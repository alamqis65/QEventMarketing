"""
EventQ Backend - Database layer (PostgreSQL, normalized tables)

The frontend still uses logical state keys (qis_users, qis_events, etc.)
and writes the full JSON payload for each key. This layer projects
normalized relational data into those shapes and imports them back in
a single transaction.
"""
import json
import re
from datetime import date, datetime, time
import psycopg2
import psycopg2.pool
from contextlib import contextmanager
from . import config

_pool = None


# ─── Connection pool ────────────────────────────────────────────────────

def init_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            host=config.DB_HOST,
            port=config.DB_PORT,
            dbname=config.DB_NAME,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
        )
    return _pool


@contextmanager
def get_conn():
    pool = init_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


# ─── Schema validation on startup ──────────────────────────────────────

def init_db():
    """Ensure all normalized tables exist (idempotent)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Read and execute the schema file if tables don't exist
            # We check for the users table as a proxy for "schema already applied"
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'users'
                );
            """)
            if not cur.fetchone()[0]:
                # First run — execute the schema
                _run_schema_file(cur)
            cur.execute("""
                ALTER TABLE events
                ALTER COLUMN event_date DROP NOT NULL
            """)
            # Profile pictures may be data URLs/base64 strings, not short URLs.
            # ALTER TABLE is intentionally idempotent for databases created with
            # an earlier schema version.
            cur.execute("""
                ALTER TABLE users
                ALTER COLUMN profile_picture_url TYPE TEXT
                USING profile_picture_url::text
            """)
            # Always run migration if eventq_kv has data
            _migrate_legacy_kv_if_needed(cur)


def _run_schema_file(cur):
    """Execute the root-level schema SQL file."""
    import os
    schema_path = os.path.join(os.path.dirname(__file__), '..', '..', 'EventQ_Database_Schema.sql')
    schema_path = os.path.normpath(schema_path)
    if os.path.exists(schema_path):
        with open(schema_path, 'r', encoding='utf-8') as f:
            cur.execute(f.read())
    else:
        raise FileNotFoundError(
            f"Schema file not found: {schema_path}\n"
            "Please place EventQ_Database_Schema.sql in the project root."
        )


