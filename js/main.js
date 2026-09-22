// EventQ - App bootstrap
//
// Runs once the page and every other js/*.js file has loaded. First step is
// new: hydrate the in-memory Cache from the FastAPI/Postgres backend (see
// js/cache.js). If that fails (backend down / unreachable), we stop here
// with a toast instead of continuing on empty/stale data. Everything below
// that point is unchanged from the original single-file app.

// ===== Jaring Pengaman Error Tak Terduga (Global) =====
// Sebelum ini, error yang tidak sengaja lolos dari try-catch manapun (bug tak terduga, typo,
// race condition, dsb.) akan gagal secara diam-diam - tombol yang diklik seolah tidak
// melakukan apa-apa, tanpa ada pemberitahuan apa pun ke pengguna, dan hanya bisa dilihat lewat
// console browser yang tidak akan dibuka pengguna awam. Dua listener di bawah menangkap SEMUA
// error tak tertangani (baik yang dilempar secara sinkron maupun dari Promise yang gagal tanpa
// .catch()) di level paling luar, mencatatnya ke console untuk keperluan debug, dan menampilkan
// satu pesan singkat ke pengguna supaya mereka tahu sesuatu yang salah terjadi (alih-alih
// mengira aplikasi macet/tidak merespons). Throttle waktunya supaya kalau ada error yang
// berulang-ulang (mis. di dalam sebuah loop/interval) tidak membanjiri layar dengan toast
// yang sama berkali-kali dalam waktu singkat.
let lastGlobalErrorToastAt = 0;
function notifyUnexpectedError(err) {
    const now = Date.now();
    if (now - lastGlobalErrorToastAt < 8000) return; // maksimal 1 toast tiap 8 detik
    lastGlobalErrorToastAt = now;
    if (typeof window.showToast === 'function') {
        window.showToast(
            window.currentLang === 'id'
                ? 'Terjadi kesalahan tak terduga. Coba ulangi aksi tadi, atau muat ulang halaman jika masalah berlanjut.'
                : 'An unexpected error occurred. Try repeating that action, or reload the page if the problem persists.',
            'error'
        );
    }
}
window.addEventListener('error', function(e) {
    console.error('Uncaught error:', e.error || e.message, e);
    notifyUnexpectedError(e.error || e.message);
});
window.addEventListener('unhandledrejection', function(e) {
    // BUG FIX: Html5QrcodeScanner (library scan QR) diketahui membuang Promise yang "reject"
    // secara NORMAL & tidak berbahaya saat kamera dimulai/dihentikan/berganti (bukan error
    // sungguhan) - disaring di sini SEBELUM toast muncul, supaya admin tidak melihat pesan
    // "kesalahan tak terduga" yang menyesatkan tiap kali membuka/menutup modal scan kehadiran.
    // Sebelumnya ada listener KEDUA terpisah yang didaftarkan belakangan di window.onload untuk
    // menyaring kasus ini, tapi karena listener itu terdaftar SETELAH listener ini, toast di
    // bawah sudah keburu tampil duluan sebelum sempat disaring - makanya pemfilterannya
    // dipindahkan langsung ke sini (paling awal) supaya benar-benar efektif.
    const reasonText = typeof e.reason === 'string' ? e.reason : ((e.reason && e.reason.message) || '');
    if (reasonText.includes('Html5QrcodeScanner')) { e.preventDefault(); return; }
    console.error('Unhandled promise rejection:', e.reason);
    notifyUnexpectedError(e.reason);
});

window.onload = async function () {
  window.initSignaturePad();

  // Step 1: can we even reach the backend? (see console for details)
  const isConnected = await Cache.checkConnection();
  if (!isConnected) {
    window.showToast(
      "Tidak dapat terhubung ke server backend! Cek console (F12).",
      "error",
    );
    return; // don't proceed - nothing will work without the backend
  }

  // Step 2: load the actual data
  try {
    await Cache.hydrate();
  } catch (err) {
    console.error(err);
    window.showToast("Gagal memuat data dari server!", "error");
    return; // don't proceed with stale/empty data
  }

  // Memastikan setidaknya ada satu Super Admin jika aplikasi diperbarui dari versi lama
  let users = LS.getUsers();
  if (users.length > 0 && !users.some((u) => u.isSuperAdmin)) {
    const firstAdminIdx = users.findIndex((u) => u.role === "admin");
    if (firstAdminIdx > -1) {
      users[firstAdminIdx].isSuperAdmin = true;
      LS.setUsers(users);
    }
  }

  applyAppLogo();
  window.applyLoginBg();
  window.applyAuthCaptionSetting();
  window.applyDarkModeSetting();
  window.applyLanguage();
  if (window.setAuthRole) window.setAuthRole("admin");
  window.renderAppVersionInfo();

  const sess = sessionStorage.getItem("qis_session");
  // BUG FIX: sebelumnya JSON.parse(sess) di sini tidak dibungkus try/catch - kalau data sesi
  // di sessionStorage rusak/tidak valid (mis. gangguan ekstensi browser, penulisan yang
  // terputus), seluruh proses inisialisasi aplikasi akan crash tak tertangkap & macet di
  // splash screen tanpa jalan keluar bagi pengguna. Sekarang fallback aman: sesi yang rusak
  // dibersihkan lalu diarahkan ke halaman login, sama seperti saat memang belum ada sesi.
  let restoredSession = null;
  if (sess) {
    try {
      restoredSession = JSON.parse(sess);
    } catch (e) {
      console.error("Data sesi login rusak/tidak valid, sesi dihapus & diarahkan ke halaman login.", e);
      sessionStorage.removeItem("qis_session");
    }
  }
  if (restoredSession) {
    window.appState.currentUser = restoredSession;
    window.setLoadingText("txt_loading");
    switchMainViewAnimated("view-loading");
    setTimeout(() => {
      loadLibrary();
      window.tryLaunchPendingKiosk();
    }, 1000);
  } else {
    switchMainViewAnimated("view-auth");
  }

  // Jam berjalan di header Library Event, diperbarui tiap detik
  if (window.updateHeaderDateTime) {
    window.updateHeaderDateTime();
    setInterval(window.updateHeaderDateTime, 1000);
  }
};
