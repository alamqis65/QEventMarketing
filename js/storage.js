// EventQ - Storage layer
//
// Drop-in replacement for the original localStorage-based `LS` object.
// Same method names/shapes as before, so every other file in the app
// needs no changes at all — only what's underneath LS changed, from
// localStorage.getItem/setItem to Cache.get/set, which is backed by
// the FastAPI + Postgres normalized schema (see js/cache.js + js/config.js).

const LS = {
  getUsers: () => JSON.parse(Cache.get("qis_users") || "[]"),
  setUsers: (data) => Cache.set("qis_users", JSON.stringify(data)),
  getEvents: () => JSON.parse(Cache.get("qis_events") || "[]"),
  setEvents: (data) => Cache.set("qis_events", JSON.stringify(data)),
  getGuests: (eventId) =>
    JSON.parse(Cache.get(`qis_guests_${eventId}`) || "[]"),
  setGuests: (eventId, data) =>
    Cache.set(`qis_guests_${eventId}`, JSON.stringify(data)),
  removeGuests: (eventId) => Cache.remove(`qis_guests_${eventId}`),
  getSetting: (key) => Cache.get(`qis_setting_${key}`),
  setSetting: (key, val) => Cache.set(`qis_setting_${key}`, val),
  removeSetting: (key) => Cache.remove(`qis_setting_${key}`),
  getCustomQRs: () => JSON.parse(Cache.get("qis_custom_qrs") || "[]"),
  setCustomQRs: (data) => Cache.set("qis_custom_qrs", JSON.stringify(data)),
  getCustomBarcodes: () => JSON.parse(Cache.get("qis_custom_barcodes") || "[]"),
  setCustomBarcodes: (data) =>
    Cache.set(`qis_custom_barcodes`, JSON.stringify(data)),
  getLoginBgList: () => {
    const raw = Cache.get('qis_setting_bg_login_list');
    if (raw) {
      try { return JSON.parse(raw); } catch { return []; }
    }
    // Migrasi otomatis dari pengaturan lama (satu foto background)
    const legacy = Cache.get('qis_setting_bg_login');
    if (legacy) {
      const list = [legacy];
      LS.setLoginBgList(list);
      Cache.remove('qis_setting_bg_login');
      return list;
    }
    return [];
  },
  setLoginBgList: (list) => Cache.set('qis_setting_bg_login_list', JSON.stringify(list)),
};