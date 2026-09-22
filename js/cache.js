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
// in the background. If a write fails, a toast is shown.

window.Cache = {
  _store: {},
  _hydrated: false,

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
    this._store = await res.json();
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
    fetch(`${window.API_BASE}/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    }).catch((err) => {
      console.error("Cache.set failed for key", key, err);
      if (window.showToast)
        window.showToast("Gagal menyimpan data ke server!", "error");
    });
  },

  remove(key) {
    delete this._store[key];
    fetch(`${window.API_BASE}/state/${encodeURIComponent(key)}`, {
      method: "DELETE",
    }).catch((err) => {
      console.error("Cache.remove failed for key", key, err);
      if (window.showToast)
        window.showToast("Gagal menghapus data di server!", "error");
    });
  },
};
