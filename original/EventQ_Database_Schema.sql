-- =====================================================================
--  EventQ - Skema Database (Backend)
--  Dialek   : MySQL 8.0+ / MariaDB 10.5+  (InnoDB, utf8mb4)
--  Dibuat   : 20 September 2026
--
--  Dokumen pendamping: EventQ_Struktur_Database.xlsx (data dictionary
--  lengkap - alasan tiap kolom, sumber data lama di localStorage, & 
--  contoh nilai ada di sana). File ini HANYA berisi kode SQL-nya.
--
--  Catatan penggunaan di database lain:
--   - PostgreSQL   : ganti AUTO_INCREMENT -> GENERATED ALWAYS AS IDENTITY,
--                    ENUM(...) -> tipe ENUM terpisah (CREATE TYPE) atau
--                    VARCHAR + CHECK, dan JSON -> JSONB.
--   - SQL Server   : ganti AUTO_INCREMENT -> IDENTITY(1,1), ENUM -> 
--                    VARCHAR + CHECK, JSON -> NVARCHAR(MAX).
--  Urutan CREATE TABLE di bawah ini SUDAH memperhatikan urutan
--  dependensi Foreign Key (tabel induk selalu dibuat lebih dulu).
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 1) users - Akun pengguna aplikasi (Admin & Public)
-- =====================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username`            VARCHAR(50)     NOT NULL COMMENT 'Username untuk login, unik di seluruh sistem',
    `password_hash`       VARCHAR(255)    NOT NULL COMMENT 'Kata sandi ter-hash (bcrypt/argon2) - JANGAN pernah simpan plain text',
    `full_name`           VARCHAR(150)    NOT NULL COMMENT 'Nama lengkap pemilik akun',
    `role`                ENUM('admin','public') NOT NULL DEFAULT 'public' COMMENT 'Peran akun',
    `is_super_admin`      BOOLEAN         NOT NULL DEFAULT FALSE COMMENT 'TRUE = Admin pertama di sistem, selalu punya akses penuh',
    `profile_picture_url` VARCHAR(500)    NULL     COMMENT 'URL/path foto profil (file terpisah, bukan base64)',
    `created_at`          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Akun pengguna aplikasi (Admin & Public)';


-- =====================================================================
-- 2) user_feature_permissions - Hak akses fitur per pengguna
--    (dinormalisasi dari users[].permissions di localStorage)
-- =====================================================================
DROP TABLE IF EXISTS `user_feature_permissions`;
CREATE TABLE `user_feature_permissions` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`      BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id',
    `feature_key`  VARCHAR(50)     NOT NULL COMMENT 'Kode fitur, mis. printSelectedQR, tabScan, kioskMode, dsb',
    `is_enabled`   BOOLEAN         NOT NULL DEFAULT TRUE COMMENT 'TRUE = pengguna diizinkan memakai fitur ini',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_user_feature` (`user_id`, `feature_key`),
    CONSTRAINT `fk_ufp_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Hak akses fitur per pengguna (menu "Kelola Akses Fitur")';


-- =====================================================================
-- 3) events - Data event/acara
-- =====================================================================
DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
    `id`                  VARCHAR(20)   NOT NULL COMMENT 'Kode event, format EVT-XXXXXXXXX (dipertahankan dari sistem lama)',
    `name`                VARCHAR(150)  NOT NULL COMMENT 'Nama event/acara',
    `event_type`          ENUM('Rumah Sakit','Internal','Lain-lain') NOT NULL DEFAULT 'Rumah Sakit',
    `event_type_detail`   VARCHAR(150)  NULL     COMMENT 'Diisi hanya jika event_type = Lain-lain',
    `event_date`          DATETIME      NOT NULL COMMENT 'Tanggal & waktu mulai acara',
    `logo_url`            VARCHAR(500)  NULL     COMMENT 'URL/path logo event (file terpisah, bukan base64)',
    `needs_seat`          BOOLEAN       NOT NULL DEFAULT TRUE  COMMENT 'TRUE = event memakai penomoran kursi/meja',
    `seat_label_type`     ENUM('kursi','meja') NOT NULL DEFAULT 'kursi',
    `needs_hotel`         BOOLEAN       NOT NULL DEFAULT FALSE COMMENT 'TRUE = event melibatkan akomodasi hotel',
    `needs_key_signature` BOOLEAN       NOT NULL DEFAULT FALSE COMMENT 'TRUE = pengambilan kunci kamar wajib tanda tangan',
    `hidden_columns`      JSON          NULL     COMMENT 'Array kolom yang disembunyikan, subset dari [rs,jabatan,kursi,kamar,kunci]',
    `owner_user_id`       BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id, pembuat event',
    `created_at`          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_events_owner` (`owner_user_id`),
    CONSTRAINT `fk_events_owner`
        FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Data event/acara';


-- =====================================================================
-- 4) event_custom_fields - Definisi Nomor Khusus/Unik tambahan per event
--    (dinormalisasi dari events[].customNumberFields)
-- =====================================================================
DROP TABLE IF EXISTS `event_custom_fields`;
CREATE TABLE `event_custom_fields` (
    `id`          VARCHAR(20)  NOT NULL COMMENT 'ID field, dipertahankan dari sistem lama (dirujuk oleh data peserta lama)',
    `event_id`    VARCHAR(20)  NOT NULL COMMENT 'FK -> events.id',
    `label`       VARCHAR(100) NOT NULL COMMENT 'Nama field yang tampil di form & tabel peserta',
    `sort_order`  INT          NOT NULL DEFAULT 0 COMMENT 'Urutan tampil relatif terhadap field lain di event yang sama',
    PRIMARY KEY (`id`),
    KEY `idx_ecf_event` (`event_id`),
    CONSTRAINT `fk_ecf_event`
        FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Definisi Nomor Khusus/Unik tambahan per event';


-- =====================================================================
-- 5) event_shared_access - Akses event yang dibagikan ke user Public
--    (dinormalisasi dari events[].accessList - relasi many-to-many)
-- =====================================================================
DROP TABLE IF EXISTS `event_shared_access`;
CREATE TABLE `event_shared_access` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `event_id`    VARCHAR(20)     NOT NULL COMMENT 'FK -> events.id',
    `user_id`     BIGINT UNSIGNED NOT NULL COMMENT 'FK -> users.id, akun Public penerima akses',
    `granted_at`  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu akses diberikan',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_event_user_access` (`event_id`, `user_id`),
    KEY `idx_esa_user` (`user_id`),
    CONSTRAINT `fk_esa_event`
        FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_esa_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Daftar user Public yang diberi akses ke sebuah event (fitur Bagikan Akses)';


