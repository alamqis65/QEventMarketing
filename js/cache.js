// EventQ - Cache layer
//
// Replaces the browser's localStorage with a synchronous-feeling,
// network-backed store. The whole dataset is fetched once at startup
// (Cache.hydrate) into an in-memory object, so every LS.getX() call
// stays perfectly synchronous — only the underlying storage engine
// changed from localStorage to Postgres via the logical state API.
//
// Writes (Cache.set / Cache.remove) update the in-memory copy
// immediately (so the UI reacts instantly) and persist to the backend
// through a per-key queue: one in-flight request per key, newest value
// always wins, non-2xx responses are treated as failures, transient
// failures are retried, and everything that cannot be saved stays
// visible in the save indicator (with a beforeunload warning) instead
// of failing silently.

window.Cache = {
  _store: {},
  _hydrated: false,

  // ── Write queue ────────────────────────────────────────────────────
  // _pending : key -> { op:'put'|'del', value, confirm }  (latest intent)
  // _sending : Set of keys with a request in flight
  // _failed  : key -> job + { status, detail, message }   (needs attention)
  _pending: new Map(),
  _sending: new Set(),
  _failed: new Map(),
  _confirmQueue: [],
  _confirmOpen: false,
  _savedTimer: null,
  _savedUntil: 0,
  _unloadBound: false,

  // Retry budget: 1 initial attempt + 3 retries, progressive backoff.
  _RETRY_DELAYS: [400, 1200, 3000],

  async checkConnection() {
    const url = `${window.API_BASE}/health`;
    console.groupCollapsed(
      "%c[EventQ] Backend connection check",
      "color:#4f46e5;font-weight:bold;"
    );
    console.log("API_BASE:", window.API_BASE);
    console.log("Pinging:", url);
    const started = performance.now();
    try {
      const res = await fetch(url);
      const ms = Math.round(performance.now() - started);
      if (!res.ok) {
        console.error(
          `❌ Backend responded but with an error: HTTP ${res.status} (${ms}ms)`
        );
        console.groupEnd();
        return false;
      }
      const data = await res.json();
      console.log(`✅ Backend reachable (${ms}ms) - response:`, data);
      console.groupEnd();
      return true;
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      console.error(`❌ Could not reach backend after ${ms}ms.`, err);
      console.error(
        "Common causes: backend not running, wrong host/port in js/config.js, firewall, or CORS."
      );
      console.groupEnd();
      return false;
    }
  },

  async hydrate() {
    const url = `${window.API_BASE}/state`;
    console.log(
      "%c[EventQ] Loading data from",
      "color:#4f46e5;font-weight:bold;",
      url
    );
    const started = performance.now();
    const res = await fetch(url);
    const ms = Math.round(performance.now() - started);
    if (!res.ok) {
      let errorMessage;
      try {
        const data = await res.json();
        errorMessage = data.error || JSON.stringify(data);
      } catch {
        errorMessage = await res.text();
      }
      console.error(
        `[EventQ] Failed to load data: HTTP ${res.status} (${ms}ms) message: ${errorMessage}`
      );
      throw new Error(
        `Failed to load data (HTTP ${res.status}) - ${errorMessage}`
      );
    }
    const fetched = await res.json();

    // A write can race hydration (e.g. LS.getLoginBgList migrating legacy
    // settings on first read). Snapshot the locally touched keys BEFORE
    // replacing the store, then put them back so the fetch never silently
    // discards a pending or in-flight write.
    const touched = new Set([...this._pending.keys(), ...this._sending.keys()]);
    const snap = {};
    touched.forEach((k) => {
      snap[k] = k in this._store ? { present: true, value: this._store[k] } : { present: false };
    });

    this._store = fetched;
    Object.keys(snap).forEach((k) => {
      if (snap[k].present) this._store[k] = snap[k].value;
      else delete this._store[k];
    });

    this._hydrated = true;
    console.log(
      `[EventQ] Data loaded (${ms}ms) - ${Object.keys(this._store).length} keys:`,
      Object.keys(this._store)
    );
  },

  get(key) {
    const v = this._store[key];
    return v === undefined || v === null ? null : v;
  },

  set(key, value) {
    this._store[key] = value;
    this._enqueue(key, { op: "put", value: value, confirm: false });
  },

  // Apply a value that ANOTHER tab already saved to the backend. Updates only
  // this tab's in-memory copy (no PUT), so it never echoes back to the server.
  // Skipped when this tab has its own unsaved write for the key.
  applyRemote(key, value) {
    if (this._pending.has(key) || this._sending.has(key)) return false;
    this._store[key] = value;
    return true;
  },

  remove(key) {
    delete this._store[key];
    this._enqueue(key, { op: "del", value: undefined, confirm: false });
  },

  // ── Queue internals ────────────────────────────────────────────────

  _enqueue(key, job) {
    job.key = key;
    // Newest intent wins: a queued (not yet sent) job for this key is replaced.
    this._pending.set(key, job);
    // A newer intent supersedes an older recorded failure for the same key.
    this._failed.delete(key);
    this._bindUnloadGuard();
    this._renderStatus();
    this._kick(key);
  },

  async _kick(key) {
    if (this._sending.has(key)) return; // in-flight; it re-kicks on settle
    const job = this._pending.get(key);
    if (!job) return;

    // Snapshot out of the queue so later writes replace the pending job
    // without mutating the request already in flight.
    this._pending.delete(key);
    this._sending.add(key);
    this._renderStatus();

    try {
      await this._send(job);
      this._failed.delete(key); // superseded or now persisted
      this._savedUntil = Date.now() + 2500;
    } catch (err) {
      if (err && err.status === 409 && err.detail && !job.confirm) {
        // Deliberate rejection: a large destructive change needs an explicit
        // user confirmation. Never auto-retry a 409 — resend only after "yes".
        // Record it first so it stays visible (and unload-guarded) while the
        // dialog is open.
        this._failed.set(key, Object.assign({}, job, {
          status: 409,
          detail: err.detail,
          message: err.message,
        }));
        this._bindUnloadGuard();
        this._askConfirm(key, job, err.detail);
      } else if (!this._pending.has(key)) {
        // Nothing newer overwrote this job, so the failure is still real.
        this._failed.set(key, Object.assign({}, job, {
          status: (err && err.status) || 0,
          detail: (err && err.detail) || null,
          message: (err && err.message) || String(err),
        }));
        this._bindUnloadGuard();
        console.error("[EventQ] Save failed:", key, job.op, err);
        if (typeof window.showToast === "function") {
          window.showToast(
            this._t("save_status_failed", "GAGAL") + " — " +
              ((err && err.message) || key),
            "error"
          );
        }
      }
    } finally {
      this._sending.delete(key);
      if (this._pending.has(key)) this._kick(key); // newer value arrived mid-flight
      this._renderStatus();
    }
  },

  async _send(job) {
    const url = `${window.API_BASE}/state/${encodeURIComponent(job.key)}`;
    const attempts = this._RETRY_DELAYS.length + 1;
    let lastErr = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, this._RETRY_DELAYS[attempt - 1]));
      }
      try {
        const opts =
          job.op === "put"
            ? {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                  job.confirm ? { value: job.value, confirm: true } : { value: job.value }
                ),
              }
            : { method: "DELETE" };

        const res = await fetch(url, opts);
        if (res.ok) return;

        // Read the body once (stream is single-use) and keep the server detail.
        // The backend may answer with FastAPI's {"detail": ...} envelope or
        // (for 400/409) a flat {"saved": false, "message": ..., counts...}.
        let payload = null;
        try {
          payload = await res.json();
        } catch {
          /* non-JSON error body */
        }
        let message = `HTTP ${res.status}`;
        if (payload && typeof payload === "object") {
          const cand =
            payload.detail !== undefined
              ? payload.detail
              : payload.error !== undefined
                ? payload.error
                : payload.message;
          if (typeof cand === "string" && cand) {
            message = cand;
          } else if (cand && typeof cand === "object") {
            message = cand.message || JSON.stringify(cand);
          } else {
            message = JSON.stringify(payload);
          }
        } else if (typeof payload === "string" && payload) {
          message = payload;
        }

        const err = new Error(message);
        err.status = res.status;
        err.detail = payload && typeof payload === "object" ? payload : null;
        lastErr = err;

        // 400/409 (and other 4xx) are deliberate rejections — retrying them
        // would hammer the server and, for 409, bypass a confirmation the
        // user has not given. Only transient statuses are retried.
        const transient =
          res.status === 408 || res.status === 429 || res.status >= 500;
        if (!transient || attempt === attempts - 1) throw err;
      } catch (err) {
        // HTTP errors were already classified above; rethrow as-is so they are
        // never mistaken for network errors and retried.
        if (err && err.status !== undefined) throw err;
        lastErr = err; // network / CORS / JSON.stringify failure
        if (attempt === attempts - 1) throw err;
      }
    }
    throw lastErr || new Error("Save failed");
  },

  // ── 409 confirmation flow (one dialog at a time) ───────────────────

  _askConfirm(key, job, detail) {
    // One queued confirmation per key — a newer attempt supersedes the old one.
    this._confirmQueue = this._confirmQueue.filter((i) => i.key !== key);
    this._confirmQueue.push({ key: key, job: job, detail: detail });
    this._drainConfirmQueue();
  },

  _drainConfirmQueue() {
    if (this._confirmOpen || !this._confirmQueue.length) return;
    const item = this._confirmQueue[0];
    // Superseded by a newer write while waiting — drop it silently.
    const current = this._failed.get(item.key);
    if (!current || current.status !== 409) {
      this._confirmQueue.shift();
      this._drainConfirmQueue();
      return;
    }
    if (typeof window.openConfirmCustom !== "function") {
      // ui.js has not loaded yet — retry shortly.
      setTimeout(() => this._drainConfirmQueue(), 250);
      return;
    }
    this._confirmQueue.shift();
    this._confirmOpen = true;
    const d = item.detail || {};
    const pct = d.ratio !== undefined ? d.ratio : null;
    const title = this._t(
      "save_confirm_del_title",
      "Konfirmasi Penghapusan Besar"
    );
    let sub = this._t(
      "save_confirm_del_sub",
      "Server menolak: {n} dari {t} data ({p}%) akan terhapus. Lanjutkan?"
    );
    sub = sub
      .replace("{n}", d.removed !== undefined ? d.removed : "?")
      .replace("{t}", d.existing !== undefined ? d.existing : d.total !== undefined ? d.total : "?")
      .replace("{p}", pct !== null ? pct : "?");
    if (d.message) sub = d.message;

    window.openConfirmCustom(
      title,
      sub,
      () => {
        this._confirmOpen = false;
        // Only resend if no newer edit superseded this failure in the
        // meantime (a newer write clears the _failed entry).
        const current = this._failed.get(item.key);
        if (current) {
          this._enqueue(item.key, {
            key: item.key,
            op: current.op,
            value: current.value,
            confirm: true,
          });
        }
        this._drainConfirmQueue();
      },
      () => {
        this._confirmOpen = false;
        // Declined: keep it visible as a failed, retryable write — unless a
        // newer edit already replaced it.
        if (this._failed.has(item.key)) {
          this._failed.set(item.key, Object.assign({}, this._failed.get(item.key), {
            status: 409,
            detail: item.detail,
            message: (item.detail && item.detail.message) || "Ditolak",
          }));
        }
        this._renderStatus();
        this._drainConfirmQueue();
      }
    );
  },

  async _retryFailed() {
    if (this._confirmOpen) return; // a confirmation dialog is already open
    const jobs = [...this._failed.entries()];
    if (!jobs.length) return;
    for (const [key, job] of jobs) {
      if (job.status === 409 && job.detail && !job.confirm) {
        this._askConfirm(key, job, job.detail); // opens one dialog; rest queue
        return;
      }
      this._failed.delete(key);
      this._enqueue(key, {
        key: key,
        op: job.op,
        value: job.value,
        confirm: !!job.confirm,
      });
    }
  },

  // ── Save indicator ─────────────────────────────────────────────────

  _t(key, fallback) {
    // window.t returns the key itself when missing — treat that as "no entry".
    if (typeof window.t !== "function") return fallback;
    const v = window.t(key);
    return v === key ? fallback : v;
  },

  _ensureStatusEl() {
    let el = document.getElementById("save-status");
    if (el) return el;
    // Markup can be missing without ever throwing.
    el = document.createElement("button");
    el.type = "button";
    el.id = "save-status";
    el.className = "save-status hidden fixed bottom-6 left-6 z-[90] items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg transition-colors cursor-pointer";
    document.body.appendChild(el);
    return el;
  },

  _renderStatus() {
    if (typeof document === "undefined" || !document.body) return;
    const el = this._ensureStatusEl();
    let icon = document.getElementById("save-status-icon");
    let text = document.getElementById("save-status-text");
    if (!icon || !text) {
      el.innerHTML =
        '<i id="save-status-icon" class="fa-solid"></i><span id="save-status-text"></span>';
      icon = document.getElementById("save-status-icon");
      text = document.getElementById("save-status-text");
    }
    if (!el.dataset.bound) {
      el.dataset.bound = "1";
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
      el.addEventListener("click", () => this._retryFailed());
    }

    const base =
      "save-status fixed bottom-6 left-6 z-[90] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium transition-colors cursor-pointer";
    const hidden = () => {
      el.className = base.replace("flex ", "") + " hidden";
      el.setAttribute("aria-hidden", "true");
    };
    clearTimeout(this._savedTimer);

    if (this._pending.size || this._sending.size) {
      el.className = base + " bg-indigo-600 border-indigo-500 text-white";
      el.removeAttribute("aria-hidden");
      icon.className = "fa-solid fa-spinner fa-spin";
      text.innerText = this._t("save_status_saving", "Menyimpan…");
      el.setAttribute("aria-label", this._t("save_status_saving", "Menyimpan…"));
      return;
    }

    if (this._failed.size) {
      el.className = base + " bg-red-600 border-red-500 text-white";
      el.removeAttribute("aria-hidden");
      icon.className = "fa-solid fa-circle-exclamation";
      text.innerText =
        this._t("save_status_failed", "GAGAL") +
        " — " +
        this._t("save_status_retry", "klik untuk mencoba lagi");
      el.setAttribute("aria-label", this._t("save_status_retry", "klik untuk mencoba lagi"));
      return;
    }

    if (Date.now() < this._savedUntil) {
      el.className = base + " bg-emerald-600 border-emerald-500 text-white";
      el.removeAttribute("aria-hidden");
      icon.className = "fa-solid fa-circle-check";
      text.innerText = this._t("save_status_saved", "Tersimpan");
      this._savedTimer = setTimeout(() => hidden(), 2500);
      return;
    }

    hidden();
  },

  // ── Unload guard ───────────────────────────────────────────────────

  _bindUnloadGuard() {
    if (this._unloadBound) return;
    this._unloadBound = true;
    window.addEventListener("beforeunload", (e) => {
      if (!this.hasUnsavedWrites()) return;
      // Something is still unsaved (pending, in flight, awaiting confirmation,
      // or failed) — the browser's native dialog is the only reliable warning.
      e.preventDefault();
      e.returnValue = "";
      return "";
    });
  },

  hasUnsavedWrites() {
    return !!(
      this._pending.size ||
      this._sending.size ||
      this._failed.size ||
      this._confirmOpen ||
      this._confirmQueue.length
    );
  },
};
