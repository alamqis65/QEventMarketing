// EventQ - Global app state
//
// Kept as plain top-level `let`/`window` globals, same as the original
// single-file version. Non-module classic <script> tags share one global
// scope, so these are visible from every other js/*.js file as long as
// this file loads before they run (it's listed first in index.html).

window.appState = { currentUser: null, currentEventId: null };
window.guests = [];
window.currentLang = localStorage.getItem('qis_lang') || 'id';
window.authRole = 'admin';
window.currentPageEvents = 1;
window.libraryViewMode = localStorage.getItem('qis_setting_library_view_mode') || 'grid';
window.libraryFilterCategory = localStorage.getItem('qis_setting_library_filter_category') || 'all';
window.librarySortMode = localStorage.getItem('qis_setting_library_sort_mode') || 'default';
window.currentPageGuests = 1;
window.currentPageAttended = 1;
window.currentPageCustomQR = 1;
window.currentPageCustomBarcode = 1;
// ID peserta yang dicentang admin di tabel Data Peserta untuk fitur "Cetak Terpilih"
window.selectedGuestIds = new Set();
window.selectedCustomQRIds = new Set();
window.selectedCustomBarcodeIds = new Set();

let scannerInstance = null;
let isScanLocked = false;
let scanReaderInstance = null;
let recoveredUserRole = null;
let chartRS = null, chartStatus = null;

// State Mode Kiosk
let kioskScannerInstance = null;
let isKioskScanLocked = false;
let kioskResultTimer = null;
let kioskStatsInterval = null;
let pendingKioskLaunchEventId = null;
let pendingKioskLaunchType = 'attendance';

let cropper = null;
let cropTarget = null;
let cropSourceFileName = '';
window.tempRestoreData = null;

// Scan context: 'guest' (original) or 'generic' (custom tool scanner)
let currentScanContext = 'guest';

// Read kiosk URL params
try {
    const kioskUrlParams = new URLSearchParams(window.location.search);
    pendingKioskLaunchEventId = kioskUrlParams.get('kiosk') || null;
    const kioskTypeParam = kioskUrlParams.get('kioskType');
    pendingKioskLaunchType = (kioskTypeParam === 'pickup') ? 'pickup' : (kioskTypeParam === 'check') ? 'check' : 'attendance';
} catch(e) {}

// Helper untuk Generate ID Event & Peserta
// kedua fungsi di bawah SENGAJA mengecek dulu apakah ID hasil random-nya sudah
// dipakai record lain sebelum benar-benar dipakai (diulang sampai unik, maksimal
// 20 kali percobaan sebagai jaga-jaga supaya tidak berputar selamanya).
window.generateEventId = function() {
    const existingIds = LS.getEvents().map(e => e.id);
    let id; let attempts = 0;
    do {
        id = 'EVT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        attempts++;
    } while (existingIds.includes(id) && attempts < 20);
    return id;
};
window.generateGuestId = function(eventType, checkAgainstList) {
    let prefix = 'QIS-';
    if (eventType === 'Internal') prefix = 'INT-';
    if (eventType === 'Lain-lain') prefix = 'LNL-';
    const list = checkAgainstList || window.guests;
    let id; let attempts = 0;
    do {
        id = prefix + Math.random().toString(36).substr(2, 9).toUpperCase();
        attempts++;
    } while (list.some(g => g.id === id) && attempts < 20);
    return id;
};
// Kunci pembanding "peserta yang sama": Nama + Asal RS, di-trim & lowercased
window.guestMatchKey = function(nama, rs) {
    const norm = s => String(s || '').trim().toLowerCase();
    return norm(nama) + '|' + norm(rs);
};