-- =====================================================================
-- 6) guests - Data peserta/tamu (gabungan seluruh event, dibedakan event_id)
-- =====================================================================
DROP TABLE IF EXISTS `guests`;
CREATE TABLE `guests` (
    `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `guest_code`           VARCHAR(20)   NOT NULL COMMENT 'Kode tercetak di kartu QR, format QIS-/INT-/LNL-XXXXXXXXX',
    `event_id`             VARCHAR(20)   NOT NULL COMMENT 'FK -> events.id',
    `full_name`            VARCHAR(150)  NOT NULL COMMENT 'Nama lengkap peserta',
    `institution_origin`   VARCHAR(150)  NOT NULL COMMENT 'Asal Rumah Sakit/Instansi (label form menyesuaikan jenis event)',
    `position`             VARCHAR(100)  NULL     COMMENT 'Jabatan/posisi peserta',
    `seat_number`          VARCHAR(30)   NULL     COMMENT 'Nomor kursi/meja, "-" jika tidak dipakai',
    `room_number`          VARCHAR(30)   NULL     COMMENT 'Nomor kamar hotel, hanya relevan jika events.needs_hotel = TRUE',
    `key_picked_up`        BOOLEAN       NOT NULL DEFAULT FALSE COMMENT 'TRUE = kunci kamar sudah diambil',
    `key_picked_up_by`     VARCHAR(150)  NULL     COMMENT 'Nama pengambil kunci (bisa diwakilkan)',
    `key_signature_url`    VARCHAR(500)  NULL     COMMENT 'URL/path bukti tanda tangan (file terpisah, bukan base64)',
    `pickup_scanned`       BOOLEAN       NOT NULL DEFAULT FALSE COMMENT 'TRUE = QR Kiosk Pengambilan sudah pernah dipindai',
    `pickup_scan_time`     DATETIME      NULL,
    `attendance_scanned`   BOOLEAN       NOT NULL DEFAULT FALSE COMMENT 'Status kehadiran peserta',
    `attendance_scan_time` DATETIME      NULL,
    `created_at`           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_guest_code_per_event` (`event_id`, `guest_code`),
    KEY `idx_guests_event` (`event_id`),
    KEY `idx_guests_attendance` (`event_id`, `attendance_scanned`),
    CONSTRAINT `fk_guests_event`
        FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Data peserta/tamu per event';


-- =====================================================================
-- 7) guest_custom_field_values - Nilai Nomor Khusus/Unik tiap peserta
--    (dinormalisasi dari guests[].customNumbers)
-- =====================================================================
DROP TABLE IF EXISTS `guest_custom_field_values`;
CREATE TABLE `guest_custom_field_values` (
    `id`                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `guest_id`               BIGINT UNSIGNED NOT NULL COMMENT 'FK -> guests.id',
    `event_custom_field_id`  VARCHAR(20)     NOT NULL COMMENT 'FK -> event_custom_fields.id',
    `value`                  VARCHAR(100)    NULL COMMENT 'Nilai yang diisi untuk field kustom tsb',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_guest_field` (`guest_id`, `event_custom_field_id`),
    KEY `idx_gcfv_field` (`event_custom_field_id`),
    CONSTRAINT `fk_gcfv_guest`
        FOREIGN KEY (`guest_id`) REFERENCES `guests` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_gcfv_field`
        FOREIGN KEY (`event_custom_field_id`) REFERENCES `event_custom_fields` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Nilai Nomor Khusus/Unik tiap peserta, satu baris per field kustom';


-- =====================================================================
-- 8) custom_qr_codes - QR Code kustom (tool Custom QR Code Generator)
-- =====================================================================
DROP TABLE IF EXISTS `custom_qr_codes`;
CREATE TABLE `custom_qr_codes` (
    `id`          VARCHAR(20)  NOT NULL COMMENT 'Kode unik, format CQR-XXXXXXXXX',
    `name`        VARCHAR(150) NOT NULL COMMENT 'Nama/label QR Code',
    `content`     TEXT         NOT NULL COMMENT 'Isi/konten yang dikodekan dalam QR',
    `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='QR Code kustom dari tool Custom QR Code Generator (mandiri, tidak terkait event)';


-- =====================================================================
-- 9) custom_barcodes - Barcode kustom (tool Custom Barcode Generator)
-- =====================================================================
DROP TABLE IF EXISTS `custom_barcodes`;
CREATE TABLE `custom_barcodes` (
    `id`          VARCHAR(20)  NOT NULL COMMENT 'Kode unik, format BAR-XXXXXXXXX',
    `name`        VARCHAR(150) NOT NULL COMMENT 'Nama/label Barcode',
    `content`     TEXT         NOT NULL COMMENT 'Isi/nilai yang dikodekan dalam Barcode',
    `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Barcode kustom dari tool Custom Barcode Generator (mandiri, tidak terkait event)';


-- =====================================================================
-- 10) login_bg_images - Foto latar belakang halaman login (slideshow)
-- =====================================================================
DROP TABLE IF EXISTS `login_bg_images`;
CREATE TABLE `login_bg_images` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `image_url`   VARCHAR(500) NOT NULL COMMENT 'URL/path foto (file terpisah, bukan base64)',
    `sort_order`  INT          NOT NULL DEFAULT 0 COMMENT 'Urutan tampil dalam slideshow',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Foto latar belakang halaman login (mandiri, satu set untuk seluruh sistem)';