def _migrate_legacy_kv_if_needed(cur):
    """
    One-time idempotent migration: if eventq_kv exists and has data,
    import it into the normalized tables, then mark migration done
    via a special settings key.
    """
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'eventq_kv'
        );
    """)
    if not cur.fetchone()[0]:
        return

    # Check if migration already completed
    cur.execute("SELECT setting_value FROM app_settings WHERE setting_key = '_legacy_migrated'")
    if cur.fetchone():
        return

    cur.execute("SELECT count(*) FROM eventq_kv")
    if cur.fetchone()[0] == 0:
        cur.execute(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('_legacy_migrated', 'true') "
            "ON CONFLICT (setting_key) DO NOTHING"
        )
        return

    # Load all KV data
    cur.execute("SELECT key, value FROM eventq_kv")
    kv_rows = cur.fetchall()
    kv = {k: v for k, v in kv_rows}

    # Import users (field mapping: name→full_name, password→password_hash, profilePic→profile_picture_url)
    _migrate_users(cur, kv)
    # Import events + custom fields + shared access
    _migrate_events(cur, kv)
    # Import guests + custom field values
    _migrate_guests(cur, kv)
    # Import custom QR codes
    _migrate_custom_qrs(cur, kv)
    # Import custom barcodes
    _migrate_custom_barcodes(cur, kv)
    # Import login backgrounds
    _migrate_login_bg(cur, kv)
    # Import settings
    _migrate_settings(cur, kv)

    # Mark migration done
    cur.execute(
        "INSERT INTO app_settings (setting_key, setting_value) VALUES ('_legacy_migrated', 'true') "
        "ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'true'"
    )


# ─── Legacy migration helpers ──────────────────────────────────────────

def _safe_json(text, default=None):
    if not text:
        return default
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return default


def _migrate_users(cur, kv):
    users_raw = kv.get('qis_users')
    users = _safe_json(users_raw, [])
    if not users:
        return
    for u in users:
        cur.execute("""
            INSERT INTO users (username, password_hash, full_name, role, is_super_admin, profile_picture_url)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (username) DO NOTHING
        """, (
            u.get('username', ''),
            u.get('password', u.get('password_hash', '')),
            u.get('name', u.get('full_name', '')),
            u.get('role', 'public'),
            u.get('isSuperAdmin', u.get('is_super_admin', False)),
            u.get('profilePic', u.get('profile_picture_url')),
        ))


def _empty_to_none(value):
    """Return NULL for empty or non-date legacy clock strings."""
    if value is None or value == '':
        return None
    if isinstance(value, (datetime, date)):
        return value
    text = str(value).strip()
    # Legacy attendance stores display-only values such as 15.21.32.
    if re.fullmatch(r'\d{1,2}[.:]\d{2}[.:]\d{2}', text):
        return None
    try:
        return datetime.fromisoformat(text.replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None


def _resolve_user_id(cur, value, default=None):
    """Resolve a legacy username or numeric user id to users.id."""
    if value is None or value == '':
        return default
    try:
        numeric_id = int(value)
    except (TypeError, ValueError):
        numeric_id = None
    if numeric_id is not None:
        cur.execute("SELECT id FROM users WHERE id = %s", (numeric_id,))
    else:
        cur.execute("SELECT id FROM users WHERE username = %s", (str(value),))
    row = cur.fetchone()
    return row[0] if row else default


def _migrate_events(cur, kv):
    events_raw = kv.get('qis_events')
    events = _safe_json(events_raw, [])
    if not events:
        return
    # We need at least one user for owner_user_id
    cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
    row = cur.fetchone()
    default_owner = row[0] if row else 1

    for e in events:
        custom_fields = e.get('customNumberFields', [])
        access_list = e.get('accessList', [])
        hidden_cols = e.get('hiddenColumns')

        cur.execute("""
            INSERT INTO events (id, name, event_type, event_type_detail, event_date,
                logo_url, needs_seat, seat_label_type, needs_hotel, needs_key_signature,
                hidden_columns, owner_user_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (
            e.get('id', ''),
            e.get('name', ''),
            e.get('type', e.get('event_type', 'Rumah Sakit')),
            e.get('eventTypeDetail', e.get('event_type_detail')),
            _empty_to_none(e.get('date', e.get('event_date'))),
            e.get('logo', e.get('logo_url')),
            e.get('needsSeat', e.get('needs_seat', True)),
            e.get('seatLabelType', e.get('seat_label_type', 'kursi')),
            e.get('needsHotel', e.get('needs_hotel', False)),
            e.get('needsKeySignature', e.get('needs_key_signature', False)),
            json.dumps(hidden_cols) if hidden_cols else None,
            _resolve_user_id(cur, e.get('ownerUserId', e.get('owner_user_id')), default_owner),
        ))

        for cf in custom_fields:
            cf_id = cf.get('id', '')
            if cf_id:
                cur.execute("""
                    INSERT INTO event_custom_fields (id, event_id, label, sort_order)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (cf_id, e.get('id'), cf.get('label', ''), cf.get('sortOrder', 0)))

        for uid in access_list:
            cur.execute("""
                INSERT INTO event_shared_access (event_id, user_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (e.get('id'), _resolve_user_id(cur, uid)))


def _normalize_custom_numbers(raw):
    """Accept both shapes used by the app and return a list of (field_id, value):
    - frontend object map: {"field1": "ABC", ...}   (current js/guests.js form)
    - legacy list records:  [{"id"|"fieldId": ..., "value": ...}, ...]
    """
    if isinstance(raw, dict):
        return [(str(k), v) for k, v in raw.items() if k and v is not None]
    if isinstance(raw, list):
        pairs = []
        for cn in raw:
            if isinstance(cn, dict):
                fid = cn.get('fieldId', cn.get('id', ''))
                if fid:
                    pairs.append((str(fid), cn.get('value')))
        return pairs
    return []


def _migrate_guests(cur, kv):
    events_raw = kv.get('qis_events')
    events = _safe_json(events_raw, [])
    for e in events:
        eid = e.get('id', '')
        guests_key = f'qis_guests_{eid}'
        guests_raw = kv.get(guests_key)
        guests = _safe_json(guests_raw, [])
        if not guests:
            continue

        event_type = e.get('type', e.get('event_type', 'Rumah Sakit'))
        for g in guests:
            # Map old field names → new schema
            cur.execute("""
                INSERT INTO guests (guest_code, event_id, full_name, institution_origin,
                    position, seat_number, room_number, key_picked_up, key_picked_up_by,
                    key_signature_url, pickup_scanned, pickup_scan_time,
                    attendance_scanned, attendance_scan_time)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (event_id, guest_code) DO NOTHING
            """, (
                g.get('id', ''),
                eid,
                g.get('nama', g.get('full_name', '')),
                g.get('rs', g.get('institution_origin', '')),
                g.get('jabatan', g.get('position')),
                g.get('kursi', g.get('seat_number')),
                g.get('kamar', g.get('room_number')),
                g.get('kunciDiambil', g.get('key_picked_up', False)),
                g.get('keyPickedUpBy', g.get('key_picked_up_by')),
                g.get('keySignatureUrl', g.get('key_signature_url')),
                g.get('pickupScanned', g.get('pickup_scanned', False)),
                _empty_to_none(g.get('pickupScanTime', g.get('pickup_scan_time'))),
                g.get('scanned', g.get('attendance_scanned', False)),
                _empty_to_none(g.get('scanTime', g.get('attendance_scan_time'))),
            ))

            # Custom field values
            custom_pairs = _normalize_custom_numbers(g.get('customNumbers'))
            if not custom_pairs:
                continue
            # Look up the guest_id from the DB
            cur.execute(
                "SELECT id FROM guests WHERE event_id = %s AND guest_code = %s",
                (eid, g.get('id', ''))
            )
            guest_row = cur.fetchone()
            if not guest_row:
                continue
            guest_db_id = guest_row[0]

            for cf_id, cf_value in custom_pairs:
                cur.execute("""
                    INSERT INTO guest_custom_field_values (guest_id, event_custom_field_id, value)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (guest_id, event_custom_field_id) DO NOTHING
                """, (guest_db_id, cf_id, cf_value))


def _migrate_custom_qrs(cur, kv):
    raw = kv.get('qis_custom_qrs')
    items = _safe_json(raw, [])
    for item in items:
        cur.execute("""
            INSERT INTO custom_qr_codes (id, name, content)
            VALUES (%s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (item.get('id', ''), item.get('name', ''), item.get('content', '')))


def _migrate_custom_barcodes(cur, kv):
    raw = kv.get('qis_custom_barcodes')
    items = _safe_json(raw, [])
    for item in items:
        cur.execute("""
            INSERT INTO custom_barcodes (id, name, content)
            VALUES (%s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (item.get('id', ''), item.get('name', ''), item.get('content', '')))


def _migrate_login_bg(cur, kv):
    # Legacy single background
    raw_single = kv.get('qis_setting_bg_login')
    # New slideshow list
    raw_list = kv.get('qis_setting_bg_login_list')
    list_data = _safe_json(raw_list, [])
    if raw_single and not list_data:
        list_data = [raw_single]

    for i, url in enumerate(list_data):
        cur.execute("""
            INSERT INTO login_bg_images (image_url, sort_order)
            VALUES (%s, %s)
        """, (url, i))


def _migrate_settings(cur, kv):
    setting_keys = [
        'app_logo', 'auth_caption', 'dark_mode',
        'kiosk_audio_enabled', 'kiosk_exit_pin', 'kiosk_pickup_signature',
        'kiosk_reset_duration', 'kiosk_tts_enabled', 'kiosk_tts_lang',
        'library_filter_category', 'library_sort_mode', 'library_view_mode',
        'print_qr_fields', 'print_custom_qr_fields', 'print_custom_barcode_fields',
        'app_lang',
    ]
    for key in setting_keys:
        # old format: qis_setting_<key> → new format: setting_key directly
        val = kv.get(f'qis_setting_{key}')
        if val is not None:
            cur.execute("""
                INSERT INTO app_settings (setting_key, setting_value)
                VALUES (%s, %s)
                ON CONFLICT (setting_key) DO NOTHING
            """, (key, val))


# ─── State projection (normalized → frontend shape) ─────────────────────

def state_get_all():
    """Return the full application state projected into the legacy frontend shape."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            result = {}
            # Users
            cur.execute("""
                SELECT username, password_hash, full_name, role, is_super_admin, profile_picture_url, id
                FROM users ORDER BY id
            """)
            users = []
            for row in cur.fetchall():
                u = {
                    'username': row[0],
                    'password': row[1],  # kept for compatibility; no plaintext passwords in new UI
                    'name': row[2],
                    'role': row[3],
                    'isSuperAdmin': row[4],
                    'profilePic': row[5],
                    '_dbId': row[6],  # internal, for permission mapping
                }
                # Load permissions for this user
                cur.execute(
                    "SELECT feature_key, is_enabled FROM user_feature_permissions WHERE user_id = %s",
                    (row[6],)
                )
                perms = {r[0]: r[1] for r in cur.fetchall()}
                if perms:
                    u['permissions'] = perms
                users.append(u)
            result['qis_users'] = json.dumps(users)

            # Events + custom fields + shared access
            cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
            default_owner = cur.fetchone()
            default_owner_id = default_owner[0] if default_owner else 1

            cur.execute("""
                SELECT id, name, event_type, event_type_detail, event_date, logo_url,
                       needs_seat, seat_label_type, needs_hotel, needs_key_signature,
                       hidden_columns, owner_user_id
                FROM events ORDER BY created_at
            """)
            events = []
            for row in cur.fetchall():
                eid = row[0]
                e = {
                    'id': eid,
                    'name': row[1],
                    'type': row[2],
                    'eventTypeDetail': row[3],
                    'date': row[4].isoformat() if row[4] else None,
                    'logo': row[5],
                    'needsSeat': row[6],
                    'seatLabelType': row[7],
                    'needsHotel': row[8],
                    'needsKeySignature': row[9],
                    # psycopg2 already deserializes JSONB; only parse if a string slips through
                    'hiddenColumns': _safe_json(row[10], None) if isinstance(row[10], str) else row[10],
                    'ownerUserId': row[11],
                }
                # Custom fields
                cur.execute(
                    "SELECT id, label, sort_order FROM event_custom_fields WHERE event_id = %s ORDER BY sort_order",
                    (eid,)
                )
                e['customNumberFields'] = [
                    {'id': r[0], 'label': r[1], 'sortOrder': r[2]}
                    for r in cur.fetchall()
                ]
                # Shared access
                cur.execute(
                    "SELECT user_id FROM event_shared_access WHERE event_id = %s",
                    (eid,)
                )
                e['accessList'] = [r[0] for r in cur.fetchall()]

                events.append(e)
                # Guests for this event
                cur.execute("""
                    SELECT guest_code, full_name, institution_origin, position,
                           seat_number, room_number, key_picked_up, key_picked_up_by,
                           key_signature_url, pickup_scanned, pickup_scan_time,
                           attendance_scanned, attendance_scan_time
                    FROM guests WHERE event_id = %s
                """, (eid,))
                guests = []
                for g in cur.fetchall():
                    guest = {
                        'id': g[0],
                        'nama': g[1],
                        'rs': g[2],
                        'jabatan': g[3],
                        'kursi': g[4],
                        'kamar': g[5],
                        'kunciDiambil': g[6],
                        'keyPickedUpBy': g[7],
                        'keySignatureUrl': g[8],
                        'pickupScanned': g[9],
                        'pickupScanTime': g[10].isoformat() if g[10] else None,
                        'scanned': g[11],
                        'scanTime': g[12].isoformat() if g[12] else None,
                    }
                    # Guest custom field values
                    cur.execute("""
                        SELECT gcfv.event_custom_field_id, gcfv.value
                        FROM guest_custom_field_values gcfv
                        WHERE gcfv.guest_id = (
                            SELECT id FROM guests
                            WHERE event_id = %s AND guest_code = %s LIMIT 1
                        )
                    """, (eid, g[0]))
                    # Frontend expects customNumbers as an object map {fieldId: value}
                    guest['customNumbers'] = {r[0]: r[1] for r in cur.fetchall()}
                    guests.append(guest)
                result[f'qis_guests_{eid}'] = json.dumps(guests)

            result['qis_events'] = json.dumps(events)

            # Custom QR codes
            cur.execute("SELECT id, name, content FROM custom_qr_codes ORDER BY created_at")
            result['qis_custom_qrs'] = json.dumps([
                {'id': r[0], 'name': r[1], 'content': r[2]} for r in cur.fetchall()
            ])

            # Custom barcodes
            cur.execute("SELECT id, name, content FROM custom_barcodes ORDER BY created_at")
            result['qis_custom_barcodes'] = json.dumps([
                {'id': r[0], 'name': r[1], 'content': r[2]} for r in cur.fetchall()
            ])

            # Login backgrounds
            cur.execute("SELECT image_url FROM login_bg_images ORDER BY sort_order")
            bg_list = [r[0] for r in cur.fetchall()]
            if bg_list:
                result['qis_setting_bg_login_list'] = json.dumps(bg_list)

            # App settings
            cur.execute("SELECT setting_key, setting_value FROM app_settings WHERE setting_key != '_legacy_migrated'")
            for key, val in cur.fetchall():
                result[f'qis_setting_{key}'] = val

    return result


# ─── State mutation (frontend shape → normalized) ────────────────────────

def state_set(key, value):
    """Import a full JSON payload for a logical state key."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            if key == 'qis_users':
                _import_users(cur, value)
            elif key == 'qis_events':
                _import_events(cur, value)
            elif key.startswith('qis_guests_'):
                event_id = key[len('qis_guests_'):]
                _import_guests(cur, event_id, value)
            elif key == 'qis_custom_qrs':
                _import_simple_list(cur, 'custom_qr_codes', value)
            elif key == 'qis_custom_barcodes':
                _import_simple_list(cur, 'custom_barcodes', value)
            elif key == 'qis_setting_bg_login_list':
                _import_login_bg(cur, value)
            elif key.startswith('qis_setting_'):
                setting_key = key[len('qis_setting_'):]
                _import_setting(cur, setting_key, value)
            else:
                raise ValueError(f"Unknown state key: {key}")


def state_delete(key):
    """Remove data for a logical state key."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            if key == 'qis_custom_qrs':
                cur.execute("DELETE FROM custom_qr_codes")
            elif key == 'qis_custom_barcodes':
                cur.execute("DELETE FROM custom_barcodes")
            elif key == 'qis_setting_bg_login_list':
                cur.execute("DELETE FROM login_bg_images")
            elif key.startswith('qis_setting_'):
                setting_key = key[len('qis_setting_'):]
                cur.execute("DELETE FROM app_settings WHERE setting_key = %s", (setting_key,))
            elif key.startswith('qis_guests_'):
                event_id = key[len('qis_guests_'):]
                cur.execute("DELETE FROM guests WHERE event_id = %s", (event_id,))
            else:
                raise ValueError(f"Cannot delete state key: {key}")


# ─── Import helpers (one transaction per call) ──────────────────────────

def _import_users(cur, value):
    users = _safe_json(value, []) if isinstance(value, str) else value
    if not isinstance(users, list):
        return
    # Track which usernames we're keeping
    seen_usernames = set()
    for u in users:
        username = u.get('username', '')
        if not username:
            continue
        seen_usernames.add(username)
        password_hash = u.get('password', u.get('password_hash', ''))
        full_name = u.get('name', u.get('full_name', ''))
        role = u.get('role', 'public')
        is_super = u.get('isSuperAdmin', u.get('is_super_admin', False))
        profile_url = u.get('profilePic', u.get('profile_picture_url'))

        cur.execute("""
            INSERT INTO users (username, password_hash, full_name, role, is_super_admin, profile_picture_url)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                is_super_admin = EXCLUDED.is_super_admin,
                profile_picture_url = EXCLUDED.profile_picture_url
        """, (username, password_hash, full_name, role, is_super, profile_url))

        # Get the user's db ID for permissions
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        user_id = cur.fetchone()[0]

        # Permissions
        permissions = u.get('permissions', {})
        if permissions:
            cur.execute("DELETE FROM user_feature_permissions WHERE user_id = %s", (user_id,))
            for feat_key, is_enabled in permissions.items():
                cur.execute(
                    "INSERT INTO user_feature_permissions (user_id, feature_key, is_enabled) VALUES (%s, %s, %s)",
                    (user_id, feat_key, is_enabled)
                )

    # The frontend sends the complete user list. Remove database users that are
    # no longer present, otherwise a deleted user reappears on the next hydrate.
    if seen_usernames:
        placeholders = ','.join(['%s'] * len(seen_usernames))
        cur.execute(f"""
            SELECT id, username FROM users
            WHERE username NOT IN ({placeholders}) AND is_super_admin = FALSE
        """, list(seen_usernames))
        removed = cur.fetchall()
        if removed:
            removed_ids = [row[0] for row in removed]
            # Preserve events when their owner account is removed by assigning
            # them to an existing remaining user before deleting the account.
            cur.execute(
                "SELECT id FROM users WHERE username IN (" + placeholders + ") ORDER BY id LIMIT 1",
                list(seen_usernames)
            )
            fallback = cur.fetchone()
            if fallback:
                for removed_id in removed_ids:
                    cur.execute("UPDATE events SET owner_user_id = %s WHERE owner_user_id = %s", (fallback[0], removed_id))
            cur.execute(f"DELETE FROM users WHERE id IN ({','.join(['%s'] * len(removed_ids))})", removed_ids)
    elif users:
        # Do not interpret an invalid/empty payload as a request to delete all users.
        return


def _import_events(cur, value):
    events = _safe_json(value, []) if isinstance(value, str) else value
    if not isinstance(events, list):
        return
    # Get default owner
    cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
    row = cur.fetchone()
    default_owner = row[0] if row else 1

    seen_ids = set()
    for e in events:
        eid = e.get('id', '')
        if not eid:
            continue
        seen_ids.add(eid)
        hidden_cols = e.get('hiddenColumns')

        cur.execute("""
            INSERT INTO events (id, name, event_type, event_type_detail, event_date,
                logo_url, needs_seat, seat_label_type, needs_hotel, needs_key_signature,
                hidden_columns, owner_user_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                event_type = EXCLUDED.event_type,
                event_type_detail = EXCLUDED.event_type_detail,
                event_date = EXCLUDED.event_date,
                logo_url = EXCLUDED.logo_url,
                needs_seat = EXCLUDED.needs_seat,
                seat_label_type = EXCLUDED.seat_label_type,
                needs_hotel = EXCLUDED.needs_hotel,
                needs_key_signature = EXCLUDED.needs_key_signature,
                hidden_columns = EXCLUDED.hidden_columns
        """, (
            eid,
            e.get('name', ''),
            e.get('type', e.get('event_type', 'Rumah Sakit')),
            e.get('eventTypeDetail', e.get('event_type_detail')),
            _empty_to_none(e.get('date', e.get('event_date'))),
            e.get('logo', e.get('logo_url')),
            e.get('needsSeat', e.get('needs_seat', True)),
            e.get('seatLabelType', e.get('seat_label_type', 'kursi')),
            e.get('needsHotel', e.get('needs_hotel', False)),
            e.get('needsKeySignature', e.get('needs_key_signature', False)),
            json.dumps(hidden_cols) if hidden_cols else None,
            _resolve_user_id(cur, e.get('ownerUserId', e.get('owner_user_id')), default_owner),
        ))

        # Custom fields: delete existing and re-insert
        cur.execute("DELETE FROM event_custom_fields WHERE event_id = %s", (eid,))
        for cf in e.get('customNumberFields', []):
            cf_id = cf.get('id', '')
            if cf_id:
                cur.execute(
                    "INSERT INTO event_custom_fields (id, event_id, label, sort_order) VALUES (%s, %s, %s, %s)",
                    (cf_id, eid, cf.get('label', ''), cf.get('sortOrder', 0))
                )

        # Shared access
        cur.execute("DELETE FROM event_shared_access WHERE event_id = %s", (eid,))
        for uid in e.get('accessList', []):
            cur.execute(
                "INSERT INTO event_shared_access (event_id, user_id) VALUES (%s, %s)",
                (eid, _resolve_user_id(cur, uid))
            )

    # Remove events not in the new list
    if seen_ids:
        placeholders = ','.join(['%s'] * len(seen_ids))
        cur.execute(f"DELETE FROM events WHERE id NOT IN ({placeholders})", list(seen_ids))
    else:
        cur.execute("DELETE FROM events")


def _import_guests(cur, event_id, value):
    guests = _safe_json(value, []) if isinstance(value, str) else value
    if not isinstance(guests, list):
        return
    seen_codes = set()
    for g in guests:
        code = g.get('id', '')
        if not code:
            continue
        seen_codes.add(code)
        cur.execute("""
            INSERT INTO guests (guest_code, event_id, full_name, institution_origin,
                position, seat_number, room_number, key_picked_up, key_picked_up_by,
                key_signature_url, pickup_scanned, pickup_scan_time,
                attendance_scanned, attendance_scan_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (event_id, guest_code) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                institution_origin = EXCLUDED.institution_origin,
                position = EXCLUDED.position,
                seat_number = EXCLUDED.seat_number,
                room_number = EXCLUDED.room_number,
                key_picked_up = EXCLUDED.key_picked_up,
                key_picked_up_by = EXCLUDED.key_picked_up_by,
                key_signature_url = EXCLUDED.key_signature_url,
                pickup_scanned = EXCLUDED.pickup_scanned,
                pickup_scan_time = EXCLUDED.pickup_scan_time,
                attendance_scanned = EXCLUDED.attendance_scanned,
                attendance_scan_time = EXCLUDED.attendance_scan_time
        """, (
            code, event_id,
            g.get('nama', g.get('full_name', '')),
            g.get('rs', g.get('institution_origin', '')),
            g.get('jabatan', g.get('position')),
            g.get('kursi', g.get('seat_number')),
            g.get('kamar', g.get('room_number')),
            g.get('kunciDiambil', g.get('key_picked_up', False)),
            g.get('keyPickedUpBy', g.get('key_picked_up_by')),
            g.get('keySignatureUrl', g.get('key_signature_url')),
            g.get('pickupScanned', g.get('pickup_scanned', False)),
            _empty_to_none(g.get('pickupScanTime', g.get('pickup_scan_time'))),
            g.get('scanned', g.get('attendance_scanned', False)),
            _empty_to_none(g.get('scanTime', g.get('attendance_scan_time'))),
        ))

        # Custom field values
        cur.execute("SELECT id FROM guests WHERE event_id = %s AND guest_code = %s LIMIT 1", (event_id, code))
        g_row = cur.fetchone()
        if g_row:
            guest_db_id = g_row[0]
            cur.execute("DELETE FROM guest_custom_field_values WHERE guest_id = %s", (guest_db_id,))
            for cf_id, cf_value in _normalize_custom_numbers(g.get('customNumbers')):
                cur.execute(
                    "INSERT INTO guest_custom_field_values (guest_id, event_custom_field_id, value) VALUES (%s, %s, %s)",
                    (guest_db_id, cf_id, cf_value)
                )

    # Remove guests not in the new list
    if seen_codes:
        placeholders = ','.join(['%s'] * len(seen_codes))
        cur.execute(
            f"DELETE FROM guests WHERE event_id = %s AND guest_code NOT IN ({placeholders})",
            [event_id] + list(seen_codes)
        )
    else:
        cur.execute("DELETE FROM guests WHERE event_id = %s", (event_id,))


def _import_simple_list(cur, table, value):
    items = _safe_json(value, []) if isinstance(value, str) else value
    if not isinstance(items, list):
        return
    cur.execute(f"DELETE FROM {table}")
    for item in items:
        cur.execute(
            f"INSERT INTO {table} (id, name, content) VALUES (%s, %s, %s)",
            (item.get('id', ''), item.get('name', ''), item.get('content', ''))
        )


def _import_login_bg(cur, value):
    items = _safe_json(value, []) if isinstance(value, str) else value
    if not isinstance(items, list):
        return
    cur.execute("DELETE FROM login_bg_images")
    for i, url in enumerate(items):
        cur.execute(
            "INSERT INTO login_bg_images (image_url, sort_order) VALUES (%s, %s)",
            (url, i)
        )


def _import_setting(cur, setting_key, value):
    cur.execute("""
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES (%s, %s)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
    """, (setting_key, value if value is not None else None))