-- =====================================================================
-- 11) app_settings - Pengaturan aplikasi global (key-value)
-- =====================================================================
DROP TABLE IF EXISTS `app_settings`;
CREATE TABLE `app_settings` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `setting_key`   VARCHAR(60) NOT NULL COMMENT 'Nama unik pengaturan',
    `setting_value` TEXT        NULL     COMMENT 'Nilai pengaturan (teks/angka/JSON tergantung setting_key)',
    `updated_at`    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Pengaturan aplikasi global (satu baris per pengaturan, single-tenant)';

SET FOREIGN_KEY_CHECKS = 1;


-- =====================================================================
--  DATA AWAL (SEED) - OPSIONAL
--  Baris ini hanya CONTOH nilai default/kosong untuk tiap setting_key
--  yang SUDAH DIKENALI aplikasi saat ini, supaya aplikasi backend tidak
--  perlu menangani "key belum ada" saat pertama kali dijalankan.
--  Silakan sesuaikan/isi ulang nilainya sesuai kebutuhan sebenarnya,
--  atau hapus/lewati bagian ini sepenuhnya jika aplikasi backend Anda
--  sudah menangani nilai default secara terpisah di kode.
-- =====================================================================
INSERT INTO `app_settings` (`setting_key`, `setting_value`) VALUES
    ('app_logo',                    NULL),
    ('auth_caption',                NULL),
    ('dark_mode',                   'false'),
    ('kiosk_audio_enabled',         'true'),
    ('kiosk_exit_pin',              NULL),
    ('kiosk_pickup_signature',      'false'),
    ('kiosk_reset_duration',        '4'),
    ('kiosk_tts_enabled',           'true'),
    ('kiosk_tts_lang',              'id-ID'),
    ('library_filter_category',     'all'),
    ('library_sort_mode',           'newest'),
    ('library_view_mode',           'grid'),
    ('print_qr_fields',             NULL),
    ('print_custom_qr_fields',      NULL),
    ('print_custom_barcode_fields', NULL),
    ('app_lang',                    'id');

-- =====================================================================
--  Akun Super Admin awal - OPSIONAL, WAJIB DIGANTI setelah instalasi
--  Kata sandi contoh di bawah = "ubah_password_ini" (SUDAH di-hash
--  dengan bcrypt cost 12 HANYA sebagai contoh format hash yang valid -
--  JANGAN dipakai apa adanya di lingkungan produksi sungguhan).
-- =====================================================================
INSERT INTO `users` (`username`, `password_hash`, `full_name`, `role`, `is_super_admin`) VALUES
    ('superadmin', '$2b$12$KIXQb0S1qkS8i1e7oQ5Z9uH1uQmYQvXW1oGZ3qk8h1p2c9m6j7L8e', 'Super Admin', 'admin', TRUE);
