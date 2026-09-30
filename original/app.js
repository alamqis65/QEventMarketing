window.appState = { currentUser: null, currentEventId: null };
window.guests = [];
window.currentLang = localStorage.getItem("qis_lang") || "id";
window.authRole = "admin";
window.currentPageEvents = 1;
window.libraryViewMode =
  localStorage.getItem("qis_setting_library_view_mode") || "grid";
// Preferensi Filter Kategori & Sort Alfabet di Event Library — disimpan persis seperti
// libraryViewMode di atas, supaya pilihan user tetap konsisten walau browser di-refresh.
window.libraryFilterCategory =
  localStorage.getItem("qis_setting_library_filter_category") || "all";
window.librarySortMode =
  localStorage.getItem("qis_setting_library_sort_mode") || "default";
window.currentPageGuests = 1;
window.currentPageAttended = 1;
window.currentPageCustomQR = 1;
window.currentPageCustomBarcode = 1;
// ID peserta yang dicentang admin di tabel Data Peserta untuk fitur "Cetak Terpilih" - bertahan
// lintas halaman/pencarian, direset tiap masuk/pindah event (lihat window.enterApp).
window.selectedGuestIds = new Set();
// ID QR/Barcode kustom yang dicentang admin di tabel Custom QR Code Generator & Custom Barcode
// Generator untuk fitur "Cetak Terpilih" masing-masing - polanya sama persis dengan
// window.selectedGuestIds di atas, direset tiap kali admin membuka halaman tool-nya
// (lihat window.openToolQR/window.openToolBarcode).
window.selectedCustomQRIds = new Set();
window.selectedCustomBarcodeIds = new Set();

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
  if (typeof window.showToast === "function") {
    window.showToast(
      window.currentLang === "id"
        ? "Terjadi kesalahan tak terduga. Coba ulangi aksi tadi, atau muat ulang halaman jika masalah berlanjut."
        : "An unexpected error occurred. Try repeating that action, or reload the page if the problem persists.",
      "error",
    );
  }
}
window.addEventListener("error", function (e) {
  console.error("Uncaught error:", e.error || e.message, e);
  notifyUnexpectedError(e.error || e.message);
});
window.addEventListener("unhandledrejection", function (e) {
  // BUG FIX: Html5QrcodeScanner (library scan QR) diketahui membuang Promise yang "reject"
  // secara NORMAL & tidak berbahaya saat kamera dimulai/dihentikan/berganti (bukan error
  // sungguhan) - disaring di sini SEBELUM toast muncul, supaya admin tidak melihat pesan
  // "kesalahan tak terduga" yang menyesatkan tiap kali membuka/menutup modal scan kehadiran.
  // Sebelumnya ada listener KEDUA terpisah yang didaftarkan belakangan di window.onload untuk
  // menyaring kasus ini, tapi karena listener itu terdaftar SETELAH listener ini, toast di
  // bawah sudah keburu tampil duluan sebelum sempat disaring - makanya pemfilterannya
  // dipindahkan langsung ke sini (paling awal) supaya benar-benar efektif.
  const reasonText =
    typeof e.reason === "string"
      ? e.reason
      : (e.reason && e.reason.message) || "";
  if (reasonText.includes("Html5QrcodeScanner")) {
    e.preventDefault();
    return;
  }
  console.error("Unhandled promise rejection:", e.reason);
  notifyUnexpectedError(e.reason);
});

// ===== Info Versi Aplikasi & Log Pembaruan =====
// Setiap kali ada revisi/update baru pada aplikasi, tambahkan SATU entri baru di bagian
// PALING ATAS array APP_CHANGELOG (urutan terbaru -> terlama) dan naikkan APP_VERSION,
// supaya riwayat perubahan tetap tercatat dan bisa dilihat pengguna lewat
// Pengaturan > Tentang Aplikasi. Field "date" pakai format YYYY-MM-DD (opsional -
// dikosongkan/dihapus kalau tanggal pastinya tidak diketahui).
window.APP_VERSION = "1.21.0";
window.APP_CHANGELOG = [
  {
    version: "1.21.0",
    date: "2026-09-19",
    changes: {
      id: [
        'Custom QR Code Generator & Custom Barcode Generator: tambah fitur "Cetak Terpilih" - centang QR/Barcode lewat checkbox baru di tabel (bisa "Pilih Semua" sesuai hasil pencarian aktif), lalu cetak hanya yang dicentang lewat tombol "Cetak Terpilih" yang baru menggantikan tombol "Cetak Semua". Indikator jumlah terpilih & tombol "Batal Pilih" ditampilkan di sebelah judul tabel, persis seperti "Cetak Terpilih" di Data Peserta event. Tombol "Cetak Semua" pada kedua tools ini dihapus karena mencetak semua kini cukup lewat "Pilih Semua" + "Cetak Terpilih".',
      ],
      en: [
        'Custom QR Code Generator & Custom Barcode Generator: added a "Print Selected" feature - check QR/Barcode items via new checkboxes in the table (with a "Select All" that respects the active search), then print only the checked items via the new "Print Selected" button that replaces "Print All". A selected-count indicator and "Clear Selection" button appear next to the table title, matching "Print Selected" in the event Participant Data. The "Print All" button on both tools was removed since printing everything is now just "Select All" + "Print Selected".',
      ],
    },
  },
  {
    version: "1.20.0",
    date: "2026-09-19",
    changes: {
      id: [
        'Data Peserta: hapus tombol "Cetak Semua QR" dari Toolbar Data Peserta - fungsinya kini sepenuhnya tercakup oleh "Cetak Terpilih" (centang "Pilih Semua" pada checkbox tabel, lalu klik "Cetak Terpilih" untuk mencetak seluruh peserta). Opsi hak akses "Cetak Semua QR" pada modal Kelola Akses Fitur turut dihapus karena fiturnya sudah tidak ada.',
      ],
      en: [
        'Participant Data: removed the "Print All QR" button from the Participant Data Toolbar - its function is now fully covered by "Print Selected" (check "Select All" in the table checkboxes, then click "Print Selected" to print every participant). The "Print All QR" permission option in the Manage Feature Access modal was also removed since the feature no longer exists.',
      ],
    },
  },
  {
    version: "1.19.0",
    date: "2026-09-19",
    changes: {
      id: [
        'Data Peserta: tambah fitur "Cetak Terpilih" - centang beberapa peserta lewat checkbox baru di tabel (bisa "Pilih Semua" sesuai hasil pencarian/filter aktif), lalu cetak kartu QR hanya untuk peserta yang dicentang lewat tombol "Cetak Terpilih" baru di sebelah "Cetak Semua QR". Indikator jumlah terpilih & tombol "Batal Pilih" ditampilkan di sebelah judul tabel, dan hasil cetaknya tetap mengikuti Pengaturan Cetak QR (orientasi, layout grid, bingkai, dsb.) yang sama seperti Cetak Semua QR.',
      ],
      en: [
        'Participant Data: added a "Print Selected" feature - check several participants via new checkboxes in the table (with a "Select All" that respects the active search/filter), then print QR cards for only the checked participants via the new "Print Selected" button next to "Print All QR". A selected-count indicator and "Clear Selection" button appear next to the table title, and the print output still follows the same Print QR Settings (orientation, grid layout, frame, etc.) as Print All QR.',
      ],
    },
  },
  {
    version: "1.18.0",
    date: "2026-09-18",
    changes: {
      id: [
        'Custom QR Code Generator & Custom Barcode Generator: tambah tombol "Pengaturan Cetak" (ikon slider) di sebelah tombol "Cetak Semua" - berisi checkbox untuk menyalakan/mematikan apa saja yang ikut tercetak di kartu (Judul Tools, Nama, Konten/Nilai) dan switch Bingkai Kartu Cetak, mirip pengaturan cetak QR Code peserta tapi disederhanakan khusus untuk kedua tools mandiri ini. Berlaku untuk cetak satuan maupun Cetak Semua, dan diatur terpisah antara QR Code Kustom & Barcode Kustom.',
      ],
      en: [
        'Custom QR Code Generator & Custom Barcode Generator: added a "Print Settings" button (slider icon) next to the "Print All" button - contains checkboxes to turn what gets printed on each card on/off (Tool Title, Name, Content/Value) plus a Print Card Frame switch, similar to the participant QR print settings but simplified for these two standalone tools. Applies to both single print and Print All, and is configured separately for Custom QR Code & Custom Barcode.',
      ],
    },
  },
  {
    version: "1.17.1",
    date: "2026-09-13",
    changes: {
      id: [
        "Perbaikan Bug: logo event terkadang tidak ikut tercetak pada sebagian kartu QR saat mencetak ke printer fisik (walau tampak normal di preview) — penyebabnya proses cetak dipicu sebelum semua gambar (logo & QR Code) selesai dimuat sepenuhnya. Sekarang proses cetak menunggu semua gambar benar-benar siap terlebih dulu. Berlaku untuk semua jenis cetak (QR Peserta, QR Kustom, Barcode Kustom, satuan maupun massal).",
      ],
      en: [
        "Bug Fix: the event logo sometimes didn't print on some QR cards when printing to a physical printer (despite looking fine in preview) — caused by printing being triggered before all images (logo & QR Code) had fully finished loading. Printing now waits for every image to be fully ready first. Applies to all print types (Participant QR, Custom QR, Custom Barcode, single and bulk).",
      ],
    },
  },
  {
    version: "1.17.0",
    date: "2026-09-13",
    changes: {
      id: [
        'Pengaturan Cetak QR Code: tambah checkbox "Jabatan" - kalau diaktifkan, data jabatan peserta ikut tercetak di kartu QR (baik cetak satuan maupun Cetak Semua). Mati secara default.',
      ],
      en: [
        'QR Code Print Settings: added a "Position" checkbox - when enabled, the participant\'s position/job title is printed on the QR card (both single print and Print All). Off by default.',
      ],
    },
  },
  {
    version: "1.16.0",
    date: "2026-09-13",
    changes: {
      id: [
        'Event Library: tombol "Duplikat Event" kini menawarkan pilihan - duplikat beserta data peserta (status kehadiran/pengambilan direset) atau duplikat tanpa data peserta. Kalau event asal memang belum punya peserta sama sekali, pilihan tidak ditanyakan - langsung diproses tanpa data.',
      ],
      en: [
        "Event Library: the \"Duplicate Event\" button now offers a choice - duplicate with participant data (attendance/pickup status reset) or duplicate without participant data. If the original event has no participants at all, the choice isn't asked - it's processed without data automatically.",
      ],
    },
  },
  {
    version: "1.15.0",
    date: "2026-09-11",
    changes: {
      id: [
        "Keandalan Data: ID Event & ID Peserta kini dijamin tidak akan pernah kembar/tabrakan satu sama lain (dicek ulang otomatis sebelum dipakai).",
        "Keandalan Data: penyimpanan gagal (mis. penyimpanan browser penuh) kini ditangani dengan pesan peringatan yang jelas, alih-alih gagal secara diam-diam tanpa pemberitahuan - berlaku untuk tambah/edit/import data peserta & duplikat event.",
        "Keandalan Data: import Excel sekarang melewati baris yang bermasalah alih-alih menghentikan seluruh proses import, dengan laporan jumlah baris yang dilewati di akhir.",
        "Ditambahkan jaring pengaman untuk error tak terduga di seluruh aplikasi - menampilkan pesan peringatan alih-alih aplikasi terlihat macet/tidak merespons tanpa penjelasan.",
      ],
      en: [
        "Data Reliability: Event IDs & Participant IDs are now guaranteed never to collide with each other (automatically re-checked before use).",
        "Data Reliability: save failures (e.g. browser storage full) are now handled with a clear warning message instead of failing silently with no notice - covers adding/editing/importing participant data & duplicating events.",
        "Data Reliability: Excel import now skips problematic rows instead of halting the whole import, with a report of how many rows were skipped at the end.",
        "Added an app-wide safety net for unexpected errors - shows a warning message instead of the app appearing stuck/unresponsive with no explanation.",
      ],
    },
  },
  {
    version: "1.14.0",
    date: "2026-09-11",
    changes: {
      id: [
        'Event Library: tombol baru "Duplikat Event" di setiap kartu event - membuat event baru dengan seluruh konfigurasi (jenis acara, tanggal, logo, pengaturan kursi/hotel, Nomor Khusus/Unik, kolom disembunyikan) tersalin persis, tanpa ikut membawa data peserta lama. Langsung jadi tanpa modal apa pun - nama diberi akhiran "(Salinan)", tinggal diganti lewat tombol Edit kalau perlu.',
      ],
      en: [
        'Event Library: new "Duplicate Event" button on every event card - creates a new event with all configuration (event type, date, logo, seat/hotel settings, Special/Unique Numbers, hidden columns) copied exactly, without carrying over old participant data. Created instantly with no modal - named with a "(Copy)" suffix, rename it via the Edit button if needed.',
      ],
    },
  },
  {
    version: "1.13.0",
    date: "2026-09-10",
    changes: {
      id: [
        'Data Peserta & Daftar Hadir: tambah dropdown "Urutkan" di kedua tabel - bisa mengurutkan berdasarkan Nama, Asal RS/Instansi, atau Jabatan (A-Z maupun Z-A), masing-masing tabel independen satu sama lain.',
      ],
      en: [
        'Participant Data & Attendance List: added a "Sort by" dropdown to both tables - can now sort by Name, Hospital/Institution, or Position (A-Z or Z-A), independently for each table.',
      ],
    },
  },
  {
    version: "1.12.0",
    date: "2026-09-10",
    changes: {
      id: [
        "Data Peserta: peringatan otomatis kalau isian Nomor Khusus/Unik (mis. NIK, No. Registrasi) sudah dipakai peserta lain di event yang sama - tampil inline (border amber + pesan di bawah field) begitu diketik di Form Pendaftaran Peserta maupun modal Edit Data Peserta, ditambah konfirmasi sekali lagi saat disimpan. Tidak diblokir otomatis, admin tetap bisa melanjutkan kalau memang disengaja.",
      ],
      en: [
        "Participant Data: automatic warning if a Special/Unique Number entry (e.g. National ID, Registration No.) is already used by another participant in the same event - shown inline (amber border + message under the field) as it's typed in both the Add Participant form and the Edit Participant modal, plus a confirmation prompt again on save. Not auto-blocked - admins can still proceed if it's intentional.",
      ],
    },
  },
  {
    version: "1.11.0",
    date: "2026-09-10",
    changes: {
      id: [
        "Kiosk QR Code Pengambilan: kini memberi peringatan (layar amber + bip & suara peringatan) kalau QR yang sama dipindai lagi setelah Nomor Khusus/Unik-nya pernah tampil sebelumnya, lengkap dengan jam scan pertama - mencegah pengambilan barang/kunci dua kali secara tidak sengaja maupun disengaja. Nomornya tetap ditampilkan (tidak disembunyikan) supaya panitia masih bisa memverifikasi.",
      ],
      en: [
        "QR Code Pickup Kiosk: now shows a warning (amber screen + warning beep & voice alert) if the same QR is scanned again after its Special/Unique Number has already been shown before, including the first scan time - prevents accidentally or intentionally picking up an item/key twice. The number is still displayed (not hidden) so staff can still verify it.",
      ],
    },
  },
  {
    version: "1.10.0",
    date: "2026-09-09",
    changes: {
      id: [
        'Mode Kiosk: jenis kiosk baru "Kiosk Cek Data" - peserta/panitia scan QR hanya untuk menampilkan data diri (Quest ID, asal, jabatan, kursi/meja) apa adanya, tanpa mengubah status kehadiran maupun status pengambilan kunci/tanda tangan sama sekali. Cocok dipakai untuk pengecekan data sewaktu-waktu.',
        "Mode Kiosk: tombol ganti jenis kiosk di header kini membuka daftar ketiga jenis kiosk (Absensi/Pengambilan/Cek Data) sekaligus menandai jenis yang sedang aktif, sebelumnya hanya toggle dua arah antara Kiosk Absensi & Kiosk Pengambilan.",
      ],
      en: [
        'Kiosk Mode: new "Data Check Kiosk" type - participants/staff scan their QR just to display their info (Quest ID, origin, position, seat/table) as-is, without changing attendance or key pickup/signature status at all. Handy for on-the-spot data verification.',
        "Kiosk Mode: the kiosk type switch button in the header now opens the full list of all three kiosk types (Attendance/Pickup/Data Check) and marks which one is currently active, previously it only toggled two-way between Attendance & Pickup Kiosk.",
      ],
    },
  },
  {
    version: "1.9.0",
    date: "2026-09-07",
    changes: {
      id: [
        'Perbaikan ikon "Nomor Meja" di Preview QR & kartu Event: sebelumnya memakai ikon tabel data/spreadsheet (fa-table) yang membingungkan, kini diganti ikon meja makan/perjamuan (fa-utensils).',
      ],
      en: [
        'Fixed the "Table Number" icon on QR Preview & Event cards: previously used a data table/spreadsheet icon (fa-table) which was confusing, now replaced with a dining table icon (fa-utensils).',
      ],
    },
  },
  {
    version: "1.8.0",
    date: "2026-09-07",
    changes: {
      id: [
        'Kelola Akses Fitur: checkbox izin akses terpisah untuk tombol "Download QR" per peserta di Data Peserta, sebelumnya selalu tampil untuk semua user tanpa bisa dibatasi.',
      ],
      en: [
        'Feature Access Control: separate permission checkbox for the per-participant "Download QR" button in Participant Data, previously always shown to all users without being restrictable.',
      ],
    },
  },
  {
    version: "1.7.0",
    date: "2026-09-07",
    changes: {
      id: [
        'Kelola Akses Fitur: checkbox izin akses terpisah untuk "Mode Kiosk", sebelumnya menyatu dengan izin tab Scan Kehadiran - admin kini bisa mengizinkan akses Scan Kehadiran biasa tanpa otomatis membuka akses Mode Kiosk untuk user tersebut, atau sebaliknya.',
      ],
      en: [
        'Feature Access Control: separate permission checkbox for "Kiosk Mode", previously tied to the Attendance Scan tab permission - admins can now grant regular Attendance Scan access without automatically opening Kiosk Mode access for that user, or vice versa.',
      ],
    },
  },
  {
    version: "1.6.0",
    date: "2026-09-07",
    changes: {
      id: [
        'Kiosk QR Code Pengambilan: checkbox "Kunci Diambil" di tabel Data Peserta kini otomatis ikut tercentang begitu QR peserta berhasil discan di kios (untuk event yang membutuhkan kunci hotel & peserta punya kamar) - tidak perlu menunggu proses tanda tangan selesai. Jika peserta memang menandatangani, bukti tanda tangannya ikut dilengkapi ke data yang sama.',
      ],
      en: [
        'Pickup QR Code Kiosk: the "Key Picked Up" checkbox in the Participant Data table is now automatically checked as soon as a participant\'s QR is successfully scanned at the kiosk (for events that require a hotel key and where the participant has a room) - no need to wait for the signature step. If the participant does sign, the signature proof is added to the same record.',
      ],
    },
  },
  {
    version: "1.5.0",
    date: "2026-09-04",
    changes: {
      id: [
        "Pengaturan > Mode Kiosk: toast notifikasi kini muncul saat bahasa suara Text-to-Speech diubah, sebagai konfirmasi visual selain uji coba suara.",
        "Nomor Khusus/Unik Peserta: saat membuat/mengedit event, admin bisa menambahkan jenis nomor unik tambahan (mis. NIK, No. Registrasi) dengan nama & jumlah bebas - otomatis muncul sebagai field di Form Pendaftaran Peserta & modal Edit Data Peserta.",
      ],
      en: [
        "Settings > Kiosk Mode: a toast notification now appears when the Text-to-Speech voice language is changed, as visual confirmation alongside the voice preview.",
        "Custom/Unique Participant Number: when creating/editing an event, admins can add extra unique number types (e.g. National ID, Registration No.) with freely customizable name & count - automatically shown as fields on the Participant Registration Form & Edit Participant modal.",
      ],
    },
  },
  {
    version: "1.4.0",
    date: "2026-09-03",
    changes: {
      id: [
        "Pengaturan > Mode Kiosk: switch pilihan bahasa suara Text-to-Speech (Indonesia/English) untuk ucapan sapaan nama peserta, lengkap dengan uji coba suara langsung saat memilih.",
      ],
      en: [
        "Settings > Kiosk Mode: Text-to-Speech voice language switch (Indonesian/English) for the participant name greeting, with an instant voice preview when selecting.",
      ],
    },
  },
  {
    version: "1.3.0",
    date: "2026-09-01",
    changes: {
      id: [
        "Mode Kiosk: tombol khusus untuk mengaktifkan/menonaktifkan suara ucapan (Text-to-Speech) nama peserta, terpisah dari tombol suara notifikasi (bip) - operator kiosk kini bisa memilih kombinasi sesuai kebutuhan.",
      ],
      en: [
        "Kiosk Mode: dedicated button to turn the participant name Text-to-Speech voice on/off, separate from the notification (beep) sound toggle - kiosk operators can now choose the combination that fits their needs.",
      ],
    },
  },
  {
    version: "1.2.0",
    date: "2026-08-28",
    changes: {
      id: [
        "Local Cross-Tab Sync (BroadcastChannel API): perubahan data peserta, registrasi, dan absensi di satu tab/jendela otomatis memperbarui statistik & tabel di tab/jendela lain secara real-time tanpa perlu refresh - terutama saat Mode Kiosk dijalankan di tab/jendela terpisah dari dashboard admin.",
      ],
      en: [
        "Local Cross-Tab Sync (BroadcastChannel API): participant, registration, and attendance changes in one tab/window now automatically update stats & tables in other tabs/windows in real time without a refresh - especially useful when Kiosk Mode runs in a separate tab/window from the admin dashboard.",
      ],
    },
  },
  {
    version: "1.1.0",
    date: "2026-08-27",
    changes: {
      id: [
        'Menambahkan halaman "Tentang Aplikasi" berisi informasi versi dan log pembaruan.',
        "Header Custom QR Code Generator & Custom Barcode Generator dibuat sticky saat scroll.",
      ],
      en: [
        'Added an "About This App" page showing version info and the update log.',
        "Custom QR Code Generator & Custom Barcode Generator headers are now sticky while scrolling.",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "",
    changes: {
      id: [
        "Manajemen event & peserta (tambah, edit, hapus, impor data).",
        "Generator QR Code & Barcode kustom, termasuk cetak label satuan maupun massal.",
        "Pemindai QR/Barcode untuk proses check-in peserta.",
        "Dashboard statistik kehadiran & asal instansi peserta.",
        "Mode gelap (dark mode) di seluruh halaman aplikasi.",
        "Dukungan dwibahasa: Indonesia & Inggris.",
        "Backup & restore data melalui file JSON.",
      ],
      en: [
        "Event & participant management (add, edit, delete, import data).",
        "Custom QR Code & Barcode generator, including single and bulk label printing.",
        "QR/Barcode scanner for participant check-in.",
        "Attendance & institution-origin statistics dashboard.",
        "Dark mode across the entire application.",
        "Bilingual support: Indonesian & English.",
        "Backup & restore data via JSON file.",
      ],
    },
  },
];

// Menampilkan versi aplikasi saat ini di badge Pengaturan & di setiap footer Hak Cipta,
// serta merender daftar log pembaruan (changelog) di kartu "Tentang Aplikasi".
window.renderAppVersionInfo = function () {
  document.querySelectorAll(".app-version-badge").forEach((el) => {
    el.textContent = "v" + window.APP_VERSION;
  });
  document.querySelectorAll(".app-version-footer-tag").forEach((el) => {
    el.textContent = `· v${window.APP_VERSION}`;
  });

  const list = document.getElementById("app-changelog-list");
  if (!list) return;
  list.innerHTML = window.APP_CHANGELOG.map((entry, idx) => {
    const dateLabel = entry.date
      ? new Date(entry.date + "T00:00:00").toLocaleDateString(
          window.currentLang === "id" ? "id-ID" : "en-US",
          { day: "numeric", month: "long", year: "numeric" },
        )
      : window.currentLang === "id"
        ? "Rilis awal"
        : "Initial release";
    const changesForLang =
      entry.changes[window.currentLang] || entry.changes.id;
    const changesHtml = changesForLang
      .map(
        (c) =>
          `<li class="flex gap-2"><i class="fa-solid fa-circle text-[4px] mt-2 text-slate-300 dark:text-slate-600 shrink-0"></i><span>${c}</span></li>`,
      )
      .join("");
    const isLast = idx === window.APP_CHANGELOG.length - 1;
    return `
                    <div class="${isLast ? "" : "border-b border-slate-100 dark:border-slate-700 pb-5"}">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">v${entry.version}</span>
                            <span class="text-xs text-slate-400 dark:text-slate-500">${dateLabel}</span>
                        </div>
                        <ul class="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">${changesHtml}</ul>
                    </div>`;
  }).join("");
};

let scannerInstance = null;
let isScanLocked = false;
let scanReaderInstance = null;
let recoveredUserRole = null;
let chartRS = null,
  chartStatus = null;

// ===== State Mode Kiosk =====
let kioskScannerInstance = null;
let isKioskScanLocked = false;
let kioskResultTimer = null;
// Signature pad KHUSUS Kiosk Pengambilan (terpisah dari #signature-pad milik alur bukti
// pengambilan kunci hotel) — dipisah supaya kedua canvas tidak saling mengganggu, mengingat
// konteks & modalnya berbeda meski mekanisme gambarnya identik.
let kioskSigCanvas = null,
  kioskSigCtx = null,
  isKioskSigCanvasEmpty = true;
let pendingKioskPickupGuest = null,
  pendingKioskPickupEvt = null;
// Durasi popup hasil scan sebelum auto-reset kini bisa diatur admin lewat
// Pengaturan Aplikasi (lihat window.getKioskResetDurationSec), default 4 detik.
let kioskAudioCtx = null; // AudioContext dibuat lazy & sekali pakai selama sesi kiosk berjalan
let kioskPinFailCount = 0; // jumlah percobaan PIN salah berturut-turut
let kioskPinLockUntil = 0; // timestamp (ms) sampai kapan input PIN dikunci setelah terlalu banyak gagal
// Jenis Mode Kiosk yang sedang aktif: 'attendance' (Kiosk Absensi, default — scan menandai
// kehadiran), 'pickup' (Kiosk Pengambilan — scan hanya menampilkan data peserta & Nomor
// Khusus/Unik miliknya, tanpa mengubah status kehadiran), atau 'check' (Kiosk Cek Data — scan
// hanya menampilkan data diri peserta apa adanya, tanpa mengubah status kehadiran maupun
// pengambilan sama sekali; dipakai untuk pengecekan data sewaktu-waktu). Dipilih lewat
// window.openKioskTypeChoiceModal sebelum modal pemilihan lokasi tampil (jendela/tab/layar ini).
window.currentKioskType = "attendance";
window.pendingKioskType = "attendance";
// Konteks saat modal pemilihan jenis kiosk (modal-kiosk-type-choice) dibuka: 'launch' — dari
// tombol "Mode Kiosk" di header event, sebelum Mode Kiosk aktif, lanjut ke modal pemilihan lokasi
// tampil (lihat window.chooseKioskType); atau 'switch' — dari tombol ganti jenis di header layar
// Mode Kiosk yang SEDANG aktif, langsung berpindah jenis tanpa keluar/masuk ulang (lihat
// window.openKioskSwitchTypeModal & window.confirmSwitchKioskTypeTo).
let kioskTypeChoiceContext = "launch";
// eventId dari parameter URL ?kiosk=<id> — diisi saat tab/jendela ini dibuka lewat pilihan
// "Jendela Baru"/"Tab Baru" pada modal pemilihan Mode Kiosk (lihat window.launchKioskInNewContext).
let pendingKioskLaunchEventId = null;
let pendingKioskLaunchType = "attendance";
try {
  const kioskUrlParams = new URLSearchParams(window.location.search);
  pendingKioskLaunchEventId = kioskUrlParams.get("kiosk") || null;
  const kioskTypeParam = kioskUrlParams.get("kioskType");
  pendingKioskLaunchType =
    kioskTypeParam === "pickup"
      ? "pickup"
      : kioskTypeParam === "check"
        ? "check"
        : "attendance";
} catch (e) {}

// ===== Local Cross-Tab Sync (BroadcastChannel API) =====
// Menyinkronkan perubahan data peserta/registrasi/absensi antar tab/jendela browser
// secara real-time TANPA reload halaman - dibutuhkan terutama karena Mode Kiosk sering
// dijalankan di tab/jendela terpisah dari dashboard admin (lihat
// window.launchKioskInNewContext). Setiap tab menyiarkan pesan setiap kali saveGuests()
// dipanggil (lihat definisinya di bawah); tab lain yang sedang membuka EVENT YANG SAMA
// akan memuat ulang window.guests dari localStorage lalu merender ulang tampilan yang
// relevan (dashboard, tabel peserta/kehadiran, statistik scan & kiosk) secara otomatis.
// Browser yang tidak mendukung BroadcastChannel akan diam-diam mengabaikan fitur ini
// (aplikasi tetap berfungsi normal, hanya tanpa sinkronisasi real-time antar tab).
window.syncChannel = null;
try {
  if ("BroadcastChannel" in window)
    window.syncChannel = new BroadcastChannel("eventq_guests_sync");
} catch (e) {
  window.syncChannel = null;
}

// ID unik per tab/jendela, supaya tab pengirim tidak ikut memproses ulang siarannya sendiri
window.tabId = Date.now().toString(36) + Math.random().toString(36).slice(2);

window.broadcastGuestsChanged = function (eventId) {
  if (!window.syncChannel || !eventId) return;
  try {
    window.syncChannel.postMessage({
      type: "guests-changed",
      eventId: eventId,
      tabId: window.tabId,
      ts: Date.now(),
    });
  } catch (e) {}
};

if (window.syncChannel) {
  window.syncChannel.onmessage = function (e) {
    const msg = e.data;
    if (!msg || msg.type !== "guests-changed" || msg.tabId === window.tabId)
      return;
    // Hanya proses kalau tab ini sedang membuka event yang sama dengan yang berubah
    if (msg.eventId !== window.appState.currentEventId) return;
    window.guests = LS.getGuests(msg.eventId);
    window.refreshLiveViewsAfterSync();
  };
}

// Highlight singkat (non-intrusif) pada angka statistik supaya terlihat jelas kalau baru
// saja diperbarui otomatis dari tab/jendela lain, tanpa perlu toast/notifikasi yang bisa
// mengganggu kalau kiosk sedang ramai memindai berturut-turut.
window.pulseStatElement = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("stat-live-pulse");
  void el.offsetWidth;
  el.classList.add("stat-live-pulse");
  // Lepas kembali class-nya setelah animasi selesai, supaya elemen kembali ke display
  // aslinya (bukan tertahan inline-block permanen).
  setTimeout(() => {
    el.classList.remove("stat-live-pulse");
  }, 600);
};

// Merender ulang seluruh tampilan yang menampilkan data peserta/absensi setelah data
// disegarkan dari tab/jendela lain. Mengikuti pola guard yang sama seperti
// window.changeLanguage, supaya render berat (chart dashboard) hanya jalan saat tab
// terkait sedang aktif/terlihat.
window.refreshLiveViewsAfterSync = function () {
  if (!window.appState.currentEventId) return;

  window.renderScanStats();
  window.renderGenerateSideStats();
  window.pulseStatElement("scan-stat-hadir");

  if (
    document.getElementById("view-app") &&
    !document.getElementById("view-app").classList.contains("view-hidden")
  ) {
    window.renderTable();
    window.pulseStatElement("stat-hadir-guests");
  }
  if (
    document.getElementById("tab-content-dashboard") &&
    document
      .getElementById("tab-content-dashboard")
      .classList.contains("active")
  ) {
    window.renderDashboard();
    window.pulseStatElement("dash-hadir");
  }

  const kioskView = document.getElementById("kiosk-mode-view");
  if (kioskView && !kioskView.classList.contains("hidden")) {
    window.renderKioskStats();
    window.pulseStatElement("kiosk-stat-hadir");
  }
};

let cropper = null;
let cropTarget = null;
let cropSourceFileName = "";
window.tempRestoreData = null;

// Helper untuk Generate ID Event & Peserta
// Kedua fungsi generate ID di bawah SENGAJA mengecek dulu apakah ID hasil random-nya sudah
// dipakai record lain sebelum benar-benar dipakai (diulang sampai unik, maksimal 20 kali
// percobaan sebagai jaga-jaga supaya tidak berputar selamanya kalau ada hal aneh terjadi).
// Peluang tabrakan aslinya nyaris nol (9 karakter base36 acak = puluhan triliun kemungkinan),
// tapi tetap dijaga eksplisit karena KALAU sampai terjadi, dua event/peserta berbeda akan
// berbagi ID yang sama - bug "data duplikat/tertimpa" yang sangat sulit dilacak (pencarian
// "cari berdasarkan ID" jadi ambigu, edit/hapus satu bisa salah sasaran ke yang lain).
window.generateEventId = function () {
  const existingIds = LS.getEvents().map((e) => e.id);
  let id;
  let attempts = 0;
  do {
    id = "EVT-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    attempts++;
  } while (existingIds.includes(id) && attempts < 20);
  return id;
};
window.generateGuestId = function (eventType, checkAgainstList) {
  let prefix = "QIS-";
  if (eventType === "Internal") prefix = "INT-";
  if (eventType === "Lain-lain") prefix = "LNL-";
  // window.guests dicek langsung (bukan LS.getGuests) supaya baris-baris yang baru saja
  // ditambahkan dalam batch import yang sama (belum sempat tersimpan ke localStorage) ikut
  // terhitung juga - window.guests selalu jadi acuan data peserta event yang sedang dibuka.
  // checkAgainstList (opsional) dipakai saat membuat daftar peserta untuk event yang BUKAN
  // sedang dibuka (mis. menyalin peserta ke event hasil duplikat di window.executeDuplicateEvent)
  // - tanpa ini, ID baru hanya akan dicek tabrakan dengan peserta event yang sedang aktif,
  // bukan dengan daftar baru yang sedang dibangun.
  const list = checkAgainstList || window.guests;
  let id;
  let attempts = 0;
  do {
    id = prefix + Math.random().toString(36).substr(2, 9).toUpperCase();
    attempts++;
  } while (list.some((g) => g.id === id) && attempts < 20);
  return id;
};
// Kunci pembanding "peserta yang sama": Nama Lengkap + Asal RS, di-trim & disamakan huruf
// kecil/besarnya. Dipakai saat import Excel mode gabung untuk mendeteksi baris file yang
// sebenarnya sudah merepresentasikan peserta yang sama dengan data yang sudah ada - supaya
// peserta tsb tidak ditambahkan lagi sebagai entri baru (dan Quest ID lamanya tidak berubah).
window.guestMatchKey = function (nama, rs) {
  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase();
  return norm(nama) + "|" + norm(rs);
};

const dict = {
  id: {
    app_title: "EventQ",
    login_subtitle: "Masuk ke akun Anda untuk melanjutkan",
    sub_admin: "Masuk sebagai Admin untuk mengelola event",
    sub_public: "Masuk sebagai Public untuk akses event",
    auth_bg_title: "Kelola Event Lebih Mudah",
    auth_bg_sub:
      "Generate QR Code, pantau kehadiran, dan kelola data peserta secara real-time dalam satu platform.",
    auth_feat_qr: "QR Code Instan",
    auth_feat_scan: "Scan Real-time",
    auth_feat_report: "Rekap Otomatis",
    tab_admin: "Admin",
    tab_public: "Public",
    ph_username: "Masukkan username",
    ph_password: "Masukkan password",
    ph_fullname: "Nama sesuai identitas",
    ph_reg_username: "Pilih username",
    ph_reg_password: "Buat password",
    lbl_username: "Username",
    lbl_password: "Password",
    btn_login: "Masuk",
    txt_no_account: "Belum punya akun?",
    btn_register: "Daftar",
    btn_forgot_pw: "Lupa Password?",
    lbl_fullname: "Nama Lengkap",
    btn_create_account: "Buat Akun",
    txt_has_account: "Sudah punya akun?",
    btn_login_back: "Masuk kembali",
    lbl_recovery_username: "Username Terdaftar",
    btn_recover: "Cari & Pulihkan Akun",
    txt_back_to: "Kembali ke",
    btn_login_page: "Halaman Login",
    txt_loading: "Mempersiapkan Event Library...",
    txt_opening_event: "Membuka Event...",
    lib_title: "Library Event",
    welcome: "Selamat datang kembali,",
    btn_create_event: "Buat Event",
    txt_no_event: "Belum ada event",
    txt_no_event_sub:
      "Mulai perjalanan Anda dengan membuat event baru untuk mengelola pendaftaran peserta dan absensi QR.",
    txt_no_event_filtered: "Tidak ada event yang cocok",
    txt_no_event_filtered_sub:
      "Coba ubah kata kunci pencarian atau filter kategori yang dipakai.",
    settings_title: "Pengaturan Aplikasi",
    settings_profile: "Profil Pengguna",
    lbl_new_password: "Password Baru",
    btn_save_changes: "Simpan Update",
    settings_pref: "Tampilan dan Bahasa Aplikasi",
    lbl_language: "Bahasa Aplikasi",
    lbl_language_sub: "Atur bahasa dan mode tampilan aplikasi.",
    settings_login_page: "Halaman Login",
    settings_login_page_desc:
      "Sesuaikan logo, foto latar, dan tulisan pada halaman login.",
    tab_dash: "Dashboard",
    tab_gen: "Buat QR Peserta",
    tab_read: "Scan Kehadiran",
    tab_list: "Data Peserta",
    tab_att: "Daftar Hadir",
    dash_reg: "Pendaftar",
    dash_att: "Kehadiran",
    dash_pct: "Persentase",
    dash_chart_rs: "Statistik Asal RS",
    dash_chart_status: "Status Kehadiran",
    dash_feed_new: "Pendaftar Terbaru",
    dash_feed_att: "Kehadiran Terbaru",
    form_title: "Form Pendaftaran Peserta",
    form_sub: "Masukkan data peserta untuk membuat ID unik dan QR Code.",
    lbl_rs: "Asal Rumah Sakit",
    lbl_jabatan: "Jabatan",
    lbl_kursi: "Nomor Kursi (Opsional)",
    txt_mandatory: "Kolom dengan tanda bintang (*) wajib diisi.",
    lbl_kursi_th: "Kursi",
    lbl_kursi_label: "Nomor Kursi",
    lbl_seat_label_type: "Jenis nomor yang digunakan:",
    opt_seat_kursi: "Nomor Kursi",
    opt_seat_meja: "Nomor Meja",
    btn_gen_qr: "Generate QR Code",
    scan_title: "Scan QR Code Kehadiran",
    scan_sub: "Arahkan kamera ke QR Code peserta atau unggah file gambar QR.",
    btn_bulk_qr: "Bulk Download QR",
    btn_export: "Export Excel",
    btn_export_att: "Export Excel",
    btn_import: "Import Excel",
    btn_template: "Template",
    list_title: "Daftar Seluruh Peserta",
    lbl_status: "Status",
    lbl_action: "Aksi",
    txt_empty_guest: "Belum ada data peserta terdaftar.",
    att_title: "Rekap Kehadiran",
    lbl_time: "Waktu Masuk",
    txt_empty_att: "Belum ada peserta yang check-in.",
    modal_event_title: "Buat Event Baru",
    lbl_event_name: "Nama Event",
    lbl_event_type: "Jenis Acara",
    lbl_event_date: "Tanggal & Waktu Mulai",
    lbl_event_logo: "Logo Event (Opsional)",
    btn_cancel: "Batal",
    btn_save: "Simpan",
    btn_confirm: "Ya, Lanjutkan",
    lbl_custom_number_fields: "Nomor Khusus/Unik Peserta (Opsional)",
    lbl_custom_number_fields_sub:
      "Tambahkan jenis nomor unik tambahan yang perlu diisi di form data peserta, misalnya NIK, No. Registrasi, atau ID Karyawan.",
    btn_add_custom_number_field: "Tambah Jenis Nomor",
    lbl_hide_columns: "Sembunyikan Kolom Data Peserta (Opsional)",
    lbl_hide_columns_sub:
      "Kolom yang dicentang akan disembunyikan dari tabel Data Peserta & Daftar Hadir. Data tetap tersimpan utuh dan tetap bisa dipakai sistem (form, QR, cetak, export) — bisa ditampilkan kembali kapan saja.",
    lbl_hide_col_rs: "Asal RS / Instansi",
    modal_del_title: "Hapus Data?",
    modal_del_sub:
      "Tindakan ini permanen dan tidak dapat dibatalkan. Seluruh data terkait akan dihapus.",
    btn_delete: "Ya, Hapus",
    modal_qr_title: "Preview QR Code",
    btn_close: "Tutup Preview",
    modal_scan_ok: "Check-In Berhasil",
    btn_continue_scan: "Lanjut Scan QR",
    modal_scan_already: "Sudah Pernah Check-In",
    lbl_scan_recorded_at: "Tercatat hadir pukul",
    lbl_eventq_info: "Informasi EventQ",
    modal_dup_name_title: "Nama Sudah Terdaftar",
    modal_dup_id_title: "Quest ID Duplikat Ditemukan",
    modal_import_mode_title: "Data Peserta Sudah Ada",
    modal_import_mode_sub:
      "Event ini sudah memiliki data peserta. Pilih bagaimana data baru dari file ingin diproses:",
    lbl_import_existing: "Sudah Ada",
    lbl_import_new: "Data Baru",
    lbl_import_total_after_merge: "Jika Gabung",
    btn_import_merge: "Gabungkan dengan Data Lama",
    btn_import_merge_desc:
      "Data baru ditambahkan tanpa menghapus data yang sudah ada.",
    btn_import_replace: "Hapus Data Lama, Ganti dengan Data Baru",
    btn_import_replace_desc:
      "Seluruh data peserta yang ada saat ini akan dihapus permanen.",
    modal_dup_event_title: "Duplikat Event",
    modal_dup_event_sub:
      "Event ini memiliki data peserta terdaftar. Pilih bagaimana duplikat event akan dibuat:",
    lbl_dup_event_guest_count: "Peserta Terdaftar di Event Asal",
    btn_dup_with_data: "Duplikat Beserta Data Peserta",
    btn_dup_with_data_desc:
      "Daftar peserta ikut disalin. Status kehadiran & pengambilan direset ke awal.",
    btn_dup_no_data: "Duplikat Tanpa Data Peserta",
    btn_dup_no_data_desc:
      "Hanya konfigurasi event yang disalin. Peserta mulai dari kosong.",
    modal_edit_title: "Edit Data Peserta",
    lbl_app_logo: "Logo Aplikasi",
    lbl_app_logo_sub: "Ganti logo login dan Favicon.",
    opt_top5: "Top 5",
    opt_all: "Semua",
    opt_status_all: "Semua Status",
    opt_status_present: "Sudah Hadir",
    opt_status_absent: "Belum Hadir",
    opt_sort_default: "Urutan Default",
    opt_sort_nama_asc: "Nama (A-Z)",
    opt_sort_nama_desc: "Nama (Z-A)",
    opt_sort_rs_asc: "Asal RS/Instansi (A-Z)",
    opt_sort_rs_desc: "Asal RS/Instansi (Z-A)",
    opt_sort_jabatan_asc: "Jabatan (A-Z)",
    opt_sort_jabatan_desc: "Jabatan (Z-A)",
    btn_reset_logo: "Reset Logo Default",
    btn_reset_settings: "Kembalikan Pengaturan Semula",
    confirm_reset: "Pengaturan berhasil di-reset",
    lbl_bg_login: "Latar Belakang Login",
    lbl_bg_login_sub:
      "Unggah beberapa foto sekaligus, background akan bergantian otomatis sesuai kecepatan yang diatur di bawah.",
    btn_reset_bg: "Reset Background",
    btn_shortcut_to_barcode: "Ke Barcode Generator",
    btn_shortcut_to_qr: "Ke QR Code Generator",
    btn_scan_qr: "Scan QR",
    btn_scan_barcode: "Scan Barcode",
    modal_scan_qr_title: "Scan QR Code",
    modal_scan_barcode_title: "Scan Barcode",
    modal_scan_qr_sub: "Arahkan kamera ke QR Code untuk membaca isinya.",
    modal_scan_barcode_sub: "Arahkan kamera ke Barcode untuk membaca isinya.",
    lbl_scan_result: "Hasil Terbaca",
    btn_copy_result: "Salin",
    btn_open_link: "Buka Link",
    btn_scan_again: "Scan Lagi",
    toast_scan_success: "Kode berhasil dibaca!",
    toast_copied: "Disalin ke clipboard",
    toast_copy_failed: "Gagal menyalin.",
    title_bg_login_add: "Klik untuk tambah foto background",
    title_bg_login_remove: "Hapus foto ini",
    title_toggle_pw: "Tampilkan password",
    modal_prof_title: "Atur Foto Profil",
    btn_prof_upload: "Upload Foto Baru",
    btn_prof_reset: "Gunakan Avatar Default",
    btn_reset_logo_event: "Default",
    btn_share_access: "Bagikan Akses",
    modal_share_title: "Bagikan Akses Event",
    lbl_select_user: "Pilih User",
    txt_no_other_users: "Tidak ada user lain yang terdaftar.",
    settings_backup: "Backup & Restore Data",
    lbl_backup_sub:
      "Amankan data event, peserta, dan pengaturan Anda dengan mengunduh file Backup (JSON). Anda dapat memulihkannya kapan saja.",
    btn_backup: "Download Backup",
    btn_restore: "Load Backup",
    settings_restore_system: "Restore System",
    lbl_restore_system_sub:
      "Kembalikan seluruh pengaturan aplikasi (logo, tampilan, halaman login, cetak QR, PIN Kiosk, dll) ke kondisi default awal.",
    settings_about: "Tentang Aplikasi",
    lbl_about_sub:
      "Versi EventQ yang sedang digunakan beserta riwayat pembaruannya.",
    modal_restore_title: "Restore Data Backup?",
    modal_restore_sub:
      "Peringatan: Seluruh data saat ini akan ditimpa dengan data dari file backup. Anda akan otomatis keluar (logout) setelah proses selesai.",
    btn_other_tools: "Tools Lainnya",
    modal_tools_title: "Tools Tambahan",
    tool_qr_gen: "QR Code Generator",
    tool_qr_desc:
      "Buat QR Code custom dari teks atau link URL untuk kebutuhan event.",
    tools_qr_title: "Custom QR Code Generator",
    lbl_qr_name: "Nama QR / Keterangan",
    lbl_qr_content: "Teks / Link URL",
    lbl_create_new_qr: "Buat QR Baru",
    btn_generate: "Generate & Simpan",
    txt_loading_qr_gen: "Mempersiapkan Custom QR Code Generator...",
    txt_loading_barcode_gen: "Mempersiapkan Custom Barcode Generator...",
    tool_barcode_gen: "Barcode Generator",
    tool_barcode_desc:
      "Buat Barcode custom dari teks untuk kebutuhan logistik / data event.",
    tools_barcode_title: "Custom Barcode Generator",
    lbl_create_new_barcode: "Buat Barcode Baru",
    lbl_barcode_name: "Nama Barcode / Keterangan",
    lbl_barcode_content: "Teks / Nilai Barcode",
    lbl_hotel_needs: "Membutuhkan data kunci kamar & penginapan hotel",
    lbl_room: "Nomor Kamar",
    lbl_room_opt: "Nomor Kamar (Opsional)",
    lbl_key_taken: "Kunci Diambil",
    lbl_key_signature_needs: "Perlu tanda tangan bukti pengambilan kunci",
    lbl_key_signature_needs_sub:
      "Jika dimatikan, pengambilan kunci cukup dicentang dengan mengisi nama pengambil saja — tanpa modal tanda tangan.",
    lbl_seat_needs: "Membutuhkan data Nomor untuk peserta",
    btn_generating: "Memproses...",
    btn_close_tools: "Tutup tools tambahan",
    admin_manage_users: "Manajemen Pengguna",
    admin_manage_users_desc:
      "Kelola akses, edit data, dan buat akun baru untuk Admin maupun Public.",
    btn_manage_users: "Kelola Pengguna",
    plc_search_event: "Cari event...",
    plc_search_user: "Cari berdasarkan username atau nama...",
    opt_role_all: "Semua Akun",
    lbl_account_type: "Tipe Akun",
    opt_public: "User Public",
    opt_admin: "User Admin",
    btn_create_new_account: "Buat Akun Baru",
    lbl_share_search: "Cari nama / username...",
    btn_close_menu: "Tutup Menu",
    title_tools: "Tools Lainnya",
    title_settings: "Pengaturan Aplikasi",
    txt_not_found: "Pengguna tidak ditemukan.",
    txt_credentials_hidden: "Username & password disembunyikan",
    settings_print_qr: "Pengaturan Cetak QR Code",
    lbl_print_qr_sub:
      "Atur informasi tambahan yang ikut tercetak bersama QR Code peserta (nama/judul event, nama, nomor ID, asal RS/instansi, jabatan, nomor kursi, logo event).",
    lbl_print_field_eventname: "Nama/Judul Event",
    lbl_print_field_nama: "Nama Peserta",
    lbl_print_field_id: "Nomor ID Peserta",
    lbl_print_field_rs: "Asal Rumah Sakit / Instansi",
    lbl_print_field_jabatan: "Jabatan",
    lbl_print_field_kursi: "Nomor Kursi",
    lbl_print_field_logo: "Logo Event (Pojok Kanan Atas)",
    lbl_print_logo_hint:
      "Logo diambil otomatis dari foto logo yang diunggah pada masing-masing event. Jika event belum punya logo, bagian ini akan dilewati.",
    lbl_print_frame: "Bingkai Kartu Cetak",
    lbl_print_frame_sub:
      "Tampilkan garis bingkai (border) di sekeliling setiap kartu QR saat dicetak.",
    title_print_custom_settings: "Pengaturan Cetak",
    lbl_print_custom_settings_title: "Info yang Tercetak",
    lbl_print_field_tools_title: "Judul Tools",
    lbl_print_field_name: "Nama",
    lbl_print_field_content: "Konten / Nilai",
    lbl_storage_usage: "Kapasitas Penyimpanan Browser",
    lbl_storage_usage_hint: "Kapasitas bervariasi per browser",
    settings_kiosk_menu: "Mode Kiosk",
    settings_kiosk_pin: "Keamanan Mode Kiosk",
    lbl_kiosk_pin_sub:
      "PIN ini wajib dimasukkan untuk keluar dari Mode Kiosk, supaya peserta tidak bisa mengakses halaman manajemen data.",
    modal_kiosk_type_title: "Pilih Jenis Kiosk",
    modal_kiosk_type_sub: "Pilih jenis Mode Kiosk yang ingin digunakan.",
    kiosk_type_attendance: "Kiosk Absensi",
    kiosk_type_attendance_sub:
      "Peserta scan QR untuk mencatat kehadiran secara mandiri.",
    kiosk_type_pickup: "Kiosk QR Code Pengambilan",
    kiosk_type_pickup_sub:
      "Peserta scan QR untuk menampilkan data diri & Nomor Khusus/Unik miliknya.",
    kiosk_type_check: "Kiosk Cek Data",
    kiosk_type_check_sub:
      "Peserta/panitia scan QR hanya untuk melihat data diri, tanpa mengubah status kehadiran atau pengambilan.",
    badge_kiosk_active: "Aktif",
    btn_back: "Kembali",
    modal_kiosk_choice_title: "Buka Mode Kiosk",
    modal_kiosk_choice_sub: "Pilih ke mana layar Mode Kiosk akan ditampilkan.",
    kiosk_choice_window: "Jendela Baru",
    kiosk_choice_window_sub: "Cocok untuk layar/monitor terpisah khusus kiosk.",
    kiosk_choice_tab: "Tab Baru",
    kiosk_choice_tab_sub: "Tetap di browser yang sama, dalam tab terpisah.",
    kiosk_choice_same: "Jendela Ini",
    kiosk_choice_same_sub:
      "Layar saat ini langsung berubah menjadi Mode Kiosk.",
    lbl_kiosk_pin: "PIN Keluar Kiosk",
    ph_kiosk_pin: "Contoh: 1234",
    btn_save_pin: "Simpan PIN",
    settings_kiosk_reset: "Durasi Pop-up Mode Kiosk",
    lbl_kiosk_reset_sub:
      "Atur berapa lama pop-up hasil scan tampil sebelum otomatis kembali ke layar scan untuk peserta berikutnya.",
    lbl_kiosk_reset_duration: "Durasi Auto-Reset",
    lbl_kiosk_reset_custom: "Custom (detik):",
    lbl_kiosk_reset_custom_hint: "(maksimal 30 detik)",
    settings_kiosk_tts_lang: "Bahasa Suara Text-to-Speech",
    lbl_kiosk_tts_lang_sub:
      "Pilih bahasa yang diucapkan Mode Kiosk saat menyapa nama peserta.",
    lbl_kiosk_tts_lang_hint:
      "Ketersediaan suara tergantung perangkat/browser yang digunakan.",
    opt_tts_lang_id: "Indonesia",
    opt_tts_lang_en: "English",
    settings_kiosk_pickup_sig: "Tanda Tangan Kiosk Pengambilan",
    lbl_kiosk_pickup_sig_desc:
      "Berlaku khusus untuk Kiosk QR Code Pengambilan (menampilkan Nomor Khusus/Unik peserta).",
    lbl_kiosk_pickup_sig_toggle: "Wajib Tanda Tangan Sebelum Menampilkan Data",
    lbl_kiosk_pickup_sig_toggle_sub:
      "Jika dimatikan, peserta langsung melihat Nomor Khusus/Unik miliknya begitu QR terpindai — tanpa diminta tanda tangan.",
    btn_print_qr: "Cetak Label",
    btn_print_selected: "Cetak Terpilih",
    title_select_all_guests: "Pilih Semua (hasil pencarian/filter saat ini)",
    title_select_all_custom: "Pilih Semua (hasil pencarian saat ini)",
    title_clear_selection: "Batal Pilih",
    txt_print_preparing: "Menyiapkan cetak...",
    txt_print_bulk_preparing: "Menyiapkan cetak massal...",
    txt_print_saved: "Pengaturan cetak QR disimpan!",
    lbl_print_orientation: "Orientasi Kertas Cetak",
    lbl_print_orientation_sub:
      "Pilih orientasi kertas untuk hasil cetak QR Code.",
    lbl_print_layout: "Layout Grid Cetak Massal",
    lbl_print_layout_sub:
      "Atur berapa kolom & baris kartu QR per halaman saat cetak massal (Cetak Semua).",
    btn_edit_print_layout: "Atur Layout Grid",
    modal_print_layout_title: "Atur Layout Grid Cetak",
    modal_print_layout_sub:
      'Tentukan berapa kolom dan baris kartu QR yang tercetak dalam satu halaman saat menggunakan "Cetak Semua". Setiap kelipatan kolom × baris akan otomatis berpindah ke halaman berikutnya.',
    lbl_print_layout_columns: "Jumlah Kolom",
    lbl_print_layout_rows: "Jumlah Baris / Halaman",
    lbl_print_layout_preview: "Pratinjau per Halaman",
    lbl_print_layout_per_page: "kartu per halaman",
    lbl_print_layout_custom_size: "Gunakan Ukuran Kustom (Cm)",
    lbl_print_layout_custom_size_sub:
      "Tentukan ukuran kartu QR secara pasti dalam sentimeter, alih-alih menyesuaikan otomatis ke lebar kertas.",
    lbl_print_layout_width_cm: "Lebar Kartu (Cm)",
    lbl_print_layout_height_cm: "Tinggi Kartu (Cm)",
    btn_save_print_layout: "Simpan Layout",
    txt_print_layout_saved: "Layout grid cetak berhasil disimpan.",
    opt_portrait: "Portrait",
    opt_landscape: "Landscape",
    lbl_dark_mode: "Mode Gelap",
    lbl_dark_mode_sub: "Aktifkan tampilan gelap untuk kenyamanan mata.",
    lbl_auth_caption: "Tulisan di Foto Background",
    lbl_auth_caption_sub:
      "Nonaktifkan agar foto tampil bersih tanpa judul, deskripsi, dan ikon.",
    lbl_bg_interval: "Kecepatan Pergantian Foto",
    lbl_bg_interval_sub:
      "Atur jeda waktu sebelum foto background berganti otomatis (berlaku bila foto lebih dari satu).",
    lbl_bg_interval_custom: "Custom (detik):",
    lbl_bg_interval_custom_hint: "(boleh lebih dari 10 detik)",
    btn_mark_all: "Absen Semua",
    btn_cancel_all: "Batal Absen Semua",
    lbl_registered_accounts: "Akun Terdaftar",
    lbl_preview: "Pratinjau Langsung",
    txt_preview_placeholder_qr: "QR Code akan muncul di sini",
    txt_preview_placeholder_barcode: "Barcode akan muncul di sini",
    lbl_barcode_format_info:
      "Format: CODE128 (mendukung huruf, angka & simbol ASCII).",
    title_view_grid: "Tampilan Grid/Card",
    title_view_list: "Tampilan List",
    title_filter_category: "Filter Kategori Event",
    opt_filter_all_category: "Semua Kategori",
    title_sort_library: "Urutkan Event",
    opt_sort_default_lib: "Urutan Bawaan",
    opt_sort_az: "Nama (A-Z)",
    opt_sort_za: "Nama (Z-A)",
  },
  en: {
    app_title: "EventQ",
    login_subtitle: "Log in to your account to continue",
    sub_admin: "Login as Admin to manage events",
    sub_public: "Login as Public to access events",
    auth_bg_title: "Manage Events with Ease",
    auth_bg_sub:
      "Generate QR Codes, track attendance, and manage participant data in real-time, all in one platform.",
    auth_feat_qr: "Instant QR Code",
    auth_feat_scan: "Real-time Scan",
    auth_feat_report: "Auto Reports",
    tab_admin: "Admin",
    tab_public: "Public",
    ph_username: "Enter your username",
    ph_password: "Enter your password",
    ph_fullname: "Full name as on ID",
    ph_reg_username: "Choose a username",
    ph_reg_password: "Create a password",
    lbl_username: "Username",
    lbl_password: "Password",
    btn_login: "Sign In",
    txt_no_account: "Don't have an account?",
    btn_register: "Register",
    btn_forgot_pw: "Forgot Password?",
    lbl_fullname: "Full Name",
    btn_create_account: "Create Account",
    txt_has_account: "Already have an account?",
    btn_login_back: "Sign in again",
    lbl_recovery_username: "Registered Username",
    btn_recover: "Search & Recover Account",
    txt_back_to: "Back to",
    btn_login_page: "Login Page",
    txt_loading: "Preparing Event Library...",
    txt_opening_event: "Opening Event...",
    lib_title: "Event Library",
    welcome: "Welcome back,",
    btn_create_event: "Create Event",
    txt_no_event: "No events yet",
    txt_no_event_sub: "Start your journey by creating a new event.",
    txt_no_event_filtered: "No matching events found",
    txt_no_event_filtered_sub:
      "Try changing your search keyword or category filter.",
    settings_title: "Application Settings",
    settings_profile: "User Profile",
    lbl_new_password: "New Password",
    btn_save_changes: "Save Changes",
    settings_pref: "Appearance & Language",
    lbl_language: "App Language",
    lbl_language_sub: "Set the app's language and display mode.",
    settings_login_page: "Login Page",
    settings_login_page_desc:
      "Customize the logo, background photo, and caption on the login page.",
    tab_dash: "Dashboard",
    tab_gen: "Create Participant QR",
    tab_read: "Scan Attendance",
    tab_list: "Participant Data",
    tab_att: "Attendance List",
    dash_reg: "Registrants",
    dash_att: "Attendance",
    dash_pct: "Percentage",
    dash_chart_rs: "Hospital Origin Stats",
    dash_chart_status: "Attendance Status",
    dash_feed_new: "Recent Registrants",
    dash_feed_att: "Recent Attendances",
    form_title: "Participant Registration Form",
    form_sub: "Enter participant data to create unique ID and QR Code.",
    lbl_rs: "Hospital Origin",
    lbl_jabatan: "Position",
    lbl_kursi: "Seat Number (Optional)",
    txt_mandatory: "Fields with an asterisk (*) are required.",
    lbl_kursi_th: "Seat",
    lbl_kursi_label: "Seat Number",
    lbl_seat_label_type: "Type of number used:",
    opt_seat_kursi: "Seat Number",
    opt_seat_meja: "Table Number",
    btn_gen_qr: "Generate QR Code",
    scan_title: "Scan Attendance QR Code",
    scan_sub: "Point camera at participant QR Code or upload file.",
    btn_bulk_qr: "Bulk Download QR",
    btn_export: "Export Excel",
    btn_export_att: "Export Excel",
    btn_import: "Import Excel",
    btn_template: "Template",
    list_title: "All Participant List",
    lbl_status: "Status",
    lbl_action: "Action",
    txt_empty_guest: "No participant data registered yet.",
    att_title: "Attendance Recap",
    lbl_time: "Time In",
    txt_empty_att: "No participants have checked in yet.",
    modal_event_title: "Create New Event",
    lbl_event_name: "Event Name",
    lbl_event_type: "Event Type",
    lbl_event_date: "Start Date & Time",
    lbl_event_logo: "Event Logo (Optional)",
    btn_cancel: "Cancel",
    btn_save: "Save",
    btn_confirm: "Yes, Continue",
    lbl_custom_number_fields: "Custom/Unique Participant Number (Optional)",
    lbl_custom_number_fields_sub:
      "Add extra unique number types to be filled in on the participant data form, e.g. National ID, Registration No., or Employee ID.",
    btn_add_custom_number_field: "Add Number Type",
    lbl_hide_columns: "Hide Participant Data Columns (Optional)",
    lbl_hide_columns_sub:
      "Checked columns will be hidden from the Participant Data & Attendance List tables. The data stays fully stored and is still used normally by the system (form, QR, print, export) — you can unhide it anytime.",
    lbl_hide_col_rs: "Hospital/Institution Origin",
    modal_del_title: "Delete Data?",
    modal_del_sub: "This action is permanent and cannot be undone.",
    btn_delete: "Yes, Delete",
    modal_qr_title: "Preview QR Code",
    btn_close: "Close Preview",
    modal_scan_ok: "Check-In Successful",
    btn_continue_scan: "Continue Scan QR",
    modal_scan_already: "Already Checked In",
    lbl_scan_recorded_at: "Recorded at",
    lbl_eventq_info: "EventQ Information",
    modal_dup_name_title: "Name Already Registered",
    modal_dup_id_title: "Duplicate Quest ID Found",
    modal_import_mode_title: "Existing Participant Data Found",
    modal_import_mode_sub:
      "This event already has participant data. Choose how the new file data should be processed:",
    lbl_import_existing: "Existing",
    lbl_import_new: "New Data",
    lbl_import_total_after_merge: "If Merged",
    btn_import_merge: "Merge with Existing Data",
    btn_import_merge_desc: "New data is added without deleting existing data.",
    btn_import_replace: "Delete Old Data, Replace with New",
    btn_import_replace_desc:
      "All current participant data will be permanently deleted.",
    modal_dup_event_title: "Duplicate Event",
    modal_dup_event_sub:
      "This event has registered participant data. Choose how the duplicate should be created:",
    lbl_dup_event_guest_count: "Participants Registered in Original Event",
    btn_dup_with_data: "Duplicate With Participant Data",
    btn_dup_with_data_desc:
      "The participant list is copied too. Attendance & pickup status are reset to fresh.",
    btn_dup_no_data: "Duplicate Without Participant Data",
    btn_dup_no_data_desc:
      "Only the event configuration is copied. Participants start from empty.",
    modal_edit_title: "Edit Participant Data",
    lbl_app_logo: "Application Logo",
    lbl_app_logo_sub: "Change login logo and Favicon.",
    opt_top5: "Top 5",
    opt_all: "All",
    opt_status_all: "All Status",
    opt_status_present: "Present",
    opt_status_absent: "Absent",
    opt_sort_default: "Default Order",
    opt_sort_nama_asc: "Name (A-Z)",
    opt_sort_nama_desc: "Name (Z-A)",
    opt_sort_rs_asc: "Hospital/Institution (A-Z)",
    opt_sort_rs_desc: "Hospital/Institution (Z-A)",
    opt_sort_jabatan_asc: "Position (A-Z)",
    opt_sort_jabatan_desc: "Position (Z-A)",
    btn_reset_logo: "Reset Default Logo",
    btn_reset_settings: "Restore Default Settings",
    confirm_reset: "Settings restored to default",
    lbl_bg_login: "Login Background",
    lbl_bg_login_sub:
      "Upload multiple photos at once, the background will rotate automatically at the speed set below.",
    btn_reset_bg: "Reset Background",
    btn_shortcut_to_barcode: "To Barcode Generator",
    btn_shortcut_to_qr: "To QR Code Generator",
    btn_scan_qr: "Scan QR",
    btn_scan_barcode: "Scan Barcode",
    modal_scan_qr_title: "Scan QR Code",
    modal_scan_barcode_title: "Scan Barcode",
    modal_scan_qr_sub: "Point your camera at a QR Code to read its content.",
    modal_scan_barcode_sub:
      "Point your camera at a Barcode to read its content.",
    lbl_scan_result: "Result",
    btn_copy_result: "Copy",
    btn_open_link: "Open Link",
    btn_scan_again: "Scan Again",
    toast_scan_success: "Code scanned successfully!",
    toast_copied: "Copied to clipboard",
    toast_copy_failed: "Failed to copy.",
    title_bg_login_add: "Click to add a background photo",
    title_bg_login_remove: "Remove this photo",
    title_toggle_pw: "Show password",
    modal_prof_title: "Setup Profile Picture",
    btn_prof_upload: "Upload New Picture",
    btn_prof_reset: "Use Default Avatar",
    btn_reset_logo_event: "Default",
    btn_share_access: "Share Access",
    modal_share_title: "Share Event Access",
    lbl_select_user: "Select User",
    txt_no_other_users: "No other registered users.",
    settings_backup: "Data Backup & Restore",
    lbl_backup_sub:
      "Secure your event, participant, and settings data by downloading a Backup (JSON) file. You can restore it anytime.",
    btn_backup: "Download Backup",
    btn_restore: "Load Backup",
    settings_restore_system: "Restore System",
    lbl_restore_system_sub:
      "Restore all app settings (logo, appearance, login page, QR print, Kiosk PIN, etc.) back to their original defaults.",
    settings_about: "About This App",
    lbl_about_sub:
      "The EventQ version currently in use, along with its update history.",
    modal_restore_title: "Restore Data Backup?",
    modal_restore_sub:
      "Warning: All current data will be overwritten with the data from the backup file. You will be automatically logged out after the process is complete.",
    btn_other_tools: "Other Tools",
    modal_tools_title: "Additional Tools",
    tool_qr_gen: "QR Code Generator",
    tool_qr_desc: "Create custom QR Codes from text or URL links.",
    tools_qr_title: "Custom QR Code Generator",
    lbl_qr_name: "QR Name / Label",
    lbl_qr_content: "Text / URL Link",
    lbl_create_new_qr: "Create New QR",
    btn_generate: "Generate & Save",
    txt_loading_qr_gen: "Preparing Custom QR Code Generator...",
    txt_loading_barcode_gen: "Preparing Custom Barcode Generator...",
    tool_barcode_gen: "Barcode Generator",
    tool_barcode_desc:
      "Create custom Barcodes from text for logistics / event data.",
    tools_barcode_title: "Custom Barcode Generator",
    lbl_create_new_barcode: "Create New Barcode",
    lbl_barcode_name: "Barcode Name / Label",
    lbl_barcode_content: "Text / Barcode Value",
    lbl_hotel_needs: "Require hotel room key & accommodation data",
    lbl_room: "Room Number",
    lbl_room_opt: "Room Number (Optional)",
    lbl_key_taken: "Key Taken",
    lbl_key_signature_needs: "Require signature as proof of key pickup",
    lbl_key_signature_needs_sub:
      "If turned off, key pickup only needs to be checked and the picker's name filled in — no signature modal.",
    lbl_seat_needs: "Require Number data for attendees",
    btn_generating: "Processing...",
    btn_close_tools: "Close additional tools",
    admin_manage_users: "User Management",
    admin_manage_users_desc:
      "Manage access, edit data, and create new accounts for Admin and Public.",
    btn_manage_users: "Manage Users",
    plc_search_event: "Search event...",
    plc_search_user: "Search by username or name...",
    opt_role_all: "All Accounts",
    lbl_account_type: "Account Type",
    opt_public: "Public User",
    opt_admin: "Admin User",
    btn_create_new_account: "Create New Account",
    lbl_share_search: "Search name / username...",
    btn_close_menu: "Close Menu",
    title_tools: "Other Tools",
    title_settings: "App Settings",
    txt_not_found: "User not found.",
    txt_credentials_hidden: "Username & password hidden",
    settings_print_qr: "QR Code Print Settings",
    lbl_print_qr_sub:
      "Set the additional information printed alongside participant QR Codes (event name/title, name, ID number, hospital/institution origin, position, seat number, event logo).",
    lbl_print_field_eventname: "Event Name/Title",
    lbl_print_field_nama: "Participant Name",
    lbl_print_field_id: "Participant ID Number",
    lbl_print_field_rs: "Hospital / Institution Origin",
    lbl_print_field_jabatan: "Position",
    lbl_print_field_kursi: "Seat Number",
    lbl_print_field_logo: "Event Logo (Top-Right Corner)",
    lbl_print_logo_hint:
      "The logo is taken automatically from the logo photo uploaded on each event. If an event has no logo yet, this part will be skipped.",
    lbl_print_frame: "Print Card Frame",
    lbl_print_frame_sub: "Show a border line around each QR card when printed.",
    title_print_custom_settings: "Print Settings",
    lbl_print_custom_settings_title: "Info to Print",
    lbl_print_field_tools_title: "Tool Title",
    lbl_print_field_name: "Name",
    lbl_print_field_content: "Content / Value",
    lbl_storage_usage: "Browser Storage Usage",
    lbl_storage_usage_hint: "Capacity varies by browser",
    settings_kiosk_menu: "Kiosk Mode",
    settings_kiosk_pin: "Kiosk Mode Security",
    lbl_kiosk_pin_sub:
      "This PIN is required to exit Kiosk Mode, so participants can't access the data management page.",
    modal_kiosk_type_title: "Choose Kiosk Type",
    modal_kiosk_type_sub: "Choose which Kiosk Mode type you want to use.",
    kiosk_type_attendance: "Attendance Kiosk",
    kiosk_type_attendance_sub:
      "Participants scan their QR to record attendance themselves.",
    kiosk_type_pickup: "QR Code Pickup Kiosk",
    kiosk_type_pickup_sub:
      "Participants scan their QR to display their info & their Special/Unique Number.",
    kiosk_type_check: "Data Check Kiosk",
    kiosk_type_check_sub:
      "Participants/staff scan their QR just to view their info, without changing attendance or pickup status.",
    badge_kiosk_active: "Active",
    btn_back: "Back",
    modal_kiosk_choice_title: "Open Kiosk Mode",
    modal_kiosk_choice_sub: "Choose where the Kiosk Mode screen should appear.",
    kiosk_choice_window: "New Window",
    kiosk_choice_window_sub:
      "Great for a separate screen/monitor dedicated to the kiosk.",
    kiosk_choice_tab: "New Tab",
    kiosk_choice_tab_sub: "Stay in the same browser, in a separate tab.",
    kiosk_choice_same: "This Window",
    kiosk_choice_same_sub: "This screen switches to Kiosk Mode right away.",
    lbl_kiosk_pin: "Kiosk Exit PIN",
    ph_kiosk_pin: "e.g. 1234",
    btn_save_pin: "Save PIN",
    settings_kiosk_reset: "Kiosk Mode Popup Duration",
    lbl_kiosk_reset_sub:
      "Set how long the scan result popup stays visible before automatically returning to the scan screen for the next participant.",
    lbl_kiosk_reset_duration: "Auto-Reset Duration",
    lbl_kiosk_reset_custom: "Custom (seconds):",
    lbl_kiosk_reset_custom_hint: "(maximum 30 seconds)",
    settings_kiosk_tts_lang: "Text-to-Speech Voice Language",
    lbl_kiosk_tts_lang_sub:
      "Choose the language Kiosk Mode uses when greeting participants by name.",
    lbl_kiosk_tts_lang_hint:
      "Voice availability depends on the device/browser being used.",
    opt_tts_lang_id: "Indonesian",
    opt_tts_lang_en: "English",
    settings_kiosk_pickup_sig: "Pickup Kiosk Signature",
    lbl_kiosk_pickup_sig_desc:
      "Applies specifically to the QR Code Pickup Kiosk (displaying the participant's Special/Unique Number).",
    lbl_kiosk_pickup_sig_toggle: "Require Signature Before Showing Data",
    lbl_kiosk_pickup_sig_toggle_sub:
      "If turned off, participants see their Special/Unique Number right after their QR is scanned — no signature required.",
    btn_print_qr: "Print Label",
    btn_print_selected: "Print Selected",
    title_select_all_guests: "Select All (current search/filter results)",
    title_select_all_custom: "Select All (current search results)",
    title_clear_selection: "Clear Selection",
    txt_print_preparing: "Preparing print...",
    txt_print_bulk_preparing: "Preparing bulk print...",
    txt_print_saved: "Print QR settings saved!",
    lbl_print_orientation: "Print Paper Orientation",
    lbl_print_orientation_sub:
      "Choose the paper orientation for QR Code prints.",
    lbl_print_layout: "Bulk Print Grid Layout",
    lbl_print_layout_sub:
      "Set how many columns & rows of QR cards print per page for bulk printing (Print All).",
    btn_edit_print_layout: "Edit Grid Layout",
    modal_print_layout_title: "Edit Print Grid Layout",
    modal_print_layout_sub:
      'Set how many columns and rows of QR cards print on a single page when using "Print All". Every multiple of columns × rows automatically moves to the next page.',
    lbl_print_layout_columns: "Columns",
    lbl_print_layout_rows: "Rows / Page",
    lbl_print_layout_preview: "Preview per Page",
    lbl_print_layout_per_page: "card(s) per page",
    lbl_print_layout_custom_size: "Use Custom Size (Cm)",
    lbl_print_layout_custom_size_sub:
      "Set the exact QR card size in centimeters, instead of auto-fitting it to the paper width.",
    lbl_print_layout_width_cm: "Card Width (Cm)",
    lbl_print_layout_height_cm: "Card Height (Cm)",
    btn_save_print_layout: "Save Layout",
    txt_print_layout_saved: "Print grid layout saved successfully.",
    opt_portrait: "Portrait",
    opt_landscape: "Landscape",
    lbl_dark_mode: "Dark Mode",
    lbl_dark_mode_sub: "Enable dark theme for eye comfort.",
    lbl_auth_caption: "Text on Background Photo",
    lbl_auth_caption_sub:
      "Turn off to show the photo cleanly without title, description, or icon.",
    lbl_bg_interval: "Photo Rotation Speed",
    lbl_bg_interval_sub:
      "Set the delay before the background photo changes automatically (applies when there is more than one photo).",
    lbl_bg_interval_custom: "Custom (seconds):",
    lbl_bg_interval_custom_hint: "(can be more than 10 seconds)",
    btn_mark_all: "Mark All Present",
    btn_cancel_all: "Cancel All Attendance",
    lbl_registered_accounts: "Registered Accounts",
    lbl_preview: "Live Preview",
    txt_preview_placeholder_qr: "Your QR Code will appear here",
    txt_preview_placeholder_barcode: "Your barcode will appear here",
    lbl_barcode_format_info:
      "Format: CODE128 (supports letters, numbers & ASCII symbols).",
    title_view_grid: "Grid/Card View",
    title_view_list: "List View",
    title_filter_category: "Filter by Event Category",
    opt_filter_all_category: "All Categories",
    title_sort_library: "Sort Events",
    opt_sort_default_lib: "Default Order",
    opt_sort_az: "Name (A-Z)",
    opt_sort_za: "Name (Z-A)",
  },
};

window.t = function (key) {
  return dict[window.currentLang][key] || key;
};

window.applyLanguage = function () {
  let tempId = dict["id"]["lbl_rs"];
  let tempEn = dict["en"]["lbl_rs"];
  let tempKursiId = dict["id"]["lbl_kursi"];
  let tempKursiEn = dict["en"]["lbl_kursi"];
  let tempKursiThId = dict["id"]["lbl_kursi_th"];
  let tempKursiThEn = dict["en"]["lbl_kursi_th"];
  let tempKursiLabelId = dict["id"]["lbl_kursi_label"];
  let tempKursiLabelEn = dict["en"]["lbl_kursi_label"];
  let isMeja = false;
  if (window.appState.currentEventId) {
    const evt = LS.getEvents().find(
      (e) => e.id === window.appState.currentEventId,
    );
    if (evt && (evt.type === "Internal" || evt.type === "Lain-lain")) {
      dict["id"]["lbl_rs"] = "Asal Instansi";
      dict["en"]["lbl_rs"] = "Institution Origin";
    }
    if (evt && evt.seatLabelType === "meja") {
      isMeja = true;
      dict["id"]["lbl_kursi"] = "Nomor Meja (Opsional)";
      dict["en"]["lbl_kursi"] = "Table Number (Optional)";
      dict["id"]["lbl_kursi_th"] = "Meja";
      dict["en"]["lbl_kursi_th"] = "Table";
      dict["id"]["lbl_kursi_label"] = "Nomor Meja";
      dict["en"]["lbl_kursi_label"] = "Table Number";
    }
  }

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[window.currentLang][key])
      el.innerHTML = dict[window.currentLang][key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[window.currentLang][key])
      el.setAttribute("placeholder", dict[window.currentLang][key]);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (dict[window.currentLang][key])
      el.setAttribute("title", dict[window.currentLang][key]);
  });

  // Ikon "kursi" pada form pendaftaran & preview QR ikut menyesuaikan bila event memakai
  // istilah "Nomor Meja" — fa-chair untuk kursi, fa-utensils untuk representasi meja
  // (fa-table sebelumnya dipakai, tapi bentuknya menyerupai tabel data/spreadsheet,
  // bukan meja fisik, sehingga membingungkan).
  const seatIconClass = isMeja ? "fa-utensils" : "fa-chair";
  const inputKursiIcon = document.getElementById("input-kursi-icon");
  if (inputKursiIcon)
    inputKursiIcon.className = `fa-solid ${seatIconClass} absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm`;

  dict["id"]["lbl_rs"] = tempId;
  dict["en"]["lbl_rs"] = tempEn;
  dict["id"]["lbl_kursi"] = tempKursiId;
  dict["en"]["lbl_kursi"] = tempKursiEn;
  dict["id"]["lbl_kursi_th"] = tempKursiThId;
  dict["en"]["lbl_kursi_th"] = tempKursiThEn;
  dict["id"]["lbl_kursi_label"] = tempKursiLabelId;
  dict["en"]["lbl_kursi_label"] = tempKursiLabelEn;

  const selLang = document.getElementById("app-language");
  if (selLang) selLang.value = window.currentLang;
};

window.changeLanguage = function (lang) {
  window.currentLang = lang;
  localStorage.setItem("qis_lang", lang);
  window.applyLanguage();
  window.updateHeaderDateTime();
  window.renderStorageMeter();
  window.renderAppVersionInfo();
  window.renderUserManageSummary();
  if (
    document.getElementById("tab-content-dashboard") &&
    document
      .getElementById("tab-content-dashboard")
      .classList.contains("active")
  )
    window.renderDashboard();
  if (
    document.getElementById("view-app") &&
    !document.getElementById("view-app").classList.contains("view-hidden")
  )
    window.renderTable();
};

// Membaca JSON dari localStorage dengan aman - kalau datanya entah kenapa rusak/tidak valid
// (mis. penyimpanan browser bermasalah, ekstensi lain ikut mengubah, dsb), JSON.parse mentah
// akan throw & bisa menjatuhkan seluruh aplikasi sejak awal load (karena data event/peserta
// dibaca sangat awal). Fallback dikembalikan saja, dan errornya dicatat ke console supaya
// masih bisa ditelusuri kalau perlu debug.
function safeJSONParse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Data tersimpan rusak/tidak valid, memakai nilai kosong:", e);
    return fallback;
  }
}

// Membungkus localStorage.setItem supaya kegagalan menyimpan (paling sering karena kuota
// penyimpanan browser penuh - localStorage biasanya dibatasi sekitar 5-10MB, gampang tercapai
// kalau banyak menyimpan logo/tanda tangan/background dalam bentuk base64) TIDAK menjatuhkan
// aplikasi dengan error tak tertangani di tengah proses (mis. peserta sudah ditambahkan di
// memori tapi gagal tersimpan tanpa pemberitahuan apa pun ke pengguna). Mengembalikan
// true/false supaya pemanggil yang butuh tahu masih bisa membatalkan/mengulang aksinya.
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error("Gagal menyimpan ke localStorage:", key, e);
    if (typeof window.showToast === "function") {
      window.showToast(
        window.currentLang === "id"
          ? "Gagal menyimpan data! Penyimpanan browser kemungkinan penuh - coba hapus beberapa logo/foto/gambar yang tidak perlu, lalu ulangi."
          : "Failed to save data! Browser storage may be full - try removing some unnecessary logos/photos/images, then try again.",
        "error",
      );
    }
    return false;
  }
}

const LS = {
  getUsers: () => safeJSONParse(localStorage.getItem("qis_users"), []) || [],
  setUsers: (data) => safeLocalStorageSet("qis_users", JSON.stringify(data)),
  getEvents: () => safeJSONParse(localStorage.getItem("qis_events"), []) || [],
  setEvents: (data) => safeLocalStorageSet("qis_events", JSON.stringify(data)),
  getGuests: (eventId) =>
    safeJSONParse(localStorage.getItem(`qis_guests_${eventId}`), []) || [],
  setGuests: (eventId, data) =>
    safeLocalStorageSet(`qis_guests_${eventId}`, JSON.stringify(data)),
  getSetting: (key) => localStorage.getItem(`qis_setting_${key}`),
  setSetting: (key, val) => safeLocalStorageSet(`qis_setting_${key}`, val),
  getCustomQRs: () =>
    safeJSONParse(localStorage.getItem("qis_custom_qrs"), []) || [],
  setCustomQRs: (data) =>
    safeLocalStorageSet("qis_custom_qrs", JSON.stringify(data)),
  getCustomBarcodes: () =>
    safeJSONParse(localStorage.getItem("qis_custom_barcodes"), []) || [],
  setCustomBarcodes: (data) =>
    safeLocalStorageSet("qis_custom_barcodes", JSON.stringify(data)),
  getLoginBgList: () => {
    const raw = localStorage.getItem("qis_setting_bg_login_list");
    if (raw) return safeJSONParse(raw, []);
    // Migrasi otomatis dari pengaturan lama (satu foto background)
    const legacy = localStorage.getItem("qis_setting_bg_login");
    if (legacy) {
      const list = [legacy];
      safeLocalStorageSet("qis_setting_bg_login_list", JSON.stringify(list));
      localStorage.removeItem("qis_setting_bg_login");
      return list;
    }
    return [];
  },
  setLoginBgList: (list) =>
    safeLocalStorageSet("qis_setting_bg_login_list", JSON.stringify(list)),
};

// ===== Sistem Hak Akses Fitur per Pengguna (Kelola Akses) =====
// Setiap fitur/tombol punya "key" unik. Secara default SEMUA fitur aktif (true) untuk menjaga
// kompatibilitas dengan akun yang sudah ada sebelum fitur ini dibuat — admin baru perlu mencentang
// hilang (nonaktifkan) fitur tertentu secara eksplisit lewat modal "Kelola Akses Fitur".
const FEATURE_PERMISSION_GROUPS = [
  {
    label: "Tools Tambahan (Library)",
    items: [
      {
        key: "toolQRGenerator",
        label: "Custom QR Code Generator",
        icon: "fa-qrcode",
      },
      {
        key: "toolBarcodeGenerator",
        label: "Custom Barcode Generator",
        icon: "fa-barcode",
      },
    ],
  },
  {
    label: "Tab di Dalam Event",
    items: [
      { key: "tabDashboard", label: "Dashboard", icon: "fa-chart-pie" },
      { key: "tabGenerate", label: "Buat QR Peserta", icon: "fa-user-plus" },
      { key: "tabScan", label: "Scan Kehadiran", icon: "fa-expand" },
      {
        key: "kioskMode",
        label: "Mode Kiosk",
        icon: "fa-tablet-screen-button",
      },
    ],
  },
  {
    label: "Toolbar Data Peserta",
    items: [
      {
        key: "bulkDownloadQR",
        label: "Bulk Download QR",
        icon: "fa-file-zipper",
      },
      {
        key: "printSelectedQR",
        label: "Cetak Terpilih",
        icon: "fa-square-check",
      },
      { key: "exportExcelList", label: "Export Excel", icon: "fa-file-excel" },
      { key: "importExcelList", label: "Import Excel", icon: "fa-upload" },
      { key: "downloadTemplate", label: "Unduh Template", icon: "fa-download" },
      { key: "markAllAttendance", label: "Absen Semua", icon: "fa-user-check" },
      {
        key: "cancelAllAttendance",
        label: "Batal Absen Semua",
        icon: "fa-user-xmark",
      },
    ],
  },
  {
    label: "Toolbar Daftar Hadir",
    items: [
      {
        key: "exportExcelAttended",
        label: "Export Excel",
        icon: "fa-file-excel",
      },
    ],
  },
  {
    label: "Tombol Aksi per Peserta (Data Peserta)",
    items: [
      { key: "actionManual", label: "Absen Manual", icon: "fa-check" },
      { key: "actionPreviewQR", label: "Preview QR", icon: "fa-qrcode" },
      { key: "actionDownloadQR", label: "Download QR", icon: "fa-download" },
      { key: "actionPrintQR", label: "Cetak QR", icon: "fa-print" },
      { key: "actionEdit", label: "Edit", icon: "fa-pen" },
      { key: "actionDelete", label: "Hapus", icon: "fa-trash" },
    ],
  },
];
const ALL_FEATURE_KEYS = FEATURE_PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

function getDefaultPermissions() {
  const p = {};
  ALL_FEATURE_KEYS.forEach((k) => (p[k] = true));
  return p;
}

// Super Admin selalu punya akses penuh & tidak bisa dibatasi.
// Untuk role lain (Admin biasa maupun Public), key yang belum pernah diatur dianggap AKTIF (true).
window.hasFeaturePerm = function (key) {
  const u = window.appState.currentUser;
  if (!u) return false;
  if (u.role === "admin" && u.isSuperAdmin) return true;
  if (!u.permissions || u.permissions[key] === undefined) return true;
  return u.permissions[key] !== false;
};

// Terapkan visibilitas tab & tombol toolbar berdasarkan hak akses user yang sedang login.
// Dipanggil setiap kali masuk ke sebuah event (tombol baris peserta diatur langsung saat render tabel)
// MAUPUN setiap kali halaman Library dimuat (lihat window.loadLibrary) — karena Tools Tambahan
// (Custom QR/Barcode Generator) adalah fitur level Library, di luar event.
window.applyFeaturePermissions = function () {
  const setVisible = (id, allowed) => {
    const el = document.getElementById(id);
    if (el) el.style.display = allowed ? "" : "none";
  };

  // Tools Tambahan: tombol pembuka daftar Tools di Library, dua kartu di dalam modal-nya, serta
  // tombol pintasan lintas-tool ("Ke Barcode Generator" di halaman QR & sebaliknya) yang bisa
  // memicu perpindahan tanpa lewat kartu modal - semuanya mengikuti checkbox yang sama supaya
  // pengguna yang aksesnya dicabut ke salah satu tool benar-benar tidak menemukan jalan masuk.
  const canToolQR = window.hasFeaturePerm("toolQRGenerator");
  const canToolBarcode = window.hasFeaturePerm("toolBarcodeGenerator");
  setVisible("btn-lib-tools", canToolQR || canToolBarcode);
  setVisible("tool-card-qr-gen", canToolQR);
  setVisible("tool-card-barcode-gen", canToolBarcode);
  setVisible("btn-tools-shortcut-to-barcode", canToolBarcode);
  setVisible("btn-tools-shortcut-to-qr", canToolQR);

  setVisible("tab-dashboard", window.hasFeaturePerm("tabDashboard"));
  setVisible("tab-generate", window.hasFeaturePerm("tabGenerate"));
  setVisible("tab-read", window.hasFeaturePerm("tabScan"));
  setVisible("btn-kiosk-mode", window.hasFeaturePerm("kioskMode"));

  setVisible("btn-bulk-download-qr", window.hasFeaturePerm("bulkDownloadQR"));
  setVisible("btn-print-selected-qr", window.hasFeaturePerm("printSelectedQR"));
  setVisible("btn-export-excel-list", window.hasFeaturePerm("exportExcelList"));
  setVisible("btn-import-excel", window.hasFeaturePerm("importExcelList"));
  setVisible(
    "btn-download-template",
    window.hasFeaturePerm("downloadTemplate"),
  );
  setVisible(
    "btn-mark-all-attendance",
    window.hasFeaturePerm("markAllAttendance"),
  );
  setVisible(
    "btn-cancel-all-attendance",
    window.hasFeaturePerm("cancelAllAttendance"),
  );
  setVisible(
    "btn-export-excel-attended",
    window.hasFeaturePerm("exportExcelAttended"),
  );
};

// Tab pertama yang boleh dibuka user saat masuk event (fallback ke 'list' karena tab
// Data Peserta & Daftar Hadir sendiri tidak termasuk fitur yang bisa dibatasi).
window.getDefaultTabName = function () {
  if (window.hasFeaturePerm("tabDashboard")) return "dashboard";
  if (window.hasFeaturePerm("tabGenerate")) return "generate";
  if (window.hasFeaturePerm("tabScan")) return "read";
  return "list";
};

window.showToast = function (msg, type = "success") {
  const t = document.getElementById("toast");
  const icon = document.getElementById("toast-icon");
  if (type === "success") {
    t.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl transition-all duration-400 z-[100] flex items-center gap-3 font-semibold bg-emerald-600 text-white border-emerald-500 toast-hidden`;
    icon.className = "fa-solid fa-circle-check text-xl";
  } else if (type === "error") {
    t.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl transition-all duration-400 z-[100] flex items-center gap-3 font-semibold bg-red-600 text-white border-red-500 toast-hidden`;
    icon.className = "fa-solid fa-circle-exclamation text-xl";
  } else if (type === "warning") {
    t.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl transition-all duration-400 z-[100] flex items-center gap-3 font-semibold bg-amber-500 text-white border-amber-400 toast-hidden`;
    icon.className = "fa-solid fa-triangle-exclamation text-xl";
  } else {
    t.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl transition-all duration-400 z-[100] flex items-center gap-3 font-semibold bg-indigo-600 text-white border-indigo-500 toast-hidden`;
    icon.className = "fa-solid fa-bell text-xl";
  }
  document.getElementById("toast-msg").innerText = msg;
  // Double rAF: konsisten dengan openModalAnimated, memastikan kondisi awal (toast-hidden)
  // sempat dilukis browser sebelum transisi ke toast-visible dimulai.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      t.classList.remove("toast-hidden");
      t.classList.add("toast-visible");
    });
  });
  setTimeout(() => {
    t.classList.remove("toast-visible");
    t.classList.add("toast-hidden");
  }, 3500);
};

// Daftar modal yang tampil di atas modal LAIN (berbagi backdrop terpisah "modal-backdrop-nested"
// supaya lapisan blur-nya bertumpuk rapi) - dipakai bersama oleh window.openModalAnimated,
// window.closeModalAnimated, & handler tombol Escape (lihat di bawah). Sebelumnya array ini
// didefinisikan ULANG persis sama di dua tempat terpisah (rawan pecah kalau salah satu lupa
// diperbarui saat ada modal nested baru) - sekarang cukup satu sumber kebenaran.
const NESTED_MODAL_IDS = [
  "modal-user-form",
  "modal-user-permissions",
  "modal-export-auth",
  "modal-kiosk-exit-pin",
  "modal-confirm",
  "modal-cropper",
  "modal-edit-custom-qr",
  "modal-edit-custom-barcode",
  "modal-signature",
  "modal-preview-signature",
];

window.openModalAnimated = function (id) {
  const backdrop = NESTED_MODAL_IDS.includes(id)
    ? document.getElementById("modal-backdrop-nested")
    : document.getElementById("modal-backdrop");
  const modal = document.getElementById(id);
  const content = modal.querySelector(".modal-content");
  backdrop.classList.remove("hidden");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  // Double rAF: memastikan browser benar-benar sempat melukis kondisi awal (scale-down, opacity 0)
  // dulu sebelum kelas "show" ditambahkan — satu rAF saja kadang masih digabung ke frame yang sama
  // di sebagian browser, sehingga animasi masuknya terlewat/langsung "meloncat" ke kondisi akhir.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      backdrop.classList.add("show");
      content.classList.add("show");
    });
  });
};

window.closeModalAnimated = function (id) {
  const isNested = NESTED_MODAL_IDS.includes(id);
  const backdrop = isNested
    ? document.getElementById("modal-backdrop-nested")
    : document.getElementById("modal-backdrop");
  const modal = document.getElementById(id);
  if (!modal) return;
  const content = modal.querySelector(".modal-content");

  content.classList.remove("show");

  // Dicek sebagai fungsi (bukan nilai sekali hitung) karena dievaluasi DUA KALI: sekarang,
  // dan sekali lagi tepat sebelum backdrop benar-benar disembunyikan 400ms kemudian. Alasannya:
  // beberapa alur menutup modal ini lalu LANGSUNG membuka modal lain yang berbagi backdrop sama
  // (mis. pilih jenis Mode Kiosk -> lanjut ke modal pilihan lokasi tampil). Kalau hanya dicek
  // sekali di awal (sebelum modal berikutnya sempat terbuka), hasilnya "tidak ada modal lain"
  // ikut kebawa ke dalam setTimeout — sehingga backdrop (dan efek blur-nya) tetap disembunyikan
  // paksa 400ms kemudian walau modal berikutnya itu sebenarnya masih terbuka.
  const anyOtherSharingBackdrop = () => {
    let found = false;
    document.querySelectorAll(".modal-content").forEach((c) => {
      const m = c.closest('div[id^="modal-"]');
      if (m && m.id !== id && !m.classList.contains("hidden")) {
        if (NESTED_MODAL_IDS.includes(m.id) === isNested) found = true;
      }
    });
    return found;
  };

  if (!anyOtherSharingBackdrop()) backdrop.classList.remove("show");

  // Menunggu 400ms (bukan 300ms) agar cocok dengan durasi transisi TRANSFORM pada .modal-content
  // (efek "bounce" saat menutup) — sebelumnya modal disembunyikan paksa 100ms lebih awal,
  // memotong animasi mengecilnya modal sebelum selesai.
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    if (!anyOtherSharingBackdrop()) backdrop.classList.add("hidden");
  }, 400);
};

// ===== Tutup Modal Terbuka dengan Tombol Escape (Event Handler baru) =====
// Sebelumnya TIDAK ADA cara menutup modal manapun selain mengklik tombol Batal/Tutup/X secara
// manual - kebiasaan umum di hampir semua aplikasi modal/dialog. Supaya tetap AMAN (tidak
// melewatkan proses pembersihan khusus tiap modal, mis. menghentikan kamera scanner via
// window.closeScanReaderModal, melanjutkan status scan via window.resumeScannerState, dsb.),
// Escape TIDAK memanggil window.closeModalAnimated secara langsung/manual per-id. Sebagai
// gantinya, setiap tombol Batal/Tutup/X resmi di index.html sudah ditandai atribut
// "data-modal-dismiss" - Escape mencari tombol itu di dalam modal yang sedang tampil paling atas
// lalu men-triggernya persis seperti diklik sungguhan, supaya logika apa pun yang menempel di
// tombol itu tetap berjalan normal & tidak pernah kadaluarsa/tidak sinkron kalau ada modal baru
// ditambahkan di kemudian hari (asal tombol Batal/Tutup-nya ikut ditandai atribut yang sama).
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  const openModalsWithDismiss = Array.from(
    document.querySelectorAll('div[id^="modal-"]'),
  ).filter(
    (m) =>
      !m.classList.contains("hidden") &&
      m.querySelector("[data-modal-dismiss]"),
  );
  if (openModalsWithDismiss.length === 0) return;
  // Kalau ada lebih dari satu modal terbuka bertumpuk (mis. "Kelola Pengguna" lalu di
  // dalamnya buka form nested "Tambah Pengguna"), yang ditutup HANYA modal paling atas -
  // ditentukan dari z-index CSS aktualnya (modal nested sengaja diberi z-index lebih tinggi),
  // bukan modal di belakangnya.
  openModalsWithDismiss.sort(
    (a, b) =>
      (parseInt(getComputedStyle(b).zIndex, 10) || 0) -
      (parseInt(getComputedStyle(a).zIndex, 10) || 0),
  );
  const dismissBtn = openModalsWithDismiss[0].querySelector(
    "[data-modal-dismiss]",
  );
  if (dismissBtn) {
    e.preventDefault();
    dismissBtn.click();
  }
});

// Ikon di tengah bingkai scanner loading, disesuaikan dengan konteks aksi yang sedang berjalan
// supaya halaman loading terasa "milik" tiap fitur, bukan generik untuk semua kondisi.
const LOADING_ICON_MAP = {
  txt_loading: "fa-calendar-days",
  txt_opening_event: "fa-calendar-check",
  txt_loading_qr_gen: "fa-qrcode",
  txt_loading_barcode_gen: "fa-barcode",
};

window.setLoadingText = function (key) {
  const el = document.getElementById("loading-text");
  if (el) {
    el.setAttribute("data-i18n", key);
    el.innerText = window.t(key);
  }
  const iconEl = document.getElementById("loading-icon");
  if (iconEl)
    iconEl.className = `fa-solid ${LOADING_ICON_MAP[key] || "fa-qrcode"} text-3xl text-indigo-500 dark:text-indigo-400 transition-all`;
  const subEl = document.getElementById("loading-subtitle");
  if (subEl)
    subEl.innerText =
      window.currentLang === "id"
        ? "Mohon tunggu sebentar..."
        : "Please wait a moment...";
};

window.renderPagination = function (
  totalItems,
  itemsPerPage,
  currentPage,
  containerId,
  changePageFunc,
) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return; // Hide pagination

  const prevBtn = document.createElement("button");
  prevBtn.className = `w-8 h-8 flex items-center justify-center rounded-lg border ${currentPage === 1 ? "border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`;
  prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left text-xs"></i>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => window[changePageFunc](currentPage - 1);
  container.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      const btn = document.createElement("button");
      btn.className = `w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${currentPage === i ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`;
      btn.innerText = i;
      btn.onclick = () => window[changePageFunc](i);
      container.appendChild(btn);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      const dots = document.createElement("span");
      dots.className =
        "w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium";
      dots.innerText = "...";
      container.appendChild(dots);
    }
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = `w-8 h-8 flex items-center justify-center rounded-lg border ${currentPage === totalPages ? "border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`;
  nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right text-xs"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => window[changePageFunc](currentPage + 1);
  container.appendChild(nextBtn);
};

window.changePageEvents = function (page) {
  window.currentPageEvents = page;
  renderEvents();
};
window.changePageGuests = function (page) {
  window.currentPageGuests = page;
  window.renderTable();
};
window.changePageAttended = function (page) {
  window.currentPageAttended = page;
  window.renderTable();
};
window.changePageCustomQR = function (page) {
  window.currentPageCustomQR = page;
  window.renderCustomQRs();
};
window.changePageCustomBarcode = function (page) {
  window.currentPageCustomBarcode = page;
  window.renderCustomBarcodes();
};

function switchMainViewAnimated(viewName) {
  const views = [
    "view-auth",
    "view-loading",
    "view-library",
    "view-app",
    "view-settings",
    "view-tools-qr",
    "view-tools-barcode",
  ];
  views.forEach((v) => {
    const el = document.getElementById(v);
    if (v === viewName) {
      el.classList.remove("view-hidden");
      el.classList.add("view-visible");
    } else {
      el.classList.add("view-hidden");
      el.classList.remove("view-visible");
    }
  });
}

// Mengunci/melepas tombol "Simpan Potongan" selama gambar & instance cropper baru
// sedang disiapkan. Ini mencegah klik "hilang" saat cropper belum siap (race condition) -
// penyebab utama tombol simpan terasa tidak berfungsi saat memproses foto ke-4 dst.
window.setCropperSaveEnabled = function (enabled) {
  const btn = document.getElementById("btn-apply-crop");
  if (!btn) return;
  btn.disabled = !enabled;
  btn.innerHTML = enabled
    ? window.currentLang === "id"
      ? "Simpan Potongan"
      : "Save Crop"
    : `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${window.currentLang === "id" ? "Memuat..." : "Loading..."}`;
};

// Update tampilan progress bar & persentase di dalam modal cropper.
// Hanya ditampilkan saat mengunggah lebih dari 1 foto background login sekaligus.
window.updateCropperProgress = function () {
  const wrap = document.getElementById("cropper-progress-wrap");
  if (!wrap) return;
  const total = window.loginBgQueueTotal || 0;
  if (total <= 1) {
    wrap.classList.add("hidden");
    return;
  }

  const done = window.loginBgQueueDone || 0;
  const current = Math.min(done + 1, total);
  const pct = Math.round((done / total) * 100);

  wrap.classList.remove("hidden");
  document.getElementById("cropper-progress-label").textContent =
    window.currentLang === "id"
      ? `Memproses foto ${current} dari ${total}`
      : `Processing photo ${current} of ${total}`;
  document.getElementById("cropper-progress-percent").textContent = `${pct}%`;
  document.getElementById("cropper-progress-bar").style.width = `${pct}%`;
};

// Memuat satu file ke dalam cropper. Dipakai baik untuk upload tunggal (logo/profil/event)
// maupun untuk memproses foto berikutnya dalam antrian upload background login (multi-foto).
function loadCropperFile(file, target) {
  const reader = new FileReader();
  reader.onload = function (evt) {
    const img = document.getElementById("cropper-image");

    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    window.setCropperSaveEnabled(false);

    let ratio = 1;
    if (target === "event") ratio = NaN;
    else if (target === "login-bg") ratio = 16 / 9;

    // Pasang handler "load" & inisialisasi Cropper lewat callback "ready"-nya
    // SEBELUM mengubah src, supaya event load tidak pernah terlewat (berbeda
    // dengan setTimeout tetap sebelumnya yang bisa meleset saat foto besar/
    // perangkat sedang lambat memproses foto-foto sebelumnya).
    img.onload = function () {
      cropper = new Cropper(img, {
        aspectRatio: ratio,
        viewMode: 1,
        background: false,
        zoomable: true,
        ready: function () {
          window.setCropperSaveEnabled(true);
        },
      });
    };
    img.src = evt.target.result;
  };
  reader.onerror = function () {
    window.showToast(
      window.currentLang === "id"
        ? "Gagal membaca file gambar"
        : "Failed to read image file",
      "error",
    );
    window.setCropperSaveEnabled(true);
  };
  reader.readAsDataURL(file);
}

window.openCropper = function (e, target) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  cropTarget = target;
  cropSourceFileName = files[0].name || "";

  // Untuk background login, banyak foto bisa dipilih sekaligus.
  // Foto pertama langsung dibuka di cropper, sisanya diantrekan dan
  // otomatis dibuka satu-per-satu setelah foto sebelumnya disimpan.
  window.loginBgQueue = target === "login-bg" ? files.slice(1) : [];
  window.loginBgQueueTotal = target === "login-bg" ? files.length : 0;
  window.loginBgQueueDone = 0;

  window.openModalAnimated("modal-cropper");
  window.updateCropperProgress();
  loadCropperFile(files[0], target);
  e.target.value = "";
};

window.closeCropper = function () {
  window.closeModalAnimated("modal-cropper");
  if (cropper) {
    setTimeout(() => {
      cropper.destroy();
      cropper = null;
    }, 300);
  }
  const wrap = document.getElementById("cropper-progress-wrap");
  if (wrap) wrap.classList.add("hidden");
  window.loginBgQueue = [];
  window.loginBgQueueTotal = 0;
  window.loginBgQueueDone = 0;
};

window.cropperAction = function (action) {
  if (!cropper) return;
  if (action === "zoom-in") cropper.zoom(0.1);
  if (action === "zoom-out") cropper.zoom(-0.1);
  if (action === "rotate-left") cropper.rotate(-45);
  if (action === "rotate-right") cropper.rotate(45);
};

window.applyCrop = function () {
  if (!cropper) return;

  if (cropTarget === "app-logo") {
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 1280,
      maxHeight: 1280,
    });
    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    LS.setSetting("app_logo", base64);
    applyAppLogo();
    window.renderStorageMeter();
    window.showToast("Logo Aplikasi Diperbarui", "success");
  } else if (cropTarget === "profile") {
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 1280,
      maxHeight: 1280,
    });
    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    let users = LS.getUsers();
    let uIdx = users.findIndex(
      (u) => u.username === window.appState.currentUser.username,
    );
    if (uIdx > -1) {
      users[uIdx].profilePic = base64;
      LS.setUsers(users);
      window.appState.currentUser.profilePic = base64;
      sessionStorage.setItem(
        "qis_session",
        JSON.stringify(window.appState.currentUser),
      );
      updateProfilePicUI();
      window.showToast("Foto Profil Diperbarui", "success");
    }
  } else if (cropTarget === "event") {
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 1280,
      maxHeight: 1280,
    });
    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    document.getElementById("event-logo-base64").value = base64;
    window.showEventLogoFileInfo(
      cropSourceFileName || "logo-event.jpg",
      base64,
    );
    window.showToast("Logo event disetel", "success");
  } else if (cropTarget === "login-bg") {
    // Resolusi lebih tinggi & kualitas JPEG lebih tinggi agar foto background tetap HD dan jelas
    const canvas = cropper.getCroppedCanvas({
      maxWidth: 2560,
      maxHeight: 2560,
      imageSmoothingQuality: "high",
    });
    const base64 = canvas.toDataURL("image/jpeg", 0.95);
    let list = LS.getLoginBgList();
    list.push(base64);

    // Penyimpanan browser (localStorage) punya kuota terbatas (biasanya ~5-10MB).
    // Foto background beresolusi tinggi bisa membuat kuota penuh setelah beberapa
    // foto tersimpan - sebelumnya kegagalan ini tidak ditangani sama sekali, sehingga
    // tombol "Simpan Potongan" terlihat seperti tidak berfungsi untuk foto berikutnya.
    // Sekarang kegagalan ditangkap dan diberi tahu ke pengguna secara jelas.
    try {
      LS.setLoginBgList(list);
    } catch (err) {
      console.error("Gagal menyimpan background login:", err);
      window.showToast(
        window.currentLang === "id"
          ? "Penyimpanan penuh. Hapus beberapa foto background lama di Pengaturan sebelum menambah yang baru."
          : "Storage is full. Remove some older background photos in Settings before adding new ones.",
        "error",
      );
      window.closeCropper();
      return;
    }

    window.applyLoginBg();
    window.loginBgQueueDone = (window.loginBgQueueDone || 0) + 1;
    window.updateCropperProgress();

    // Jika masih ada foto lain yang diunggah bersamaan, langsung lanjut crop foto berikutnya
    // tanpa menutup modal, supaya prosesnya terasa satu alur yang mulus.
    if (window.loginBgQueue && window.loginBgQueue.length > 0) {
      const nextFile = window.loginBgQueue.shift();
      loadCropperFile(nextFile, "login-bg");
      return;
    }

    const total = window.loginBgQueueTotal || 1;
    const msg =
      total > 1
        ? window.currentLang === "id"
          ? `${total} Background Login Ditambahkan`
          : `${total} Login Backgrounds Added`
        : window.currentLang === "id"
          ? "Background Login Diperbarui"
          : "Login Background Updated";
    window.showToast(msg, "success");
    window.closeCropper();
    return;
  }
  window.closeCropper();
};

window.resetAppLogo = function () {
  LS.setSetting("app_logo", "");
  applyAppLogo();
  window.renderStorageMeter();
  window.showToast(
    window.currentLang === "id"
      ? "Logo dikembalikan ke default"
      : "Logo reset to default",
    "success",
  );
};

window.confirmResetAllSettings = function () {
  window.openConfirmCustom(
    window.currentLang === "id"
      ? "Kembalikan Pengaturan Semula?"
      : "Restore Default Settings?",
    window.currentLang === "id"
      ? "Logo aplikasi, foto & kecepatan slideshow background login, tulisan caption, mode gelap, bahasa, durasi pop-up kiosk, bahasa suara TTS kiosk, tanda tangan kiosk pengambilan, dan pengaturan cetak QR akan dikembalikan ke default. Tindakan ini tidak dapat diurungkan."
      : "App logo, login background photos & slideshow speed, caption text, dark mode, language, kiosk popup duration, kiosk TTS voice language, pickup kiosk signature, and QR print settings will be restored to default. This action cannot be undone.",
    () => {
      window.resetAllSettings();
    },
  );
};

window.resetAllSettings = function () {
  localStorage.removeItem("qis_setting_app_logo");
  localStorage.removeItem("qis_setting_bg_login");
  localStorage.removeItem("qis_setting_bg_login_list");
  localStorage.removeItem("qis_setting_bg_login_interval");
  localStorage.removeItem("qis_setting_auth_caption");
  localStorage.removeItem("qis_setting_print_qr_fields");
  localStorage.removeItem("qis_setting_dark_mode");
  localStorage.removeItem("qis_setting_kiosk_reset_duration");
  localStorage.removeItem("qis_setting_kiosk_tts_lang");
  localStorage.removeItem("qis_setting_kiosk_pickup_signature");
  localStorage.removeItem("qis_lang");
  window.currentLang = "id";
  applyAppLogo();
  window.applyLoginBg();
  window.applyAuthCaptionSetting();
  window.loadBgIntervalSettingsUI();
  window.loadKioskResetDurationSettingUI();
  window.loadKioskTTSLangSettingUI();
  window.loadKioskPickupSignatureSettingUI();
  window.applyDarkModeSetting();
  window.applyLanguage();
  window.loadPrintQRSettingsUI();
  window.showToast(window.t("confirm_reset"), "success");
};

function applyAppLogo() {
  const logoBase64 = LS.getSetting("app_logo");
  const authIcon = document.getElementById("auth-logo-icon");
  const authImg = document.getElementById("auth-logo-img");
  const setIcon = document.getElementById("setting-app-logo-icon");
  const setImg = document.getElementById("setting-app-logo-preview");
  const favicon = document.getElementById("dynamic-favicon");
  if (logoBase64) {
    if (authImg) {
      authImg.src = logoBase64;
      authImg.classList.remove("hidden");
      authIcon.classList.add("hidden");
    }
    if (setImg) {
      setImg.src = logoBase64;
      setImg.classList.remove("hidden");
      setIcon.classList.add("hidden");
    }
    if (favicon) favicon.href = logoBase64;
  } else {
    if (authImg) {
      authImg.classList.add("hidden");
      authIcon.classList.remove("hidden");
    }
    if (setImg) {
      setImg.classList.add("hidden");
      setIcon.classList.remove("hidden");
    }
    if (favicon)
      favicon.href =
        "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📅</text></svg>";
  }
}

window.resetLoginBg = function () {
  localStorage.removeItem("qis_setting_bg_login"); // key lama (kompatibilitas)
  localStorage.removeItem("qis_setting_bg_login_list");
  window.applyLoginBg();
  window.showToast(
    window.currentLang === "id"
      ? "Background dikembalikan ke default"
      : "Background reset to default",
    "success",
  );
};

window.removeLoginBg = function (idx) {
  let list = LS.getLoginBgList();
  list.splice(idx, 1);
  LS.setLoginBgList(list);
  window.applyLoginBg();
  window.showToast(
    window.currentLang === "id"
      ? "Foto background dihapus"
      : "Background photo removed",
    "success",
  );
};

// Merender thumbnail daftar foto background login di halaman Pengaturan, masing-masing dengan tombol hapus.
window.renderLoginBgSettingsList = function () {
  const list = LS.getLoginBgList();
  const container = document.getElementById("setting-bg-login-thumbs");
  if (!container) return;
  container.innerHTML = list
    .map(
      (base64, idx) => `
                <div class="relative w-24 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group shrink-0">
                    <img src="${base64}" class="w-full h-full object-cover">
                    <button type="button" onclick="window.removeLoginBg(${idx})" class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" data-i18n-title="title_bg_login_remove" title="Hapus foto ini">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `,
    )
    .join("");
  window.renderStorageMeter();
};

// Menghitung total penyimpanan browser (localStorage) yang terpakai oleh aplikasi ini,
// lalu menampilkannya sebagai progress bar real-time di Pengaturan > Latar Belakang Login.
// Kuota localStorage tidak bisa dibaca langsung lewat API browser (beda dengan IndexedDB),
// jadi dipakai acuan ~5MB — batas paling konservatif yang berlaku di sebagian besar browser modern.
window.renderStorageMeter = function () {
  const barEl = document.getElementById("storage-meter-bar");
  const textEl = document.getElementById("storage-meter-text");
  const pctEl = document.getElementById("storage-meter-percent");
  if (!barEl || !textEl || !pctEl) return;

  let totalChars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const val = localStorage.getItem(key) || "";
    totalChars += key.length + val.length;
  }
  const totalBytes = totalChars * 2; // String JS berbasis UTF-16 (~2 byte per karakter)
  const QUOTA_BYTES = 5 * 1024 * 1024; // ~5MB, acuan paling konservatif antar-browser
  const pct = Math.min(100, Math.round((totalBytes / QUOTA_BYTES) * 100));

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  barEl.style.width = `${pct}%`;
  pctEl.innerText = `${pct}%`;
  textEl.innerText =
    window.currentLang === "id"
      ? `${formatSize(totalBytes)} terpakai dari ~5 MB`
      : `${formatSize(totalBytes)} used of ~5 MB`;

  // Warna berubah sesuai tingkat pemakaian: hijau (aman) → kuning (waspada) → merah (hampir penuh)
  barEl.classList.remove(
    "bg-emerald-500",
    "dark:bg-emerald-400",
    "bg-amber-500",
    "dark:bg-amber-400",
    "bg-red-500",
    "dark:bg-red-400",
  );
  if (pct < 60) {
    barEl.classList.add("bg-emerald-500", "dark:bg-emerald-400");
  } else if (pct < 85) {
    barEl.classList.add("bg-amber-500", "dark:bg-amber-400");
  } else {
    barEl.classList.add("bg-red-500", "dark:bg-red-400");
  }
};

let loginBgRotateTimer = null;
let loginBgActiveLayer = "a";
let loginBgList = [];
let loginBgCurrentIndex = 0;

// Merender indikator titik foto background di panel login (hanya tampil bila foto > 1).
// Setiap titik bisa diklik untuk langsung berpindah ke foto tersebut.
function renderAuthBgDots() {
  const dotsWrap = document.getElementById("auth-bg-dots");
  if (!dotsWrap) return;
  if (loginBgList.length <= 1) {
    dotsWrap.innerHTML = "";
    return;
  }
  dotsWrap.innerHTML = loginBgList
    .map(
      (_, idx) => `
                <button type="button" onclick="window.jumpToLoginBg(${idx})" class="h-2 rounded-full transition-all duration-300 ${idx === loginBgCurrentIndex ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"}" aria-label="${window.currentLang === "id" ? "Foto background ke-" + (idx + 1) : "Background photo " + (idx + 1)}"></button>
            `,
    )
    .join("");
}

// Berpindah ke foto pada index tertentu dengan efek crossfade antar layer.
function goToLoginBgIndex(idx) {
  const layerA = document.getElementById("auth-bg-layer-a");
  const layerB = document.getElementById("auth-bg-layer-b");
  if (!layerA || !layerB || !loginBgList[idx]) return;
  const showing = loginBgActiveLayer === "a" ? layerB : layerA;
  const hiding = loginBgActiveLayer === "a" ? layerA : layerB;
  showing.style.backgroundImage = `url('${loginBgList[idx]}')`;
  showing.style.opacity = "1";
  hiding.style.opacity = "0";
  loginBgActiveLayer = loginBgActiveLayer === "a" ? "b" : "a";
  loginBgCurrentIndex = idx;
  renderAuthBgDots();
}

// Navigasi manual lewat klik titik indikator. Timer rotasi otomatis di-reset supaya
// tidak langsung berpindah lagi sesaat setelah pengguna memilih foto secara manual.
window.jumpToLoginBg = function (idx) {
  if (idx === loginBgCurrentIndex || !loginBgList[idx]) return;
  goToLoginBgIndex(idx);
  window.restartLoginBgRotation();
};

// ===== Kecepatan slideshow foto background (bisa diatur 1-10 detik via slider, atau custom bebas) =====
window.getLoginBgIntervalSec = function () {
  const raw = localStorage.getItem("qis_setting_bg_login_interval");
  const val = raw !== null ? parseInt(raw, 10) : 7;
  return !isNaN(val) && val > 0 ? val : 7;
};

window.setLoginBgIntervalSec = function (sec) {
  let clamped = Math.round(Number(sec));
  if (isNaN(clamped) || clamped < 1) clamped = 1;
  if (clamped > 120) clamped = 120;
  localStorage.setItem("qis_setting_bg_login_interval", String(clamped));
  return clamped;
};

window.syncBgIntervalUI = function (sec) {
  const slider = document.getElementById("bg-interval-slider");
  const customInput = document.getElementById("bg-interval-custom");
  const valueLabel = document.getElementById("bg-interval-value");
  if (slider) slider.value = Math.min(10, Math.max(1, sec));
  if (customInput) customInput.value = sec;
  if (valueLabel)
    valueLabel.innerText = `${sec} ${window.currentLang === "id" ? "detik" : "sec"}`;
};

window.loadBgIntervalSettingsUI = function () {
  window.syncBgIntervalUI(window.getLoginBgIntervalSec());
};

window.onBgIntervalSliderInput = function (val) {
  const sec = window.setLoginBgIntervalSec(val);
  window.syncBgIntervalUI(sec);
  window.restartLoginBgRotation();
};

window.onBgIntervalCustomChange = function (val) {
  const sec = window.setLoginBgIntervalSec(val);
  window.syncBgIntervalUI(sec);
  window.restartLoginBgRotation();
};

// Menghentikan timer rotasi yang sedang berjalan (bila ada) lalu memulainya kembali
// dengan durasi terbaru dari pengaturan. Dipakai ulang di beberapa titik agar durasi
// selalu konsisten tanpa duplikasi logika setInterval.
window.restartLoginBgRotation = function () {
  if (loginBgRotateTimer !== null) {
    clearInterval(loginBgRotateTimer);
    loginBgRotateTimer = null;
  }
  if (loginBgList.length > 1) {
    const ms = window.getLoginBgIntervalSec() * 1000;
    loginBgRotateTimer = setInterval(() => {
      goToLoginBgIndex((loginBgCurrentIndex + 1) % loginBgList.length);
    }, ms);
  }
};

// ===== Durasi Auto-Reset Pop-up Hasil Scan Mode Kiosk =====
// Mengikuti pola yang sama dengan pengaturan kecepatan slideshow background login:
// slider cepat 1-10 detik, plus input custom bebas untuk kebutuhan di luar rentang itu.
window.getKioskResetDurationSec = function () {
  const raw = localStorage.getItem("qis_setting_kiosk_reset_duration");
  const val = raw !== null ? parseInt(raw, 10) : 4;
  return !isNaN(val) && val > 0 ? val : 4;
};

window.setKioskResetDurationSec = function (sec) {
  let clamped = Math.round(Number(sec));
  if (isNaN(clamped) || clamped < 1) clamped = 1;
  if (clamped > 30) clamped = 30;
  localStorage.setItem("qis_setting_kiosk_reset_duration", String(clamped));
  return clamped;
};

window.syncKioskResetDurationUI = function (sec) {
  const slider = document.getElementById("kiosk-reset-slider");
  const customInput = document.getElementById("kiosk-reset-custom");
  const valueLabel = document.getElementById("kiosk-reset-value");
  if (slider) slider.value = Math.min(10, Math.max(1, sec));
  if (customInput) customInput.value = sec;
  if (valueLabel)
    valueLabel.innerText = `${sec} ${window.currentLang === "id" ? "detik" : "sec"}`;
};

window.loadKioskResetDurationSettingUI = function () {
  window.syncKioskResetDurationUI(window.getKioskResetDurationSec());
};

// ===== Toggle Tanda Tangan — Kiosk QR Code Pengambilan =====
// Default AKTIF (true) supaya perilaku lama (selalu minta tanda tangan) tetap sama untuk
// instalasi yang sudah ada, kecuali admin secara sadar mematikannya di Pengaturan Aplikasi.
window.getKioskPickupSignatureEnabled = function () {
  const raw = localStorage.getItem("qis_setting_kiosk_pickup_signature");
  return raw === null ? true : raw === "1";
};

window.toggleKioskPickupSignature = function (enabled) {
  LS.setSetting("kiosk_pickup_signature", enabled ? "1" : "0");
};

window.loadKioskPickupSignatureSettingUI = function () {
  const el = document.getElementById("kiosk-pickup-signature-toggle");
  if (el) el.checked = window.getKioskPickupSignatureEnabled();
};

window.onKioskResetDurationSliderInput = function (val) {
  const sec = window.setKioskResetDurationSec(val);
  window.syncKioskResetDurationUI(sec);
};

window.onKioskResetDurationCustomChange = function (val) {
  const sec = window.setKioskResetDurationSec(val);
  window.syncKioskResetDurationUI(sec);
};

// ===== Bahasa Suara Text-to-Speech Mode Kiosk =====
// Menentukan bahasa yang dipakai saat Mode Kiosk mengucapkan nama peserta lewat Web Speech
// API (lihat window.speakKioskMessage & window.playKioskFeedback). Pilihan tersimpan permanen
// lewat Pengaturan > Mode Kiosk, terpisah dari nyala/mati suara TTS itu sendiri
// (window.isKioskTTSEnabled mengatur ON/OFF-nya, pengaturan ini mengatur bahasanya).
window.setKioskTTSLang = function (lang) {
  lang = lang === "id" ? "id" : "en";
  LS.setSetting("kiosk_tts_lang", lang);
  window.loadKioskTTSLangSettingUI();

  // Toast konfirmasi supaya admin dapat kepastian visual bahwa perubahan tersimpan,
  // tidak hanya mengandalkan highlight tombol yang mudah terlewat.
  const langName =
    lang === "id"
      ? window.currentLang === "id"
        ? "Bahasa Indonesia"
        : "Indonesian"
      : window.currentLang === "id"
        ? "Bahasa Inggris"
        : "English";
  window.showToast(
    window.currentLang === "id"
      ? `Bahasa suara Text-to-Speech diubah ke ${langName}`
      : `Text-to-Speech voice language changed to ${langName}`,
    "success",
  );

  // Uji coba suara singkat supaya admin langsung dengar hasil pilihannya - dipanggil
  // langsung (bukan lewat window.speakKioskMessage) supaya tetap bisa dicoba kapan saja,
  // terlepas dari status aktif/nonaktif suara Mode Kiosk saat ini.
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(
      lang === "id" ? "Contoh suara Bahasa Indonesia" : "English voice sample",
    );
    utter.rate = 1.02;
    utter.pitch = 1.05;
    utter.volume = 1;
    if (lang === "id") {
      utter.lang = "id-ID";
      const v = pickIndonesianVoice();
      if (v) utter.voice = v;
    } else {
      utter.lang = "en-US";
      const v = pickFemaleEnglishVoice();
      if (v) utter.voice = v;
    }
    window.speechSynthesis.speak(utter);
  } catch (e) {}
};

window.loadKioskTTSLangSettingUI = function () {
  const lang = window.getKioskTTSLang();
  const hiddenEl = document.getElementById("kiosk-tts-lang-value");
  if (hiddenEl) hiddenEl.value = lang;
  const btnId = document.getElementById("btn-tts-lang-id");
  const btnEn = document.getElementById("btn-tts-lang-en");
  if (btnId) btnId.classList.toggle("tab-active", lang === "id");
  if (btnEn) btnEn.classList.toggle("tab-active", lang === "en");
};

// Menerapkan background halaman login. Jika lebih dari satu foto tersimpan, foto akan
// otomatis bergantian (crossfade) setiap 7 detik menggunakan dua layer bertumpuk,
// lengkap dengan indikator titik yang bisa diklik untuk berpindah manual.
// Menampilkan/menyembunyikan tulisan (judul, deskripsi, ikon, badge fitur) di atas foto
// background halaman login, agar foto bisa tampil bersih tanpa teks bila diinginkan.
window.toggleAuthCaption = function (enabled) {
  LS.setSetting("auth_caption", enabled ? "1" : "0");
  window.applyAuthCaptionSetting();
};

window.applyAuthCaptionSetting = function () {
  const raw = localStorage.getItem("qis_setting_auth_caption");
  const enabled = raw === null ? true : raw === "1"; // default: tampil
  const branding = document.getElementById("auth-bg-branding");
  const scrimTop = document.getElementById("auth-bg-scrim-top");
  const scrimBottom = document.getElementById("auth-bg-scrim-bottom");
  if (branding) branding.classList.toggle("hidden", !enabled);
  // Scrim gelap ikut disembunyikan karena fungsinya hanya menjaga keterbacaan teks;
  // tanpa teks, foto background lebih baik tampil polos/asli.
  if (scrimTop) scrimTop.classList.toggle("hidden", !enabled);
  if (scrimBottom) scrimBottom.classList.toggle("hidden", !enabled);
  const toggleEl = document.getElementById("auth-caption-toggle");
  if (toggleEl) toggleEl.checked = enabled;
};

window.applyLoginBg = function () {
  const list = LS.getLoginBgList();
  loginBgList = list;
  loginBgCurrentIndex = 0;
  const bgPanel = document.getElementById("auth-bg-panel");
  const bgOverlay = document.getElementById("auth-bg-overlay");
  const layerA = document.getElementById("auth-bg-layer-a");
  const layerB = document.getElementById("auth-bg-layer-b");

  if (loginBgRotateTimer !== null) {
    clearInterval(loginBgRotateTimer);
    loginBgRotateTimer = null;
  }

  if (list.length > 0 && layerA && layerB) {
    layerA.style.backgroundImage = `url('${list[0]}')`;
    layerA.style.opacity = "1";
    layerB.style.backgroundImage = "";
    layerB.style.opacity = "0";
    loginBgActiveLayer = "a";

    if (bgPanel)
      bgPanel.classList.remove(
        "bg-gradient-to-br",
        "from-indigo-500",
        "via-indigo-600",
        "to-purple-700",
      );
    // Efek gelap transparan diterapkan menyeluruh di atas foto background
    if (bgOverlay) {
      bgOverlay.classList.remove("bg-slate-900/10");
      bgOverlay.classList.add("bg-slate-900/40");
    }

    if (list.length > 1) {
      window.restartLoginBgRotation();
    }
  } else {
    if (layerA) {
      layerA.style.backgroundImage = "";
      layerA.style.opacity = "0";
    }
    if (layerB) {
      layerB.style.backgroundImage = "";
      layerB.style.opacity = "0";
    }
    if (bgPanel)
      bgPanel.classList.add(
        "bg-gradient-to-br",
        "from-indigo-500",
        "via-indigo-600",
        "to-purple-700",
      );
    if (bgOverlay) {
      bgOverlay.classList.remove("bg-slate-900/40");
      bgOverlay.classList.add("bg-slate-900/10");
    }
  }

  renderAuthBgDots();
  window.renderLoginBgSettingsList();
};

// Menampilkan/menyembunyikan isi field password beserta ikon mata pada tombolnya.
window.togglePasswordField = function (inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btnEl.querySelector("i");
  const willShow = input.type === "password";
  input.type = willShow ? "text" : "password";
  if (icon) {
    icon.classList.toggle("fa-eye", !willShow);
    icon.classList.toggle("fa-eye-slash", willShow);
  }
  const label = willShow
    ? window.currentLang === "id"
      ? "Sembunyikan password"
      : "Hide password"
    : window.currentLang === "id"
      ? "Tampilkan password"
      : "Show password";
  btnEl.setAttribute("title", label);
  btnEl.setAttribute("aria-label", label);
};

window.setAuthRole = function (role) {
  window.authRole = role;
  document.getElementById("btn-mode-admin").className =
    role === "admin"
      ? "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-800 text-indigo-600 shadow-sm transition-all"
      : "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all";
  document.getElementById("btn-mode-public").className =
    role === "public"
      ? "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-800 text-indigo-600 shadow-sm transition-all"
      : "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all";
  document.getElementById("auth-subtitle").innerText =
    role === "admin" ? window.t("sub_admin") : window.t("sub_public");
};

window.toggleAuthMode = function (mode) {
  const forms = ["form-login", "form-register", "form-recovery"];
  forms.forEach((f) => {
    const el = document.getElementById(f);
    el.classList.remove("auth-form-active");
    el.classList.add("hidden");
  });
  let targetForm = document.getElementById("form-" + mode);
  targetForm.classList.remove("hidden");
  setTimeout(() => {
    targetForm.classList.add("auth-form-active");
  }, 10);

  const subtitle = document.getElementById("auth-subtitle");
  if (mode === "register")
    subtitle.innerText =
      window.t("txt_no_account") + " " + window.t("btn_register");
  else if (mode === "recovery") subtitle.innerText = window.t("btn_forgot_pw");
  else
    subtitle.innerText =
      window.authRole === "admin"
        ? window.t("sub_admin")
        : window.t("sub_public");
};

window.handleRecovery = function (e) {
  e.preventDefault();
  const username = document.getElementById("recovery-username").value.trim();
  const user = LS.getUsers().find((u) => u.username === username);
  if (user) {
    const role = user.role || "admin";
    recoveredUserRole = role;

    document.getElementById("rec-res-username").innerText = user.username;
    document.getElementById("rec-res-password").innerText = user.password;

    const badgeEl = document.getElementById("rec-res-role-badge");
    if (badgeEl) {
      if (role === "admin") {
        badgeEl.innerHTML = user.isSuperAdmin
          ? '<span class="inline-flex items-center text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border border-purple-200 dark:border-purple-500/30"><i class="fa-solid fa-crown mr-1.5"></i>Super Admin</span>'
          : '<span class="inline-flex items-center text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide"><i class="fa-solid fa-user-shield mr-1.5"></i>Admin</span>';
      } else {
        badgeEl.innerHTML =
          '<span class="inline-flex items-center text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide"><i class="fa-solid fa-user mr-1.5"></i>Public</span>';
      }
    }

    window.openModalAnimated("modal-recovery-result");
    document.getElementById("recovery-username").value = "";
  } else window.showToast("Mohon maaf, Username tidak ditemukan.", "error");
};

// Menutup modal hasil recovery: kembali ke form login DENGAN tab Admin/Public
// otomatis disesuaikan ke role akun yang baru ditemukan, agar login berikutnya
// tidak gagal hanya karena tab yang aktif tidak cocok dengan role akun.
window.closeRecoveryResult = function () {
  window.closeModalAnimated("modal-recovery-result");
  if (recoveredUserRole) window.setAuthRole(recoveredUserRole);
  window.toggleAuthMode("login");
};

// Menyalin username/password hasil recovery ke clipboard, dengan fallback untuk browser lama.
window.copyRecoveryField = function (fieldId, btnEl) {
  const text = document.getElementById(fieldId).innerText;
  if (!text) return;
  const showCopied = () => {
    const icon = btnEl.querySelector("i");
    if (icon) {
      icon.classList.remove("fa-copy");
      icon.classList.add("fa-check");
      setTimeout(() => {
        icon.classList.remove("fa-check");
        icon.classList.add("fa-copy");
      }, 1200);
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(showCopied)
      .catch(() => window.showToast("Gagal menyalin.", "error"));
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showCopied();
    } catch (err) {
      window.showToast("Gagal menyalin.", "error");
    }
    document.body.removeChild(ta);
  }
};

window.handleRegister = function (e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  const users = LS.getUsers();
  if (users.find((u) => u.username === username))
    return window.showToast("Username sudah digunakan!", "error");

  // Logika Super Admin: Admin yang pertama kali dibuat / mendaftar
  const isFirstAdmin =
    users.filter((u) => u.role === "admin").length === 0 &&
    window.authRole === "admin";

  users.push({
    name,
    username,
    password,
    profilePic: "",
    role: window.authRole,
    isSuperAdmin: isFirstAdmin,
  });

  LS.setUsers(users);
  e.target.reset();
  window.toggleAuthMode("login");
  window.showToast("Registrasi berhasil!", "success");
};

window.handleLogin = function (e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const user = LS.getUsers().find(
    (u) => u.username === username && u.password === password,
  );
  if (user) {
    const userRole = user.role || "admin";
    if (userRole !== window.authRole) {
      return window.showToast(
        `Akun ini adalah User ${userRole === "admin" ? "Admin" : "Public"}! Silakan ubah opsi mode di atas.`,
        "error",
      );
    }

    window.appState.currentUser = {
      name: user.name,
      username: user.username,
      profilePic: user.profilePic || "",
      role: userRole,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.permissions || {},
    };
    sessionStorage.setItem(
      "qis_session",
      JSON.stringify(window.appState.currentUser),
    );
    e.target.reset();
    window.setLoadingText("txt_loading");
    switchMainViewAnimated("view-loading");
    setTimeout(() => {
      loadLibrary();
      window.tryLaunchPendingKiosk();
    }, 1200);
  } else window.showToast("Username atau Password salah!", "error");
};

window.handleLogout = function () {
  window.appState.currentUser = null;
  sessionStorage.removeItem("qis_session");
  switchMainViewAnimated("view-auth");
};

window.exportBackupJSON = function () {
  const data = {
    users: LS.getUsers(),
    events: LS.getEvents(),
    settings: { app_logo: LS.getSetting("app_logo") || "" },
    guests: {},
    customQRs: LS.getCustomQRs(),
    customBarcodes: LS.getCustomBarcodes(),
  };
  data.events.forEach((ev) => {
    data.guests[ev.id] = LS.getGuests(ev.id);
  });

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `EventQ_Backup_${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast("Backup berhasil diunduh!", "success");
};

window.importBackupJSON = function (event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.users && data.events) {
        window.tempRestoreData = data;
        document.getElementById("confirm-type").value = "restore";
        document.getElementById("confirm-id").value = "all";

        document.querySelector("#modal-confirm h3").innerText = window.t(
          "modal_restore_title",
        );
        document.querySelector("#confirm-sub").innerText =
          window.t("modal_restore_sub");
        window.openModalAnimated("modal-confirm");
      } else {
        window.showToast("Format file backup tidak valid!", "error");
      }
    } catch (err) {
      window.showToast("Gagal membaca file JSON!", "error");
    }
    event.target.value = "";
  };
  // BUG FIX: reader.onerror sebelumnya belum ditangani di sini - kalau proses baca file gagal
  // di level browser (bukan datanya yang rusak, tapi gagal DIBACA sama sekali), admin tidak
  // akan melihat pesan apa pun & tombol input tetap terisi nama file lama tanpa bisa dipilih ulang.
  reader.onerror = function () {
    console.error("FileReader gagal membaca file backup JSON:", reader.error);
    window.showToast(
      window.currentLang === "id"
        ? "Gagal membaca file! Coba lagi atau gunakan file lain."
        : "Failed to read the file! Please try again or use a different file.",
      "error",
    );
    event.target.value = "";
  };
  reader.readAsText(file);
};

window.openSettingsView = function () {
  const isAdmin = window.appState.currentUser.role === "admin";
  const usersNavBtn = document.getElementById("settings-nav-users");
  if (usersNavBtn) usersNavBtn.style.display = isAdmin ? "flex" : "none";
  window.loadPrintQRSettingsUI();
  window.applyAuthCaptionSetting();
  window.loadBgIntervalSettingsUI();
  window.updateSettingsUserCountBadge();
  window.renderStorageMeter();
  window.loadKioskPinSettingsUI();
  window.loadKioskResetDurationSettingUI();
  window.loadKioskTTSLangSettingUI();
  window.loadKioskPickupSignatureSettingUI();
  window.switchSettingsSection(isAdmin ? "users" : "appearance");
  switchMainViewAnimated("view-settings");
};

// Navigasi panel Pengaturan Aplikasi (sidebar kiri -> tampilkan section terkait di kanan)
window.switchSettingsSection = function (section) {
  document
    .querySelectorAll(".settings-nav-btn")
    .forEach((btn) => btn.classList.remove("settings-nav-active"));
  document
    .querySelectorAll(".settings-section")
    .forEach((panel) => panel.classList.add("hidden"));

  const navBtn = document.querySelector(
    `.settings-nav-btn[data-section="${section}"]`,
  );
  if (navBtn) navBtn.classList.add("settings-nav-active");
  const panel = document.getElementById(`settings-section-${section}`);
  if (panel) panel.classList.remove("hidden");

  const contentArea = document.getElementById("settings-content-area");
  if (contentArea) contentArea.scrollTop = 0;
};
window.updateSettingsUserCountBadge = function () {
  const el = document.getElementById("settings-user-count");
  if (el) el.innerText = LS.getUsers().length;
  window.renderUserManageSummary();
};

// Daftar ringkas nama pengguna + jenis akun langsung di card Manajemen Pengguna
// (halaman Pengaturan), supaya admin bisa sekilas melihat siapa saja tanpa perlu
// membuka modal "Kelola Pengguna" terlebih dahulu. Tombol Kelola Pengguna tetap
// menjadi satu-satunya pintu untuk aksi edit/hapus/kelola akses (sesuai aturan
// keamanan yang sudah ada di renderManageUsers).
window.renderUserManageSummary = function () {
  const container = document.getElementById("settings-user-summary-list");
  if (!container) return;
  const users = LS.getUsers();

  if (users.length === 0) {
    container.innerHTML = `<p class="text-sm text-slate-400 dark:text-slate-500 text-center py-4">${window.currentLang === "id" ? "Belum ada pengguna." : "No users yet."}</p>`;
    return;
  }

  container.innerHTML = users
    .map((u) => {
      const isTargetSuper = u.isSuperAdmin === true;
      const roleBadge =
        u.role === "admin"
          ? isTargetSuper
            ? '<span class="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide shrink-0"><i class="fa-solid fa-crown mr-1"></i>Super Admin</span>'
            : '<span class="text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide shrink-0">Admin</span>'
          : '<span class="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide shrink-0">Public</span>';
      const initial = (u.name || u.username || "?")
        .trim()
        .charAt(0)
        .toUpperCase();

      return `
                    <div class="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">${initial}</div>
                        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate flex-1" title="${u.name}">${u.name}</span>
                        ${roleBadge}
                    </div>`;
    })
    .join("");
};
window.backToLibraryFromSettings = function () {
  loadLibrary();
};

window.resetProfilePic = function () {
  let users = LS.getUsers();
  let uIdx = users.findIndex(
    (u) => u.username === window.appState.currentUser.username,
  );
  if (uIdx > -1) {
    users[uIdx].profilePic = "";
    LS.setUsers(users);
    window.appState.currentUser.profilePic = "";
    sessionStorage.setItem(
      "qis_session",
      JSON.stringify(window.appState.currentUser),
    );
    updateProfilePicUI();
    window.showToast(
      window.currentLang === "id"
        ? "Foto Profil Direset"
        : "Profile Picture Reset",
      "success",
    );
  }
};

function updateProfilePicUI() {
  const imgEl = document.getElementById("profile-pic-display");
  const iconEl = document.getElementById("profile-pic-icon");
  if (window.appState.currentUser && window.appState.currentUser.profilePic) {
    imgEl.src = window.appState.currentUser.profilePic;
    imgEl.classList.remove("hidden");
    iconEl.classList.add("hidden");
  } else {
    imgEl.classList.add("hidden");
    iconEl.classList.remove("hidden");
  }
}

window.openManageUsers = function () {
  document.getElementById("search-manage-users").value = "";
  document.getElementById("filter-manage-users").value = "all";
  window.renderManageUsers();
  window.openModalAnimated("modal-manage-users");
};

window.renderManageUsers = function () {
  const users = LS.getUsers();
  window.updateSettingsUserCountBadge();
  const container = document.getElementById("manage-users-list");
  const searchTerm = (
    document.getElementById("search-manage-users")?.value || ""
  ).toLowerCase();
  const filterRole =
    document.getElementById("filter-manage-users")?.value || "all";

  container.innerHTML = "";

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.username.toLowerCase().includes(searchTerm) ||
      u.name.toLowerCase().includes(searchTerm);
    let matchRole = true;
    if (filterRole === "superadmin")
      matchRole = u.role === "admin" && u.isSuperAdmin;
    else if (filterRole === "admin")
      matchRole = u.role === "admin" && !u.isSuperAdmin;
    else if (filterRole === "public") matchRole = u.role === "public";
    return matchSearch && matchRole;
  });

  if (filteredUsers.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 dark:text-slate-500"><i class="fa-solid fa-users-slash text-3xl mb-3"></i><p class="text-sm font-medium" data-i18n="txt_not_found">${window.t("txt_not_found") || "Pengguna tidak ditemukan."}</p></div>`;
    return;
  }

  filteredUsers.forEach((u) => {
    const isMe = u.username === window.appState.currentUser.username;
    const isTargetSuper = u.isSuperAdmin === true;
    const amISuper = window.appState.currentUser.isSuperAdmin === true;

    const roleBadge =
      u.role === "admin"
        ? isTargetSuper
          ? '<span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md ml-2 font-bold uppercase tracking-wide border border-purple-200" title="Super Admin"><i class="fa-solid fa-crown mr-1"></i>Super Admin</span>'
          : '<span class="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md ml-2 font-bold uppercase tracking-wide">Admin</span>'
        : '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md ml-2 font-bold uppercase tracking-wide">Public</span>';

    // Super Admin tidak boleh dihapus sama sekali
    const canDelete = !isMe && !isTargetSuper;

    // Kredensial (username & password) hanya boleh dilihat/diubah oleh: Super Admin (lihat semua),
    // pemilik akun itu sendiri, atau untuk akun ber-role Public. Admin biasa tidak boleh melihat
    // maupun mengedit (yang berarti membuka form berisi password asli) akun Super Admin ataupun
    // sesama Admin lain — mencegah kebocoran password lewat form edit, bukan cuma lewat daftar.
    const canSeeCredentials = amISuper || isMe || u.role === "public";
    const canEdit = canSeeCredentials;

    const editBtn = canEdit
      ? `<button onclick="window.openUserForm('${u.username}')" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-amber-500 hover:text-amber-700 hover:bg-amber-50 flex items-center justify-center transition-colors shadow-sm" title="Edit Akun"><i class="fa-solid fa-pen text-xs"></i></button>`
      : `<button class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 flex items-center justify-center cursor-not-allowed" title="Tidak ada akses edit"><i class="fa-solid fa-pen text-xs"></i></button>`;

    // Super Admin selalu memiliki akses penuh & tidak bisa dibatasi, jadi tombol Kelola Akses disembunyikan untuknya.
    // Aturan Kelola Akses Fitur:
    //  - Super Admin boleh mengubah akses fitur user Admin (non-super) maupun Public.
    //  - Admin (non-super) hanya boleh mengubah akses fitur user Public — tidak ke sesama Admin, dan tidak ke dirinya sendiri.
    const canManageAccess =
      !isTargetSuper && !isMe && (amISuper || u.role === "public");
    const permBtn = canManageAccess
      ? `<button onclick="window.openUserPermissions('${u.username}')" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 flex items-center justify-center transition-colors shadow-sm" title="Kelola Akses Fitur"><i class="fa-solid fa-key text-xs"></i></button>`
      : "";

    const credentialsLine = canSeeCredentials
      ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium"><i class="fa-solid fa-user text-slate-400 dark:text-slate-500 mr-1"></i> ${u.username} <span class="mx-1 text-slate-300">|</span> <i class="fa-solid fa-lock text-slate-400 dark:text-slate-500 mr-1"></i> ${u.password}</p>`
      : `<p class="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium italic flex items-center gap-1"><i class="fa-solid fa-lock text-slate-300 dark:text-slate-600 mr-0.5"></i>${window.t("txt_credentials_hidden") || "Username & password disembunyikan"}</p>`;

    container.innerHTML += `
                    <div class="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                        <div>
                            <p class="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center">${u.name} ${roleBadge} ${isMe ? '<span class="text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md ml-1 font-bold">You</span>' : ""}</p>
                            ${credentialsLine}
                        </div>
                        <div class="flex gap-1.5 self-end sm:self-auto">
                            ${permBtn}
                            ${editBtn}
                            ${canDelete ? `<button onclick="window.deleteUserAcc('${u.username}')" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition-colors shadow-sm" title="Hapus Akun"><i class="fa-solid fa-trash text-xs"></i></button>` : ""}
                        </div>
                    </div>`;
  });
};

window.openUserForm = function (username = null) {
  const form = document.getElementById("form-manage-user");
  form.reset();
  if (username) {
    const user = LS.getUsers().find((u) => u.username === username);

    // Security check — konsisten dengan aturan visibilitas kredensial di renderManageUsers:
    // hanya Super Admin, pemilik akun sendiri, atau target ber-role Public yang boleh dibuka form editnya.
    // Ini mencegah password akun Super Admin/Admin lain bocor lewat form edit meski tombolnya
    // dipanggil langsung (bukan lewat tombol yang sudah dinonaktifkan di UI).
    const amISuper = window.appState.currentUser.isSuperAdmin === true;
    const isMe = window.appState.currentUser.username === username;
    if (!(amISuper || isMe || user.role === "public")) {
      return window.showToast(
        "Tidak memiliki akses untuk mengubah akun ini",
        "error",
      );
    }

    document.getElementById("user-form-title").innerText = "Edit Akun Pengguna";
    document.getElementById("mu-old-username").value = user.username;
    document.getElementById("mu-role").value = user.role || "public";
    document.getElementById("mu-name").value = user.name;
    document.getElementById("mu-username").value = user.username;
    document.getElementById("mu-password").value = user.password;
  } else {
    document.getElementById("user-form-title").innerText = "Buat Akun Baru";
    document.getElementById("mu-old-username").value = "";
    document.getElementById("mu-role").value = "public";
  }
  window.openModalAnimated("modal-user-form");
};

window.handleUserFormSubmit = function (e) {
  e.preventDefault();
  const oldUser = document.getElementById("mu-old-username").value;
  const role = document.getElementById("mu-role").value;
  const name = document.getElementById("mu-name").value.trim();
  const newUser = document.getElementById("mu-username").value.trim();
  const pass = document.getElementById("mu-password").value;
  let users = LS.getUsers();

  if (oldUser) {
    if (oldUser !== newUser && users.find((u) => u.username === newUser))
      return window.showToast("Username sudah dipakai!", "error");
    const idx = users.findIndex((u) => u.username === oldUser);
    if (idx > -1) {
      const isSuper = users[idx].isSuperAdmin; // Pertahankan hak akses Super Admin
      users[idx] = {
        ...users[idx],
        role,
        name,
        username: newUser,
        password: pass,
        isSuperAdmin: isSuper,
      };
      if (oldUser === window.appState.currentUser.username) {
        window.appState.currentUser.name = name;
        window.appState.currentUser.username = newUser;
        window.appState.currentUser.role = role;
        sessionStorage.setItem(
          "qis_session",
          JSON.stringify(window.appState.currentUser),
        );
        document.getElementById("user-display-name").innerText = name;
      }
    }
    window.showToast("Akun diperbarui!", "success");
  } else {
    if (users.find((u) => u.username === newUser))
      return window.showToast("Username sudah dipakai!", "error");
    const isFirstAdmin =
      users.filter((u) => u.role === "admin").length === 0 && role === "admin";
    users.push({
      role,
      name,
      username: newUser,
      password: pass,
      profilePic: "",
      isSuperAdmin: isFirstAdmin,
    });
    window.showToast("Akun berhasil dibuat!", "success");
  }
  LS.setUsers(users);
  window.closeModalAnimated("modal-user-form");
  window.renderManageUsers();
};

window.deleteUserAcc = function (username) {
  window.openConfirmModal("user", username);
};

window.openUserPermissions = function (username) {
  const user = LS.getUsers().find((u) => u.username === username);
  if (!user) return;
  if (user.isSuperAdmin)
    return window.showToast("Super Admin selalu memiliki akses penuh", "info");

  // Aturan Kelola Akses Fitur (selaras dengan tombol di renderManageUsers):
  //  - Super Admin boleh mengubah akses fitur user Admin (non-super) maupun Public.
  //  - Admin (non-super) hanya boleh mengubah akses fitur user Public — tidak ke sesama Admin, dan tidak ke dirinya sendiri.
  const amISuper = window.appState.currentUser.isSuperAdmin === true;
  const isMe = username === window.appState.currentUser.username;
  if (isMe)
    return window.showToast(
      "Tidak dapat mengubah akses fitur diri sendiri",
      "error",
    );
  if (!amISuper && user.role !== "public")
    return window.showToast(
      "Admin hanya dapat mengubah akses fitur untuk user Public",
      "error",
    );

  document.getElementById("perm-target-username").value = username;
  document.getElementById("perm-user-name").innerText =
    `${user.name} (@${user.username})`;

  const perms = { ...getDefaultPermissions(), ...(user.permissions || {}) };
  const container = document.getElementById("user-permissions-list");
  container.innerHTML = FEATURE_PERMISSION_GROUPS.map(
    (group) => `
                <div>
                    <p class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">${group.label}</p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${group.items
                          .map(
                            (item) => `
                            <label class="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm">
                                <input type="checkbox" class="perm-checkbox w-4 h-4 shrink-0 text-indigo-600 rounded border-slate-300 dark:border-slate-600 cursor-pointer" data-perm-key="${item.key}" ${perms[item.key] ? "checked" : ""}>
                                <i class="fa-solid ${item.icon} text-slate-400 dark:text-slate-500 w-4 text-center text-xs shrink-0"></i>
                                <span class="text-slate-700 dark:text-slate-200 font-medium truncate">${item.label}</span>
                            </label>`,
                          )
                          .join("")}
                    </div>
                </div>`,
  ).join("");

  document.getElementById("perm-toggle-all").checked = ALL_FEATURE_KEYS.every(
    (k) => perms[k],
  );
  window.openModalAnimated("modal-user-permissions");
};

window.toggleAllPermissions = function (checked) {
  document
    .querySelectorAll("#user-permissions-list .perm-checkbox")
    .forEach((cb) => (cb.checked = checked));
};

window.saveUserPermissions = function () {
  const username = document.getElementById("perm-target-username").value;
  let users = LS.getUsers();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return;

  const permissions = {};
  document
    .querySelectorAll("#user-permissions-list .perm-checkbox")
    .forEach((cb) => {
      permissions[cb.getAttribute("data-perm-key")] = cb.checked;
    });

  users[idx].permissions = permissions;
  LS.setUsers(users);

  // Jika yang diedit adalah user yang sedang login, terapkan langsung tanpa perlu login ulang
  if (
    window.appState.currentUser &&
    window.appState.currentUser.username === username
  ) {
    window.appState.currentUser.permissions = permissions;
    sessionStorage.setItem(
      "qis_session",
      JSON.stringify(window.appState.currentUser),
    );
    if (window.appState.currentEventId) window.applyFeaturePermissions();
  }

  window.closeModalAnimated("modal-user-permissions");
  window.showToast(
    `Akses fitur untuk ${users[idx].name} berhasil diperbarui!`,
    "success",
  );
};

window.promptExportUsers = function () {
  document.getElementById("export-auth-password").value = "";
  window.openModalAnimated("modal-export-auth");
};

window.executeExportUsers = function (e) {
  e.preventDefault();
  const inputPass = document.getElementById("export-auth-password").value;
  const currentUser = LS.getUsers().find(
    (u) => u.username === window.appState.currentUser.username,
  );

  if (currentUser && currentUser.password === inputPass) {
    const users = LS.getUsers();
    const amISuper = currentUser.isSuperAdmin === true;
    const hiddenLabel =
      window.currentLang === "id" ? "(Disembunyikan)" : "(Hidden)";
    const exportData = users.map((u, i) => {
      // Aturan sama seperti tampilan daftar pengguna: Admin biasa tidak ikut mengekspor
      // username/password milik Super Admin atau sesama Admin lain, hanya miliknya sendiri & user Public.
      const canSeeCredentials =
        amISuper || u.username === currentUser.username || u.role === "public";
      return {
        No: i + 1,
        "Nama Lengkap": u.name,
        Username: canSeeCredentials ? u.username : hiddenLabel,
        Password: canSeeCredentials ? u.password : hiddenLabel,
        Role:
          u.role === "admin"
            ? u.isSuperAdmin
              ? "Super Admin"
              : "Admin"
            : "Public",
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar_Pengguna");
    XLSX.writeFile(wb, "Data_Akses_Pengguna.xlsx");

    window.closeModalAnimated("modal-export-auth");
    window.showToast("Data pengguna berhasil diexport!", "success");
  } else {
    window.showToast("Password tidak sesuai!", "error");
  }
};

// Info hari, tanggal, dan jam berjalan di header Library Event — mengikuti bahasa aktif aplikasi.
window.updateHeaderDateTime = function () {
  const el = document.getElementById("header-datetime-text");
  if (!el) return;
  const now = new Date();
  const locale = window.currentLang === "en" ? "en-US" : "id-ID";
  const dayDate = now.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  el.innerText = `${dayDate} • ${time}`;
};

function loadLibrary() {
  if (!window.appState.currentUser) return;
  document.getElementById("user-display-name").innerText =
    window.appState.currentUser.name;
  updateProfilePicUI();
  switchMainViewAnimated("view-library");
  const libContent = document.getElementById("library-main-content");
  libContent.classList.remove("library-enter");
  void libContent.offsetWidth;
  libContent.classList.add("library-enter");
  window.updateHeaderDateTime();
  window.applyFeaturePermissions(); // sinkronkan visibilitas Tools Tambahan (btn-lib-tools & kartu tools) tiap kali Library dibuka
  window.updateLibraryViewToggleUI(); // sinkronkan tombol Grid/List sesuai preferensi tersimpan
  window.updateLibraryFilterSortUI(); // sinkronkan dropdown Filter Kategori & Sort sesuai preferensi tersimpan
  renderEvents();
}

// Ganti jenis tampilan Event Library antara Grid/Card dan List, lalu simpan preferensinya
// di localStorage supaya tetap konsisten di kunjungan/refresh berikutnya.
window.setLibraryViewMode = function (mode) {
  if (mode !== "grid" && mode !== "list") return;
  if (window.libraryViewMode === mode) return;
  window.libraryViewMode = mode;
  LS.setSetting("library_view_mode", mode);
  window.updateLibraryViewToggleUI();
  renderEvents();
};

window.updateLibraryViewToggleUI = function () {
  const btnGrid = document.getElementById("btn-view-grid");
  const btnList = document.getElementById("btn-view-list");
  if (!btnGrid || !btnList) return;
  btnGrid.classList.toggle("tab-active", window.libraryViewMode === "grid");
  btnList.classList.toggle("tab-active", window.libraryViewMode === "list");
};

// Ganti kategori (Jenis Acara) yang ditampilkan di Event Library, lalu simpan preferensinya
// di localStorage. Halaman kembali ke halaman 1 karena jumlah hasil bisa berubah.
window.setLibraryFilterCategory = function (value) {
  window.libraryFilterCategory = value || "all";
  LS.setSetting("library_filter_category", window.libraryFilterCategory);
  window.currentPageEvents = 1;
  renderEvents();
};

// Ganti urutan Event Library (Bawaan / Nama A-Z / Nama Z-A), lalu simpan preferensinya
// di localStorage supaya tetap konsisten di kunjungan/refresh berikutnya.
window.setLibrarySortMode = function (value) {
  window.librarySortMode = value || "default";
  LS.setSetting("library_sort_mode", window.librarySortMode);
  renderEvents();
};

// Sinkronkan tampilan dropdown Filter Kategori & Sort sesuai preferensi tersimpan —
// dipanggil tiap kali Library dibuka (lihat window.loadLibrary), pola sama dengan
// window.updateLibraryViewToggleUI.
window.updateLibraryFilterSortUI = function () {
  const filterSel = document.getElementById("filter-library-category");
  const sortSel = document.getElementById("sort-library");
  if (filterSel) filterSel.value = window.libraryFilterCategory;
  if (sortSel) sortSel.value = window.librarySortMode;
};

function renderEvents() {
  const container = document.getElementById("event-list-container");
  const allEvents = LS.getEvents();
  const role = window.appState.currentUser.role;
  let myEvents = [];

  if (role === "admin") {
    myEvents = allEvents;
    document.getElementById("btn-lib-settings").style.display = "flex";
    document.getElementById("btn-lib-create").style.display = "flex";
  } else {
    myEvents = allEvents.filter(
      (e) =>
        e.accessList &&
        e.accessList.includes(window.appState.currentUser.username),
    );
    document.getElementById("btn-lib-settings").style.display = "none";
    document.getElementById("btn-lib-create").style.display = "none";
  }
  // Catatan: visibilitas 'btn-lib-tools' (Tools Tambahan) TIDAK diatur di sini lagi — sekarang
  // murni mengikuti checkbox "Custom QR Code Generator"/"Custom Barcode Generator" di modal
  // Kelola Akses Fitur (lihat window.applyFeaturePermissions, dipanggil dari window.loadLibrary),
  // supaya baik user Admin (non-super) maupun Public bisa diberi/dicabut akses tools ini secara
  // granular tanpa perlu mengubah role akunnya.

  const searchKeyword = (
    document.getElementById("search-library")?.value || ""
  ).toLowerCase();
  if (searchKeyword)
    myEvents = myEvents.filter((e) =>
      e.name.toLowerCase().includes(searchKeyword),
    );

  // Filter berdasarkan kategori (Jenis Acara: Rumah Sakit/Internal/Lain-lain).
  // "Lain-lain" mencakup semua event dengan tipe tsb, apapun isi typeDetail-nya.
  const filterCategory =
    document.getElementById("filter-library-category")?.value || "all";
  if (filterCategory !== "all")
    myEvents = myEvents.filter((e) => e.type === filterCategory);

  // Sort alfabet berdasarkan nama event. 'default' = urutan asli (sesuai data tersimpan).
  const sortMode = document.getElementById("sort-library")?.value || "default";
  if (sortMode === "az") {
    myEvents = [...myEvents].sort((a, b) =>
      a.name.localeCompare(b.name, "id", { sensitivity: "base" }),
    );
  } else if (sortMode === "za") {
    myEvents = [...myEvents].sort((a, b) =>
      b.name.localeCompare(a.name, "id", { sensitivity: "base" }),
    );
  }

  const totalEventsBadge = document.getElementById("total-events");
  if (totalEventsBadge)
    totalEventsBadge.innerText = `Total: ${myEvents.length}`;

  container.innerHTML = "";
  const isListView = window.libraryViewMode === "list";
  container.className = isListView
    ? "flex flex-col gap-3 w-full content-start min-h-[500px]"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 w-full content-start items-stretch min-h-[500px]";

  const EVENTS_PER_PAGE = 8;
  let totalPages = Math.ceil(myEvents.length / EVENTS_PER_PAGE);
  if (window.currentPageEvents > totalPages && totalPages > 0)
    window.currentPageEvents = totalPages;

  const startIdx = (window.currentPageEvents - 1) * EVENTS_PER_PAGE;
  const paginatedEvents = myEvents.slice(startIdx, startIdx + EVENTS_PER_PAGE);

  if (myEvents.length === 0) {
    document.getElementById("empty-event-state").classList.remove("hidden");
    // Jika kosong karena kata kunci pencarian atau filter kategori aktif (bukan karena
    // memang belum ada event sama sekali), tampilkan pesan "tidak ditemukan" yang lebih
    // sesuai dan sembunyikan tombol "Buat Event" (tidak relevan untuk kasus ini).
    const hasActiveFilter = !!searchKeyword || filterCategory !== "all";
    document.getElementById("empty-event-btn").style.display =
      role === "admin" && !hasActiveFilter ? "inline-flex" : "none";
    if (hasActiveFilter) {
      document.getElementById("empty-event-title").innerText = window.t(
        "txt_no_event_filtered",
      );
      document.getElementById("empty-event-sub").innerText = window.t(
        "txt_no_event_filtered_sub",
      );
    } else if (role === "public") {
      document.getElementById("empty-event-title").innerText =
        "Belum ada event";
      document.getElementById("empty-event-sub").innerText =
        "Anda belum diberikan akses ke event manapun.";
    } else {
      document.getElementById("empty-event-title").innerText =
        window.t("txt_no_event");
      document.getElementById("empty-event-sub").innerText =
        window.t("txt_no_event_sub");
    }
  } else {
    document.getElementById("empty-event-state").classList.add("hidden");

    paginatedEvents.forEach((evt) => {
      const guestsArr = LS.getGuests(evt.id);
      const evtDate = evt.date
        ? new Date(evt.date).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";
      const logoImg = evt.logo
        ? `<img src="${evt.logo}" class="w-full h-full object-contain bg-white dark:bg-slate-800 rounded-xl">`
        : `<i class="fa-solid fa-calendar-check"></i>`;

      const div = document.createElement("div");

      const metaBadges = `
                        <p class="font-medium"><i class="fa-regular fa-clock w-4"></i> ${evtDate}</p>
                        ${evt.type ? `<p class="font-medium"><i class="fa-solid fa-tag w-4"></i> ${evt.type === "Lain-lain" ? evt.typeDetail : evt.type}</p>` : ""}
                        ${evt.needsHotel ? `<p class="font-medium text-amber-600 dark:text-amber-400"><i class="fa-solid fa-hotel w-4"></i> Penginapan/Hotel</p>` : ""}
                        ${evt.needsSeat !== false ? `<p class="font-medium text-indigo-500 dark:text-indigo-400"><i class="fa-solid ${evt.seatLabelType === "meja" ? "fa-utensils" : "fa-chair"} w-4"></i> Penempatan ${evt.seatLabelType === "meja" ? "Meja" : "Kursi"}</p>` : ""}`;

      const metaBadgesInline = `
                        <span class="font-medium"><i class="fa-regular fa-clock w-4"></i> ${evtDate}</span>
                        ${evt.type ? `<span class="font-medium"><i class="fa-solid fa-tag w-4"></i> ${evt.type === "Lain-lain" ? evt.typeDetail : evt.type}</span>` : ""}
                        ${evt.needsHotel ? `<span class="font-medium text-amber-600 dark:text-amber-400"><i class="fa-solid fa-hotel w-4"></i> Penginapan/Hotel</span>` : ""}
                        ${evt.needsSeat !== false ? `<span class="font-medium text-indigo-500 dark:text-indigo-400"><i class="fa-solid ${evt.seatLabelType === "meja" ? "fa-utensils" : "fa-chair"} w-4"></i> Penempatan ${evt.seatLabelType === "meja" ? "Meja" : "Kursi"}</span>` : ""}`;

      const adminActions =
        role === "admin"
          ? `
                            <button onclick="event.stopPropagation(); window.openShareModal('${evt.id}')" class="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 p-2 rounded-lg transition-colors" title="Bagikan Akses"><i class="fa-solid fa-share-nodes text-sm"></i></button>
                            <button onclick="event.stopPropagation(); window.editEvent('${evt.id}')" class="text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 p-2 rounded-lg transition-colors" title="Edit Event"><i class="fa-solid fa-pen text-sm"></i></button>
                            <button onclick="event.stopPropagation(); window.duplicateEvent('${evt.id}')" class="text-cyan-500 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 p-2 rounded-lg transition-colors" title="Duplikat Event"><i class="fa-solid fa-copy text-sm"></i></button>
                            <button onclick="event.stopPropagation(); window.openConfirmModal('event', '${evt.id}')" class="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 p-2 rounded-lg transition-colors" title="Hapus Event"><i class="fa-solid fa-trash text-sm"></i></button>
                    `
          : "";

      if (isListView) {
        // ===== List View: baris horizontal, ringkas, padat informasi =====
        div.className =
          "w-full bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-lg dark:hover:border-indigo-500/40 transition-all relative group flex items-center gap-3 sm:gap-5";
        div.innerHTML = `
                            <div onclick="window.enterApp('${evt.id}')" class="flex items-center gap-3 sm:gap-5 flex-1 min-w-0 cursor-pointer">
                                <div class="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center text-xl overflow-hidden shadow-inner border border-indigo-100 dark:border-indigo-500/30">${logoImg}</div>
                                <div class="min-w-0 flex-1">
                                    <h3 class="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight truncate" title="${evt.name}">${evt.name}</h3>
                                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">${metaBadgesInline}</div>
                                </div>
                                <div class="hidden md:flex items-center shrink-0 pl-4">
                                    <p class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap"><i class="fa-solid fa-users mr-2"></i> ${guestsArr.length} Peserta</p>
                                </div>
                            </div>
                            ${role === "admin" ? `<div class="flex gap-1.5 sm:gap-2 shrink-0 pl-2 sm:pl-3 border-l border-slate-100 dark:border-slate-700">${adminActions}</div>` : ""}
                        `;
      } else {
        // ===== Grid/Card View: kartu vertikal (tampilan asli) =====
        div.className =
          "w-full bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-lg dark:hover:border-indigo-500/40 transition-all transform hover:-translate-y-1 relative group cursor-pointer flex flex-col h-full min-h-[220px]";
        div.innerHTML = `
                            <div class="absolute top-4 right-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1.5 sm:gap-2 z-10">
                                ${adminActions}
                            </div>
                            <div onclick="window.enterApp('${evt.id}')" class="flex-1 flex flex-col">
                                <div class="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center text-2xl mb-4 overflow-hidden shadow-inner border border-indigo-100 dark:border-indigo-500/30">${logoImg}</div>
                                <h3 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1 leading-tight line-clamp-2 ${role === "admin" ? "pr-32" : ""}" title="${evt.name}">${evt.name}</h3>
                                <div class="text-xs text-slate-500 dark:text-slate-400 space-y-1 mt-2 mb-4">${metaBadges}</div>
                                <p class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-auto pt-4 border-t border-slate-50 dark:border-slate-700"><i class="fa-solid fa-users mr-2"></i> ${guestsArr.length} Peserta Terdaftar</p>
                            </div>`;
      }

      container.appendChild(div);
    });
  }
  window.renderPagination(
    myEvents.length,
    EVENTS_PER_PAGE,
    window.currentPageEvents,
    "pagination-events",
    "changePageEvents",
  );
}
// BUG FIX: renderEvents dipanggil sebagai window.renderEvents() dari atribut oninput kolom
// pencarian Library ("Cari event...") di index.html, tapi sebelumnya fungsi ini hanya dideklarasikan
// secara lokal (tidak pernah diekspos ke window) - akibatnya setiap kali user mengetik di kolom
// pencarian, terjadi error "window.renderEvents is not a function" & daftar event tidak ikut
// terfilter live. Panggilan renderEvents() bare di dalam file ini (tanpa prefix window.) tetap
// berfungsi normal karena masih dalam scope closure yang sama.
window.renderEvents = renderEvents;

window.openToolsListModal = function () {
  window.openModalAnimated("modal-tools-list");
};

window.openToolQR = function () {
  // Jaga-jaga selain menyembunyikan kartu/tombolnya (lihat window.applyFeaturePermissions) —
  // fungsi ini juga bisa dipicu langsung dari tombol pintasan "Ke QR Code Generator" di halaman
  // Barcode Generator, jadi tetap perlu dicek ulang di sini. Pola sama dengan window.enterKioskMode.
  if (!window.hasFeaturePerm("toolQRGenerator"))
    return window.showToast(
      "Anda tidak memiliki akses ke fitur Custom QR Code Generator",
      "error",
    );
  window.closeModalAnimated("modal-tools-list");
  window.setLoadingText("txt_loading_qr_gen");
  switchMainViewAnimated("view-loading");

  setTimeout(() => {
    switchMainViewAnimated("view-tools-qr");
    document.getElementById("form-custom-qr").reset();
    window.updateCQRPreview();
    window.selectedCustomQRIds = new Set(); // reset centang "Cetak Terpilih" tiap buka halaman ini
    window.renderCustomQRs();
  }, 800);
};

window.openToolBarcode = function () {
  // Jaga-jaga selain menyembunyikan kartu/tombolnya (lihat window.applyFeaturePermissions) —
  // fungsi ini juga bisa dipicu langsung dari tombol pintasan "Ke Barcode Generator" di halaman
  // QR Code Generator, jadi tetap perlu dicek ulang di sini. Pola sama dengan window.enterKioskMode.
  if (!window.hasFeaturePerm("toolBarcodeGenerator"))
    return window.showToast(
      "Anda tidak memiliki akses ke fitur Custom Barcode Generator",
      "error",
    );
  window.closeModalAnimated("modal-tools-list");
  window.setLoadingText("txt_loading_barcode_gen");
  switchMainViewAnimated("view-loading");

  setTimeout(() => {
    switchMainViewAnimated("view-tools-barcode");
    document.getElementById("form-custom-barcode").reset();
    window.updateCBarcodePreview();
    window.selectedCustomBarcodeIds = new Set(); // reset centang "Cetak Terpilih" tiap buka halaman ini
    window.renderCustomBarcodes();
  }, 800);
};

// Filter Custom QR (pencarian saja) TANPA pengurutan - dipakai bersama oleh renderCustomQRs
// maupun window.toggleSelectAllCustomQR/updateCustomQRSelectionUI, supaya keduanya selalu
// merujuk ke kumpulan QR yang sama persis dengan yang sedang tampil di tabel.
function getFilteredCustomQRsList() {
  const search = (
    document.getElementById("search-custom-qr")?.value || ""
  ).toLowerCase();
  return LS.getCustomQRs().filter(
    (q) =>
      q.name.toLowerCase().includes(search) ||
      q.content.toLowerCase().includes(search),
  );
}

window.renderCustomQRs = function () {
  const qrs = LS.getCustomQRs();
  const tbody = document.getElementById("table-body-custom-qr");

  // Buang ID centang "Cetak Terpilih" yang datanya sudah tidak ada lagi (dihapus/diedit ulang,
  // dsb.) supaya counter "X QR dipilih" selalu akurat.
  const currentQRIds = new Set(qrs.map((q) => q.id));
  window.selectedCustomQRIds.forEach((id) => {
    if (!currentQRIds.has(id)) window.selectedCustomQRIds.delete(id);
  });

  let filtered = getFilteredCustomQRsList();
  filtered.sort((a, b) => b.created - a.created);

  tbody.innerHTML = "";
  const totalBadge = document.getElementById("qr-total-badge");
  if (totalBadge) totalBadge.innerText = qrs.length;

  const ITEMS_PER_PAGE = 5;
  let totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (window.currentPageCustomQR > totalPages && totalPages > 0)
    window.currentPageCustomQR = totalPages;

  const startIdx = (window.currentPageCustomQR - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  if (filtered.length === 0) {
    document.getElementById("empty-state-custom-qr").classList.remove("hidden");
  } else {
    document.getElementById("empty-state-custom-qr").classList.add("hidden");
    paginated.forEach((qr) => {
      const dateStr = new Date(qr.created).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const isLink = /^https?:\/\//i.test(qr.content.trim());
      const typeBadge = isLink
        ? '<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md mr-1.5 shrink-0"><i class="fa-solid fa-link"></i> Link</span>'
        : '<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md mr-1.5 shrink-0"><i class="fa-solid fa-font"></i> Teks</span>';
      const tr = document.createElement("tr");
      tr.className =
        "hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
      // Checkbox pilih baris untuk fitur "Cetak Terpilih" - state-nya murni mengikuti
      // window.selectedCustomQRIds supaya tetap konsisten walau tabel dirender ulang
      // (ganti halaman/pencarian) tanpa perlu menyimpan apa pun ke DOM.
      const selectCell = `<td class="px-4 py-3.5 text-center"><input type="checkbox" onchange="window.toggleCustomQRSelection('${qr.id}', this.checked)" ${window.selectedCustomQRIds.has(qr.id) ? "checked" : ""} class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"></td>`;
      tr.innerHTML = `${selectCell}
                        <td class="px-5 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100">${qr.name}</td>
                        <td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300 max-w-[220px]" title="${qr.content}"><div class="flex items-center">${typeBadge}<span class="truncate">${qr.content}</span></div></td>
                        <td class="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">${dateStr}</td>
                        <td class="px-5 py-3.5 text-center whitespace-nowrap">
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="window.previewCustomQR('${qr.id}')" class="w-8 h-8 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors" title="Preview"><i class="fa-solid fa-qrcode"></i></button>
                                <button onclick="window.downloadCustomQR('${qr.id}')" class="w-8 h-8 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors" title="Download"><i class="fa-solid fa-download"></i></button>
                                <button onclick="window.printSingleCustomQR('${qr.id}')" class="w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="Cetak"><i class="fa-solid fa-print"></i></button>
                                <button onclick="window.editCustomQR('${qr.id}')" class="w-8 h-8 rounded-lg text-amber-500 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors" title="Edit"><i class="fa-solid fa-pen"></i></button>
                                <button onclick="window.openConfirmModal('custom-qr', '${qr.id}')" class="w-8 h-8 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>`;
      tbody.appendChild(tr);
    });
  }
  window.renderPagination(
    filtered.length,
    ITEMS_PER_PAGE,
    window.currentPageCustomQR,
    "pagination-custom-qr",
    "changePageCustomQR",
  );
  window.updateCustomQRSelectionUI();
};

// ===== Pilih Custom QR untuk "Cetak Terpilih" (Custom QR Code Generator) =====
// Pola & alasan penerapannya sama persis dengan window.toggleGuestSelection dkk. di Data Peserta.
window.toggleCustomQRSelection = function (id, checked) {
  if (checked) window.selectedCustomQRIds.add(id);
  else window.selectedCustomQRIds.delete(id);
  window.updateCustomQRSelectionUI();
};

// Centang/hapus centang SEMUA Custom QR yang cocok dengan pencarian yang sedang aktif (bukan
// cuma yang tampil di halaman saat ini) - supaya "Pilih Semua" tetap intuitif walau dipaginasi.
window.toggleSelectAllCustomQR = function (checked) {
  const filtered = getFilteredCustomQRsList();
  filtered.forEach((q) => {
    if (checked) window.selectedCustomQRIds.add(q.id);
    else window.selectedCustomQRIds.delete(q.id);
  });
  window.renderCustomQRs();
};

window.clearCustomQRSelection = function () {
  window.selectedCustomQRIds.clear();
  window.renderCustomQRs();
};

// Perbarui badge tombol "Cetak Terpilih", indikator "X QR dipilih" + tombol Batal Pilih di
// sebelah judul tabel, dan status checkbox "Pilih Semua" di header (termasuk indeterminate saat
// hanya SEBAGIAN hasil yang cocok pencarian sedang tercentang).
window.updateCustomQRSelectionUI = function () {
  const count = window.selectedCustomQRIds.size;

  const indicator = document.getElementById("selected-cqr-indicator");
  if (indicator) indicator.style.display = count > 0 ? "inline-flex" : "none";
  const countText = document.getElementById("selected-cqr-count-text");
  if (countText)
    countText.innerText =
      window.currentLang === "id"
        ? `${count} QR dipilih`
        : `${count} QR selected`;

  const badge = document.getElementById("badge-print-selected-cqr-count");
  if (badge) {
    badge.innerText = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }

  const selectAllEl = document.getElementById("checkbox-select-all-cqr");
  if (selectAllEl) {
    const filtered = getFilteredCustomQRsList();
    const selectedInFiltered = filtered.filter((q) =>
      window.selectedCustomQRIds.has(q.id),
    ).length;
    selectAllEl.checked =
      filtered.length > 0 && selectedInFiltered === filtered.length;
    selectAllEl.indeterminate =
      selectedInFiltered > 0 && selectedInFiltered < filtered.length;
  }
};

// Pratinjau QR langsung di form saat konten diketik (debounce ringan agar tidak terlalu sering re-render).
let cqrPreviewDebounce = null;
window.updateCQRPreview = function () {
  const contentEl = document.getElementById("cqr-content");
  const counterEl = document.getElementById("cqr-char-count");
  if (counterEl && contentEl) counterEl.innerText = contentEl.value.length;

  clearTimeout(cqrPreviewDebounce);
  cqrPreviewDebounce = setTimeout(() => {
    const content = (contentEl?.value || "").trim();
    const emptyEl = document.getElementById("cqr-preview-empty");
    const canvasEl = document.getElementById("cqr-preview-canvas");
    if (!emptyEl || !canvasEl) return;
    if (!content) {
      emptyEl.classList.remove("hidden");
      canvasEl.classList.add("hidden");
      canvasEl.innerHTML = "";
      return;
    }
    canvasEl.innerHTML = "";
    new QRCode(canvasEl, {
      text: content,
      width: 140,
      height: 140,
      colorDark: "#1e293b",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    emptyEl.classList.add("hidden");
    canvasEl.classList.remove("hidden");
  }, 150);
};

window.handleCustomQRSubmit = function (e) {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-cqr");
  const originalHTML = btn.innerHTML;

  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> <span data-i18n="btn_generating">${window.t("btn_generating")}</span>`;
  btn.disabled = true;
  btn.classList.add("opacity-80", "cursor-not-allowed");

  setTimeout(() => {
    const name = document.getElementById("cqr-name").value.trim();
    const content = document.getElementById("cqr-content").value.trim();
    let qrs = LS.getCustomQRs();
    const newId =
      "CQR-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    qrs.push({ id: newId, name: name, content: content, created: Date.now() });

    LS.setCustomQRs(qrs);
    e.target.reset();
    window.updateCQRPreview();
    window.renderCustomQRs();
    window.showToast("Custom QR Code berhasil disimpan!", "success");
    window.previewCustomQR(newId);

    btn.innerHTML = originalHTML;
    btn.disabled = false;
    btn.classList.remove("opacity-80", "cursor-not-allowed");
  }, 800);
};

window.previewCustomQR = function (id) {
  const qr = LS.getCustomQRs().find((q) => q.id === id);
  if (!qr) return;
  const container = document.getElementById("custom-qrcode-container");
  container.innerHTML = "";
  new QRCode(container, {
    text: qr.content,
    width: 220,
    height: 220,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });
  document.getElementById("modal-custom-qr-name").innerText = qr.name;
  document.getElementById("modal-custom-qr-content").innerText = qr.content;
  window.openModalAnimated("modal-preview-custom-qr");
};

window.editCustomQR = function (id) {
  const qr = LS.getCustomQRs().find((q) => q.id === id);
  if (!qr) return;
  document.getElementById("edit-cqr-id").value = qr.id;
  document.getElementById("edit-cqr-name").value = qr.name;
  document.getElementById("edit-cqr-content").value = qr.content;
  window.openModalAnimated("modal-edit-custom-qr");
};

window.handleEditCustomQRSubmit = function (e) {
  e.preventDefault();
  const id = document.getElementById("edit-cqr-id").value;
  const name = document.getElementById("edit-cqr-name").value.trim();
  const content = document.getElementById("edit-cqr-content").value.trim();
  let qrs = LS.getCustomQRs();
  const idx = qrs.findIndex((q) => q.id === id);
  if (idx > -1) {
    qrs[idx].name = name;
    qrs[idx].content = content;
    LS.setCustomQRs(qrs);
    window.renderCustomQRs();
    window.closeModalAnimated("modal-edit-custom-qr");
    window.showToast("Data QR Code berhasil diupdate!", "success");
  }
};

window.downloadCustomQR = async function (id) {
  const qr = LS.getCustomQRs().find((q) => q.id === id);
  if (!qr) return;
  window.showToast("Menyiapkan unduhan QR...", "info");
  const url = await window.createQRCanvas(qr.content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `QR_${qr.name}.png`;
  a.click();
};

// Filter Custom Barcode (pencarian saja) TANPA pengurutan - dipakai bersama oleh
// renderCustomBarcodes maupun window.toggleSelectAllCustomBarcode/updateCustomBarcodeSelectionUI,
// supaya keduanya selalu merujuk ke kumpulan Barcode yang sama persis dengan yang sedang tampil.
function getFilteredCustomBarcodesList() {
  const search = (
    document.getElementById("search-custom-barcode")?.value || ""
  ).toLowerCase();
  return LS.getCustomBarcodes().filter(
    (b) =>
      b.name.toLowerCase().includes(search) ||
      b.content.toLowerCase().includes(search),
  );
}

window.renderCustomBarcodes = function () {
  const bcs = LS.getCustomBarcodes();
  const tbody = document.getElementById("table-body-custom-barcode");

  // Buang ID centang "Cetak Terpilih" yang datanya sudah tidak ada lagi (dihapus/diedit ulang,
  // dsb.) supaya counter "X Barcode dipilih" selalu akurat.
  const currentBcIds = new Set(bcs.map((b) => b.id));
  window.selectedCustomBarcodeIds.forEach((id) => {
    if (!currentBcIds.has(id)) window.selectedCustomBarcodeIds.delete(id);
  });

  let filtered = getFilteredCustomBarcodesList();
  filtered.sort((a, b) => b.created - a.created);

  tbody.innerHTML = "";
  const totalBadge = document.getElementById("barcode-total-badge");
  if (totalBadge) totalBadge.innerText = bcs.length;

  const ITEMS_PER_PAGE = 5;
  let totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (window.currentPageCustomBarcode > totalPages && totalPages > 0)
    window.currentPageCustomBarcode = totalPages;

  const startIdx = (window.currentPageCustomBarcode - 1) * ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  if (filtered.length === 0) {
    document
      .getElementById("empty-state-custom-barcode")
      .classList.remove("hidden");
  } else {
    document
      .getElementById("empty-state-custom-barcode")
      .classList.add("hidden");
    paginated.forEach((bc) => {
      const dateStr = new Date(bc.created).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const tr = document.createElement("tr");
      tr.className =
        "hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";
      // Checkbox pilih baris untuk fitur "Cetak Terpilih" - state-nya murni mengikuti
      // window.selectedCustomBarcodeIds supaya tetap konsisten walau tabel dirender ulang
      // (ganti halaman/pencarian) tanpa perlu menyimpan apa pun ke DOM.
      const selectCell = `<td class="px-4 py-3.5 text-center"><input type="checkbox" onchange="window.toggleCustomBarcodeSelection('${bc.id}', this.checked)" ${window.selectedCustomBarcodeIds.has(bc.id) ? "checked" : ""} class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"></td>`;
      tr.innerHTML = `${selectCell}
                        <td class="px-5 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100">${bc.name}</td>
                        <td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title="${bc.content}">${bc.content}</td>
                        <td class="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">${dateStr}</td>
                        <td class="px-5 py-3.5 text-center whitespace-nowrap">
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="window.previewCustomBarcode('${bc.id}')" class="w-8 h-8 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors" title="Preview"><i class="fa-solid fa-barcode"></i></button>
                                <button onclick="window.downloadCustomBarcode('${bc.id}')" class="w-8 h-8 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors" title="Download"><i class="fa-solid fa-download"></i></button>
                                <button onclick="window.printSingleCustomBarcode('${bc.id}')" class="w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="Cetak"><i class="fa-solid fa-print"></i></button>
                                <button onclick="window.editCustomBarcode('${bc.id}')" class="w-8 h-8 rounded-lg text-amber-500 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors" title="Edit"><i class="fa-solid fa-pen"></i></button>
                                <button onclick="window.openConfirmModal('custom-barcode', '${bc.id}')" class="w-8 h-8 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>`;
      tbody.appendChild(tr);
    });
  }
  window.renderPagination(
    filtered.length,
    ITEMS_PER_PAGE,
    window.currentPageCustomBarcode,
    "pagination-custom-barcode",
    "changePageCustomBarcode",
  );
  window.updateCustomBarcodeSelectionUI();
};

// ===== Pilih Custom Barcode untuk "Cetak Terpilih" (Custom Barcode Generator) =====
// Pola & alasan penerapannya sama persis dengan window.toggleGuestSelection dkk. di Data Peserta.
window.toggleCustomBarcodeSelection = function (id, checked) {
  if (checked) window.selectedCustomBarcodeIds.add(id);
  else window.selectedCustomBarcodeIds.delete(id);
  window.updateCustomBarcodeSelectionUI();
};

// Centang/hapus centang SEMUA Custom Barcode yang cocok dengan pencarian yang sedang aktif
// (bukan cuma yang tampil di halaman saat ini) - supaya "Pilih Semua" tetap intuitif walau dipaginasi.
window.toggleSelectAllCustomBarcode = function (checked) {
  const filtered = getFilteredCustomBarcodesList();
  filtered.forEach((b) => {
    if (checked) window.selectedCustomBarcodeIds.add(b.id);
    else window.selectedCustomBarcodeIds.delete(b.id);
  });
  window.renderCustomBarcodes();
};

window.clearCustomBarcodeSelection = function () {
  window.selectedCustomBarcodeIds.clear();
  window.renderCustomBarcodes();
};

// Perbarui badge tombol "Cetak Terpilih", indikator "X Barcode dipilih" + tombol Batal Pilih di
// sebelah judul tabel, dan status checkbox "Pilih Semua" di header (termasuk indeterminate saat
// hanya SEBAGIAN hasil yang cocok pencarian sedang tercentang).
window.updateCustomBarcodeSelectionUI = function () {
  const count = window.selectedCustomBarcodeIds.size;

  const indicator = document.getElementById("selected-cbarcode-indicator");
  if (indicator) indicator.style.display = count > 0 ? "inline-flex" : "none";
  const countText = document.getElementById("selected-cbarcode-count-text");
  if (countText)
    countText.innerText =
      window.currentLang === "id"
        ? `${count} Barcode dipilih`
        : `${count} barcodes selected`;

  const badge = document.getElementById("badge-print-selected-cbarcode-count");
  if (badge) {
    badge.innerText = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }

  const selectAllEl = document.getElementById("checkbox-select-all-cbarcode");
  if (selectAllEl) {
    const filtered = getFilteredCustomBarcodesList();
    const selectedInFiltered = filtered.filter((b) =>
      window.selectedCustomBarcodeIds.has(b.id),
    ).length;
    selectAllEl.checked =
      filtered.length > 0 && selectedInFiltered === filtered.length;
    selectAllEl.indeterminate =
      selectedInFiltered > 0 && selectedInFiltered < filtered.length;
  }
};

// Pratinjau Barcode langsung di form saat konten diketik (debounce ringan agar tidak terlalu sering re-render).
let cbarcodePreviewDebounce = null;
window.updateCBarcodePreview = function () {
  const contentEl = document.getElementById("cbarcode-content");
  const counterEl = document.getElementById("cbarcode-char-count");
  if (counterEl && contentEl) counterEl.innerText = contentEl.value.length;

  clearTimeout(cbarcodePreviewDebounce);
  cbarcodePreviewDebounce = setTimeout(() => {
    const content = (contentEl?.value || "").trim();
    const emptyEl = document.getElementById("cbarcode-preview-empty");
    const svgEl = document.getElementById("cbarcode-preview-svg");
    if (!emptyEl || !svgEl) return;
    if (!content) {
      emptyEl.classList.remove("hidden");
      svgEl.classList.add("hidden");
      return;
    }
    try {
      JsBarcode(svgEl, content, {
        format: "CODE128",
        width: 1.6,
        height: 60,
        displayValue: true,
        background: "#ffffff",
        lineColor: "#1e293b",
        margin: 4,
        fontSize: 12,
      });
      emptyEl.classList.add("hidden");
      svgEl.classList.remove("hidden");
    } catch (e) {
      emptyEl.classList.remove("hidden");
      svgEl.classList.add("hidden");
    }
  }, 150);
};

window.handleCustomBarcodeSubmit = function (e) {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-cbarcode");
  const originalHTML = btn.innerHTML;

  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> <span data-i18n="btn_generating">${window.t("btn_generating")}</span>`;
  btn.disabled = true;
  btn.classList.add("opacity-80", "cursor-not-allowed");

  setTimeout(() => {
    const name = document.getElementById("cbarcode-name").value.trim();
    const content = document.getElementById("cbarcode-content").value.trim();
    let bcs = LS.getCustomBarcodes();
    const newId =
      "BAR-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    bcs.push({ id: newId, name: name, content: content, created: Date.now() });

    LS.setCustomBarcodes(bcs);
    e.target.reset();
    window.updateCBarcodePreview();
    window.renderCustomBarcodes();
    window.showToast("Custom Barcode berhasil disimpan!", "success");
    window.previewCustomBarcode(newId);

    btn.innerHTML = originalHTML;
    btn.disabled = false;
    btn.classList.remove("opacity-80", "cursor-not-allowed");
  }, 800);
};

window.previewCustomBarcode = function (id) {
  const barcode = LS.getCustomBarcodes().find((b) => b.id === id);
  if (!barcode) return;
  try {
    JsBarcode("#custom-barcode-svg", barcode.content, {
      format: "CODE128",
      width: 2,
      height: 80,
      displayValue: true,
      background: "#ffffff",
      lineColor: "#1e293b",
      margin: 0,
    });
    document.getElementById("modal-custom-barcode-name").innerText =
      barcode.name;
    document.getElementById("modal-custom-barcode-content").innerText =
      barcode.content;
    window.openModalAnimated("modal-preview-custom-barcode");
  } catch (err) {
    window.showToast(
      "Teks tidak kompatibel untuk dibuat Barcode. Gunakan standar ASCII.",
      "error",
    );
  }
};

window.editCustomBarcode = function (id) {
  const bc = LS.getCustomBarcodes().find((b) => b.id === id);
  if (!bc) return;
  document.getElementById("edit-cbarcode-id").value = bc.id;
  document.getElementById("edit-cbarcode-name").value = bc.name;
  document.getElementById("edit-cbarcode-content").value = bc.content;
  window.openModalAnimated("modal-edit-custom-barcode");
};

window.handleEditCustomBarcodeSubmit = function (e) {
  e.preventDefault();
  const id = document.getElementById("edit-cbarcode-id").value;
  const name = document.getElementById("edit-cbarcode-name").value.trim();
  const content = document.getElementById("edit-cbarcode-content").value.trim();
  let bcs = LS.getCustomBarcodes();
  const idx = bcs.findIndex((b) => b.id === id);
  if (idx > -1) {
    bcs[idx].name = name;
    bcs[idx].content = content;
    LS.setCustomBarcodes(bcs);
    window.renderCustomBarcodes();
    window.closeModalAnimated("modal-edit-custom-barcode");
    window.showToast("Data Barcode berhasil diupdate!", "success");
  }
};

// Konversi konten barcode (CODE128/JsBarcode) menjadi PNG data URL, dipakai bersama oleh
// unduh satuan, cetak satuan, maupun cetak massal - supaya logikanya konsisten di satu tempat.
window.createBarcodeCanvasPNG = function (content, jsBarcodeOptions) {
  const opts = Object.assign(
    {
      format: "CODE128",
      width: 2,
      height: 100,
      displayValue: true,
      background: "#ffffff",
      lineColor: "#000000",
      margin: 10,
    },
    jsBarcodeOptions || {},
  );
  return new Promise((resolve, reject) => {
    try {
      const tempSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      JsBarcode(tempSvg, content, opts);
      const xml = new XMLSerializer().serializeToString(tempSvg);
      const svg64 = btoa(xml);
      const image64 = "data:image/svg+xml;base64," + svg64;
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = image64;
    } catch (e) {
      reject(e);
    }
  });
};

window.downloadCustomBarcode = function (id) {
  const barcode = LS.getCustomBarcodes().find((b) => b.id === id);
  if (!barcode) return;
  window.showToast("Menyiapkan unduhan Barcode...", "info");
  window
    .createBarcodeCanvasPNG(barcode.content)
    .then((url) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `Barcode_${barcode.name}.png`;
      a.click();
    })
    .catch(() =>
      window.showToast(
        "Gagal memproses gambar Barcode untuk diunduh.",
        "error",
      ),
    );
};

// ===== Menunggu Semua Gambar Siap Sebelum Mencetak =====
// BUG YANG DIPERBAIKI: sebelumnya window.print() dipanggil lewat setTimeout dengan delay tetap
// (250-300ms) setelah #print-area diisi HTML kartu. Ini TIDAK bisa diandalkan - delay tetap
// seperti itu cukup untuk kartu yang sedikit/gambar kecil, tapi terlalu singkat untuk logo event
// (foto base64 yang bisa berukuran besar, diulang di SETIAP kartu saat Cetak Semua) yang belum
// selesai di-decode/dirender oleh browser saat mulai me-rasterisasi halaman untuk printer fisik.
// Hasilnya: sebagian kartu tercetak TANPA logo (kosong), padahal terlihat normal di layar/preview
// karena pengguna biasanya sempat menunggu sebelum benar-benar menekan tombol cetak di dialog
// preview browser - waktu tunggu itu sudah cukup bagi gambar untuk selesai dimuat, sehingga
// masalahnya tidak kelihatan di preview dan baru muncul di hasil cetak fisik yang sebenarnya.
// PERBAIKAN: tunggu SEMUA elemen <img> di dalam area cetak benar-benar selesai dimuat (event
// 'load', atau 'error' supaya satu gambar yang gagal tidak mengganjal proses cetak selamanya)
// sebelum window.print() dipanggil - bukan menebak-nebak durasi lewat delay tetap.
function waitForImagesReady(container) {
  const imgs = Array.from(container.querySelectorAll("img"));
  if (imgs.length === 0) return Promise.resolve();
  const allLoaded = Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }),
  );
  // Jaring pengaman: kalau entah kenapa ada gambar yang tidak pernah memicu load/error sama
  // sekali (kasus sangat jarang), jangan sampai proses cetak macet menunggu tanpa henti -
  // batas 5 detik cukup longgar untuk gambar base64 yang seharusnya didekode hampir seketika.
  const timeout = new Promise((resolve) => setTimeout(resolve, 5000));
  return Promise.race([allLoaded, timeout]);
}

// ===== Pengaturan Cetak untuk Custom QR Code Generator & Custom Barcode Generator =====
// Terpisah dari window.getPrintQRSettings (itu khusus kartu QR peserta event, dengan field
// sebanyak nama/id/rs/jabatan/kursi/logo). Di sini kartu Custom QR & Custom Barcode tidak
// terikat data peserta, jadi cukup 3 checkbox (Judul Tools, Nama, Konten/Nilai) + switch
// Bingkai. Disimpan dengan key terpisah per tool (type 'qr' / 'barcode') supaya preferensi
// cetak QR Kustom & Barcode Kustom bisa diatur berbeda satu sama lain.
window.getPrintCustomSettings = function (type) {
  const key =
    type === "barcode"
      ? "print_custom_barcode_fields"
      : "print_custom_qr_fields";
  const raw = LS.getSetting(key);
  const DEFAULTS = { title: true, name: true, content: true, frame: true };
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw);
    // Default nyala untuk semua field — sebelum pengaturan ini ada, keempatnya SELALU
    // tercetak tanpa opsi mati, jadi pengguna lama (belum pernah menyimpan) tetap melihat
    // perilaku yang sama persis seperti sebelumnya.
    return {
      title: parsed.title !== false,
      name: parsed.name !== false,
      content: parsed.content !== false,
      frame: parsed.frame !== false,
    };
  } catch (e) {
    return DEFAULTS;
  }
};

window.saveCustomPrintFieldSetting = function (type, field, value) {
  const s = window.getPrintCustomSettings(type);
  s[field] = value;
  const key =
    type === "barcode"
      ? "print_custom_barcode_fields"
      : "print_custom_qr_fields";
  LS.setSetting(key, JSON.stringify(s));
};

// Popover pengaturan cetak, dirender sebagai portal ke document.body (posisi fixed) supaya
// tidak terpotong area sekitarnya & menutup otomatis saat klik di luar/scroll — pola yang
// sama dengan window.toggleGuestActionMenu di atas.
window.togglePrintCustomSettingsMenu = function (type, btnEl) {
  const existing = document.getElementById("print-custom-settings-menu");
  const wasOpenForThis = existing && existing.dataset.type === type;
  window.closePrintCustomSettingsMenu();
  if (wasOpenForThis) return;

  const s = window.getPrintCustomSettings(type);
  const menu = document.createElement("div");
  menu.id = "print-custom-settings-menu";
  menu.dataset.type = type;
  menu.className =
    "fixed z-[90] w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4";
  menu.style.animation = "fadeSlideUp 0.15s ease forwards";

  const checkboxRow = (field, label) => `
                <label class="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors mb-2">
                    <input type="checkbox" onchange="window.saveCustomPrintFieldSetting('${type}', '${field}', this.checked)" class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer" ${s[field] ? "checked" : ""}>
                    <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${label}</span>
                </label>`;

  menu.innerHTML = `
                <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><i class="fa-solid fa-print text-[10px]"></i> ${window.t("lbl_print_custom_settings_title")}</p>
                ${checkboxRow("title", window.t("lbl_print_field_tools_title"))}
                ${checkboxRow("name", window.t("lbl_print_field_name"))}
                ${checkboxRow("content", window.t("lbl_print_field_content"))}
                <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">
                    <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${window.t("lbl_print_frame")}</span>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                        <input type="checkbox" onchange="window.saveCustomPrintFieldSetting('${type}', 'frame', this.checked)" class="sr-only peer" ${s.frame ? "checked" : ""}>
                        <div class="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer peer-checked:bg-indigo-600 transition-colors duration-300"></div>
                        <span class="absolute left-1 top-1 bg-white dark:bg-slate-800 w-4 h-4 rounded-full shadow-md transition-transform duration-300 peer-checked:translate-x-5"></span>
                    </label>
                </div>`;
  document.body.appendChild(menu);

  const rect = btnEl.getBoundingClientRect();
  const menuWidth = 288; // w-72
  let left = rect.right - menuWidth;
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8)
    left = window.innerWidth - menuWidth - 8;
  let top = rect.bottom + 8;
  const menuHeightEstimate = 260;
  if (top + menuHeightEstimate > window.innerHeight - 8)
    top = Math.max(8, rect.top - menuHeightEstimate - 8);
  menu.style.left = left + "px";
  menu.style.top = top + "px";

  setTimeout(() => {
    window._closePrintCustomSettingsMenuHandler = function (ev) {
      if (!menu.contains(ev.target)) window.closePrintCustomSettingsMenu();
    };
    document.addEventListener(
      "click",
      window._closePrintCustomSettingsMenuHandler,
      true,
    );
    window.addEventListener("scroll", window.closePrintCustomSettingsMenu, {
      once: true,
      capture: true,
    });
  }, 0);
};

window.closePrintCustomSettingsMenu = function () {
  const existing = document.getElementById("print-custom-settings-menu");
  if (existing) existing.remove();
  if (window._closePrintCustomSettingsMenuHandler) {
    document.removeEventListener(
      "click",
      window._closePrintCustomSettingsMenuHandler,
      true,
    );
    window._closePrintCustomSettingsMenuHandler = null;
  }
};

// ===== Cetak Custom QR Code (satuan & massal) =====
window.buildPrintCustomQRCard = function (qr, qrUrl, settings) {
  const s = settings || window.getPrintCustomSettings("qr");
  // Konten bisa berupa link/teks panjang; dipotong agar tidak merusak tata letak kartu cetak.
  const contentPreview =
    qr.content.length > 140 ? qr.content.slice(0, 140) + "…" : qr.content;
  const frameClass = s.frame === false ? " no-frame" : "";
  return `
                <div class="print-qr-card${frameClass}">
                    ${s.title !== false ? `<p class="print-card-event">Custom QR Code</p>` : ""}
                    <div class="print-card-body">
                        <img src="${qrUrl}" class="print-card-qr">
                        <div class="print-card-info">
                            ${s.name !== false ? `<p class="print-card-name">${qr.name}</p>` : ""}
                            ${s.content !== false ? `<p class="print-card-desc">${contentPreview}</p>` : ""}
                        </div>
                    </div>
                </div>`;
};

window.printSingleCustomQR = async function (id) {
  const qr = LS.getCustomQRs().find((q) => q.id === id);
  if (!qr) return;
  window.showToast(window.t("txt_print_preparing"), "info");
  const settings = window.getPrintCustomSettings("qr");
  const qrUrl = await window.createQRCanvas(qr.content);
  window.applyPrintOrientationStyle("portrait");
  const area = document.getElementById("print-area");
  area.innerHTML = `<div class="print-single-wrap">${window.buildPrintCustomQRCard(qr, qrUrl, settings)}</div>`;
  await waitForImagesReady(area);
  window.print();
};

// Cetak Terpilih: mencetak Custom QR yang dicentang admin di tabel Daftar QR Code (lihat
// window.toggleCustomQRSelection/window.selectedCustomQRIds) - untuk mencetak SEMUA QR, admin
// tinggal centang "Pilih Semua" lalu klik tombol ini. Pola sama dengan window.printSelectedQR
// di Data Peserta event.
window.printSelectedCustomQR = async function () {
  const qrs = LS.getCustomQRs().filter((q) =>
    window.selectedCustomQRIds.has(q.id),
  );
  if (qrs.length === 0)
    return window.showToast(
      window.currentLang === "id"
        ? "Belum ada QR Code yang dipilih untuk dicetak!"
        : "No QR codes selected to print yet!",
      "error",
    );
  window.applyPrintOrientationStyle("portrait");
  const settings = window.getPrintCustomSettings("qr");
  window.showProgressModal(
    window.t("btn_print_selected"),
    window.currentLang === "id"
      ? "Menyiapkan label cetak QR..."
      : "Preparing QR print labels...",
  );
  const area = document.getElementById("print-area");
  // Dibuat berbarengan dalam batch kecil (bukan satu per satu) — lihat processInChunks di atas.
  const cards = await processInChunks(
    qrs,
    async (qr) => {
      const qrUrl = await window.createQRCanvas(qr.content);
      return window.buildPrintCustomQRCard(qr, qrUrl, settings);
    },
    (done, t) => window.updateProgressModal(done, t),
  );
  area.innerHTML = `<div class="print-grid-wrap">${cards.join("")}</div>`;
  window.hideProgressModal();
  await waitForImagesReady(area);
  window.print();
};

// ===== Cetak Custom Barcode (satuan & massal) =====
window.buildPrintCustomBarcodeCard = function (bc, barcodeUrl, settings) {
  const s = settings || window.getPrintCustomSettings("barcode");
  // Catatan: teks Konten/Nilai untuk Barcode dikendalikan lewat opsi displayValue saat
  // membuat gambar barcode-nya (lihat window.createBarcodeCanvasPNG di pemanggilnya),
  // bukan lewat elemen teks terpisah di sini — supaya tidak dobel dengan teks yang sudah
  // otomatis ditampilkan JsBarcode di bawah garis barcode.
  const frameClass = s.frame === false ? " no-frame" : "";
  const nameRow =
    s.name !== false
      ? `<div class="print-card-info"><p class="print-card-name">${bc.name}</p></div>`
      : "";
  return `
                <div class="print-qr-card print-card-barcode-wrap${frameClass}">
                    ${s.title !== false ? `<p class="print-card-event">Custom Barcode</p>` : ""}
                    <div class="print-card-body">
                        <img src="${barcodeUrl}" class="print-card-barcode-img">
                        ${nameRow}
                    </div>
                </div>`;
};

window.printSingleCustomBarcode = async function (id) {
  const bc = LS.getCustomBarcodes().find((b) => b.id === id);
  if (!bc) return;
  window.showToast(window.t("txt_print_preparing"), "info");
  try {
    const settings = window.getPrintCustomSettings("barcode");
    const barcodeUrl = await window.createBarcodeCanvasPNG(bc.content, {
      displayValue: settings.content !== false,
    });
    window.applyPrintOrientationStyle("portrait");
    const area = document.getElementById("print-area");
    area.innerHTML = `<div class="print-single-wrap">${window.buildPrintCustomBarcodeCard(bc, barcodeUrl, settings)}</div>`;
    await waitForImagesReady(area);
    window.print();
  } catch (e) {
    window.showToast(
      "Teks tidak kompatibel untuk dibuat Barcode. Gunakan standar ASCII.",
      "error",
    );
  }
};

// Cetak Terpilih: mencetak Custom Barcode yang dicentang admin di tabel Daftar Barcode (lihat
// window.toggleCustomBarcodeSelection/window.selectedCustomBarcodeIds) - untuk mencetak SEMUA
// Barcode, admin tinggal centang "Pilih Semua" lalu klik tombol ini. Pola sama dengan
// window.printSelectedQR di Data Peserta event.
window.printSelectedCustomBarcode = async function () {
  const bcs = LS.getCustomBarcodes().filter((b) =>
    window.selectedCustomBarcodeIds.has(b.id),
  );
  if (bcs.length === 0)
    return window.showToast(
      window.currentLang === "id"
        ? "Belum ada Barcode yang dipilih untuk dicetak!"
        : "No barcodes selected to print yet!",
      "error",
    );
  window.applyPrintOrientationStyle("portrait");
  const settings = window.getPrintCustomSettings("barcode");
  window.showProgressModal(
    window.t("btn_print_selected"),
    window.currentLang === "id"
      ? "Menyiapkan label cetak Barcode..."
      : "Preparing Barcode print labels...",
  );
  const area = document.getElementById("print-area");
  let skipped = 0;
  // Dibuat berbarengan dalam batch kecil (bukan satu per satu) — lihat processInChunks di atas.
  const cardsRaw = await processInChunks(
    bcs,
    async (bc) => {
      try {
        const barcodeUrl = await window.createBarcodeCanvasPNG(bc.content, {
          displayValue: settings.content !== false,
        });
        return window.buildPrintCustomBarcodeCard(bc, barcodeUrl, settings);
      } catch (e) {
        skipped++;
        return "";
      }
    },
    (done, t) => window.updateProgressModal(done, t),
  );
  area.innerHTML = `<div class="print-grid-wrap">${cardsRaw.filter(Boolean).join("")}</div>`;
  window.hideProgressModal();
  if (skipped > 0)
    window.showToast(
      `${skipped} Barcode dilewati (konten tidak kompatibel)`,
      "error",
    );
  await waitForImagesReady(area);
  window.print();
};

// Menampilkan info nama file & pratinjau kecil logo event yang baru saja dipilih/dipotong,
// supaya pengguna dapat konfirmasi visual file mana yang ter-upload (sebelumnya tidak ada
// indikasi apa pun setelah cropper ditutup selain toast yang cepat hilang).
window.showEventLogoFileInfo = function (label, previewSrc) {
  const wrap = document.getElementById("event-logo-filename-wrap");
  const text = document.getElementById("event-logo-filename-text");
  const preview = document.getElementById("event-logo-filename-preview");
  if (!wrap || !text) return;
  text.innerText = label;
  if (preview) {
    if (previewSrc) {
      preview.src = previewSrc;
      preview.classList.remove("hidden");
    } else {
      preview.classList.add("hidden");
    }
  }
  wrap.classList.remove("hidden");
};
window.hideEventLogoFileInfo = function () {
  const wrap = document.getElementById("event-logo-filename-wrap");
  if (wrap) wrap.classList.add("hidden");
};

// Menampilkan/menyembunyikan sub-opsi "perlu tanda tangan" mengikuti status checkbox needs-hotel induknya
window.toggleHotelKeySignatureOption = function () {
  const needsHotel = document.getElementById("event-needs-hotel").checked;
  const container = document.getElementById("event-key-signature-container");
  if (container) container.classList.toggle("hidden", !needsHotel);
  // Opsi sembunyikan kolom Kamar/Kunci hanya relevan jika data hotel memang dipakai;
  // jika dimatikan, checkbox-nya ikut direset supaya tidak tersimpan nyangkut.
  ["event-hide-col-kamar-row", "event-hide-col-kunci-row"].forEach((rowId) => {
    const row = document.getElementById(rowId);
    if (row) row.classList.toggle("hidden", !needsHotel);
  });
  if (!needsHotel) {
    ["event-hide-col-kamar", "event-hide-col-kunci"].forEach((cbId) => {
      const cb = document.getElementById(cbId);
      if (cb) cb.checked = false;
    });
  }
};

// Menampilkan/menyembunyikan pilihan "Nomor Meja"/"Nomor Kursi" — hanya relevan bila
// event memang membutuhkan data nomor untuk peserta (checkbox event-needs-seat aktif).
window.toggleSeatLabelOption = function () {
  const needsSeat = document.getElementById("event-needs-seat").checked;
  const container = document.getElementById("event-seat-label-container");
  if (container) container.classList.toggle("hidden", !needsSeat);
  // Opsi sembunyikan kolom Kursi/Meja hanya relevan jika data nomor memang dipakai.
  const hideColRow = document.getElementById("event-hide-col-kursi-row");
  if (hideColRow) hideColRow.classList.toggle("hidden", !needsSeat);
  if (!needsSeat) {
    const cb = document.getElementById("event-hide-col-kursi");
    if (cb) cb.checked = false;
  }
};

// ===== Nomor Khusus/Unik Peserta (custom number fields per-event) =====
// Admin bisa menambahkan jenis-jenis nomor unik tambahan (mis. NIK, No. Registrasi, ID
// Karyawan) saat membuat/mengedit sebuah event - jumlah & namanya bebas dikustomisasi.
// Field-field ini lalu otomatis dirender ulang di Form Pendaftaran Peserta & modal Edit
// Data Peserta untuk event tersebut (lihat window.renderCustomNumberFieldsForm), dan
// nilainya tersimpan di guest.customNumbers (object, key = id field, value = isian teks).
const MAX_CUSTOM_NUMBER_FIELDS = 10;

window.addEventCustomNumberFieldRow = function (label = "", fieldId = null) {
  const list = document.getElementById("event-custom-number-fields-list");
  if (!list) return;
  if (list.children.length >= MAX_CUSTOM_NUMBER_FIELDS) {
    window.showToast(
      window.currentLang === "id"
        ? `Maksimal ${MAX_CUSTOM_NUMBER_FIELDS} jenis nomor unik.`
        : `Maximum ${MAX_CUSTOM_NUMBER_FIELDS} unique number types.`,
      "warning",
    );
    return;
  }
  fieldId =
    fieldId || `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 custom-number-field-row";
  row.dataset.fieldId = fieldId;
  const safeLabel = (label || "").replace(/"/g, "&quot;");
  row.innerHTML = `
                <i class="fa-solid fa-hashtag text-slate-400 dark:text-slate-500 text-xs shrink-0"></i>
                <input type="text" class="custom-number-field-label flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 transition-colors" placeholder="${window.currentLang === "id" ? "Misal: NIK, No. Registrasi" : "E.g: National ID, Registration No."}" maxlength="40" value="${safeLabel}">
                <button type="button" onclick="window.removeEventCustomNumberFieldRow(this)" class="w-8 h-8 shrink-0 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center transition-colors" title="${window.currentLang === "id" ? "Hapus" : "Remove"}"><i class="fa-solid fa-trash text-xs"></i></button>
            `;
  list.appendChild(row);
};

window.removeEventCustomNumberFieldRow = function (btnEl) {
  const row = btnEl.closest(".custom-number-field-row");
  if (row) row.remove();
};

// ===== Sembunyikan Kolom Data Peserta (hide/unhide kolom tabel per-event) =====
// Hanya memengaruhi TAMPILAN kolom pada tabel Data Peserta & Daftar Hadir. Data pada
// field yang disembunyikan tetap tersimpan utuh di object guest dan tetap terpakai normal
// oleh seluruh bagian sistem lain (form input/edit, QR, cetak, export Excel, kartu kunci,
// dsb) — checkbox ini murni kontrol visibilitas kolom, bukan penghapusan data.
const HIDEABLE_COLUMN_KEYS = ["rs", "jabatan", "kursi", "kamar", "kunci"];

window.getEventHiddenColumnsFromForm = function () {
  const idMap = {
    rs: "event-hide-col-rs",
    jabatan: "event-hide-col-jabatan",
    kursi: "event-hide-col-kursi",
    kamar: "event-hide-col-kamar",
    kunci: "event-hide-col-kunci",
  };
  const result = [];
  HIDEABLE_COLUMN_KEYS.forEach((key) => {
    const el = document.getElementById(idMap[key]);
    if (el && el.checked) result.push(key);
  });
  return result;
};

// Mengisi ulang checkbox sembunyikan kolom dari data event tersimpan (dipakai window.editEvent)
// atau mengosongkannya semua (dipakai window.openEventModal untuk event baru).
window.setEventHiddenColumnsToForm = function (hiddenColumns) {
  const idMap = {
    rs: "event-hide-col-rs",
    jabatan: "event-hide-col-jabatan",
    kursi: "event-hide-col-kursi",
    kamar: "event-hide-col-kamar",
    kunci: "event-hide-col-kunci",
  };
  const hidden = Array.isArray(hiddenColumns) ? hiddenColumns : [];
  HIDEABLE_COLUMN_KEYS.forEach((key) => {
    const el = document.getElementById(idMap[key]);
    if (el) el.checked = hidden.includes(key);
  });
};

// Menerapkan status sembunyikan kolom ke header tabel Data Peserta & Daftar Hadir yang
// sedang tampil. Dipanggil dari window.enterApp setiap kali sebuah event dibuka - baris
// <td> per tamu sendiri sudah menyesuaikan lewat createGuestRow/createAttendedRow.
window.applyHiddenColumnsToTableHeaders = function (evt) {
  const hidden =
    evt && Array.isArray(evt.hiddenColumns) ? evt.hiddenColumns : [];
  const setDisplay = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? "table-cell" : "none";
  };
  setDisplay("th-list-rs-col", !hidden.includes("rs"));
  setDisplay("th-att-rs-col", !hidden.includes("rs"));
  setDisplay("th-list-jabatan-col", !hidden.includes("jabatan"));
  setDisplay("th-att-jabatan-col", !hidden.includes("jabatan"));
};

// Dipanggil saat submit form Buat/Edit Event - baris dengan nama kosong diabaikan begitu saja.
window.getEventCustomNumberFieldsFromForm = function () {
  const rows = document.querySelectorAll(
    "#event-custom-number-fields-list .custom-number-field-row",
  );
  const fields = [];
  rows.forEach((row) => {
    const label = row.querySelector(".custom-number-field-label").value.trim();
    if (label) fields.push({ id: row.dataset.fieldId, label });
  });
  return fields;
};

// Merender input Nomor Khusus/Unik sesuai konfigurasi event yang aktif. Dipakai bersama oleh
// Form Pendaftaran Peserta (containerId="container-custom-number-fields") maupun modal Edit
// Data Peserta (containerId="container-edit-custom-number-fields") - prefix dibedakan supaya
// id elemen tidak bentrok karena kedua form ini sama-sama ada di DOM secara bersamaan.
// excludeGuestId: id peserta yang HARUS dikecualikan dari pengecekan kembar (lihat
// window.checkCustomNumberFieldDuplicate) - null untuk Form Pendaftaran (peserta belum ada),
// atau id peserta yang sedang diedit supaya nilainya sendiri tidak dianggap "bentrok dengan
// diri sendiri" di modal Edit Data Peserta.
window.renderCustomNumberFieldsForm = function (
  evt,
  containerId,
  prefix,
  existingValues,
  excludeGuestId,
) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const fields =
    evt && Array.isArray(evt.customNumberFields) ? evt.customNumberFields : [];
  existingValues = existingValues || {};
  const excludeArg = excludeGuestId ? `'${excludeGuestId}'` : "null";

  if (fields.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = fields
    .map((f) => {
      const val = (existingValues[f.id] || "")
        .toString()
        .replace(/"/g, "&quot;");
      const inputId = `${prefix}-${f.id}`;
      return `
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">${f.label} <span class="text-xs font-normal text-slate-400 dark:text-slate-500">(${window.currentLang === "id" ? "Opsional" : "Optional"})</span></label>
                    <div class="relative">
                        <i class="fa-solid fa-hashtag absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm"></i>
                        <input type="text" id="${inputId}" data-custom-field-id="${f.id}" autocomplete="off" value="${val}" oninput="window.checkCustomNumberFieldDuplicate(this, ${excludeArg})" class="w-full pl-11 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 transition-all focus:bg-white dark:focus:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500">
                    </div>
                    <p id="${inputId}-dup-warning" class="hidden mt-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation"></i> <span></span></p>
                </div>`;
    })
    .join("");

  // Jalankan pengecekan sekali di awal untuk field yang sudah terisi (mis. modal Edit Data
  // Peserta dibuka dengan nilai lama yang ternyata sudah bentrok dengan peserta lain) -
  // supaya peringatan langsung tampil tanpa menunggu admin mengetik ulang.
  fields.forEach((f) => {
    const inputEl = document.getElementById(`${prefix}-${f.id}`);
    if (inputEl && inputEl.value.trim())
      window.checkCustomNumberFieldDuplicate(inputEl, excludeGuestId);
  });
};

// Memeriksa apakah nilai yang baru saja diketik pada sebuah field Nomor Khusus/Unik sudah
// dipakai peserta LAIN di event yang sama (excludeGuestId dikecualikan supaya nilai milik
// peserta yang sedang diedit sendiri tidak dianggap bentrok dengan dirinya sendiri).
// Peringatan tampil inline di bawah input & border input ikut ditandai amber - TIDAK
// memblokir pengisian, karena bisa saja memang sengaja sama untuk kasus tertentu. Pengecekan
// terakhir yang lebih tegas (meminta konfirmasi sebelum benar-benar disimpan) ada di
// window.findDuplicateCustomNumberField, dipanggil dari window.handleGenerateSubmit &
// window.handleEditSubmit saat form disubmit.
window.checkCustomNumberFieldDuplicate = function (inputEl, excludeGuestId) {
  const fieldId = inputEl.getAttribute("data-custom-field-id");
  const warningEl = document.getElementById(`${inputEl.id}-dup-warning`);
  const value = inputEl.value.trim();
  inputEl.classList.remove("custom-number-dup-border");
  if (!warningEl) return;
  if (!value) {
    warningEl.classList.add("hidden");
    warningEl.classList.remove("flex");
    return;
  }

  const dupGuest = window.guests.find(
    (g) =>
      g.id !== excludeGuestId &&
      g.customNumbers &&
      (g.customNumbers[fieldId] || "").toString().trim() === value,
  );
  if (dupGuest) {
    inputEl.classList.add("custom-number-dup-border");
    warningEl.querySelector("span").innerText =
      window.currentLang === "id"
        ? `Sudah dipakai oleh ${dupGuest.nama}`
        : `Already used by ${dupGuest.nama}`;
    warningEl.classList.remove("hidden");
    warningEl.classList.add("flex");
  } else {
    warningEl.classList.add("hidden");
    warningEl.classList.remove("flex");
  }
};

// Mencari apakah salah satu nilai di `customNumbersMap` (hasil window.collectCustomNumberValues)
// sudah dipakai peserta LAIN (excludeGuestId dikecualikan, untuk kasus edit peserta yang sedang
// mengedit dirinya sendiri) di event yang sama. Mengembalikan info field & pemilik pertama yang
// bentrok, atau null kalau tidak ada yang bentrok - dipakai sebagai pengecekan terakhir saat
// form disubmit (lihat window.handleGenerateSubmit & window.handleEditSubmit), melengkapi
// peringatan inline yang sudah tampil saat mengetik (window.checkCustomNumberFieldDuplicate).
window.findDuplicateCustomNumberField = function (
  evt,
  customNumbersMap,
  excludeGuestId,
) {
  const fields =
    evt && Array.isArray(evt.customNumberFields) ? evt.customNumberFields : [];
  for (const f of fields) {
    const val = (customNumbersMap[f.id] || "").toString().trim();
    if (!val) continue;
    const dupGuest = window.guests.find(
      (g) =>
        g.id !== excludeGuestId &&
        g.customNumbers &&
        (g.customNumbers[f.id] || "").toString().trim() === val,
    );
    if (dupGuest)
      return {
        fieldId: f.id,
        label: f.label,
        value: val,
        guestName: dupGuest.nama,
        guestId: dupGuest.id,
      };
  }
  return null;
};

// Mengumpulkan nilai isian dari field Nomor Khusus/Unik yang sedang dirender di sebuah
// container, untuk disimpan ke guest.customNumbers. Baris kosong tidak disertakan.
window.collectCustomNumberValues = function (containerId) {
  const container = document.getElementById(containerId);
  const values = {};
  if (!container) return values;
  container.querySelectorAll("[data-custom-field-id]").forEach((input) => {
    const v = input.value.trim();
    if (v) values[input.getAttribute("data-custom-field-id")] = v;
  });
  return values;
};

window.openEventModal = function () {
  document.getElementById("event-id").value = "";
  document.getElementById("event-name").value = "";
  document.getElementById("event-type").value = "Rumah Sakit";
  window.toggleEventTypeDetail();
  document.getElementById("event-date").value = "";
  document.getElementById("event-needs-seat").checked = true; // Default nyala
  document.querySelector(
    'input[name="event-seat-label-type"][value="kursi"]',
  ).checked = true; // Default: Nomor Kursi
  window.toggleSeatLabelOption();
  document.getElementById("event-needs-hotel").checked = false;
  document.getElementById("event-needs-key-signature").checked = true; // Default nyala (perlu tanda tangan)
  window.toggleHotelKeySignatureOption();
  document.getElementById("event-logo-file").value = "";
  document.getElementById("event-logo-base64").value = "";
  window.hideEventLogoFileInfo();
  document.getElementById("event-custom-number-fields-list").innerHTML = "";
  window.setEventHiddenColumnsToForm([]);
  document.getElementById("modal-event-title").innerText =
    window.t("modal_event_title");
  window.openModalAnimated("modal-event");
};

window.editEvent = function (id) {
  const evt = LS.getEvents().find((e) => e.id === id);
  if (evt) {
    document.getElementById("event-id").value = evt.id;
    document.getElementById("event-name").value = evt.name;
    document.getElementById("event-type").value = evt.type || "Rumah Sakit";
    document.getElementById("event-type-detail").value = evt.typeDetail || "";
    window.toggleEventTypeDetail();
    document.getElementById("event-date").value = evt.date || "";
    document.getElementById("event-needs-seat").checked =
      evt.needsSeat !== false; // if undefined, act as true
    document.querySelector(
      `input[name="event-seat-label-type"][value="${evt.seatLabelType === "meja" ? "meja" : "kursi"}"]`,
    ).checked = true;
    window.toggleSeatLabelOption();
    document.getElementById("event-needs-hotel").checked = !!evt.needsHotel;
    document.getElementById("event-needs-key-signature").checked =
      evt.needsKeySignature !== false; // default nyala utk event lama
    window.toggleHotelKeySignatureOption();
    document.getElementById("event-logo-file").value = "";
    document.getElementById("event-logo-base64").value = evt.logo || "";
    if (evt.logo)
      window.showEventLogoFileInfo(
        window.currentLang === "id"
          ? "Logo saat ini tersimpan"
          : "Current logo saved",
        evt.logo,
      );
    else window.hideEventLogoFileInfo();

    // Isi ulang baris Nomor Khusus/Unik dari data event yang sudah tersimpan, ID field
    // lama dipertahankan (bukan dibuat baru) supaya tetap terhubung ke data guest yang ada.
    const cfList = document.getElementById("event-custom-number-fields-list");
    cfList.innerHTML = "";
    (evt.customNumberFields || []).forEach((f) =>
      window.addEventCustomNumberFieldRow(f.label, f.id),
    );

    // Muat ulang pilihan sembunyikan kolom data peserta yang sudah tersimpan untuk event ini.
    window.setEventHiddenColumnsToForm(evt.hiddenColumns);

    document.getElementById("modal-event-title").innerText = "Edit Event";
    window.openModalAnimated("modal-event");
  }
};

// Menduplikat sebuah event dari Event Library: membuat event BARU dengan seluruh konfigurasi
// (jenis acara, tanggal, logo, pengaturan kursi/hotel/tanda tangan, daftar Nomor Khusus/Unik,
// kolom yang disembunyikan) disalin persis dari event asal - TAPI data peserta TIDAK ikut
// disalin (event baru mulai dari 0 peserta terdaftar). Cocok dipakai sebagai "template" untuk
// acara serupa yang berulang (mis. gathering tahunan) tanpa membawa data peserta lama.
// owner & accessList di-reset (bukan ikut disalin) - disamakan dengan event yang dibuat baru
// lewat window.handleEventSubmit, supaya duplikat tidak diam-diam mewarisi akses admin/publik
// dari event asal. Langsung jadi tanpa modal konfirmasi/pengisian apa pun - admin bisa
// mengganti nama/tanggalnya sendiri lewat tombol Edit kalau diperlukan.
// Titik masuk tombol "Duplikat Event" di Event Library. Event asal dicek dulu apakah punya
// data peserta atau tidak:
// - Kalau TIDAK ADA data peserta sama sekali -> tidak ada yang perlu ditanyakan, langsung
//   proses duplikat tanpa data (setara opsi 2) tanpa modal apa pun.
// - Kalau ADA data peserta -> tampilkan modal pilihan (window.openDuplicateEventModeModal)
//   supaya admin memutuskan mau ikut menyalin data peserta atau tidak.
window.duplicateEvent = function (id) {
  const original = LS.getEvents().find((e) => e.id === id);
  if (!original) return;

  const existingGuests = LS.getGuests(id);
  if (existingGuests.length === 0) {
    window.executeDuplicateEvent(id, false);
    return;
  }
  window.openDuplicateEventModeModal(id, existingGuests.length);
};

window.openDuplicateEventModeModal = function (id, guestCount) {
  window.pendingDuplicateEventId = id;
  const elCount = document.getElementById("duplicate-event-guest-count");
  if (elCount) elCount.innerText = guestCount;
  window.openModalAnimated("modal-duplicate-event-mode");
};

window.cancelDuplicateEventMode = function () {
  window.closeModalAnimated("modal-duplicate-event-mode");
  window.pendingDuplicateEventId = null;
};

// Dipanggil saat admin memilih salah satu opsi di modal-duplicate-event-mode.
window.chooseDuplicateEventMode = function (includeParticipants) {
  const id = window.pendingDuplicateEventId;
  window.closeModalAnimated("modal-duplicate-event-mode");
  window.pendingDuplicateEventId = null;
  if (!id) return;
  window.executeDuplicateEvent(id, includeParticipants);
};

// Eksekusi duplikat event yang sesungguhnya, setelah tahu pasti apakah data peserta ikut
// disalin atau tidak (baik lewat modal pilihan, maupun otomatis kalau event asal kosong).
// Konfigurasi event (jenis acara, tanggal, logo, pengaturan kursi/hotel/tanda tangan, daftar
// Nomor Khusus/Unik, kolom disembunyikan) SELALU disalin persis - yang jadi pilihan hanyalah
// daftar peserta di dalamnya. owner & accessList di-reset (bukan ikut disalin) - disamakan
// dengan event yang dibuat baru lewat window.handleEventSubmit, supaya duplikat tidak diam-diam
// mewarisi akses admin/publik dari event asal.
window.executeDuplicateEvent = function (id, includeParticipants) {
  const original = LS.getEvents().find((e) => e.id === id);
  if (!original) return;

  const newEvt = {
    ...original,
    id: window.generateEventId(),
    name: `${original.name} (Salinan)`,
    // Disalin ulang jadi array/object baru (bukan sekadar ikut ter-spread sebagai referensi
    // yang sama dengan milik event asal) - jaga-jaga supaya perubahan di salah satu event
    // tidak bisa saling memengaruhi array event lainnya.
    customNumberFields: JSON.parse(
      JSON.stringify(original.customNumberFields || []),
    ),
    hiddenColumns: [...(original.hiddenColumns || [])],
    owner: window.appState.currentUser.username,
    accessList: [],
    updatedAt: Date.now(),
  };

  let events = LS.getEvents();
  events.push(newEvt);
  const eventSaved = LS.setEvents(events);
  // Kalau gagal tersimpan (mis. kuota penyimpanan browser penuh), safeLocalStorageSet di
  // dalam LS.setEvents sudah menampilkan toast error-nya sendiri - hentikan di sini saja,
  // jangan lanjut menyalin data peserta ke event yang bahkan gagal tersimpan.
  if (!eventSaved) return;

  let copiedCount = 0;
  let guestsSaved = true;
  if (includeParticipants) {
    const originalGuests = LS.getGuests(id);
    // Dibangun pakai for-loop biasa (bukan .map) supaya window.generateGuestId bisa
    // mengecek tabrakan ID terhadap daftar BARU yang sedang dibangun ini (newGuests) -
    // bukan terhadap window.guests, yang di titik ini masih berisi data event LAIN
    // (atau kosong) karena kita belum "masuk" ke event hasil duplikat sama sekali.
    const newGuests = [];
    for (const g of originalGuests) {
      newGuests.push({
        id: window.generateGuestId(newEvt.type, newGuests),
        nama: g.nama,
        rs: g.rs,
        jabatan: g.jabatan,
        kursi: g.kursi,
        kamar: g.kamar,
        // customNumbers disalin ulang jadi object baru, bukan referensi yang sama.
        customNumbers: g.customNumbers
          ? JSON.parse(JSON.stringify(g.customNumbers))
          : {},
        // Status kehadiran/pengambilan SENGAJA direset ke awal (bukan ikut disalin) -
        // status-status ini melekat pada PENYELENGGARAAN event, bukan identitas
        // pesertanya, jadi tidak relevan lagi untuk event hasil duplikat yang belum
        // pernah berlangsung sama sekali.
        kunciDiambil: false,
        pickupScanned: false,
        pickupScanTime: null,
        scanned: false,
        scanTime: null,
        created: Date.now(),
      });
    }
    guestsSaved = LS.setGuests(newEvt.id, newGuests);
    copiedCount = newGuests.length;
  }

  renderEvents();
  // Sama seperti di atas: kalau menyimpan daftar peserta gagal, toast error-nya sudah
  // ditampilkan sendiri oleh safeLocalStorageSet di dalam LS.setGuests - jangan tambah
  // toast "berhasil" yang jadi kontradiktif.
  if (guestsSaved) {
    const msg = includeParticipants
      ? window.currentLang === "id"
        ? `Event berhasil diduplikat beserta ${copiedCount} data peserta (status kehadiran/pengambilan direset).`
        : `Event duplicated along with ${copiedCount} participant records (attendance/pickup status reset).`
      : window.currentLang === "id"
        ? "Event berhasil diduplikat! Data peserta tidak ikut disalin."
        : "Event duplicated! Participant data was not copied.";
    window.showToast(msg, "success");
  }
};

window.toggleEventTypeDetail = function () {
  const val = document.getElementById("event-type").value;
  const container = document.getElementById("event-type-detail-container");
  if (val === "Lain-lain") container.classList.remove("hidden");
  else container.classList.add("hidden");
};

window.resetTempEventLogo = function () {
  document.getElementById("event-logo-file").value = "";
  document.getElementById("event-logo-base64").value = "";
  window.hideEventLogoFileInfo();
  window.showToast("Logo disetel ke default", "info");
};

window.handleEventSubmit = function (e) {
  e.preventDefault();
  const id = document.getElementById("event-id").value;
  const name = document.getElementById("event-name").value.trim();
  const type = document.getElementById("event-type").value;
  const typeDetail = document.getElementById("event-type-detail").value;
  const date = document.getElementById("event-date").value;
  const logo = document.getElementById("event-logo-base64").value;
  const needsSeat = document.getElementById("event-needs-seat").checked;
  const seatLabelType = document.querySelector(
    'input[name="event-seat-label-type"]:checked',
  ).value;
  const needsHotel = document.getElementById("event-needs-hotel").checked;
  const needsKeySignature = document.getElementById(
    "event-needs-key-signature",
  ).checked;
  const customNumberFields = window.getEventCustomNumberFieldsFromForm();
  const hiddenColumns = window.getEventHiddenColumnsFromForm();

  let events = LS.getEvents();
  if (id) {
    const i = events.findIndex((ev) => ev.id === id);
    if (i > -1) {
      events[i] = {
        ...events[i],
        name,
        type,
        typeDetail,
        date,
        logo,
        needsSeat,
        seatLabelType,
        needsHotel,
        needsKeySignature,
        customNumberFields,
        hiddenColumns,
        updatedAt: Date.now(),
      };
    }
    window.showToast("Event diperbarui!", "success");
    // Jika event yang diedit sedang terbuka di layar, terapkan langsung visibilitas kolomnya.
    if (window.appState.currentEventId === id) {
      window.applyHiddenColumnsToTableHeaders(events[i]);
      window.renderTable();
    }
  } else {
    const newEvt = {
      id: window.generateEventId(),
      name,
      type,
      typeDetail,
      date,
      logo,
      needsSeat,
      seatLabelType,
      needsHotel,
      needsKeySignature,
      customNumberFields,
      hiddenColumns,
      owner: window.appState.currentUser.username,
      accessList: [],
      updatedAt: Date.now(),
    };
    events.push(newEvt);
    LS.setEvents(events);
    window.closeModalAnimated("modal-event");
    window.enterApp(newEvt.id);
    window.showToast("Event dibuat!", "success");
    return;
  }
  LS.setEvents(events);
  window.closeModalAnimated("modal-event");
  renderEvents();
};

window.openConfirmModal = function (type, id) {
  document.getElementById("confirm-type").value = type;
  document.getElementById("confirm-id").value = id;
  document.querySelector("#modal-confirm h3").innerText =
    window.t("modal_del_title");
  document.querySelector("#confirm-sub").innerText = window.t("modal_del_sub");
  window.confirmCallback = null;
  window.confirmCancelCallback = null;
  window.openModalAnimated("modal-confirm");
};

// Pembuka konfirmasi generik berbasis callback (dipakai untuk peringatan batal kunci / batal absen, dsb)
window.openConfirmCustom = function (title, subtitle, onConfirm, onCancel) {
  document.getElementById("confirm-type").value = "";
  document.getElementById("confirm-id").value = "";
  document.querySelector("#modal-confirm h3").innerText = title;
  document.querySelector("#confirm-sub").innerText = subtitle;
  window.confirmCallback = onConfirm;
  window.confirmCancelCallback = onCancel || null;
  window.openModalAnimated("modal-confirm");
};

window.cancelConfirmModal = function () {
  const cb = window.confirmCancelCallback;
  window.confirmCallback = null;
  window.confirmCancelCallback = null;
  window.closeModalAnimated("modal-confirm");
  if (typeof cb === "function") cb();
};

window.executeDelete = function () {
  if (typeof window.confirmCallback === "function") {
    const cb = window.confirmCallback;
    window.confirmCallback = null;
    window.confirmCancelCallback = null;
    window.closeModalAnimated("modal-confirm");
    cb();
    return;
  }
  const type = document.getElementById("confirm-type").value;
  const id = document.getElementById("confirm-id").value;
  if (type === "event") {
    let events = LS.getEvents();
    events = events.filter((e) => e.id !== id);
    LS.setEvents(events);
    localStorage.removeItem(`qis_guests_${id}`);
    renderEvents();
    window.showToast("Event dihapus.", "error");
  } else if (type === "guest") {
    window.guests = window.guests.filter((g) => g.id !== id);
    saveGuests();
    window.renderTable();
    window.showToast("Data peserta dihapus", "error");
  } else if (type === "user") {
    let users = LS.getUsers();
    const userToDelete = users.find((u) => u.username === id);

    if (userToDelete && userToDelete.isSuperAdmin) {
      window.showToast("Akun Super Admin tidak dapat dihapus!", "error");
    } else {
      users = users.filter((u) => u.username !== id);
      LS.setUsers(users);
      window.renderManageUsers();
      window.showToast("Akun berhasil dihapus", "warning");
    }
  } else if (type === "custom-qr") {
    let qrs = LS.getCustomQRs();
    qrs = qrs.filter((q) => q.id !== id);
    LS.setCustomQRs(qrs);
    window.renderCustomQRs();
    window.showToast("QR Code kustom berhasil dihapus", "error");
  } else if (type === "custom-barcode") {
    let bcs = LS.getCustomBarcodes();
    bcs = bcs.filter((b) => b.id !== id);
    LS.setCustomBarcodes(bcs);
    window.renderCustomBarcodes();
    window.showToast("Barcode kustom berhasil dihapus", "error");
  } else if (type === "restore") {
    const data = window.tempRestoreData;
    window.tempRestoreData = null; // selalu dibersihkan supaya tidak terpakai ulang tanpa sengaja
    if (data) {
      // BUG FIX: sebelumnya keberhasilan tiap LS.setX() di sini tidak diperiksa sama sekali -
      // kalau penyimpanan browser penuh di TENGAH proses restore (backup besar berisi banyak
      // logo/tanda tangan/background base64), sebagian data bisa gagal tersimpan namun admin
      // tetap melihat toast "Restore berhasil!" dan halaman dimuat ulang seolah semua aman,
      // padahal datanya tidak lengkap. Sekarang setiap kegagalan disimpan diakumulasikan &
      // admin diberi tahu secara eksplisit kalau restore tidak sepenuhnya berhasil.
      let ok = true;
      ok = LS.setUsers(data.users) && ok;
      ok = LS.setEvents(data.events) && ok;
      if (data.customQRs) ok = LS.setCustomQRs(data.customQRs) && ok;
      if (data.customBarcodes)
        ok = LS.setCustomBarcodes(data.customBarcodes) && ok;

      if (data.settings && data.settings.app_logo) {
        ok = LS.setSetting("app_logo", data.settings.app_logo) && ok;
      } else {
        localStorage.removeItem("qis_setting_app_logo");
      }
      if (data.guests) {
        Object.keys(data.guests).forEach((eventId) => {
          ok = LS.setGuests(eventId, data.guests[eventId]) && ok;
        });
      }
      if (!ok) {
        window.showToast(
          window.currentLang === "id"
            ? "Sebagian data GAGAL disimpan saat restore (penyimpanan browser penuh) - data mungkin tidak lengkap. Coba hapus beberapa logo/foto yang tidak perlu, lalu ulangi restore."
            : "Some data FAILED to save during restore (browser storage full) - the data may be incomplete. Try removing some unnecessary logos/photos, then retry the restore.",
          "error",
        );
        window.closeModalAnimated("modal-confirm");
        return;
      }
      window.showToast(
        "Restore berhasil! Sistem akan dimuat ulang...",
        "success",
      );
      window.closeModalAnimated("modal-confirm");
      setTimeout(() => {
        window.handleLogout();
        location.reload();
      }, 1500);
      return;
    } else {
      // BUG FIX: sebelumnya kalau tempRestoreData kosong (mis. sesi tertunda/kadaluarsa),
      // modal cuma tertutup diam-diam tanpa penjelasan apa pun ke admin.
      window.showToast(
        window.currentLang === "id"
          ? "Data restore tidak ditemukan, silakan pilih file backup lagi."
          : "Restore data not found, please choose the backup file again.",
        "error",
      );
    }
  }
  window.closeModalAnimated("modal-confirm");
};

window.openShareModal = function (id) {
  document.getElementById("share-event-id").value = id;
  if (document.getElementById("search-share-users"))
    document.getElementById("search-share-users").value = "";
  const evt = LS.getEvents().find((e) => e.id === id);
  const users = LS.getUsers().filter(
    (u) =>
      u.role !== "admin" && u.username !== window.appState.currentUser.username,
  );
  const container = document.getElementById("share-user-list");
  container.innerHTML = "";
  const searchInputContainer =
    document.getElementById("search-share-users")?.parentElement;

  if (users.length === 0) {
    container.innerHTML = `<p class="text-sm text-slate-500 dark:text-slate-400 text-center italic py-4">Tidak ada user public lain yang terdaftar.</p>`;
    if (searchInputContainer) searchInputContainer.style.display = "none";
  } else {
    if (searchInputContainer) searchInputContainer.style.display = "block";
    users.forEach((u) => {
      const isChecked =
        evt.accessList && evt.accessList.includes(u.username) ? "checked" : "";
      container.innerHTML += `
                        <label class="share-user-item flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <input type="checkbox" name="share-user" value="${u.username}" class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500" ${isChecked}>
                            <div class="flex-1">
                                <p class="text-sm font-bold text-slate-800 dark:text-slate-100 share-name">${u.name} <span class="text-[10px] ml-1 bg-slate-200 dark:bg-slate-600 px-1.5 rounded text-slate-600 dark:text-slate-300 uppercase">Public</span></p>
                                <p class="text-xs text-slate-500 dark:text-slate-400 share-username">@${u.username}</p>
                            </div>
                        </label>`;
    });
  }
  window.openModalAnimated("modal-share");
};

window.renderShareUsers = function () {
  const searchTerm = (
    document.getElementById("search-share-users").value || ""
  ).toLowerCase();
  const items = document.querySelectorAll(".share-user-item");

  items.forEach((item) => {
    const name = item.querySelector(".share-name").innerText.toLowerCase();
    const username = item
      .querySelector(".share-username")
      .innerText.toLowerCase();
    if (name.includes(searchTerm) || username.includes(searchTerm)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
};

window.handleShareSubmit = function (e) {
  e.preventDefault();
  const id = document.getElementById("share-event-id").value;
  const checkboxes = document.querySelectorAll(
    'input[name="share-user"]:checked',
  );
  const selectedUsers = Array.from(checkboxes).map((cb) => cb.value);

  let events = LS.getEvents();
  const i = events.findIndex((ev) => ev.id === id);
  if (i > -1) {
    events[i].accessList = selectedUsers;
    LS.setEvents(events);
    window.showToast("Akses event berhasil diperbarui!", "success");
  }
  window.closeModalAnimated("modal-share");
  renderEvents();
};

window.enterApp = function (id, callback) {
  window.setLoadingText("txt_opening_event");
  switchMainViewAnimated("view-loading");

  setTimeout(() => {
    window.appState.currentEventId = id;
    const evt = LS.getEvents().find((e) => e.id === id);
    document.getElementById("app-event-title").innerText = evt.name;

    const typeBadge = document.getElementById("header-event-type-badge");
    if (typeBadge) {
      const typeLabel = evt.type || "Rumah Sakit";
      typeBadge.innerText = typeLabel;
      typeBadge.classList.remove("hidden");
    }

    const hlContainer = document.getElementById("header-event-logo-container");
    const hlImg = document.getElementById("header-event-logo");
    const hlIcon = document.getElementById("header-event-icon");
    if (evt.logo) {
      hlImg.src = evt.logo;
      hlContainer.classList.remove("hidden");
      hlContainer.classList.add("flex");
      hlIcon.classList.add("hidden");
    } else {
      hlContainer.classList.add("hidden");
      hlContainer.classList.remove("flex");
      hlIcon.classList.remove("hidden");
    }

    const isRS = !evt.type || evt.type === "Rumah Sakit";
    const instansiStrId = isRS ? "Asal Rumah Sakit" : "Asal Instansi";
    const instansiStrEn = isRS ? "Hospital Origin" : "Institution Origin";
    dict["id"]["lbl_rs"] = instansiStrId;
    dict["en"]["lbl_rs"] = instansiStrEn;

    // Judul Statistik Dashboard menyesuaikan Jenis Acara
    if (isRS) {
      dict["id"]["dash_chart_rs"] = "Statistik Kedatangan Asal RS";
      dict["en"]["dash_chart_rs"] = "Hospital Origin Arrival Statistics";
    } else {
      dict["id"]["dash_chart_rs"] = "Statistik Kehadiran";
      dict["en"]["dash_chart_rs"] = "Attendance Statistics";
    }

    document.getElementById("lbl-input-rs").innerHTML =
      `<span data-i18n="lbl_rs">${instansiStrId}</span> <span class="text-red-600 font-bold text-base">*</span>`;
    document.getElementById("lbl-edit-rs").innerHTML =
      `<span data-i18n="lbl_rs">${instansiStrId}</span> <span class="text-red-600 font-bold text-base">*</span>`;
    document.getElementById("th-list-rs").innerText = instansiStrId;
    document.getElementById("th-att-rs").innerText = instansiStrId;
    document.getElementById("info-lbl-rs").innerText = instansiStrId;
    const modalQrRsLabel = document.getElementById("modal-qr-rs-label");
    if (modalQrRsLabel) modalQrRsLabel.innerText = instansiStrId;

    // Sembunyikan Kolom Data Peserta: kolom yang dicentang admin di Edit Event hanya
    // memengaruhi tampilan header tabel di bawah ini - form input/edit tetap tampil
    // normal (lihat container-input-kursi / container-edit-kursi dst di bawah, yang
    // TIDAK ikut disembunyikan) supaya data tetap bisa diisi & dibaca sistem seutuhnya.
    const hiddenCols = Array.isArray(evt.hiddenColumns)
      ? evt.hiddenColumns
      : [];

    // Seat logic
    const needsSeat = evt.needsSeat !== false; // Default true if undefined
    if (needsSeat) {
      document
        .getElementById("container-input-kursi")
        .classList.remove("hidden");
      document
        .getElementById("container-edit-kursi")
        .classList.remove("hidden");
      const showSeatCol = !hiddenCols.includes("kursi");
      document.getElementById("th-list-kursi").style.display = showSeatCol
        ? "table-cell"
        : "none";
      document.getElementById("th-att-kursi").style.display = showSeatCol
        ? "table-cell"
        : "none";
    } else {
      document.getElementById("container-input-kursi").classList.add("hidden");
      document.getElementById("container-edit-kursi").classList.add("hidden");
      document.getElementById("th-list-kursi").style.display = "none";
      document.getElementById("th-att-kursi").style.display = "none";
    }

    // Hotel logic
    if (evt.needsHotel) {
      document
        .getElementById("container-input-kamar")
        .classList.remove("hidden");
      document
        .getElementById("container-edit-kamar")
        .classList.remove("hidden");
      const showKamarCol = !hiddenCols.includes("kamar");
      const showKunciCol = !hiddenCols.includes("kunci");
      document.getElementById("th-list-kamar").style.display = showKamarCol
        ? "table-cell"
        : "none";
      document.getElementById("th-list-kunci").style.display = showKunciCol
        ? "table-cell"
        : "none";
      document.getElementById("th-att-kamar").style.display = showKamarCol
        ? "table-cell"
        : "none";
    } else {
      document.getElementById("container-input-kamar").classList.add("hidden");
      document.getElementById("container-edit-kamar").classList.add("hidden");
      document.getElementById("th-list-kamar").style.display = "none";
      document.getElementById("th-list-kunci").style.display = "none";
      document.getElementById("th-att-kamar").style.display = "none";
    }

    // Kolom Asal RS/Instansi & Jabatan selalu tersedia (tidak tergantung needsSeat/needsHotel),
    // jadi visibilitasnya murni mengikuti pilihan sembunyikan kolom.
    window.applyHiddenColumnsToTableHeaders(evt);

    window.applyLanguage();
    window.renderCustomNumberFieldsForm(
      evt,
      "container-custom-number-fields",
      "custom-gen",
      {},
      null,
    );
    window.guests = LS.getGuests(id);
    window.currentPageGuests = 1;
    window.currentPageAttended = 1;
    window.selectedGuestIds = new Set(); // reset centang "Cetak Terpilih" tiap masuk event
    switchMainViewAnimated("view-app");
    window.applyFeaturePermissions();
    window.switchTab(window.getDefaultTabName());
    if (typeof callback === "function") callback();
  }, 800);
};

window.exitAppToLibrary = function () {
  if (
    document.getElementById("kiosk-mode-view") &&
    !document.getElementById("kiosk-mode-view").classList.contains("hidden")
  )
    window.exitKioskMode();
  window.stopScanner();
  window.appState.currentEventId = null;
  window.guests = [];
  dict["id"]["lbl_rs"] = "Asal Rumah Sakit";
  dict["en"]["lbl_rs"] = "Hospital Origin";
  dict["id"]["dash_chart_rs"] = "Statistik Asal RS";
  dict["en"]["dash_chart_rs"] = "Hospital Origin Stats";
  document.getElementById("header-event-type-badge")?.classList.add("hidden");
  loadLibrary();
};

window.switchTab = function (tabName) {
  document
    .querySelectorAll("#view-app nav button")
    .forEach((btn) => btn.classList.remove("tab-active"));
  document
    .querySelectorAll(".app-tab")
    .forEach((sec) => sec.classList.remove("active"));
  document.getElementById(`tab-${tabName}`).classList.add("tab-active");
  setTimeout(() => {
    document.getElementById(`tab-content-${tabName}`).classList.add("active");
  }, 10);

  if (tabName === "read") {
    setTimeout(() => window.initScanner(), 300);
    window.renderScanStats();
  } else window.stopScanner();
  if (tabName === "list" || tabName === "attended") window.renderTable();
  if (tabName === "dashboard") window.renderDashboard();
  if (tabName === "generate") window.renderGenerateSideStats();
};

// Ringkasan live untuk tab Scan Kehadiran, agar operator tak perlu pindah tab saat memindai
window.renderScanStats = function () {
  const total = window.guests.length;
  const hadir = window.guests.filter((g) => g.scanned).length;
  const belum = total - hadir;
  const elTotal = document.getElementById("scan-stat-total");
  if (elTotal) elTotal.innerText = total;
  const elHadir = document.getElementById("scan-stat-hadir");
  if (elHadir) elHadir.innerText = hadir;
  const elBelum = document.getElementById("scan-stat-belum");
  if (elBelum) elBelum.innerText = belum;
};

// Counter total peserta terdaftar pada panel panduan tab Buat QR Peserta
window.renderGenerateSideStats = function () {
  const el = document.getElementById("generate-side-total");
  if (el) el.innerText = window.guests.length;
};

function saveGuests() {
  if (!window.appState.currentEventId) return false;
  const saved = LS.setGuests(window.appState.currentEventId, window.guests);
  window.broadcastGuestsChanged(window.appState.currentEventId);
  return saved;
}

window.handleGenerateSubmit = function (e) {
  e.preventDefault();
  const nama = document.getElementById("input-nama").value.trim();

  // Pengecekan Nomor Khusus/Unik kembar (peringatan sudah tampil inline saat mengetik lewat
  // window.checkCustomNumberFieldDuplicate - ini pengecekan TERAKHIR sebelum benar-benar
  // disimpan, untuk berjaga-jaga kalau admin tidak sempat memperhatikan peringatan inline-nya).
  // Sama seperti peringatan nama kembar di bawah: tidak diblokir otomatis, hanya konfirmasi.
  const proceedAfterChecks = () => {
    const evtForDup = LS.getEvents().find(
      (ev) => ev.id === window.appState.currentEventId,
    );
    const customNumbersForDup = window.collectCustomNumberValues(
      "container-custom-number-fields",
    );
    const dup = window.findDuplicateCustomNumberField(
      evtForDup,
      customNumbersForDup,
      null,
    );
    if (dup) {
      window.openConfirmCustom(
        window.currentLang === "id"
          ? "Nomor Sudah Terpakai"
          : "Number Already Used",
        window.currentLang === "id"
          ? `${dup.label} "${dup.value}" sudah dipakai oleh ${dup.guestName}. Tetap lanjutkan pendaftaran?`
          : `${dup.label} "${dup.value}" is already used by ${dup.guestName}. Continue anyway?`,
        () => window.processGenerateGuest(),
      );
    } else {
      window.processGenerateGuest();
    }
  };

  // Peringatan bila nama peserta sudah pernah didaftarkan sebelumnya di event yang sama.
  // Tidak diblokir otomatis (hanya diberi konfirmasi) karena bisa saja memang ada 2 peserta
  // berbeda dengan nama yang sama persis — admin yang memutuskan untuk lanjut atau tidak.
  const isDuplicateName =
    nama &&
    window.guests.some(
      (g) => (g.nama || "").trim().toLowerCase() === nama.toLowerCase(),
    );
  if (isDuplicateName) {
    window.openConfirmCustom(
      window.t("modal_dup_name_title"),
      window.currentLang === "id"
        ? `Nama "${nama}" sudah terdaftar sebelumnya di event ini. Tetap lanjutkan pendaftaran?`
        : `The name "${nama}" has already been registered for this event. Continue anyway?`,
      proceedAfterChecks,
    );
    return;
  }
  proceedAfterChecks();
};

// Logika pendaftaran peserta yang sesungguhnya, dipisah dari handleGenerateSubmit supaya bisa
// dipanggil langsung (nama unik) maupun setelah admin mengonfirmasi peringatan nama duplikat.
window.processGenerateGuest = function () {
  const btn = document.getElementById("btn-submit-generate");
  const originalHTML = btn.innerHTML;

  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> <span data-i18n="btn_generating">${window.t("btn_generating") || "Memproses..."}</span>`;
  btn.disabled = true;
  btn.classList.add("opacity-80", "cursor-not-allowed");

  setTimeout(() => {
    const evt = LS.getEvents().find(
      (ev) => ev.id === window.appState.currentEventId,
    );
    const kursiInput = document.getElementById("input-kursi").value.trim();
    const kamarInput = document.getElementById("input-kamar").value.trim();
    const customNumbers = window.collectCustomNumberValues(
      "container-custom-number-fields",
    );

    const newGuest = {
      id: window.generateGuestId(evt.type),
      nama: document.getElementById("input-nama").value,
      rs: document.getElementById("input-rs").value,
      jabatan: document.getElementById("input-jabatan").value,
      kursi: evt.needsSeat !== false ? kursiInput || "-" : "-",
      kamar: evt.needsHotel ? kamarInput || "-" : "-",
      customNumbers,
      kunciDiambil: false,
      pickupScanned: false,
      pickupScanTime: null,
      scanned: false,
      scanTime: null,
      created: Date.now(),
    };

    window.guests.push(newGuest);
    const saved = saveGuests();
    if (saved) {
      document.getElementById("form-generate").reset();
      // Render ulang field Nomor Khusus/Unik dari nol (kosong) - form.reset() di atas
      // mengembalikan NILAI input ke kosong, tapi tidak ikut menyembunyikan peringatan
      // "sudah dipakai" yang mungkin masih tampil dari pengisian sebelumnya (lihat
      // window.checkCustomNumberFieldDuplicate), jadi di-render ulang saja biar bersih.
      window.renderCustomNumberFieldsForm(
        evt,
        "container-custom-number-fields",
        "custom-gen",
        {},
        null,
      );
      window.renderGenerateSideStats();
      window.showToast("Peserta berhasil ditambahkan!", "success");
      window.showQRCode(
        newGuest.id,
        newGuest.nama,
        newGuest.rs,
        newGuest.jabatan,
        newGuest.kursi,
      );
    } else {
      // Gagal tersimpan (toast error sudah ditampilkan oleh safeLocalStorageSet di dalam
      // LS.setGuests) - batalkan penambahan di memori supaya tidak diam-diam "kelihatan
      // berhasil", dan biarkan isian form tetap ada supaya admin bisa mencoba lagi tanpa
      // perlu mengetik ulang semuanya dari awal.
      window.guests.pop();
    }

    btn.innerHTML = originalHTML;
    btn.disabled = false;
    btn.classList.remove("opacity-80", "cursor-not-allowed");
  }, 800);
};

window.renderDashboard = function () {
  const present = window.guests.filter((g) => g.scanned).length;
  const total = window.guests.length;
  document.getElementById("dash-total").innerText = total;
  document.getElementById("dash-hadir").innerText = present;
  document.getElementById("dash-persen").innerText =
    total > 0 ? Math.round((present / total) * 100) + "%" : "0%";

  const feedNew = document.getElementById("feed-new-guests");
  const feedAtt = document.getElementById("feed-attendances");
  feedNew.innerHTML = "";
  feedAtt.innerHTML = "";

  const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase();
  const emptyFeed = (icon, text) =>
    `<div class="flex flex-col items-center justify-center text-center py-8 text-slate-400 dark:text-slate-500"><i class="fa-solid ${icon} text-2xl mb-2 opacity-60"></i><span class="text-xs font-medium">${text}</span></div>`;

  const recentNew = [...window.guests].reverse().slice(0, 5);
  if (recentNew.length === 0) {
    feedNew.innerHTML = emptyFeed(
      "fa-user-plus",
      window.currentLang === "id"
        ? "Belum ada pendaftar"
        : "No registrants yet",
    );
  }
  recentNew.forEach((g) => {
    feedNew.innerHTML += `<div class="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 transition-colors hover:border-indigo-200 dark:hover:border-indigo-500/40"><div class="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center justify-center shrink-0">${initialOf(g.nama)}</div><div class="flex flex-col min-w-0 flex-1"><span class="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">${g.nama}</span><span class="text-xs text-slate-500 dark:text-slate-400 truncate">${g.rs}</span></div><span class="text-[11px] shrink-0 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full font-semibold">Baru</span></div>`;
  });

  const recentAtt = window.guests
    .filter((g) => g.scanned)
    .sort((a, b) => (a.scanTime < b.scanTime ? 1 : -1))
    .slice(0, 5);
  if (recentAtt.length === 0) {
    feedAtt.innerHTML = emptyFeed(
      "fa-user-check",
      window.currentLang === "id" ? "Belum ada kehadiran" : "No attendance yet",
    );
  }
  recentAtt.forEach((g) => {
    feedAtt.innerHTML += `<div class="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 transition-colors hover:border-emerald-200 dark:hover:border-emerald-500/40"><div class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-center shrink-0">${initialOf(g.nama)}</div><div class="flex flex-col min-w-0 flex-1"><span class="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">${g.nama}</span><span class="text-xs text-slate-500 dark:text-slate-400 truncate">${g.rs}</span></div><span class="text-[11px] shrink-0 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-semibold whitespace-nowrap"><i class="fa-solid fa-clock mr-1"></i>${g.scanTime}</span></div>`;
  });

  if (chartRS) chartRS.destroy();
  if (chartStatus) chartStatus.destroy();
  const ctxRS = document.getElementById("chart-rs").getContext("2d");
  const ctxStatus = document.getElementById("chart-status").getContext("2d");

  const rsCounts = {};
  window.guests.forEach((g) => {
    rsCounts[g.rs] = (rsCounts[g.rs] || 0) + 1;
  });
  let sortedRS = Object.entries(rsCounts).sort((a, b) => b[1] - a[1]);

  const chartMode = document.getElementById("rs-chart-mode").value;
  if (chartMode === "top5") sortedRS = sortedRS.slice(0, 5);

  // Warna chart menyesuaikan tema aktif (terang/gelap) agar tetap terbaca jelas
  const isDarkMode = document.documentElement.classList.contains("dark");
  const axisTextColor = isDarkMode ? "#cbd5e1" : "#334155";
  const gridColor = isDarkMode ? "rgba(148, 163, 184, 0.15)" : "#e2e8f0";
  const legendTextColor = isDarkMode ? "#e2e8f0" : "#334155";

  chartRS = new Chart(ctxRS, {
    type: "bar",
    plugins: [ChartDataLabels],
    data: {
      labels: sortedRS.map((i) => i[0]),
      datasets: [
        {
          label: window.t("dash_reg"),
          data: sortedRS.map((i) => i[1]),
          backgroundColor: "#6366f1",
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          color: "#ffffff",
          font: { weight: "bold", size: 14 },
          formatter: Math.round,
          anchor: "end",
          align: "start",
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: axisTextColor },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: axisTextColor, autoSkip: false },
          grid: { display: false },
        },
      },
    },
  });

  chartStatus = new Chart(ctxStatus, {
    type: "doughnut",
    plugins: [ChartDataLabels],
    data: {
      labels: [window.t("dash_att"), "Belum"],
      datasets: [
        {
          data: [present, total - present],
          backgroundColor: ["#10b981", isDarkMode ? "#475569" : "#cbd5e1"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { position: "bottom", labels: { color: legendTextColor } },
        datalabels: {
          color: "#ffffff",
          font: { weight: "bold", size: 16 },
          formatter: (value) => {
            return value > 0 ? value : "";
          },
        },
      },
    },
  });
};

// ===== Urutkan Data Peserta & Daftar Hadir (dropdown #sort-list / #sort-attended) =====
// Kedua tabel punya dropdown "Urutkan" sendiri-sendiri & independen (bisa diurutkan berbeda
// satu sama lain), dipakai bersama lewat fungsi applyGuestSort di bawah. 'default'/nilai tak
// dikenal berarti urutan asli (urutan tambah/import) dibiarkan apa adanya, tidak diurutkan.
const GUEST_SORT_OPTIONS = {
  nama_asc: { field: "nama", dir: 1 },
  nama_desc: { field: "nama", dir: -1 },
  rs_asc: { field: "rs", dir: 1 },
  rs_desc: { field: "rs", dir: -1 },
  jabatan_asc: { field: "jabatan", dir: 1 },
  jabatan_desc: { field: "jabatan", dir: -1 },
};
// localeCompare dengan locale 'id' & numeric:true supaya urutan lebih wajar dibaca orang
// Indonesia (tidak sensitif besar/kecil huruf) dan angka di dalam teks terurut alami (mis.
// "Ruang 9" tetap sebelum "Ruang 10", bukan terbalik seperti pengurutan teks murni).
function applyGuestSort(arr, sortKey) {
  const opt = GUEST_SORT_OPTIONS[sortKey];
  if (!opt) return arr;
  return [...arr].sort((a, b) => {
    const av = (a[opt.field] || "").toString();
    const bv = (b[opt.field] || "").toString();
    return (
      opt.dir *
      av.localeCompare(bv, "id", { sensitivity: "base", numeric: true })
    );
  });
}

// Filter Data Peserta (pencarian + status) TANPA pengurutan - dipakai bersama oleh renderTable
// (lalu diurutkan sesuai dropdown "Urutkan") maupun fitur "Pilih Semua" & indikator jumlah
// terpilih di window.toggleSelectAllGuests/updateGuestSelectionUI, supaya keduanya selalu
// merujuk ke kumpulan peserta yang sama persis dengan yang sedang tampil di tabel.
function getFilteredGuestsList() {
  const searchList = (
    document.getElementById("search-list")?.value || ""
  ).toLowerCase();
  const filterStatus = document.getElementById("filter-status")?.value || "all";
  return window.guests.filter((g) => {
    const matchSearch =
      g.nama.toLowerCase().includes(searchList) ||
      g.id.toLowerCase().includes(searchList) ||
      g.rs.toLowerCase().includes(searchList);
    const matchStatus =
      filterStatus === "all"
        ? true
        : filterStatus === "hadir"
          ? g.scanned
          : !g.scanned;
    return matchSearch && matchStatus;
  });
}

window.renderTable = function () {
  const tbody = document.getElementById("table-body");
  const tbodyAttended = document.getElementById("table-body-attended");
  const searchAttended = (
    document.getElementById("search-attended")?.value || ""
  ).toLowerCase();
  const sortListKey = document.getElementById("sort-list")?.value || "default";
  const sortAttendedKey =
    document.getElementById("sort-attended")?.value || "default";

  // Buang ID centang "Cetak Terpilih" yang datanya sudah tidak ada lagi (peserta baru saja
  // dihapus/diimpor ulang, dsb.) supaya counter "X peserta dipilih" selalu akurat.
  const currentGuestIds = new Set(window.guests.map((g) => g.id));
  window.selectedGuestIds.forEach((id) => {
    if (!currentGuestIds.has(id)) window.selectedGuestIds.delete(id);
  });

  let filteredGuests = getFilteredGuestsList();
  filteredGuests = applyGuestSort(filteredGuests, sortListKey);
  let attendedGuests = window.guests
    .filter((g) => g.scanned)
    .filter((g) => {
      return (
        g.nama.toLowerCase().includes(searchAttended) ||
        g.id.toLowerCase().includes(searchAttended) ||
        g.rs.toLowerCase().includes(searchAttended)
      );
    });
  attendedGuests = applyGuestSort(attendedGuests, sortAttendedKey);

  document.getElementById("total-guests").innerText =
    `Total: ${filteredGuests.length}`;
  document.getElementById("total-attended").innerText =
    `Hadir: ${attendedGuests.length}`;
  tbody.innerHTML = "";
  tbodyAttended.innerHTML = "";

  // Ringkasan menyeluruh (tidak terpengaruh pencarian/filter) untuk kartu statistik & progress bar
  const grandTotal = window.guests.length;
  const grandHadir = window.guests.filter((g) => g.scanned).length;
  const grandBelum = grandTotal - grandHadir;
  const statTotalEl = document.getElementById("stat-total-guests");
  if (statTotalEl) statTotalEl.innerText = grandTotal;
  const statHadirEl = document.getElementById("stat-hadir-guests");
  if (statHadirEl) statHadirEl.innerText = grandHadir;
  const statBelumEl = document.getElementById("stat-belum-guests");
  if (statBelumEl) statBelumEl.innerText = grandBelum;

  const attPct =
    grandTotal > 0 ? Math.round((grandHadir / grandTotal) * 100) : 0;
  const progBar = document.getElementById("attended-progress-bar");
  if (progBar) progBar.style.width = `${attPct}%`;
  const progText = document.getElementById("attended-progress-text");
  if (progText)
    progText.innerText = `${grandHadir} dari ${grandTotal} peserta (${attPct}%)`;

  const GUESTS_PER_PAGE = 10;
  let totalPagesGuests = Math.ceil(filteredGuests.length / GUESTS_PER_PAGE);
  if (window.currentPageGuests > totalPagesGuests && totalPagesGuests > 0)
    window.currentPageGuests = totalPagesGuests;

  let totalPagesAttended = Math.ceil(attendedGuests.length / GUESTS_PER_PAGE);
  if (window.currentPageAttended > totalPagesAttended && totalPagesAttended > 0)
    window.currentPageAttended = totalPagesAttended;

  const startIdxGuests = (window.currentPageGuests - 1) * GUESTS_PER_PAGE;
  const paginatedGuests = filteredGuests.slice(
    startIdxGuests,
    startIdxGuests + GUESTS_PER_PAGE,
  );

  const startIdxAtt = (window.currentPageAttended - 1) * GUESTS_PER_PAGE;
  const paginatedAtt = attendedGuests.slice(
    startIdxAtt,
    startIdxAtt + GUESTS_PER_PAGE,
  );

  paginatedGuests.forEach((g, i) => {
    tbody.appendChild(createGuestRow(g, startIdxGuests + i));
  });
  paginatedAtt.forEach((g, i) => {
    tbodyAttended.appendChild(createAttendedRow(g, startIdxAtt + i));
  });

  document
    .getElementById("empty-state")
    .classList.toggle("hidden", filteredGuests.length > 0);
  document
    .getElementById("empty-state-attended")
    .classList.toggle("hidden", attendedGuests.length > 0);

  window.renderPagination(
    filteredGuests.length,
    GUESTS_PER_PAGE,
    window.currentPageGuests,
    "pagination-list",
    "changePageGuests",
  );
  window.renderPagination(
    attendedGuests.length,
    GUESTS_PER_PAGE,
    window.currentPageAttended,
    "pagination-attended",
    "changePageAttended",
  );

  window.updateGuestSelectionUI();
};

// ===== Pilih Peserta untuk "Cetak Terpilih" (Data Peserta) =====
// window.selectedGuestIds (Set berisi guest.id) bertahan lintas halaman/pencarian & tidak ikut
// di-reset oleh renderTable (hanya di-prune dari ID yang datanya sudah hilang, lihat di atas) -
// baru direset total saat admin masuk/pindah ke event lain (lihat window.enterApp).
window.toggleGuestSelection = function (guestId, checked) {
  if (checked) window.selectedGuestIds.add(guestId);
  else window.selectedGuestIds.delete(guestId);
  // Cukup perbarui indikator & checkbox "Pilih Semua" - TIDAK render ulang seluruh tabel
  // supaya baris lain (dan checkbox yang baru saja diklik) tidak ikut ter-refresh/berkedip.
  window.updateGuestSelectionUI();
};

// Centang/hapus centang SEMUA peserta yang cocok dengan pencarian & filter status yang sedang
// aktif (bukan cuma yang tampil di halaman saat ini) - supaya "Pilih Semua" tetap intuitif
// walau datanya dipaginasi per 10 baris.
window.toggleSelectAllGuests = function (checked) {
  const filteredGuests = getFilteredGuestsList();
  filteredGuests.forEach((g) => {
    if (checked) window.selectedGuestIds.add(g.id);
    else window.selectedGuestIds.delete(g.id);
  });
  window.renderTable();
};

window.clearGuestSelection = function () {
  window.selectedGuestIds.clear();
  window.renderTable();
};

// Perbarui badge tombol "Cetak Terpilih", indikator "X peserta dipilih" + tombol Batal Pilih di
// sebelah judul tabel, dan status checkbox "Pilih Semua" di header (termasuk indeterminate saat
// hanya SEBAGIAN hasil yang cocok pencarian/filter sedang tercentang).
window.updateGuestSelectionUI = function () {
  const count = window.selectedGuestIds.size;

  const indicator = document.getElementById("selected-guests-indicator");
  if (indicator) indicator.style.display = count > 0 ? "inline-flex" : "none";
  const countText = document.getElementById("selected-guests-count-text");
  if (countText)
    countText.innerText =
      window.currentLang === "id"
        ? `${count} peserta dipilih`
        : `${count} participants selected`;

  const badge = document.getElementById("badge-print-selected-count");
  if (badge) {
    badge.innerText = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }

  const selectAllEl = document.getElementById("checkbox-select-all-guests");
  if (selectAllEl) {
    const filteredGuests = getFilteredGuestsList();
    const selectedInFiltered = filteredGuests.filter((g) =>
      window.selectedGuestIds.has(g.id),
    ).length;
    selectAllEl.checked =
      filteredGuests.length > 0 && selectedInFiltered === filteredGuests.length;
    selectAllEl.indeterminate =
      selectedInFiltered > 0 && selectedInFiltered < filteredGuests.length;
  }
};

// Cari tamu lain yang berbagi nomor kamar & asal RS/instansi yang sama (roommate)
// Perbandingan dinormalisasi (trim spasi, disamakan ke string, case-insensitive untuk RS)
// agar tetap akurat mendeteksi kecocokan meski hanya 1 huruf/angka/karakter, tanpa syarat panjang minimum.
window.findLinkedGuests = function (guest) {
  const guestKamar = String(guest.kamar ?? "").trim();
  const guestRs = String(guest.rs ?? "")
    .trim()
    .toLowerCase();
  if (!guestKamar || guestKamar === "-" || !guestRs) return [];
  return window.guests.filter((x) => {
    if (x.id === guest.id) return false;
    const xKamar = String(x.kamar ?? "").trim();
    const xRs = String(x.rs ?? "")
      .trim()
      .toLowerCase();
    return (
      xKamar !== "" &&
      xKamar !== "-" &&
      xKamar === guestKamar &&
      xRs === guestRs
    );
  });
};

window.toggleSelfPickup = function (checked) {
  const nameInput = document.getElementById("sig-name");
  const g = window.guests.find((x) => x.id === window.currentSigGuestId);
  if (!nameInput) return;
  if (checked && g) {
    nameInput.value = g.nama;
    nameInput.disabled = true;
  } else {
    nameInput.value = "";
    nameInput.disabled = false;
  }
};

window.toggleKey = function (guestId, isChecked, checkboxEl) {
  const g = window.guests.find((x) => x.id === guestId);
  if (!g) return;
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  const requiresSignature = !evt || evt.needsKeySignature !== false; // default nyala utk event lama/belum diset
  window.currentSigRequiresSignature = requiresSignature;

  if (isChecked) {
    window.currentSigGuestId = guestId;
    window.tempCheckboxElement = checkboxEl;
    document.getElementById("sig-name").value = "";
    document.getElementById("sig-name").disabled = false;
    const selfPickupEl = document.getElementById("sig-self-pickup");
    if (selfPickupEl) selfPickupEl.checked = false;

    // Info tamu lain yang berbagi kamar & asal RS/instansi yang sama
    const linked = window.findLinkedGuests(g);
    const infoBox = document.getElementById("sig-linked-info");
    const infoText = document.getElementById("sig-linked-info-text");
    if (linked.length > 0 && infoBox && infoText) {
      const names = linked.map((x) => `<strong>${x.nama}</strong>`).join(", ");
      infoText.innerHTML = `Kamar <strong>${g.kamar}</strong> juga ditempati oleh ${names} dengan asal ${g.rs} yang sama. Status kunci akan otomatis tercentang untuk tamu tersebut.`;
      infoBox.classList.remove("hidden");
    } else if (infoBox) {
      infoBox.classList.add("hidden");
    }

    // Tampilkan blok tanda tangan hanya jika event ini mewajibkannya; jika tidak, modal
    // hanya menyisakan kolom nama pengambil (dan tombol simpan tetap sama).
    const sigBlock = document.getElementById("sig-signature-block");
    const modalTitle = document.getElementById("modal-signature-title");
    if (sigBlock) sigBlock.classList.toggle("hidden", !requiresSignature);
    if (modalTitle)
      modalTitle.innerText = requiresSignature
        ? "Bukti Pengambilan Kunci"
        : "Konfirmasi Pengambilan Kunci";

    if (requiresSignature && window.sigCanvas) {
      setTimeout(() => {
        window.sigCanvas.width = window.sigCanvas.offsetWidth;
        window.sigCanvas.height = window.sigCanvas.offsetHeight;
        window.clearSignature();
      }, 50);
    }
    window.openModalAnimated("modal-signature");
  } else {
    // Minta konfirmasi sebelum benar-benar membatalkan bukti pengambilan kunci
    if (checkboxEl) checkboxEl.checked = true; // tetap tercentang sampai dikonfirmasi
    const linked = window.findLinkedGuests(g);
    const subMsg =
      linked.length > 0
        ? `Bukti pengambilan kunci atas nama ${g.nama} beserta ${linked.length} tamu sekamar (${linked.map((x) => x.nama).join(", ")}) akan dibatalkan. Tindakan ini tidak dapat diurungkan.`
        : `Bukti pengambilan kunci atas nama ${g.nama} akan dibatalkan. Tindakan ini tidak dapat diurungkan.`;
    window.openConfirmCustom(
      "Batalkan Bukti Pengambilan Kunci?",
      subMsg,
      () => {
        g.kunciDiambil = false;
        g.kunciDiambilOleh = null;
        g.kunciSignature = null;
        linked.forEach((lg) => {
          lg.kunciDiambil = false;
          lg.kunciDiambilOleh = null;
          lg.kunciSignature = null;
        });
        saveGuests();
        window.renderTable();
        window.showToast(
          linked.length > 0
            ? "Status kunci dibatalkan untuk tamu sekamar"
            : "Status kunci dibatalkan",
          "warning",
        );
      },
      () => {
        if (checkboxEl) checkboxEl.checked = true;
      },
    );
  }
};

// Mengambil 1-2 huruf inisial dari nama untuk avatar bulat pada tabel peserta
function initialsOf(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function createGuestRow(guest, index) {
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  // Kolom yang dicentang admin untuk disembunyikan (lihat Edit Event > Sembunyikan Kolom
  // Data Peserta) - hanya menyembunyikan <td> ini dari tabel; guest.rs/jabatan/dst tetap
  // utuh di data dan tetap dipakai normal di bagian lain (form, QR, export, dsb).
  const hiddenCols =
    evt && Array.isArray(evt.hiddenColumns) ? evt.hiddenColumns : [];
  const tr = document.createElement("tr");
  tr.className =
    "hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors";

  const rsCell = hiddenCols.includes("rs")
    ? ""
    : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${guest.rs}</td>`;
  const jabatanCell = hiddenCols.includes("jabatan")
    ? ""
    : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${guest.jabatan}</td>`;

  let seatCell = "";
  if (evt && evt.needsSeat !== false && !hiddenCols.includes("kursi")) {
    seatCell = `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${guest.kursi}</td>`;
  }

  let hotelCells = "";
  if (evt && evt.needsHotel) {
    const hasRoom = guest.kamar && guest.kamar !== "-";
    const checkedAttr = guest.kunciDiambil ? "checked" : "";
    const disabledAttr = !hasRoom ? "disabled" : "";
    const opacityClass = !hasRoom
      ? "opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-600"
      : "cursor-pointer focus:ring-indigo-500";
    const previewBtn =
      guest.kunciDiambil && guest.kunciSignature
        ? `<button onclick="window.previewSignature('${guest.id}')" class="ml-2 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors" title="Lihat Bukti Tanda Tangan"><i class="fa-solid fa-file-signature text-base"></i></button>`
        : "";

    const kamarCell = hiddenCols.includes("kamar")
      ? ""
      : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${guest.kamar || "-"}</td>`;
    const kunciCell = hiddenCols.includes("kunci")
      ? ""
      : `<td class="px-5 py-3.5 text-center">
                                  <div class="flex items-center justify-center">
                                      <input type="checkbox" onchange="window.toggleKey('${guest.id}', this.checked, this)" ${checkedAttr} ${disabledAttr} class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 shadow-sm ${opacityClass}" title="${!hasRoom ? "Isi nomor kamar terlebih dahulu" : ""}">
                                      ${previewBtn}
                                  </div>
                              </td>`;
    hotelCells = kamarCell + kunciCell;
  }

  const statusBadge = guest.scanned
    ? '<span class="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-md font-semibold"><i class="fa-solid fa-circle-check text-[11px]"></i>Hadir</span>'
    : '<span class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-md font-semibold"><i class="fa-regular fa-circle text-[11px]"></i>Belum</span>';

  // Tombol Aksi (Absen Manual, Preview QR, Cetak QR, Edit, Hapus) dikelompokkan dalam satu dropdown
  // yang isinya mengikuti hak akses (permission) user yang sedang login. Download QR tetap tombol
  // terpisah (di luar dropdown) tapi tetap mengikuti permission-nya sendiri (actionDownloadQR).
  const hasAnyRowAction =
    (!guest.scanned && window.hasFeaturePerm("actionManual")) ||
    window.hasFeaturePerm("actionPreviewQR") ||
    window.hasFeaturePerm("actionPrintQR") ||
    window.hasFeaturePerm("actionEdit") ||
    window.hasFeaturePerm("actionDelete");
  const actionMenuBtn = hasAnyRowAction
    ? `<button type="button" onclick="window.toggleGuestActionMenu('${guest.id}', this)" class="w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 mx-0.5 transition-colors" title="Aksi"><i class="fa-solid fa-ellipsis-vertical"></i></button>`
    : "";
  const downloadQRBtn = window.hasFeaturePerm("actionDownloadQR")
    ? `<button onclick="window.downloadSingleQR('${guest.id}', '${guest.rs}', '${guest.nama}')" class="w-8 h-8 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 mx-0.5 transition-colors" title="Download QR"><i class="fa-solid fa-download"></i></button>`
    : "";

  // Checkbox pilih baris untuk fitur "Cetak Terpilih" - state-nya murni mengikuti
  // window.selectedGuestIds supaya tetap konsisten walau tabel dirender ulang (ganti
  // halaman/pencarian/urutkan) tanpa perlu menyimpan apa pun ke DOM.
  const selectCell = `<td class="px-4 py-3.5 text-center"><input type="checkbox" onchange="window.toggleGuestSelection('${guest.id}', this.checked)" ${window.selectedGuestIds.has(guest.id) ? "checked" : ""} class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"></td>`;

  tr.innerHTML = `${selectCell}
            <td class="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">${index + 1}</td>
            <td class="px-5 py-3.5 text-sm"><span class="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md text-xs">${guest.id}</span></td>
            <td class="px-5 py-3.5 text-sm">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">${initialsOf(guest.nama)}</span>
                    <span class="font-medium text-slate-700 dark:text-slate-200">${guest.nama}</span>
                </div>
            </td>
            ${rsCell}
            ${jabatanCell}
            ${seatCell}
            ${hotelCells}
            <td class="px-5 py-3.5">${statusBadge}</td><td class="px-5 py-3.5 text-center whitespace-nowrap"><div class="flex items-center justify-center">${downloadQRBtn}${actionMenuBtn}</div></td>`;
  return tr;
}

// Dropdown "Aksi" per baris peserta, dirender sebagai portal ke document.body (posisi fixed) agar
// tidak terpotong oleh area tabel yang overflow-x-auto, dan menutup otomatis saat klik di luar / scroll.
window.toggleGuestActionMenu = function (guestId, btnEl) {
  const existing = document.getElementById("guest-action-menu");
  const wasOpenForThis = existing && existing.dataset.guestId === guestId;
  window.closeGuestActionMenu();
  if (wasOpenForThis) return;

  const guest = window.guests.find((g) => g.id === guestId);
  if (!guest) return;

  const items = [];
  if (!guest.scanned && window.hasFeaturePerm("actionManual"))
    items.push({
      icon: "fa-check",
      label: "Absen Manual",
      color: "text-emerald-600 dark:text-emerald-400",
      onClick: `window.markAttendanceManual('${guest.id}')`,
    });
  if (window.hasFeaturePerm("actionPreviewQR"))
    items.push({
      icon: "fa-qrcode",
      label: "Preview QR",
      color: "text-indigo-600 dark:text-indigo-400",
      onClick: `window.showQRCode('${guest.id}', '${guest.nama}', '${guest.rs}', '${guest.jabatan}', '${guest.kursi}')`,
    });
  if (window.hasFeaturePerm("actionPrintQR"))
    items.push({
      icon: "fa-print",
      label: "Cetak QR",
      color: "text-slate-600 dark:text-slate-300",
      onClick: `window.printSingleQR('${guest.id}')`,
    });
  if (window.hasFeaturePerm("actionEdit"))
    items.push({
      icon: "fa-pen",
      label: "Edit",
      color: "text-amber-500 dark:text-amber-400",
      onClick: `window.openEditModal('${guest.id}')`,
    });
  if (window.hasFeaturePerm("actionDelete"))
    items.push({
      icon: "fa-trash",
      label: "Hapus",
      color: "text-red-500 dark:text-red-400",
      onClick: `window.openConfirmModal('guest', '${guest.id}')`,
    });
  if (items.length === 0) return;

  const menu = document.createElement("div");
  menu.id = "guest-action-menu";
  menu.dataset.guestId = guestId;
  menu.className =
    "fixed z-[90] w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1.5";
  menu.style.animation = "fadeSlideUp 0.15s ease forwards";
  menu.innerHTML = items
    .map(
      (it) =>
        `<button type="button" onclick="${it.onClick}; window.closeGuestActionMenu();" class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium ${it.color} hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"><i class="fa-solid ${it.icon} w-4 text-center"></i>${it.label}</button>`,
    )
    .join("");
  document.body.appendChild(menu);

  const rect = btnEl.getBoundingClientRect();
  const menuWidth = 176;
  let left = rect.right - menuWidth;
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8)
    left = window.innerWidth - menuWidth - 8;
  let top = rect.bottom + 6;
  const menuHeightEstimate = items.length * 38 + 12;
  if (top + menuHeightEstimate > window.innerHeight - 8)
    top = rect.top - menuHeightEstimate - 6;
  menu.style.left = left + "px";
  menu.style.top = top + "px";

  setTimeout(() => {
    window._closeGuestActionMenuHandler = function (ev) {
      if (!menu.contains(ev.target)) window.closeGuestActionMenu();
    };
    document.addEventListener(
      "click",
      window._closeGuestActionMenuHandler,
      true,
    );
    window.addEventListener("scroll", window.closeGuestActionMenu, {
      once: true,
      capture: true,
    });
  }, 0);
};

window.closeGuestActionMenu = function () {
  const existing = document.getElementById("guest-action-menu");
  if (existing) existing.remove();
  if (window._closeGuestActionMenuHandler) {
    document.removeEventListener(
      "click",
      window._closeGuestActionMenuHandler,
      true,
    );
    window._closeGuestActionMenuHandler = null;
  }
};

function createAttendedRow(guest, index) {
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  const hiddenCols =
    evt && Array.isArray(evt.hiddenColumns) ? evt.hiddenColumns : [];
  const tr = document.createElement("tr");
  tr.className =
    "hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-colors";

  const rsCell = hiddenCols.includes("rs")
    ? ""
    : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${guest.rs}</td>`;
  const jabatanCell = hiddenCols.includes("jabatan")
    ? ""
    : `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${guest.jabatan}</td>`;

  let seatCell = "";
  if (evt && evt.needsSeat !== false && !hiddenCols.includes("kursi")) {
    seatCell = `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${guest.kursi}</td>`;
  }

  let hotelCell = "";
  if (evt && evt.needsHotel && !hiddenCols.includes("kamar")) {
    hotelCell = `<td class="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">${guest.kamar || "-"}</td>`;
  }

  tr.innerHTML = `<td class="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">${index + 1}</td>
            <td class="px-5 py-3.5 text-sm"><span class="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md text-xs">${guest.id}</span></td>
            <td class="px-5 py-3.5 text-sm">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">${initialsOf(guest.nama)}</span>
                    <span class="font-medium text-slate-700 dark:text-slate-200">${guest.nama}</span>
                </div>
            </td>
            ${rsCell}
            ${jabatanCell}
            ${seatCell}
            ${hotelCell}
            <td class="px-5 py-3.5 text-sm font-medium text-slate-600 dark:text-slate-300"><i class="fa-regular fa-clock mr-1 text-emerald-500 dark:text-emerald-400"></i>${guest.scanTime}</td><td class="px-5 py-3.5 text-center"><button onclick="window.removeAttendance('${guest.id}')" class="text-xs bg-red-50 dark:bg-red-500/10 hover:bg-red-600 dark:hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white border border-red-200 dark:border-red-500/30 py-1.5 px-3 rounded-lg shadow-sm flex items-center mx-auto transition-colors"><i class="fa-solid fa-xmark mr-1.5"></i> Batal</button></td>`;
  return tr;
}

window.markAttendanceManual = function (id) {
  const g = window.guests.find((x) => x.id === id);
  if (!g || g.scanned) return;
  window.openConfirmCustom(
    "Absen Peserta Ini?",
    `Kehadiran untuk ${g.nama} akan dicatat sebagai HADIR sekarang. Lanjutkan?`,
    () => {
      g.scanned = true;
      g.scanTime = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      saveGuests();
      window.renderTable();
      window.showToast(
        window.currentLang === "id"
          ? `Selamat datang, ${g.nama}! Kehadiran Anda tercatat.`
          : `Welcome, ${g.nama}! Attendance recorded.`,
        "success",
      );
    },
  );
};

window.markAllAttendance = function () {
  const notYet = window.guests.filter((g) => !g.scanned);
  if (notYet.length === 0)
    return window.showToast(
      window.currentLang === "id"
        ? "Semua peserta sudah hadir!"
        : "All participants already attended!",
      "info",
    );
  window.openConfirmCustom(
    "Absen Semua Peserta?",
    `${notYet.length} peserta yang belum hadir akan ditandai HADIR sekaligus. Tindakan ini tidak dapat diurungkan secara massal.`,
    () => {
      const time = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      notYet.forEach((g) => {
        g.scanned = true;
        g.scanTime = time;
      });
      saveGuests();
      window.renderTable();
      window.showToast(
        `${notYet.length} peserta berhasil diabsen sekaligus!`,
        "success",
      );
    },
  );
};

window.cancelAllAttendance = function () {
  const attended = window.guests.filter((g) => g.scanned);
  if (attended.length === 0)
    return window.showToast(
      window.currentLang === "id"
        ? "Belum ada peserta yang hadir!"
        : "No participants have attended yet!",
      "info",
    );
  window.openConfirmCustom(
    "Batalkan Absen Semua Peserta?",
    `Status hadir untuk ${attended.length} peserta akan dibatalkan sekaligus dan kembali menjadi Belum Hadir. Tindakan ini tidak dapat diurungkan.`,
    () => {
      attended.forEach((g) => {
        g.scanned = false;
        g.scanTime = null;
      });
      saveGuests();
      window.renderTable();
      window.showToast(
        `Status hadir ${attended.length} peserta dibatalkan.`,
        "warning",
      );
    },
  );
};
window.removeAttendance = function (id) {
  const g = window.guests.find((x) => x.id === id);
  if (!g) return;
  window.openConfirmCustom(
    "Batalkan Status Kehadiran?",
    `Status hadir untuk ${g.nama} akan dibatalkan dan tamu akan dianggap belum hadir kembali. Tindakan ini tidak dapat diurungkan.`,
    () => {
      g.scanned = false;
      g.scanTime = null;
      saveGuests();
      window.renderTable();
      window.showToast("Status absen dibatalkan", "warning");
    },
  );
};

window.openEditModal = function (id) {
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  const g = window.guests.find((x) => x.id === id);
  document.getElementById("edit-guest-id").value = g.id;
  document.getElementById("edit-nama").value = g.nama;
  document.getElementById("edit-rs").value = g.rs;
  document.getElementById("edit-jabatan").value = g.jabatan;

  document.getElementById("edit-kursi").value = g.kursi === "-" ? "" : g.kursi;
  document.getElementById("edit-kamar").value =
    g.kamar === "-" ? "" : g.kamar || "";
  window.renderCustomNumberFieldsForm(
    evt,
    "container-edit-custom-number-fields",
    "custom-edit",
    g.customNumbers || {},
    g.id,
  );
  window.openModalAnimated("modal-edit");
};

window.handleEditSubmit = function (e) {
  e.preventDefault();
  const evt = LS.getEvents().find(
    (ev) => ev.id === window.appState.currentEventId,
  );
  const id = document.getElementById("edit-guest-id").value;
  const g = window.guests.find((x) => x.id === id);
  const newCustomNumbers = window.collectCustomNumberValues(
    "container-edit-custom-number-fields",
  );

  // Sama seperti di Form Pendaftaran Peserta (window.handleGenerateSubmit): peringatan Nomor
  // Khusus/Unik kembar sudah tampil inline saat mengetik, ini pengecekan terakhir sebelum
  // benar-benar disimpan. excludeGuestId=g.id supaya nilai milik peserta ini sendiri (yang
  // sedang diedit) tidak dianggap bentrok dengan dirinya sendiri.
  const dup = window.findDuplicateCustomNumberField(
    evt,
    newCustomNumbers,
    g.id,
  );
  const applyEdit = () => {
    g.nama = document.getElementById("edit-nama").value;
    g.rs = document.getElementById("edit-rs").value;
    g.jabatan = document.getElementById("edit-jabatan").value;
    g.kursi =
      evt.needsSeat !== false
        ? document.getElementById("edit-kursi").value || "-"
        : "-";
    g.kamar = evt.needsHotel
      ? document.getElementById("edit-kamar").value || "-"
      : "-";
    g.customNumbers = newCustomNumbers;
    const saved = saveGuests();
    window.closeModalAnimated("modal-edit");
    window.renderTable();
    if (saved) window.showToast("Data diperbarui!", "success");
  };

  if (dup) {
    window.openConfirmCustom(
      window.currentLang === "id"
        ? "Nomor Sudah Terpakai"
        : "Number Already Used",
      window.currentLang === "id"
        ? `${dup.label} "${dup.value}" sudah dipakai oleh ${dup.guestName}. Tetap simpan perubahan?`
        : `${dup.label} "${dup.value}" is already used by ${dup.guestName}. Save changes anyway?`,
      applyEdit,
    );
    return;
  }
  applyEdit();
};

window.initScanner = function () {
  if (scannerInstance === null) {
    scannerInstance = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false,
    );
    scannerInstance.render(window.onScanSuccess, () => {});
  }
};
window.stopScanner = function () {
  if (scannerInstance) {
    scannerInstance.clear().catch((e) => console.warn(e));
    scannerInstance = null;
  }
};
window.onScanSuccess = function (t) {
  if (isScanLocked) return;
  isScanLocked = true;
  try {
    if (
      scannerInstance &&
      scannerInstance.getState &&
      scannerInstance.getState() === 2
    )
      scannerInstance.pause(true);
  } catch (e) {}

  const g = window.guests.find((x) => x.id === t);
  if (g) {
    const iconWrap = document.getElementById("modal-info-icon-wrap");
    const icon = document.getElementById("modal-info-icon");
    const title = document.getElementById("modal-info-title");
    const sub = document.getElementById("modal-info-sub");

    if (!g.scanned) {
      g.scanned = true;
      g.scanTime = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      saveGuests();
      window.renderTable();
      window.renderScanStats();
      window.showToast(
        window.currentLang === "id"
          ? `Selamat datang, ${g.nama}! Kehadiran Anda tercatat.`
          : `Welcome, ${g.nama}! Attendance recorded.`,
        "success",
      );

      // State SUKSES: ikon centang hijau, sama seperti sebelumnya.
      if (iconWrap)
        iconWrap.className =
          "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 w-12 h-12 rounded-full flex items-center justify-center shadow-sm shrink-0";
      if (icon)
        icon.className = "fa-solid fa-check-to-slot text-2xl animate-success";
      if (title) {
        title.innerText = window.t("modal_scan_ok");
        title.className =
          "text-lg font-bold text-slate-800 dark:text-slate-100";
      }
      if (sub) {
        sub.innerText = window.t("lbl_eventq_info");
        sub.className =
          "text-xs text-slate-500 dark:text-slate-400 font-medium";
      }
    } else {
      window.showToast(
        window.currentLang === "id"
          ? `Mohon maaf, ${g.nama} sudah absen sebelumnya.`
          : `Sorry, ${g.nama} has already checked in before.`,
        "warning",
      );

      // State SUDAH PERNAH CHECK-IN: ikon & warna diganti amber, plus tampilkan jam check-in
      // aslinya — supaya operator langsung sadar dari tampilan modal itu sendiri, tidak
      // hanya mengandalkan toast yang cepat hilang (konsisten dengan panel hasil Mode Kiosk).
      if (iconWrap)
        iconWrap.className =
          "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 w-12 h-12 rounded-full flex items-center justify-center shadow-sm shrink-0";
      if (icon) icon.className = "fa-solid fa-triangle-exclamation text-2xl";
      if (title) {
        title.innerText = window.t("modal_scan_already");
        title.className =
          "text-lg font-bold text-amber-600 dark:text-amber-400";
      }
      if (sub) {
        sub.innerText = `${window.t("lbl_scan_recorded_at")} ${g.scanTime || "-"}`;
        sub.className =
          "text-xs text-amber-600 dark:text-amber-400 font-semibold";
      }
    }

    document.getElementById("info-id").innerText = g.id;
    document.getElementById("info-nama").innerText = g.nama;
    document.getElementById("info-rs").innerText = g.rs;
    document.getElementById("info-jabatan").innerText = g.jabatan;
    document.getElementById("info-kursi").innerText = g.kursi;

    const evt = LS.getEvents().find(
      (e) => e.id === window.appState.currentEventId,
    );
    if (evt && evt.needsSeat !== false) {
      document.getElementById("info-container-kursi").style.display = "flex";
    } else {
      document.getElementById("info-container-kursi").style.display = "none";
    }

    window.openModalAnimated("modal-info");
  } else {
    window.showToast("Data QR tidak ditemukan di Event ini!", "error");
    setTimeout(() => window.resumeScannerState(), 2000);
  }
};
window.resumeScannerState = function () {
  isScanLocked = false;
  if (scannerInstance) {
    try {
      scannerInstance.resume();
    } catch (e) {}
  }
};

// ===== Mode Kiosk: Layar Penuh Khusus Scan Kehadiran (Self-Service) =====
// Menyembunyikan seluruh navigasi/tab aplikasi dan hanya fokus pada scan QR absensi.
// Instance scanner dibuat terpisah (kioskScannerInstance) dari scanner tab biasa supaya
// kamera tidak direbut dua proses sekaligus saat berpindah mode.

// ----- Feedback Audio: Beep + Ucapan Nama Peserta -----
// Beep disintesis langsung lewat Web Audio API (tanpa file audio eksternal) supaya ringan,
// instan, dan selalu tersedia offline. Ucapan nama peserta & salam selamat datang memakai
// Web Speech API (speechSynthesis) bawaan browser — tanpa perlu layanan TTS eksternal.
window.isKioskAudioEnabled = function () {
  const v = LS.getSetting("kiosk_audio_enabled");
  return v === null || v === undefined || v === "" ? true : v !== "false"; // default: nyala
};

window.toggleKioskAudio = function () {
  const wasEnabled = window.isKioskAudioEnabled();
  LS.setSetting("kiosk_audio_enabled", wasEnabled ? "false" : "true");
  window.updateKioskAudioButtonUI();
  if (wasEnabled) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  } else window.playKioskBeep("success"); // bip konfirmasi singkat saat suara baru dinyalakan
};

window.updateKioskAudioButtonUI = function () {
  const btn = document.getElementById("btn-kiosk-audio-toggle");
  const icon = document.getElementById("kiosk-audio-icon");
  if (!btn || !icon) return;
  const enabled = window.isKioskAudioEnabled();
  icon.className = enabled
    ? "fa-solid fa-volume-high"
    : "fa-solid fa-volume-xmark";
  btn.title = enabled
    ? "Matikan suara notifikasi"
    : "Nyalakan suara notifikasi";
  btn.classList.toggle("text-indigo-600", enabled);
  btn.classList.toggle("dark:text-indigo-400", enabled);
  btn.classList.toggle("text-slate-400", !enabled);
  btn.classList.toggle("dark:text-slate-500", !enabled);
};

// ----- Toggle khusus suara Text-to-Speech (terpisah dari beep) -----
// Independen dari window.isKioskAudioEnabled() (yang mengendalikan bip) - supaya operator
// kiosk bisa memilih kombinasi sesuai kebutuhan, mis. bip tetap menyala tapi ucapan nama
// peserta dimatikan. Ucapan tetap butuh KEDUA saklar ini menyala (lihat window.speakKioskMessage),
// jadi mematikan saklar suara utama tetap membisukan semuanya termasuk ucapan.
window.isKioskTTSEnabled = function () {
  const v = LS.getSetting("kiosk_tts_enabled");
  return v === null || v === undefined || v === "" ? true : v !== "false"; // default: nyala
};

window.toggleKioskTTS = function () {
  const wasEnabled = window.isKioskTTSEnabled();
  LS.setSetting("kiosk_tts_enabled", wasEnabled ? "false" : "true");
  window.updateKioskTTSButtonUI();
  if (wasEnabled) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  } else
    window.speakKioskMessage(
      window.getKioskTTSLang() === "id" ? "Suara aktif" : "Voice on",
    ); // konfirmasi singkat kalau suara ucapan baru dinyalakan
};

window.updateKioskTTSButtonUI = function () {
  const btn = document.getElementById("btn-kiosk-tts-toggle");
  const icon = document.getElementById("kiosk-tts-icon");
  if (!btn || !icon) return;
  const enabled = window.isKioskTTSEnabled();
  icon.className = enabled
    ? "fa-solid fa-comment-dots"
    : "fa-solid fa-comment-slash";
  btn.title = enabled
    ? "Matikan suara ucapan (Text-to-Speech)"
    : "Nyalakan suara ucapan (Text-to-Speech)";
  btn.classList.toggle("text-indigo-600", enabled);
  btn.classList.toggle("dark:text-indigo-400", enabled);
  btn.classList.toggle("text-slate-400", !enabled);
  btn.classList.toggle("dark:text-slate-500", !enabled);
};

function getKioskAudioCtx() {
  if (!kioskAudioCtx) {
    const AudioContextCls = window.AudioContext || window.webkitAudioContext;
    if (AudioContextCls) {
      try {
        kioskAudioCtx = new AudioContextCls();
      } catch (e) {
        kioskAudioCtx = null;
      }
    }
  }
  if (kioskAudioCtx && kioskAudioCtx.state === "suspended")
    kioskAudioCtx.resume().catch(() => {});
  return kioskAudioCtx;
}

// Nada beep disintesis per status: 'success' (dua nada naik, ceria & singkat),
// 'warning' (dua bip datar — sudah pernah absen), 'error' (nada turun — QR tak dikenali).
window.playKioskBeep = function (type) {
  if (!window.isKioskAudioEnabled()) return;
  const ctx = getKioskAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const tone = (freq, start, dur, vol) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + start);
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(vol || 0.22, now + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.03);
  };
  if (type === "success") {
    tone(880, 0, 0.12);
    tone(1318.5, 0.11, 0.18);
  } else if (type === "warning") {
    tone(660, 0, 0.11);
    tone(660, 0.16, 0.11);
  } else {
    tone(392, 0, 0.1);
    tone(261.6, 0.11, 0.22);
  }
};

// Memilih suara wanita Bahasa Inggris yang paling natural di antara suara yang tersedia
// di browser/OS. Web Speech API tidak punya properti gender resmi, jadi dicocokkan lewat
// nama-nama suara wanita yang umum ditemukan lintas platform (Chrome/Google, Windows, macOS),
// sekaligus secara aktif menghindari suara yang jelas bernama pria.
function pickFemaleEnglishVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const enVoices = voices.filter(
    (v) => v.lang && v.lang.toLowerCase().startsWith("en"),
  );
  if (enVoices.length === 0) return null;

  const femaleHints = [
    "female",
    "zira",
    "aria",
    "jenny",
    "michelle",
    "samantha",
    "victoria",
    "karen",
    "moira",
    "tessa",
    "fiona",
    "allison",
    "ava",
    "susan",
    "kate",
    "salli",
    "joanna",
    "kimberly",
    "ivy",
    "olivia",
    "emma",
    "amy",
    "nicole",
    "raveena",
    "google us english",
  ];
  const maleHints = [
    "male",
    "david",
    "mark",
    "guy",
    "alex",
    "daniel",
    "fred",
    "tom",
    "james",
    "ryan",
  ];

  const nameHasAny = (name, hints) => hints.some((h) => name.includes(h));

  // 1) Suara EN yang namanya cocok dengan daftar suara wanita yang dikenal (prioritas utama,
  //    "Google US English" biasanya paling natural/tidak robotik bila tersedia).
  let pick = enVoices.find((v) =>
    nameHasAny(v.name.toLowerCase(), femaleHints),
  );
  if (pick) return pick;

  // 2) Kalau tidak ada nama yang cocok persis, ambil suara EN mana pun yang BUKAN teridentifikasi pria.
  pick = enVoices.find((v) => !nameHasAny(v.name.toLowerCase(), maleHints));
  if (pick) return pick;

  // 3) Fallback terakhir: suara EN pertama yang tersedia, apa pun namanya.
  return enVoices[0];
}

// Memilih suara Bahasa Indonesia yang tersedia di perangkat/browser, dengan preferensi
// suara wanita kalau namanya cocok dengan pola umum suara ID (mis. "Damayanti", "Gadis").
// Ketersediaan suara ID jauh lebih terbatas dibanding EN tergantung OS/browser pengguna -
// kalau tidak ada satu pun suara berbahasa Indonesia terpasang, browser akan otomatis
// memakai suara default-nya sendiri untuk lang 'id-ID' (fallback bawaan browser, bukan gagal).
function pickIndonesianVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const idVoices = voices.filter(
    (v) => v.lang && v.lang.toLowerCase().startsWith("id"),
  );
  if (idVoices.length === 0) return null;

  const femaleHints = [
    "female",
    "wanita",
    "perempuan",
    "damayanti",
    "gadis",
    "google bahasa indonesia",
  ];
  const pick = idVoices.find((v) =>
    femaleHints.some((h) => v.name.toLowerCase().includes(h)),
  );
  return pick || idVoices[0];
}

// Bahasa suara Text-to-Speech Mode Kiosk - diatur lewat Pengaturan > Mode Kiosk
// (lihat window.setKioskTTSLang). Default 'en' supaya perilaku lama tidak berubah
// bagi yang belum pernah mengatur pilihan ini.
window.getKioskTTSLang = function () {
  const v = LS.getSetting("kiosk_tts_lang");
  return v === "id" ? "id" : "en";
};

window.speakKioskMessage = function (text) {
  if (
    !window.isKioskAudioEnabled() ||
    !window.isKioskTTSEnabled() ||
    !("speechSynthesis" in window)
  )
    return;
  try {
    window.speechSynthesis.cancel(); // hentikan ucapan sebelumnya yang mungkin masih berjalan
    const utter = new SpeechSynthesisUtterance(text);
    // Rate mendekati normal (bukan lambat) & pitch sedikit lebih tinggi supaya alur ucapan
    // terdengar lebih lancar, hangat, dan natural — cocok untuk suara wanita.
    utter.rate = 1.02;
    utter.pitch = 1.05;
    utter.volume = 1;
    if (window.getKioskTTSLang() === "id") {
      utter.lang = "id-ID";
      const voice = pickIndonesianVoice();
      if (voice) utter.voice = voice;
    } else {
      utter.lang = "en-US";
      const voice = pickFemaleEnglishVoice();
      if (voice) utter.voice = voice;
    }
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn("Speech synthesis error:", e);
  }
};

// Menggabungkan beep + ucapan nama peserta & nama event sesuai status hasil scan.
// Bahasa ucapan mengikuti pilihan admin di Pengaturan > Mode Kiosk (lihat
// window.getKioskTTSLang) - default Bahasa Inggris seperti sebelumnya.
// 'success' -> menyapa nama peserta & menyebut nama event.
// 'already' -> beri tahu bahwa peserta ini sudah tercatat hadir sebelumnya.
// 'notfound' -> hanya bip gagal, tanpa ucapan (tidak ada nama peserta untuk disebut).
window.playKioskFeedback = function (status, guest, evt) {
  if (!window.isKioskAudioEnabled()) return;
  const eventName = evt ? evt.name : "";
  const lang = window.getKioskTTSLang();
  if (status === "success") {
    window.playKioskBeep("success");
    if (guest) {
      const msg =
        lang === "id"
          ? `Selamat datang, ${guest.nama}, di Event ${eventName}.`
          : `Welcome, ${guest.nama}, to Event ${eventName}.`;
      window.speakKioskMessage(msg);
    }
  } else if (status === "already") {
    window.playKioskBeep("warning");
    if (guest) {
      const msg =
        lang === "id"
          ? `${guest.nama}, Anda sudah tercatat hadir sebelumnya.`
          : `${guest.nama}, you have already been recorded as present.`;
      window.speakKioskMessage(msg);
    }
  } else if (status === "pickup_found") {
    // Kiosk Pengambilan: cukup bip sukses sebagai konfirmasi data ketemu — tanpa ucapan
    // suara, karena modal hasil sudah menampilkan nama & Nomor Khusus/Unik secara visual.
    window.playKioskBeep("success");
  } else if (status === "pickup_already") {
    // Kiosk Pengambilan: nomor ini SUDAH PERNAH discan sebelumnya - bip peringatan + ucapan
    // suara (kalau aktif) supaya panitia di konter langsung sadar tanpa harus menatap layar
    // terus, karena posisi ini biasanya dipakai sambil menyerahkan barang/kunci ke peserta.
    window.playKioskBeep("warning");
    if (guest) {
      const msg =
        lang === "id"
          ? `Perhatian, ${guest.nama} sudah pernah mengambil nomornya sebelumnya.`
          : `Attention, ${guest.nama} has already picked up their number before.`;
      window.speakKioskMessage(msg);
    }
  } else if (status === "check_found") {
    // Kiosk Cek Data: sama seperti pickup_found, cukup bip sukses tanpa ucapan suara —
    // datanya sudah ditampilkan secara visual di layar hasil.
    window.playKioskBeep("success");
  } else {
    window.playKioskBeep("error");
  }
};

// Membuka modal pemilihan JENIS Mode Kiosk (Absensi/Pengambilan) — langkah pertama sebelum
// modal pemilihan lokasi tampil (window.openKioskLaunchChoiceModal), dipanggil dari tombol
// "Mode Kiosk" di header event.
window.openKioskTypeChoiceModal = function () {
  if (!window.hasFeaturePerm("kioskMode"))
    return window.showToast(
      "Anda tidak memiliki akses ke fitur Mode Kiosk",
      "error",
    );
  if (!window.appState.currentEventId) return;
  kioskTypeChoiceContext = "launch";
  updateKioskTypeChoiceBadges();
  window.openModalAnimated("modal-kiosk-type-choice");
};

// Menampilkan/menyembunyikan label "Aktif" di modal pemilihan jenis kiosk (modal-kiosk-type-choice).
// Hanya relevan saat modal dibuka dari tombol ganti jenis DI DALAM Mode Kiosk yang sedang berjalan
// (kioskTypeChoiceContext === 'switch') supaya operator tahu jenis mana yang sedang aktif; disembunyikan
// semua saat modal dibuka dari tombol "Mode Kiosk" di header event (belum ada kiosk yang berjalan).
function updateKioskTypeChoiceBadges() {
  ["attendance", "pickup", "check"].forEach((t) => {
    const badge = document.getElementById(`kiosk-type-active-badge-${t}`);
    if (!badge) return;
    const shouldShow =
      kioskTypeChoiceContext === "switch" && window.currentKioskType === t;
    badge.classList.toggle("hidden", !shouldShow);
  });
}

// Menyimpan jenis kiosk yang dipilih. Perilaku bercabang tergantung konteks modal dibuka:
// - context 'launch' (dari tombol "Mode Kiosk" di header event, belum ada kiosk berjalan):
//   simpan sebagai pendingKioskType, lalu lanjut ke modal pemilihan lokasi tampil seperti biasa.
// - context 'switch' (dari tombol ganti jenis di dalam Mode Kiosk yang SEDANG berjalan): langsung
//   minta konfirmasi lalu berpindah jenis di tempat, tanpa keluar dari Mode Kiosk sama sekali
//   (lihat window.confirmSwitchKioskTypeTo & window.switchKioskType).
window.chooseKioskType = function (type) {
  const normalizedType =
    type === "pickup" ? "pickup" : type === "check" ? "check" : "attendance";
  window.closeModalAnimated("modal-kiosk-type-choice");

  if (kioskTypeChoiceContext === "switch") {
    if (normalizedType === window.currentKioskType) return; // sudah aktif, tidak perlu apa-apa
    window.confirmSwitchKioskTypeTo(normalizedType);
    return;
  }

  window.pendingKioskType = normalizedType;
  window.openKioskLaunchChoiceModal();
};

// Tombol panah kembali di modal "Buka Mode Kiosk" — menutup modal ini dan membuka lagi
// modal pemilihan jenis kiosk, tanpa perlu membatalkan seluruh alur dari awal.
window.backToKioskTypeChoice = function () {
  window.closeModalAnimated("modal-kiosk-launch-choice");
  window.openKioskTypeChoiceModal();
};

// Membuka modal pilihan lokasi tampil Mode Kiosk (jendela baru/tab baru/jendela ini),
// dipanggil dari tombol "Mode Kiosk" di header event — menggantikan window.enterKioskMode
// yang sebelumnya dipanggil langsung.
window.openKioskLaunchChoiceModal = function () {
  if (!window.hasFeaturePerm("kioskMode"))
    return window.showToast(
      "Anda tidak memiliki akses ke fitur Mode Kiosk",
      "error",
    );
  if (!window.appState.currentEventId) return;
  window.openModalAnimated("modal-kiosk-launch-choice");
};

// Eksekusi pilihan dari modal: 'window' & 'tab' membuka ulang aplikasi ini via window.open()
// dengan parameter ?kiosk=<eventId>&kioskType=<jenis> di URL, 'same' langsung memasuki
// Mode Kiosk di layar ini dengan jenis yang sudah dipilih sebelumnya.
// Sesi login (sessionStorage) otomatis tersalin browser ke tab/jendela baru selama window.open()
// dipanggil tanpa 'noopener' dan masih origin yang sama — lihat window.tryLaunchPendingKiosk
// yang membaca parameter tsb begitu tab/jendela baru selesai memuat & sesi siap dipakai.
window.launchKioskInNewContext = function (mode) {
  window.closeModalAnimated("modal-kiosk-launch-choice");
  if (mode === "same") {
    window.enterKioskMode(window.pendingKioskType);
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("kiosk", window.appState.currentEventId);
  url.searchParams.set("kioskType", window.pendingKioskType);
  url.hash = "";

  if (mode === "window")
    window.open(url.toString(), "_blank", "width=1280,height=800");
  else window.open(url.toString(), "_blank");
};

// Dipanggil setiap kali sesi login siap dipakai (boot ulang dengan sesi tersimpan, maupun
// setelah login manual) untuk memeriksa apakah tab/jendela ini dibuka khusus untuk langsung
// masuk Mode Kiosk pada event tertentu (lewat parameter ?kiosk=<eventId>&kioskType=<jenis> di URL).
window.tryLaunchPendingKiosk = function () {
  if (!pendingKioskLaunchEventId || !window.appState.currentUser) return;
  const id = pendingKioskLaunchEventId;
  const type = pendingKioskLaunchType;
  pendingKioskLaunchEventId = null; // konsumsi sekali agar tidak retrigger

  // Bersihkan parameter dari address bar supaya rapi & tidak ikut ter-refresh/ter-share ulang
  try {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("kiosk");
    cleanUrl.searchParams.delete("kioskType");
    window.history.replaceState({}, "", cleanUrl);
  } catch (e) {}

  const evt = LS.getEvents().find((e) => e.id === id);
  const user = window.appState.currentUser;
  const hasAccess =
    evt &&
    (user.role === "admin" ||
      (evt.accessList && evt.accessList.includes(user.username)));
  if (evt && hasAccess && window.hasFeaturePerm("kioskMode")) {
    window.enterApp(id, () => window.enterKioskMode(type));
  }
  // Jika event tidak ditemukan/tidak ada akses, biarkan saja lanjut ke Library seperti biasa.
};

window.enterKioskMode = function (type) {
  if (!window.hasFeaturePerm("kioskMode"))
    return window.showToast(
      "Anda tidak memiliki akses ke fitur Mode Kiosk",
      "error",
    );
  if (!window.appState.currentEventId) return;

  window.currentKioskType =
    type === "pickup" ? "pickup" : type === "check" ? "check" : "attendance";
  window.stopScanner(); // hentikan scanner tab biasa agar kamera tidak bentrok

  // Prime AudioContext & daftar suara TTS memakai gestur klik ini (tombol Mode Kiosk),
  // supaya pemutaran beep/ucapan berikutnya — yang dipicu otomatis oleh hasil scan kamera,
  // bukan klik langsung — tidak diblokir kebijakan autoplay browser.
  getKioskAudioCtx();
  if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  window.updateKioskAudioButtonUI();
  window.updateKioskTTSButtonUI();
  window.updateKioskSwitchTypeButtonUI();

  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  document.getElementById("kiosk-event-title").innerText = evt
    ? evt.name
    : "Event";

  const logoContainer = document.getElementById("kiosk-event-logo-container");
  const logoImg = document.getElementById("kiosk-event-logo");
  const iconEl = document.getElementById("kiosk-event-icon");
  if (evt && evt.logo) {
    logoImg.src = evt.logo;
    logoContainer.classList.remove("hidden");
    logoContainer.classList.add("flex");
    iconEl.classList.add("hidden");
  } else {
    logoContainer.classList.add("hidden");
    logoContainer.classList.remove("flex");
    iconEl.classList.remove("hidden");
  }

  // Teks & statistik scan-view menyesuaikan jenis kiosk — statistik kehadiran (Total/Hadir/Belum)
  // hanya relevan untuk Kiosk Absensi, jadi disembunyikan pada Kiosk Pengambilan. Logika ini
  // dipakai bersama window.switchKioskType lewat helper applyKioskTypeViewTexts di bawah, supaya
  // tombol shortcut ganti jenis kiosk konsisten dengan tampilan awal saat kiosk pertama dibuka.
  const scanTitle = document.getElementById("kiosk-scan-title");
  if (scanTitle) scanTitle.innerText = "Scan QR Code Anda";
  applyKioskTypeViewTexts(window.currentKioskType);

  document.getElementById("kiosk-result-view").classList.add("hidden");
  document.getElementById("kiosk-result-view").classList.remove("flex");
  document.getElementById("kiosk-scan-view").classList.remove("hidden");
  isKioskScanLocked = false;

  window.renderKioskStats();

  const view = document.getElementById("kiosk-mode-view");
  view.classList.remove("hidden");
  view.classList.add("flex");

  // Best-effort fullscreen (butuh gesture pengguna; aman kalau ditolak/tidak didukung browser)
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  setTimeout(() => {
    if (kioskScannerInstance === null) {
      kioskScannerInstance = new Html5QrcodeScanner(
        "reader-kiosk",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
        },
        false,
      );
      kioskScannerInstance.render(window.onKioskScanSuccess, () => {});
    }
  }, 300);
};

// Menerapkan teks sub-judul & visibilitas bar statistik pada layar scan kiosk sesuai jenisnya
// (Absensi/Pengambilan/Cek Data). Dipakai bersama oleh window.enterKioskMode (saat kiosk pertama kali
// dibuka) & window.switchKioskType (saat berpindah jenis lewat tombol shortcut di header) supaya
// tidak ada duplikasi logika dan keduanya selalu tampil konsisten.
function applyKioskTypeViewTexts(type) {
  const scanSub = document.getElementById("kiosk-scan-sub");
  const statsBar = document.getElementById("kiosk-stats-bar");
  if (type === "pickup") {
    if (scanSub)
      scanSub.innerText =
        "Arahkan QR Code peserta ke kamera untuk melihat nomor voucher Anda";
    if (statsBar) statsBar.classList.add("hidden");
  } else if (type === "check") {
    if (scanSub)
      scanSub.innerText =
        "Arahkan QR Code Anda ke kamera untuk melihat data diri";
    if (statsBar) statsBar.classList.add("hidden");
  } else {
    if (scanSub)
      scanSub.innerText = "Arahkan QR Code kehadiran ke kamera untuk absen";
    if (statsBar) statsBar.classList.remove("hidden");
  }
}

// ===== Tombol Shortcut: Berpindah Jenis Mode Kiosk (Absensi/Pengambilan/Cek Data) =====
// Sebelumnya, berpindah jenis kiosk saat sedang berjalan mengharuskan operator keluar dulu
// (butuh PIN keluar) lalu membuka ulang dari tombol "Mode Kiosk" di dashboard - merepotkan kalau
// satu perangkat dipakai bergantian untuk beberapa jenis kiosk dalam event yang sama.
// Tombol ini ada di header layar Mode Kiosk (lihat #btn-kiosk-switch-type di index.html) dan
// memindahkan jenis kiosk secara langsung TANPA perlu PIN keluar/masuk ulang, karena tetap berada
// di dalam Mode Kiosk (tidak membuka akses ke halaman manajemen data). Sebelumnya tombol ini hanya
// toggle dua arah (Absensi <-> Pengambilan); sekarang dengan 3 jenis kiosk tombol ini membuka modal
// pemilihan jenis yang sama dengan alur "Mode Kiosk" awal (lihat window.openKioskSwitchTypeModal),
// supaya operator bisa langsung memilih salah satu dari ketiganya.
window.updateKioskSwitchTypeButtonUI = function () {
  const btn = document.getElementById("btn-kiosk-switch-type");
  const icon = document.getElementById("kiosk-switch-type-icon");
  if (!btn || !icon) return;
  icon.className = "fa-solid fa-arrows-rotate";
  btn.title =
    window.currentLang === "id"
      ? "Ganti Jenis Mode Kiosk"
      : "Switch Kiosk Type";
};

// Membuka kembali modal pemilihan jenis kiosk (modal-kiosk-type-choice) dari DALAM Mode Kiosk
// yang sedang berjalan, dengan konteks 'switch' supaya window.chooseKioskType tahu harus langsung
// berpindah jenis (dengan konfirmasi) alih-alih lanjut ke modal pemilihan lokasi tampil. Jenis yang
// sedang aktif ditandai dengan label "Aktif" (lihat updateKioskTypeChoiceBadges).
window.openKioskSwitchTypeModal = function () {
  kioskTypeChoiceContext = "switch";
  updateKioskTypeChoiceBadges();
  window.openModalAnimated("modal-kiosk-type-choice");
};

// Meminta konfirmasi dulu sebelum berpindah jenis - supaya operator tidak tidak sengaja mengganti
// jenis kiosk di tengah antrean peserta yang sedang memindai QR (memakai modal konfirmasi generik
// window.openConfirmCustom yang sudah dipakai fitur lain, dan tetap tampil di atas layar kiosk).
window.confirmSwitchKioskTypeTo = function (targetType) {
  const targetLabel =
    targetType === "pickup"
      ? "Kiosk QR Code Pengambilan"
      : targetType === "check"
        ? "Kiosk Cek Data"
        : "Kiosk Absensi";
  window.openConfirmCustom(
    "Ganti Jenis Mode Kiosk?",
    `Layar scan akan berpindah ke ${targetLabel}. Pastikan tidak ada peserta yang sedang memindai QR.`,
    () => window.switchKioskType(targetType),
  );
};

// Memutar animasi transisi saat jenis kiosk berpindah: layar scan (judul/sub-judul/bar statistik
// yang baru saja diperbarui teksnya oleh applyKioskTypeViewTexts) meluncur & memudar masuk, dan
// ikon tombol shortcut berputar sekali sebagai umpan balik bahwa klik berhasil memicu perpindahan.
// Class dilepas dulu & dipaksa reflow (void offsetWidth) sebelum dipasang lagi supaya animasi bisa
// diputar ulang walau tombol dipakai berkali-kali berturut-turut - pola yang sama dipakai
// window.pulseStatElement untuk animasi angka statistik yang berubah.
window.playKioskTypeSwitchAnimation = function () {
  const scanView = document.getElementById("kiosk-scan-view");
  if (scanView) {
    scanView.classList.remove("kiosk-type-switch-in");
    void scanView.offsetWidth;
    scanView.classList.add("kiosk-type-switch-in");
    setTimeout(() => scanView.classList.remove("kiosk-type-switch-in"), 450);
  }
  const icon = document.getElementById("kiosk-switch-type-icon");
  if (icon) {
    icon.classList.remove("kiosk-switch-btn-spin");
    void icon.offsetWidth;
    icon.classList.add("kiosk-switch-btn-spin");
    setTimeout(() => icon.classList.remove("kiosk-switch-btn-spin"), 550);
  }
};

// Eksekusi perpindahan jenis kiosk yang sudah dikonfirmasi. Instance scanner & AudioContext yang
// sama tetap dipakai (kamera tidak perlu di-restart) - hanya teks/tampilan layar scan serta
// interpretasi hasil scan berikutnya yang berubah (lihat window.onKioskScanSuccess).
window.switchKioskType = function (type) {
  const newType =
    type === "pickup" ? "pickup" : type === "check" ? "check" : "attendance";
  if (newType === window.currentKioskType) return;

  window.currentKioskType = newType;
  window.pendingKioskType = newType; // ikut disinkronkan agar konsisten jika modal pemilihan jenis dibuka lagi nanti

  applyKioskTypeViewTexts(newType);
  window.resetKioskToScan(); // kembali ke layar scan (menutup hasil scan sebelumnya jika masih tampil) & buka kunci scanner
  window.updateKioskSwitchTypeButtonUI(); // set ikon dasar dulu sebelum animasi putar ditambahkan di atasnya
  window.playKioskTypeSwitchAnimation();

  const label =
    newType === "pickup"
      ? "Kiosk QR Code Pengambilan"
      : newType === "check"
        ? "Kiosk Cek Data"
        : "Kiosk Absensi";
  window.showToast(`Berpindah ke ${label}`, "success");
};

// Membuka modal PIN sebagai gerbang keluar dari Mode Kiosk — mencegah peserta (yang hanya
// berinteraksi dengan scanner self-service) tanpa sengaja atau sengaja masuk ke halaman
// manajemen data event hanya dengan menekan tombol keluar.
window.confirmExitKioskMode = function () {
  const input = document.getElementById("kiosk-exit-pin-input");
  const errorEl = document.getElementById("kiosk-exit-pin-error");
  if (input) input.value = "";
  if (errorEl) {
    if (Date.now() < kioskPinLockUntil) {
      const secsLeft = Math.ceil((kioskPinLockUntil - Date.now()) / 1000);
      errorEl.innerHTML = `<i class="fa-solid fa-lock mr-1"></i>Terlalu banyak percobaan gagal. Coba lagi dalam ${secsLeft} detik.`;
      errorEl.classList.remove("hidden");
    } else {
      errorEl.classList.add("hidden");
    }
  }
  window.openModalAnimated("modal-kiosk-exit-pin");
  setTimeout(() => {
    if (input) input.focus();
  }, 150);
};

// Validasi PIN: memakai PIN khusus (kiosk_exit_pin) bila sudah diatur di Pengaturan Aplikasi;
// jika belum pernah diatur, memakai password akun Admin yang sedang login sebagai gantinya —
// jadi fitur ini langsung aktif tanpa perlu setup tambahan, dan admin bisa mempersingkatnya
// dengan PIN sederhana kapan pun lewat menu Pengaturan.
// Setelah 5 kali salah berturut-turut, input dikunci sementara (30 detik) untuk mencegah
// percobaan menebak PIN secara bertubi-tubi.
window.executeKioskExitPin = function (e) {
  e.preventDefault();
  const input = document.getElementById("kiosk-exit-pin-input");
  const errorEl = document.getElementById("kiosk-exit-pin-error");

  if (Date.now() < kioskPinLockUntil) {
    const secsLeft = Math.ceil((kioskPinLockUntil - Date.now()) / 1000);
    if (errorEl) {
      errorEl.innerHTML = `<i class="fa-solid fa-lock mr-1"></i>Terlalu banyak percobaan gagal. Coba lagi dalam ${secsLeft} detik.`;
      errorEl.classList.remove("hidden");
    }
    input.value = "";
    return;
  }

  const entered = input.value;
  const customPin = LS.getSetting("kiosk_exit_pin");
  let isValid = false;
  if (customPin) {
    isValid = entered === customPin;
  } else {
    const currentUser = LS.getUsers().find(
      (u) => u.username === window.appState.currentUser.username,
    );
    isValid = !!currentUser && entered === currentUser.password;
  }

  if (isValid) {
    kioskPinFailCount = 0;
    window.closeModalAnimated("modal-kiosk-exit-pin");
    window.exitKioskMode();
  } else {
    kioskPinFailCount++;
    if (kioskPinFailCount >= 5) {
      kioskPinLockUntil = Date.now() + 30000;
      kioskPinFailCount = 0;
      if (errorEl) {
        errorEl.innerHTML =
          '<i class="fa-solid fa-lock mr-1"></i>Terlalu banyak percobaan gagal. Coba lagi dalam 30 detik.';
        errorEl.classList.remove("hidden");
      }
    } else if (errorEl) {
      errorEl.innerHTML =
        '<i class="fa-solid fa-circle-exclamation mr-1"></i>PIN salah, silakan coba lagi.';
      errorEl.classList.remove("hidden");
    }
    input.value = "";
    input.focus();
  }
};

// ----- Pengaturan PIN Keluar Kiosk (halaman Pengaturan Aplikasi) -----
window.loadKioskPinSettingsUI = function () {
  const statusEl = document.getElementById("kiosk-pin-status");
  const inputEl = document.getElementById("kiosk-exit-pin");
  if (inputEl) inputEl.value = ""; // tidak menampilkan ulang PIN tersimpan demi keamanan
  if (!statusEl) return;
  const pin = LS.getSetting("kiosk_exit_pin");
  statusEl.innerHTML = pin
    ? '<i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i> PIN khusus sudah diatur & aktif.'
    : '<i class="fa-solid fa-circle-info text-amber-500 mr-1"></i> Belum diatur — memakai password akun Admin yang sedang login.';
};

window.saveKioskExitPin = function (e) {
  e.preventDefault();
  const val = document.getElementById("kiosk-exit-pin").value.trim();
  LS.setSetting("kiosk_exit_pin", val); // dikosongkan = hapus PIN khusus, kembali ke fallback password Admin
  window.loadKioskPinSettingsUI();
  window.showToast(
    val
      ? "PIN keluar kiosk berhasil disimpan!"
      : "PIN dihapus — kini memakai password Admin.",
    "success",
  );
};

window.exitKioskMode = function () {
  if (kioskResultTimer) {
    clearTimeout(kioskResultTimer);
    kioskResultTimer = null;
  }
  if (kioskScannerInstance) {
    kioskScannerInstance.clear().catch((e) => console.warn(e));
    kioskScannerInstance = null;
  }
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  try {
    window.speechSynthesis.cancel();
  } catch (e) {} // hentikan ucapan yang mungkin masih berjalan

  const view = document.getElementById("kiosk-mode-view");
  view.classList.add("hidden");
  view.classList.remove("flex");
};

window.renderKioskStats = function () {
  const total = window.guests.length;
  const hadir = window.guests.filter((g) => g.scanned).length;
  const belum = total - hadir;
  const elTotal = document.getElementById("kiosk-stat-total");
  if (elTotal) elTotal.innerText = total;
  const elHadir = document.getElementById("kiosk-stat-hadir");
  if (elHadir) elHadir.innerText = hadir;
  const elBelum = document.getElementById("kiosk-stat-belum");
  if (elBelum) elBelum.innerText = belum;
};

// Menandai peserta sebagai "sudah mengambil kunci" begitu berhasil scan di Kiosk QR Code
// Pengambilan - TIDAK menunggu proses tanda tangan selesai (jika tanda tangan kiosk sedang
// aktif & peserta memang menandatangani, fungsi ini dipanggil sekali lagi dari
// window.confirmKioskSignature untuk melengkapi buktinya dengan tanda tangan asli). Hanya
// berlaku untuk event yang membutuhkan kunci hotel & peserta memang punya kamar; di luar itu
// fungsi ini tidak melakukan apa pun (aman dipanggil kapan saja).
window.markKeyPickupFromKiosk = function (guest, evt, signatureDataUrl) {
  if (!guest || !evt || !evt.needsHotel || !guest.kamar || guest.kamar === "-")
    return;
  guest.kunciDiambil = true;
  guest.kunciDiambilOleh = guest.nama; // yang mengambil adalah peserta itu sendiri
  if (signatureDataUrl) guest.kunciSignature = signatureDataUrl;
  const linked = window.findLinkedGuests(guest);
  linked.forEach((lg) => {
    lg.kunciDiambil = true;
    lg.kunciDiambilOleh = guest.nama;
    if (signatureDataUrl) lg.kunciSignature = signatureDataUrl;
  });
  saveGuests();
  window.renderTable();
};

window.onKioskScanSuccess = function (t) {
  if (isKioskScanLocked) return;
  isKioskScanLocked = true;
  try {
    if (
      kioskScannerInstance &&
      kioskScannerInstance.getState &&
      kioskScannerInstance.getState() === 2
    )
      kioskScannerInstance.pause(true);
  } catch (e) {}

  const g = window.guests.find((x) => x.id === t);
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );

  if (window.currentKioskType === "pickup") {
    // Kiosk Pengambilan: pencarian & tampilan data (checkbox "Kunci Diambil" ikut
    // tercentang otomatis begitu QR berhasil discan, lihat window.markKeyPickupFromKiosk
    // di atas) - TIDAK menandai/mengubah status kehadiran. Tanda tangan konfirmasi
    // bersifat OPSIONAL — diatur admin lewat toggle "Tanda Tangan Kiosk Pengambilan" di
    // Pengaturan Aplikasi (window.getKioskPickupSignatureEnabled()). Jika aktif, peserta
    // diminta tanda tangan dulu lewat modal kecil sebelum Nomor Khusus/Unik ditampilkan
    // (checkbox sudah tercentang duluan, tanda tangan hanya melengkapi buktinya); jika
    // dimatikan, data langsung ditampilkan begitu QR terpindai.
    if (g) {
      // guest.pickupScanned/pickupScanTime dilacak TERPISAH dari guest.kunciDiambil (yang
      // khusus kunci kamar hotel & hanya berlaku kalau evt.needsHotel) karena Kiosk
      // Pengambilan pada dasarnya untuk menampilkan Nomor Khusus/Unik apa pun — banyak
      // event yang memakainya sama sekali tidak butuh data hotel. Kalau QR yang sama
      // sudah pernah SELESAI discan sebelumnya (Nomor-nya sudah pernah tampil), JANGAN
      // diproses ulang - cukup tampilkan peringatan supaya panitia di konter sadar & bisa
      // mencegah pengambilan barang/kunci dua kali.
      // PERBAIKAN BUG: untuk event yang butuh kunci kamar (evt.needsHotel & peserta
      // punya kamar), status "sudah discan" ini HARUS diselaraskan dengan guest.kunciDiambil.
      // Kalau admin membatalkan bukti pengambilan kunci lewat checkbox "Kunci Diambil" di
      // tabel Data Peserta (window.toggleKey), kunciDiambil kembali jadi false, tapi
      // pickupScanned lama tidak ikut direset - akibatnya peserta yang mau mengambil kunci
      // ulang selalu diblokir peringatan "Sudah Pernah Diambil" padahal kunci belum/tidak
      // lagi tercatat diambil. Maka blokir hanya kalau kunci memang relevan (event butuh
      // hotel & peserta punya kamar) DAN kunciDiambil masih true; kalau tidak relevan
      // (event tanpa data hotel/Nomor Unik untuk keperluan lain), perilaku lama tetap
      // dipakai (murni berdasar pickupScanned) supaya use-case non-kunci tidak berubah.
      const keyStatusRelevant = !!(
        evt &&
        evt.needsHotel &&
        g.kamar &&
        g.kamar !== "-"
      );
      const alreadyPickedUp =
        g.pickupScanned && (!keyStatusRelevant || g.kunciDiambil);
      if (alreadyPickedUp) {
        window.showKioskResult("pickup_already", g, evt);
        return;
      }
      window.markKeyPickupFromKiosk(g, evt, null);
      if (window.getKioskPickupSignatureEnabled()) {
        // pickupScanned baru ditandai SETELAH tanda tangan dikonfirmasi (lihat
        // window.confirmKioskSignature), BUKAN di sini - supaya kalau peserta
        // membatalkan proses tanda tangan (window.cancelKioskSignature), QR yang sama
        // masih bisa dipindai ulang tanpa terjebak peringatan "Sudah Pernah Diambil"
        // yang keliru padahal Nomor-nya belum pernah benar-benar tampil.
        window.openKioskPickupSignature(g, evt);
      } else {
        g.pickupScanned = true;
        g.pickupScanTime = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        saveGuests();
        window.showKioskResult("pickup_found", g, evt);
      }
    } else {
      window.showKioskResult("notfound", null, evt);
    }
    return;
  }

  if (window.currentKioskType === "check") {
    // Kiosk Cek Data: HANYA mencari & menampilkan data diri peserta apa adanya (nama, Quest ID,
    // asal, jabatan, kursi/meja - field yang sama dipakai oleh buildKioskDetailRows di bawah).
    // TIDAK mengubah status kehadiran (g.scanned) maupun status pengambilan kunci/tanda tangan
    // sama sekali - murni read-only, cocok dipakai panitia untuk memverifikasi data peserta
    // sewaktu-waktu tanpa risiko tidak sengaja mengubah data lain.
    if (g) window.showKioskResult("check_found", g, evt);
    else window.showKioskResult("notfound", null, evt);
    return;
  }

  if (g) {
    let status;
    if (!g.scanned) {
      g.scanned = true;
      g.scanTime = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      saveGuests();
      status = "success";
    } else {
      status = "already";
    }

    window.renderKioskStats();
    window.renderScanStats();
    window.renderTable();
    window.showKioskResult(status, g, evt);
  } else {
    window.showKioskResult("notfound", null, evt);
  }
};

function buildKioskDetailRows(guest, evt) {
  const rsLabel = dict[window.currentLang]["lbl_rs"] || "Asal";
  let rows = `<div class="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2"><span class="text-slate-400 dark:text-slate-500">Quest ID</span><span class="font-bold text-slate-800 dark:text-slate-100">${guest.id}</span></div>
            <div class="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2"><span class="text-slate-400 dark:text-slate-500">${rsLabel}</span><span class="font-semibold text-slate-800 dark:text-slate-100 text-right">${guest.rs}</span></div>
            <div class="flex justify-between${evt && evt.needsSeat !== false ? " border-b border-slate-200 dark:border-slate-700 pb-2" : ""}"><span class="text-slate-400 dark:text-slate-500">Jabatan</span><span class="font-semibold text-slate-800 dark:text-slate-100 text-right">${guest.jabatan}</span></div>`;
  if (evt && evt.needsSeat !== false) {
    const seatLabel = evt.seatLabelType === "meja" ? "No Meja" : "No Kursi";
    rows += `<div class="flex justify-between"><span class="text-slate-400 dark:text-slate-500">${seatLabel}</span><span class="font-bold text-slate-800 dark:text-slate-100">${guest.kursi}</span></div>`;
  }
  return rows;
}

// Menampilkan panel hasil scan (sukses/sudah absen/tidak ditemukan) dengan progress bar
// hitung mundur, lalu otomatis kembali ke tampilan scanner setelah durasi yang diatur
// admin di Pengaturan Aplikasi (window.getKioskResetDurationSec()).
window.showKioskResult = function (status, guest, evt) {
  window.playKioskFeedback(status, guest, evt);

  const scanView = document.getElementById("kiosk-scan-view");
  const resultView = document.getElementById("kiosk-result-view");
  const iconWrap = document.getElementById("kiosk-result-icon-wrap");
  const icon = document.getElementById("kiosk-result-icon");
  const title = document.getElementById("kiosk-result-title");
  const name = document.getElementById("kiosk-result-name");
  const sub = document.getElementById("kiosk-result-sub");
  const details = document.getElementById("kiosk-result-details");

  scanView.classList.add("hidden");
  resultView.classList.remove("hidden");
  resultView.classList.add("flex");
  resultView.classList.remove("kiosk-fade-in");
  void resultView.offsetWidth;
  resultView.classList.add("kiosk-fade-in");

  if (status === "success") {
    iconWrap.className =
      "w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-emerald-100 dark:bg-emerald-500/20";
    icon.className =
      "fa-solid fa-circle-check text-5xl text-emerald-600 dark:text-emerald-400 animate-success";
    title.innerText = "Selamat Datang!";
    title.className =
      "text-3xl font-extrabold mb-2 text-emerald-600 dark:text-emerald-400";
    name.innerText = guest.nama;
    sub.innerText = "Kehadiran Anda berhasil dicatat.";
    details.innerHTML = buildKioskDetailRows(guest, evt);
    details.classList.remove("hidden");
  } else if (status === "already") {
    iconWrap.className =
      "w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-amber-100 dark:bg-amber-500/20";
    icon.className =
      "fa-solid fa-triangle-exclamation text-5xl text-amber-600 dark:text-amber-400";
    title.innerText = "Sudah Absen";
    title.className =
      "text-3xl font-extrabold mb-2 text-amber-600 dark:text-amber-400";
    name.innerText = guest.nama;
    sub.innerText = `Anda sudah tercatat hadir pukul ${guest.scanTime || "-"}.`;
    details.innerHTML = buildKioskDetailRows(guest, evt);
    details.classList.remove("hidden");
  } else if (status === "pickup_found") {
    // Kiosk Pengambilan: tampilkan identitas + Nomor Khusus/Unik peserta (dikonfigurasi
    // admin lewat "Nomor Khusus/Unik Peserta" di form Buat/Edit Event, mis. NIK atau
    // No. Registrasi) secara mencolok (besar), supaya mudah dibaca dari jarak agak jauh
    // saat peserta mengambil sesuatu di konter. Bisa lebih dari satu jenis nomor sekaligus.
    iconWrap.className =
      "w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-indigo-100 dark:bg-indigo-500/20";
    icon.className =
      "fa-solid fa-ticket text-5xl text-indigo-600 dark:text-indigo-400";
    title.innerText = "Data Ditemukan";
    title.className =
      "text-3xl font-extrabold mb-2 text-indigo-600 dark:text-indigo-400";
    name.innerText = guest.nama;
    sub.innerText = `${guest.jabatan || "-"} • ${guest.rs || "-"}`;

    const customFields =
      evt && Array.isArray(evt.customNumberFields)
        ? evt.customNumberFields
        : [];
    const customNumbers = guest.customNumbers || {};
    const fieldsWithValue = customFields.filter((f) => customNumbers[f.id]);

    if (fieldsWithValue.length > 0) {
      details.innerHTML = fieldsWithValue
        .map(
          (f) => `
                        <div class="text-center py-2">
                            <p class="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-2">${f.label}</p>
                            <p class="text-6xl font-extrabold text-indigo-600 dark:text-indigo-400 leading-none">${customNumbers[f.id]}</p>
                        </div>`,
        )
        .join(
          '<div class="border-t border-dashed border-slate-200 dark:border-slate-700 my-1"></div>',
        );
    } else {
      details.innerHTML = `<p class="text-center text-sm text-slate-400 dark:text-slate-500 italic py-2">${window.currentLang === "id" ? "Belum ada Nomor Khusus/Unik yang diatur untuk event ini." : "No Special/Unique Number has been set up for this event."}</p>`;
    }
    // Konfirmasi visual tambahan kalau tanda tangan di Kiosk Pengambilan barusan otomatis
    // ikut menandai checkbox "Kunci Diambil" di tabel Data Peserta (lihat window.confirmKioskSignature).
    if (
      evt &&
      evt.needsHotel &&
      guest.kamar &&
      guest.kamar !== "-" &&
      guest.kunciDiambil
    ) {
      details.innerHTML += `<div class="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-semibold"><i class="fa-solid fa-circle-check"></i> ${window.currentLang === "id" ? "Kunci Kamar Tercatat Diambil" : "Room Key Recorded as Picked Up"}</div>`;
    }
    details.classList.remove("hidden");
  } else if (status === "pickup_already") {
    // Kiosk Pengambilan: Nomor Khusus/Unik milik peserta ini SUDAH PERNAH ditampilkan
    // sebelumnya (guest.pickupScanned/pickupScanTime, ditandai saat pengambilan pertama
    // benar-benar selesai - lihat window.onKioskScanSuccess & window.confirmKioskSignature).
    // Dipakai untuk mencegah pengambilan barang/kunci dua kali, sengaja maupun tidak.
    // Nomornya tetap ditampilkan di bawah (tidak disembunyikan) supaya panitia di konter
    // masih bisa memverifikasi/mencocokkan, tapi memakai warna amber & label peringatan
    // yang jelas supaya beda dari status pengambilan pertama kali (pickup_found, indigo).
    iconWrap.className =
      "w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-amber-100 dark:bg-amber-500/20";
    icon.className =
      "fa-solid fa-triangle-exclamation text-5xl text-amber-600 dark:text-amber-400";
    title.innerText = "Sudah Pernah Diambil";
    title.className =
      "text-3xl font-extrabold mb-2 text-amber-600 dark:text-amber-400";
    name.innerText = guest.nama;
    sub.innerText = `Nomor ini sudah discan sebelumnya pukul ${guest.pickupScanTime || "-"}.`;

    const customFieldsAlready =
      evt && Array.isArray(evt.customNumberFields)
        ? evt.customNumberFields
        : [];
    const customNumbersAlready = guest.customNumbers || {};
    const fieldsWithValueAlready = customFieldsAlready.filter(
      (f) => customNumbersAlready[f.id],
    );

    let alreadyHtml = `<div class="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg py-2 px-3 mb-2"><i class="fa-solid fa-clock-rotate-left"></i> ${window.currentLang === "id" ? "Bukan yang pertama kali - mohon dicek ulang" : "Not the first time - please double-check"}</div>`;
    if (fieldsWithValueAlready.length > 0) {
      alreadyHtml += fieldsWithValueAlready
        .map(
          (f) => `
                        <div class="text-center py-2">
                            <p class="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-2">${f.label}</p>
                            <p class="text-6xl font-extrabold text-amber-600 dark:text-amber-400 leading-none">${customNumbersAlready[f.id]}</p>
                        </div>`,
        )
        .join(
          '<div class="border-t border-dashed border-slate-200 dark:border-slate-700 my-1"></div>',
        );
    }
    details.innerHTML = alreadyHtml;
    details.classList.remove("hidden");
  } else if (status === "check_found") {
    // Kiosk Cek Data: identitas peserta ditampilkan apa adanya lewat field yang sama dengan
    // panel hasil Kiosk Absensi (buildKioskDetailRows: Quest ID, asal, jabatan, kursi/meja),
    // TANPA embel-embel status kehadiran/pengambilan apa pun, karena mode ini murni untuk
    // pengecekan data - warna sky/biru dipakai supaya berbeda dari Kiosk Absensi (emerald)
    // & Kiosk Pengambilan (indigo).
    iconWrap.className =
      "w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-sky-100 dark:bg-sky-500/20";
    icon.className =
      "fa-solid fa-id-card-clip text-5xl text-sky-600 dark:text-sky-400";
    title.innerText = "Data Ditemukan";
    title.className =
      "text-3xl font-extrabold mb-2 text-sky-600 dark:text-sky-400";
    name.innerText = guest.nama;
    sub.innerText = `${guest.jabatan || "-"} • ${guest.rs || "-"}`;
    details.innerHTML = buildKioskDetailRows(guest, evt);
    details.classList.remove("hidden");
  } else {
    iconWrap.className =
      "w-24 h-24 rounded-full flex items-center justify-center mb-5 shadow-lg bg-red-100 dark:bg-red-500/20";
    icon.className =
      "fa-solid fa-circle-xmark text-5xl text-red-600 dark:text-red-400";
    title.innerText = "QR Tidak Dikenali";
    title.className =
      "text-3xl font-extrabold mb-2 text-red-600 dark:text-red-400";
    name.innerText = "";
    sub.innerText = "Kode QR tidak ditemukan pada data peserta event ini.";
    details.innerHTML = "";
    details.classList.add("hidden");
  }

  const progress = document.getElementById("kiosk-result-progress");
  const resultDurationMs = window.getKioskResetDurationSec() * 1000;
  progress.style.transition = "none";
  progress.style.width = "100%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      progress.style.transition = `width ${resultDurationMs}ms linear`;
      progress.style.width = "0%";
    });
  });

  if (kioskResultTimer) clearTimeout(kioskResultTimer);
  kioskResultTimer = setTimeout(
    () => window.resetKioskToScan(),
    resultDurationMs,
  );
};

window.resetKioskToScan = function () {
  if (kioskResultTimer) {
    clearTimeout(kioskResultTimer);
    kioskResultTimer = null;
  }
  const resultView = document.getElementById("kiosk-result-view");
  resultView.classList.add("hidden");
  resultView.classList.remove("flex");
  document.getElementById("kiosk-scan-view").classList.remove("hidden");
  isKioskScanLocked = false;
  if (kioskScannerInstance) {
    try {
      kioskScannerInstance.resume();
    } catch (e) {}
  }
};

// ===== Scan & Baca Kode (Custom QR Code Generator & Custom Barcode Generator) =====
// Fitur ini murni membaca lalu menampilkan isi kode apa adanya (tidak dicocokkan ke
// data peserta manapun), jadi disengaja dipisah dari scannerInstance/onScanSuccess yang
// dipakai untuk absensi kehadiran. Memakai ulang library html5-qrcode yang sama karena
// decoder-nya sudah mendukung QR maupun berbagai format barcode 1D sekaligus.
window.openScanReaderModal = function (mode) {
  document.getElementById("scan-reader-title-text").innerText = window.t(
    mode === "barcode" ? "modal_scan_barcode_title" : "modal_scan_qr_title",
  );
  document.getElementById("scan-reader-subtitle").innerText = window.t(
    mode === "barcode" ? "modal_scan_barcode_sub" : "modal_scan_qr_sub",
  );
  document.getElementById("scan-reader-result").classList.add("hidden");
  document.getElementById("scan-reader-camera-wrap").classList.remove("hidden");
  window.openModalAnimated("modal-scan-reader");
  // Beri jeda singkat agar #reader-scan-generic sudah ter-render di DOM (modal baru saja
  // ditampilkan) sebelum html5-qrcode mencoba mengambil alih elemen tersebut.
  setTimeout(() => {
    if (scanReaderInstance === null) {
      scanReaderInstance = new Html5QrcodeScanner(
        "reader-scan-generic",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
        },
        false,
      );
      scanReaderInstance.render(window.onScanReaderSuccess, () => {});
    }
  }, 300);
};

window.stopScanReaderInstance = function () {
  if (scanReaderInstance) {
    scanReaderInstance.clear().catch((e) => console.warn(e));
    scanReaderInstance = null;
  }
};

window.closeScanReaderModal = function () {
  window.closeModalAnimated("modal-scan-reader");
  window.stopScanReaderInstance();
};

window.onScanReaderSuccess = function (decodedText) {
  window.stopScanReaderInstance();
  document.getElementById("scan-reader-camera-wrap").classList.add("hidden");

  const resultText = document.getElementById("scan-reader-result-text");
  const openLinkBtn = document.getElementById("scan-reader-open-link");
  resultText.innerText = decodedText;

  const isUrl = /^https?:\/\//i.test((decodedText || "").trim());
  if (isUrl) {
    openLinkBtn.href = decodedText.trim();
    openLinkBtn.classList.remove("hidden");
  } else {
    openLinkBtn.classList.add("hidden");
    openLinkBtn.removeAttribute("href");
  }

  document.getElementById("scan-reader-result").classList.remove("hidden");
  window.showToast(window.t("toast_scan_success"), "success");
};

window.resumeScanReader = function () {
  document.getElementById("scan-reader-result").classList.add("hidden");
  document.getElementById("scan-reader-camera-wrap").classList.remove("hidden");
  if (scanReaderInstance === null) {
    scanReaderInstance = new Html5QrcodeScanner(
      "reader-scan-generic",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false,
    );
    scanReaderInstance.render(window.onScanReaderSuccess, () => {});
  }
};

window.copyScanResult = function () {
  const text = document.getElementById("scan-reader-result-text").innerText;
  if (!text) return;
  const doneFeedback = () =>
    window.showToast(window.t("toast_copied"), "success");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(doneFeedback)
      .catch(() => window.showToast(window.t("toast_copy_failed"), "error"));
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      doneFeedback();
    } catch (err) {
      window.showToast(window.t("toast_copy_failed"), "error");
    }
    document.body.removeChild(ta);
  }
};

// ===== Pembuatan Canvas QR Code (dioptimalkan) =====
// OPTIMASI: versi sebelumnya menunggu lewat setTimeout tetap 150ms SETIAP kali membuat satu QR
// Code, padahal library QRCode.js (davidshimjs) menggambar ke elemen <canvas> secara SINKRON di
// dalam constructor-nya — jadi menunggu 150ms adalah tebakan durasi yang tidak perlu. Untuk cetak
// massal ratusan peserta, delay ini terakumulasi jadi puluhan detik tanpa alasan nyata.
// Versi sebelumnya juga memakai satu elemen #hidden-qr-container yang dipakai bersama oleh semua
// pemanggilan, sehingga proses HARUS berjalan satu per satu (serial) — panggilan berikutnya harus
// menunggu innerHTML dibersihkan dulu oleh panggilan sebelumnya.
// PERBAIKAN: setiap panggilan memakai elemen <div> baru yang berdiri sendiri (tidak dipasang ke
// DOM sama sekali - canvas tetap bisa digambar & dibaca walau elemennya "lepas"/detached), jadi
// beberapa panggilan bisa diproses BERBARENGAN tanpa saling menimpa (lihat processInChunks).
// requestAnimationFrame dipakai sebagai jaring pengaman yang murah & presisi (satu siklus repaint
// browser, ~16ms) — bukan menebak durasi lewat setTimeout — untuk mengatasi kasus langka di
// sejumlah WebView lama yang butuh satu repaint sebelum canvas benar-benar terisi.
window.createQRCanvas = function (text) {
  return new Promise((resolve) => {
    const holder = document.createElement("div");
    try {
      new QRCode(holder, {
        text: text,
        width: 400,
        height: 400,
        correctLevel: QRCode.CorrectLevel.M,
        colorDark: "#000000",
        colorLight: "#ffffff",
      });
    } catch (e) {
      console.error("Gagal membuat QR Code:", e);
      resolve("");
      return;
    }
    requestAnimationFrame(() => {
      const qrCanvas = holder.querySelector("canvas");
      if (qrCanvas) {
        const paddedCanvas = document.createElement("canvas");
        const padding = 40;
        paddedCanvas.width = qrCanvas.width + padding * 2;
        paddedCanvas.height = qrCanvas.height + padding * 2;
        const ctx = paddedCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
        ctx.drawImage(qrCanvas, padding, padding);
        resolve(paddedCanvas.toDataURL("image/png"));
      } else {
        const img = holder.querySelector("img");
        resolve(img ? img.src : "");
      }
    });
  });
};

// Memproses array dalam beberapa batch kecil yang dijalankan BERBARENGAN (bukan satu per satu),
// dipakai oleh semua proses cetak/unduh massal (QR Peserta, Custom QR, Custom Barcode) supaya
// pembuatan gambar per item tidak lagi saling menunggu secara berurutan. Hasil akhir tetap
// dijaga urut persis sesuai data asal (penting untuk tata letak grid cetak), dan progress
// callback tetap dipanggil per item selesai supaya progress bar tetap terasa mulus & responsif.
// Ukuran batch dibatasi (bukan diproses semua sekaligus) supaya browser tidak "membeku" sesaat
// saat memproses ratusan/ribuan data dalam satu waktu.
async function processInChunks(items, workerFn, onProgress, chunkSize = 24) {
  const results = new Array(items.length);
  let done = 0;
  for (let start = 0; start < items.length; start += chunkSize) {
    const chunk = items.slice(start, start + chunkSize);
    await Promise.all(
      chunk.map(async (item, idx) => {
        results[start + idx] = await workerFn(item);
        done++;
        if (onProgress) onProgress(done, items.length);
      }),
    );
  }
  return results;
}

window.showQRCode = function (id, nama, rs, jabatan, kursi) {
  window.currentModalQRId = id;
  const container = document.getElementById("qrcode-container");
  container.innerHTML = "";
  new QRCode(container, {
    text: id,
    width: 220,
    height: 220,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });

  document.getElementById("modal-qr-name").innerText = nama;
  document.getElementById("modal-qr-rs").innerText = rs || "-";
  document.getElementById("modal-qr-jabatan").innerText = jabatan || "-";
  document.getElementById("modal-qr-kursi").innerText =
    kursi && kursi !== "-" ? kursi : "Tidak Terdaftar";

  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  if (evt && evt.needsSeat !== false) {
    const kursiContainer = document.getElementById("modal-qr-container-kursi");
    kursiContainer.style.display = "flex";
    kursiContainer.style.flexDirection = "column";
  } else {
    document.getElementById("modal-qr-container-kursi").style.display = "none";
  }

  window.openModalAnimated("modal-qr");
};

window.downloadSingleQR = async function (id, rs, nama) {
  window.showToast("Menyiapkan unduhan...", "info");
  const url = await window.createQRCanvas(id);
  const a = document.createElement("a");
  a.href = url;
  a.download = `[${rs}] ${nama}.png`;
  a.click();
};

window.bulkDownloadQR = async function () {
  if (window.guests.length === 0)
    return window.showToast("Tidak ada data peserta!", "error");
  const total = window.guests.length;
  window.showProgressModal(
    window.t("btn_bulk_qr"),
    window.currentLang === "id"
      ? "Menyiapkan file QR Code..."
      : "Preparing QR Code files...",
  );
  const zip = new JSZip();
  const folder = zip.folder("QRCodes_EventQ");
  // Dibuat berbarengan dalam batch kecil (bukan satu per satu secara berurutan) — lihat
  // processInChunks di atas.
  await processInChunks(
    window.guests,
    async (g) => {
      const url = await window.createQRCanvas(g.id);
      folder.file(`[${g.rs}] ${g.nama}.png`, url.split(",")[1], {
        base64: true,
      });
    },
    (done, t) => window.updateProgressModal(done, t),
  );
  window.updateProgressModal(
    total,
    total,
    window.currentLang === "id"
      ? "Mengompres file ZIP..."
      : "Compressing ZIP file...",
  );
  zip.generateAsync({ type: "blob" }).then((blob) => {
    window.hideProgressModal();
    saveAs(blob, "QRCodes_EventQ.zip");
    window.showToast(
      window.currentLang === "id" ? "Download Selesai!" : "Download complete!",
      "success",
    );
  });
};

// ===== Progress Modal Helper (Import Excel / Bulk Download / Cetak Semua QR) =====
window.showProgressModal = function (title, subtitle) {
  const titleEl = document.getElementById("progress-modal-title");
  const subEl = document.getElementById("progress-modal-subtitle");
  if (titleEl) titleEl.textContent = title;
  if (subEl)
    subEl.textContent =
      subtitle ||
      (window.currentLang === "id"
        ? "Mohon tunggu sebentar..."
        : "Please wait a moment...");
  window.updateProgressModal(0, 0);
  const modal = document.getElementById("modal-progress");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
};

window.updateProgressModal = function (current, total, subtitle) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar = document.getElementById("progress-modal-bar");
  const pctEl = document.getElementById("progress-modal-percent");
  const countEl = document.getElementById("progress-modal-count");
  const subEl = document.getElementById("progress-modal-subtitle");
  if (bar) bar.style.width = pct + "%";
  if (pctEl) pctEl.textContent = pct + "%";
  if (countEl) countEl.textContent = `${current} / ${total}`;
  if (subtitle && subEl) subEl.textContent = subtitle;
};

window.hideProgressModal = function () {
  const modal = document.getElementById("modal-progress");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

// ===== Print QR Code (dengan info tambahan & orientasi yang bisa diatur di Pengaturan) =====
window.getPrintQRSettings = function () {
  const raw = LS.getSetting("print_qr_fields");
  const DEFAULTS = {
    eventName: true,
    nama: true,
    id: true,
    rs: true,
    jabatan: false,
    kursi: true,
    showLogo: false,
    frame: true,
    orientation: "portrait",
    columns: 2,
    rows: 4,
    customSize: false,
    cardWidthCm: 6,
    cardHeightCm: 9,
  };
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw);
    // Kolom 1-6, baris 1-10 — batas wajar supaya kartu tidak jadi terlalu kecil untuk dipindai
    // atau justru kepotong karena melebihi tinggi halaman fisik.
    const clamp = (v, def, min, max) => {
      const n = parseInt(v, 10);
      return isNaN(n) || n < min || n > max ? def : n;
    };
    // Ukuran Kustom (Cm): 1-30cm — batas wajar untuk label/kartu QR fisik (di bawah 1cm QR
    // sudah pasti tidak bisa dipindai, di atas 30cm sudah tidak lagi wajar disebut "kartu").
    // Dibulatkan 1 desimal supaya nilai seperti 5.5cm tetap didukung tanpa presisi berlebihan.
    const clampFloat = (v, def, min, max) => {
      const n = parseFloat(v);
      return isNaN(n) || n < min || n > max ? def : Math.round(n * 10) / 10;
    };
    return {
      // Default nyala — sebelumnya nama/judul event SELALU tercetak tanpa opsi mati, jadi
      // pengguna lama (belum pernah menyimpan pengaturan ini) tetap melihat perilaku yang sama.
      eventName: parsed.eventName !== false,
      nama: parsed.nama !== false,
      id: parsed.id !== false,
      rs: parsed.rs !== false,
      kursi: parsed.kursi !== false,
      jabatan: parsed.jabatan === true, // default mati — field baru bersifat opt-in, sama seperti showLogo
      showLogo: parsed.showLogo === true, // default mati — fitur baru bersifat opt-in
      frame: parsed.frame !== false, // default nyala — bingkai kartu cetak tetap tampil kecuali dimatikan manual
      orientation:
        parsed.orientation === "landscape" ? "landscape" : "portrait",
      columns: clamp(parsed.columns, 2, 1, 6),
      rows: clamp(parsed.rows, 4, 1, 10),
      // Kalau diaktifkan, kartu QR (cetak satuan maupun massal) memakai lebar & tinggi PASTI
      // dalam cm ini - lihat window.buildPrintQRCard & buildAndPrintGuestQRCards. Default mati —
      // perilaku lama (lebar mengikuti kolom grid/lebar kertas) tetap dipakai kecuali admin
      // sengaja mengaktifkannya lewat modal "Atur Layout Grid Cetak".
      customSize: parsed.customSize === true,
      cardWidthCm: clampFloat(parsed.cardWidthCm, 6, 1, 30),
      cardHeightCm: clampFloat(parsed.cardHeightCm, 9, 1, 30),
    };
  } catch (e) {
    return DEFAULTS;
  }
};

window.loadPrintQRSettingsUI = function () {
  const s = window.getPrintQRSettings();
  const elEventName = document.getElementById("print-field-eventname");
  const elNama = document.getElementById("print-field-nama");
  const elId = document.getElementById("print-field-id");
  const elRs = document.getElementById("print-field-rs");
  const elJabatan = document.getElementById("print-field-jabatan");
  const elKursi = document.getElementById("print-field-kursi");
  const elLogo = document.getElementById("print-field-logo");
  const elFrame = document.getElementById("print-field-frame");
  if (elEventName) elEventName.checked = s.eventName;
  if (elNama) elNama.checked = s.nama;
  if (elId) elId.checked = s.id;
  if (elRs) elRs.checked = s.rs;
  if (elJabatan) elJabatan.checked = s.jabatan;
  if (elKursi) elKursi.checked = s.kursi;
  if (elLogo) elLogo.checked = s.showLogo;
  if (elFrame) elFrame.checked = s.frame;
  window.updateOrientationButtonsUI(s.orientation);
  const elCols = document.getElementById("print-layout-columns");
  const elRows = document.getElementById("print-layout-rows");
  if (elCols) elCols.value = s.columns;
  if (elRows) elRows.value = s.rows;
  const elCustomSize = document.getElementById(
    "print-layout-custom-size-toggle",
  );
  const elWidthCm = document.getElementById("print-layout-width-cm");
  const elHeightCm = document.getElementById("print-layout-height-cm");
  if (elCustomSize) elCustomSize.checked = s.customSize;
  if (elWidthCm) elWidthCm.value = s.cardWidthCm;
  if (elHeightCm) elHeightCm.value = s.cardHeightCm;
  const customSizeFields = document.getElementById(
    "print-layout-custom-size-fields",
  );
  if (customSizeFields)
    customSizeFields.classList.toggle("hidden", !s.customSize);
};

window.savePrintQRSettings = function (silent) {
  const elCols = document.getElementById("print-layout-columns");
  const elRows = document.getElementById("print-layout-rows");
  const elFrame = document.getElementById("print-field-frame");
  const elJabatan = document.getElementById("print-field-jabatan");
  const elEventName = document.getElementById("print-field-eventname");
  const elCustomSize = document.getElementById(
    "print-layout-custom-size-toggle",
  );
  const elWidthCm = document.getElementById("print-layout-width-cm");
  const elHeightCm = document.getElementById("print-layout-height-cm");
  const settings = {
    eventName: elEventName ? elEventName.checked : true,
    nama: document.getElementById("print-field-nama").checked,
    id: document.getElementById("print-field-id").checked,
    rs: document.getElementById("print-field-rs").checked,
    jabatan: elJabatan ? elJabatan.checked : false,
    kursi: document.getElementById("print-field-kursi").checked,
    showLogo: document.getElementById("print-field-logo").checked,
    frame: elFrame ? elFrame.checked : true,
    orientation:
      document.getElementById("print-orientation-value").value || "portrait",
    // Dibaca dari input di modal "Atur Layout Grid Cetak" (tetap ada di DOM walau modalnya
    // sedang tertutup), supaya toggle checkbox lain tidak diam-diam mereset pengaturan grid.
    columns: elCols ? elCols.value : 2,
    rows: elRows ? elRows.value : 4,
    // Ukuran Kustom (Cm) - sama-sama dibaca dari modal "Atur Layout Grid Cetak" walau modalnya
    // sedang tertutup, lihat window.getPrintQRSettings untuk validasi & clamp nilainya.
    customSize: elCustomSize ? elCustomSize.checked : false,
    cardWidthCm: elWidthCm ? elWidthCm.value : 6,
    cardHeightCm: elHeightCm ? elHeightCm.value : 9,
  };
  LS.setSetting("print_qr_fields", JSON.stringify(settings));
  if (!silent) window.showToast(window.t("txt_print_saved"), "success");
};

// Menampilkan modal pengaturan layout grid cetak massal, mengisi ulang nilai kolom/baris
// tersimpan saat ini, dan langsung merender pratinjau visualnya.
window.openPrintLayoutModal = function () {
  const s = window.getPrintQRSettings();
  document.getElementById("print-layout-columns").value = s.columns;
  document.getElementById("print-layout-rows").value = s.rows;
  const elCustomSize = document.getElementById(
    "print-layout-custom-size-toggle",
  );
  const elWidthCm = document.getElementById("print-layout-width-cm");
  const elHeightCm = document.getElementById("print-layout-height-cm");
  const customSizeFields = document.getElementById(
    "print-layout-custom-size-fields",
  );
  if (elCustomSize) elCustomSize.checked = s.customSize;
  if (elWidthCm) elWidthCm.value = s.cardWidthCm;
  if (elHeightCm) elHeightCm.value = s.cardHeightCm;
  if (customSizeFields)
    customSizeFields.classList.toggle("hidden", !s.customSize);
  window.renderPrintLayoutPreview();
  window.openModalAnimated("modal-print-layout");
};

// Menampilkan/menyembunyikan input Lebar & Tinggi (Cm) saat toggle "Gunakan Ukuran Kustom (Cm)"
// diklik, lalu langsung merender ulang pratinjau supaya efeknya terlihat tanpa perlu simpan dulu.
window.togglePrintCustomSizeUI = function (checked) {
  const fields = document.getElementById("print-layout-custom-size-fields");
  if (fields) fields.classList.toggle("hidden", !checked);
  window.renderPrintLayoutPreview();
};

// Menggambar ulang grid kotak-kotak kecil di modal sesuai jumlah kolom/baris yang sedang diisi,
// supaya admin langsung membayangkan hasil akhirnya tanpa harus mencetak dulu. Bentuk kotak kini
// ikut menyesuaikan orientasi kertas (Portrait/Landscape) yang sedang dipilih, dan di bawahnya
// ditampilkan perkiraan lebar kartu sesungguhnya di atas kertas beserta peringatan bila kombinasi
// kolom yang dipilih berisiko membuat QR Code jadi terlalu kecil untuk dipindai dengan mudah.
window.renderPrintLayoutPreview = function () {
  const colsInput = document.getElementById("print-layout-columns");
  const rowsInput = document.getElementById("print-layout-rows");
  const grid = document.getElementById("print-layout-preview-grid");
  const countLabel = document.getElementById("print-layout-preview-count");
  const hintEl = document.getElementById("print-layout-size-hint");
  if (!colsInput || !rowsInput || !grid) return;

  const cols = Math.min(6, Math.max(1, parseInt(colsInput.value, 10) || 1));
  const rows = Math.min(10, Math.max(1, parseInt(rowsInput.value, 10) || 1));

  const orientation =
    document.getElementById("print-orientation-value")?.value === "landscape"
      ? "landscape"
      : "portrait";

  // Ukuran Kustom (Cm): kalau toggle "Gunakan Ukuran Kustom (Cm)" aktif, kotak pratinjau &
  // keterangan ukuran memakai lebar/tinggi PASTI yang diisi admin (bukan lagi estimasi otomatis
  // mengikuti lebar kertas) — lihat window.togglePrintCustomSizeUI, window.buildPrintQRCard &
  // buildAndPrintGuestQRCards untuk penerapannya di hasil cetak sesungguhnya.
  const customToggle = document.getElementById(
    "print-layout-custom-size-toggle",
  );
  const isCustomSize = !!(customToggle && customToggle.checked);
  const widthCmInput = document.getElementById("print-layout-width-cm");
  const heightCmInput = document.getElementById("print-layout-height-cm");
  const widthCm = Math.min(
    30,
    Math.max(1, parseFloat(widthCmInput?.value) || 6),
  );
  const heightCm = Math.min(
    30,
    Math.max(1, parseFloat(heightCmInput?.value) || 9),
  );

  // Ukuran kotak pratinjau "alami" (sebelum diskalakan) - mode auto pakai rasio kartu A4
  // standar, Ukuran Kustom (Cm) pakai rasio Cm asli (6px per cm sebagai acuan visual saja).
  const PREVIEW_PX_PER_CM = 6;
  let naturalBoxW, naturalBoxH;
  if (isCustomSize) {
    naturalBoxW = widthCm * PREVIEW_PX_PER_CM;
    naturalBoxH = heightCm * PREVIEW_PX_PER_CM;
  } else {
    naturalBoxW = orientation === "landscape" ? 42 : 28;
    naturalBoxH = orientation === "landscape" ? 24 : 34;
  }

  // PERBAIKAN: kotak pratinjau di atas SELALU diskalakan (auto-fit) agar total grid
  // (kolom × baris) muat dalam area pratinjau yang ukurannya tetap (lihat wrapper h-[190px]
  // di index.html) — jadi modal ini TIDAK LAGI melebar/meninggi mengikuti berapa pun jumlah
  // kolom/baris atau nilai Cm yang diisi admin. Sebagai gantinya, kotak pratinjau itu sendiri
  // yang mengecil secara proporsional layaknya thumbnail pratinjau cetak, sambil tetap
  // mempertahankan rasio lebar:tinggi aslinya.
  const GAP_PX = 5;
  const PREVIEW_AREA_W = 380; // area pratinjau efektif di dalam modal (setelah padding)
  const PREVIEW_AREA_H = 140;
  const naturalGridW = cols * naturalBoxW + (cols - 1) * GAP_PX;
  const naturalGridH = rows * naturalBoxH + (rows - 1) * GAP_PX;
  const scale = Math.min(
    1,
    PREVIEW_AREA_W / naturalGridW,
    PREVIEW_AREA_H / naturalGridH,
  );
  const boxW = Math.max(3, Math.round(naturalBoxW * scale));
  const boxH = Math.max(3, Math.round(naturalBoxH * scale));
  const gapPx = Math.max(1, Math.round(GAP_PX * scale));

  const boxClass = isCustomSize
    ? "print-layout-preview-box custom-size"
    : orientation === "landscape"
      ? "print-layout-preview-box landscape"
      : "print-layout-preview-box";
  const boxStyle = ` style="width:${boxW}px; height:${boxH}px;"`;

  grid.style.gap = `${gapPx}px`;
  grid.style.gridTemplateColumns = `repeat(${cols}, ${boxW}px)`;
  grid.innerHTML = Array.from({ length: cols * rows })
    .map(() => `<div class="${boxClass}"${boxStyle}></div>`)
    .join("");
  if (countLabel) countLabel.innerText = cols * rows;

  if (hintEl) {
    if (isCustomSize) {
      // Lebar area cetak setelah margin 10mm tiap sisi (sinkron dengan
      // window.applyPrintOrientationStyle) untuk kertas A4: Portrait 21cm - 2cm = 19cm,
      // Landscape 29.7cm - 2cm = 27.7cm. Gap antar kartu 14px (.print-grid-fixed di
      // styles.css) dikonversi ke cm (96 CSS px = 25.4mm, jadi 14px ≈ 0.37cm).
      const printableWidthCm = orientation === "landscape" ? 27.7 : 19;
      const GAP_CM = 0.37;
      const totalWidthCm =
        Math.round((cols * widthCm + (cols - 1) * GAP_CM) * 10) / 10;
      const isTooWide = totalWidthCm > printableWidthCm;
      hintEl.className = isTooWide
        ? "text-xs text-center mt-2 font-semibold text-amber-600 dark:text-amber-400"
        : "text-xs text-center mt-2 text-slate-400 dark:text-slate-500";
      const idText = isTooWide
        ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Total lebar ${cols} kolom × ${widthCm}cm ≈ ${totalWidthCm}cm, melebihi lebar cetak kertas A4 (±${printableWidthCm}cm). Kurangi jumlah kolom atau lebar kartu.`
        : `Ukuran kartu ${widthCm}cm × ${heightCm}cm (total lebar ±${totalWidthCm}cm untuk ${cols} kolom).`;
      const enText = isTooWide
        ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Total width of ${cols} column(s) × ${widthCm}cm ≈ ${totalWidthCm}cm exceeds A4 printable width (±${printableWidthCm}cm). Reduce the column count or card width.`
        : `Card size ${widthCm}cm × ${heightCm}cm (total width ±${totalWidthCm}cm for ${cols} column(s)).`;
      hintEl.innerHTML = window.currentLang === "id" ? idText : enText;
    } else {
      // Acuan kertas A4 dengan margin cetak 10mm di tiap sisi (sinkron dengan
      // window.applyPrintOrientationStyle) — 96 CSS px setara persis 25.4mm, jadi perhitungan
      // ini berlaku untuk kertas ukuran apapun yang dipakai, bukan hanya di layar.
      const GAP_PX = 14; // sinkron dengan gap pada .print-grid-fixed di styles.css
      const printableWidthPx = orientation === "landscape" ? 1047 : 718;
      const estWidth = Math.max(
        1,
        Math.floor((printableWidthPx - (cols - 1) * GAP_PX) / cols),
      );
      const estMm = Math.round(estWidth * 0.2646);
      const isTooSmall = estWidth < 130;
      hintEl.className = isTooSmall
        ? "text-xs text-center mt-2 font-semibold text-amber-600 dark:text-amber-400"
        : "text-xs text-center mt-2 text-slate-400 dark:text-slate-500";
      const idText = isTooSmall
        ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Kartu ±${estMm}mm/kolom — QR Code berisiko terlalu kecil untuk dipindai.`
        : `Perkiraan lebar kartu ±${estMm}mm per kolom (acuan kertas A4).`;
      const enText = isTooSmall
        ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Card ±${estMm}mm/column — QR Code may be too small to scan.`
        : `Estimated card width ±${estMm}mm per column (A4 reference).`;
      hintEl.innerHTML = window.currentLang === "id" ? idText : enText;
    }
  }
};

// Menyimpan pengaturan kolom/baris grid cetak (dengan validasi batas wajar) lalu menutup modal.
window.savePrintLayoutSettings = function () {
  const colsInput = document.getElementById("print-layout-columns");
  const rowsInput = document.getElementById("print-layout-rows");
  const cols = Math.min(6, Math.max(1, parseInt(colsInput.value, 10) || 2));
  const rows = Math.min(10, Math.max(1, parseInt(rowsInput.value, 10) || 4));
  colsInput.value = cols;
  rowsInput.value = rows;

  // Validasi & bulatkan nilai Ukuran Kustom (Cm) - 1 desimal, batas wajar 1-30cm (lihat
  // window.getPrintQRSettings untuk alasan batasnya).
  const widthCmInput = document.getElementById("print-layout-width-cm");
  const heightCmInput = document.getElementById("print-layout-height-cm");
  if (widthCmInput)
    widthCmInput.value =
      Math.round(
        Math.min(30, Math.max(1, parseFloat(widthCmInput.value) || 6)) * 10,
      ) / 10;
  if (heightCmInput)
    heightCmInput.value =
      Math.round(
        Math.min(30, Math.max(1, parseFloat(heightCmInput.value) || 9)) * 10,
      ) / 10;

  window.savePrintQRSettings(true);
  window.closeModalAnimated("modal-print-layout");
  window.showToast(window.t("txt_print_layout_saved"), "success");
};

window.setPrintOrientation = function (mode) {
  const hiddenEl = document.getElementById("print-orientation-value");
  if (hiddenEl) hiddenEl.value = mode;
  window.updateOrientationButtonsUI(mode);
  window.savePrintQRSettings();
};

window.updateOrientationButtonsUI = function (mode) {
  const btnP = document.getElementById("btn-orientation-portrait");
  const btnL = document.getElementById("btn-orientation-landscape");
  const hiddenEl = document.getElementById("print-orientation-value");
  if (hiddenEl) hiddenEl.value = mode;
  if (btnP) btnP.classList.toggle("tab-active", mode === "portrait");
  if (btnL) btnL.classList.toggle("tab-active", mode === "landscape");
};

window.applyPrintOrientationStyle = function (orientation) {
  const styleTag = document.getElementById("dynamic-print-page-style");
  if (styleTag)
    styleTag.textContent = `@page { size: ${orientation}; margin: 10mm; }`;
};

window.buildPrintQRCard = function (guest, evt, qrUrl, settings) {
  const showSeat =
    settings.kursi &&
    evt &&
    evt.needsSeat !== false &&
    guest.kursi &&
    guest.kursi !== "-";
  const eventName = evt
    ? evt.type === "Lain-lain" && evt.typeDetail
      ? `${evt.name} — ${evt.typeDetail}`
      : evt.name
    : "";
  const orientationClass =
    settings.orientation === "landscape" ? " landscape" : "";
  // Logo hanya disisipkan bila pengaturan diaktifkan DAN event yang bersangkutan memang punya logo tersimpan
  const showLogo = settings.showLogo && evt && evt.logo;
  const logoClass = showLogo ? " has-logo" : "";
  const logoImg = showLogo
    ? `<img src="${evt.logo}" class="print-card-logo" alt="Logo Event">`
    : "";
  // Bingkai (border) kartu bisa dimatikan per pengaturan aplikasi — dipakai saat admin mencetak
  // di atas kertas/stiker yang sudah punya desain/bingkai sendiri.
  const frameClass = settings.frame === false ? " no-frame" : "";
  // Ukuran Kustom (Cm): kalau diaktifkan lewat modal "Atur Layout Grid Cetak", kartu memakai
  // lebar & tinggi PASTI dalam cm (bukan lagi lebar baku 260px/400px atau fluid 100% kolom
  // grid) — berlaku untuk Cetak Satuan (printSingleQR) maupun Cetak Terpilih (printSelectedQR)
  // supaya ukuran fisik kartu tetap konsisten di kedua mode. overflow:hidden mencegah konten
  // yang lebih panjang dari tinggi kartu membocor keluar & merusak kerapian grid saat dicetak.
  const customSizeStyle =
    settings.customSize && settings.cardWidthCm && settings.cardHeightCm
      ? ` style="width:${settings.cardWidthCm}cm; height:${settings.cardHeightCm}cm; overflow:hidden;"`
      : "";

  return `
                <div class="print-qr-card${orientationClass}${logoClass}${frameClass}"${customSizeStyle}>
                    ${logoImg}
                    ${settings.eventName !== false && eventName ? `<p class="print-card-event">${eventName}</p>` : ""}
                    <div class="print-card-body">
                        <img src="${qrUrl}" class="print-card-qr">
                        <div class="print-card-info">
                            ${settings.nama ? `<p class="print-card-name">${guest.nama}</p>` : ""}
                            ${settings.rs ? `<p class="print-card-rs">${guest.rs}</p>` : ""}
                            ${settings.jabatan && guest.jabatan && guest.jabatan !== "-" ? `<p class="print-card-jabatan">${guest.jabatan}</p>` : ""}
                            ${showSeat ? `<p class="print-card-kursi">${guest.kursi}</p>` : ""}
                            ${settings.id ? `<p class="print-card-id">${guest.id}</p>` : ""}
                        </div>
                    </div>
                </div>`;
};

window.printSingleQR = async function (id) {
  const g = window.guests.find((x) => x.id === id);
  if (!g) return;
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  window.showToast(window.t("txt_print_preparing"), "info");
  const qrUrl = await window.createQRCanvas(g.id);
  const settings = window.getPrintQRSettings();
  window.applyPrintOrientationStyle(settings.orientation);
  const area = document.getElementById("print-area");
  area.innerHTML = `<div class="print-single-wrap">${window.buildPrintQRCard(g, evt, qrUrl, settings)}</div>`;
  await waitForImagesReady(area);
  window.print();
};

// Logika inti cetak kartu QR peserta (build kartu per-batch, susun jadi halaman grid sesuai
// Layout Cetak tersimpan, lalu window.print()) - dipakai oleh Cetak Terpilih (peserta yang
// dicentang admin di tabel Data Peserta, termasuk saat "Pilih Semua" dicentang untuk mencetak
// seluruh peserta). Dipisah jadi fungsi sendiri supaya perbaikan cukup dilakukan di satu tempat.
async function buildAndPrintGuestQRCards(guestsList, progressTitle) {
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  const settings = window.getPrintQRSettings();
  window.applyPrintOrientationStyle(settings.orientation);
  window.showProgressModal(
    progressTitle,
    window.currentLang === "id"
      ? "Menyiapkan label cetak QR..."
      : "Preparing QR print labels...",
  );
  const area = document.getElementById("print-area");
  // Dibuat berbarengan dalam batch kecil (bukan satu per satu secara berurutan) — lihat
  // processInChunks di atas. Urutan hasil tetap dijaga sesuai urutan guestsList yang diberikan.
  const cards = await processInChunks(
    guestsList,
    async (g) => {
      const qrUrl = await window.createQRCanvas(g.id);
      return window.buildPrintQRCard(g, evt, qrUrl, settings);
    },
    (done, t) => window.updateProgressModal(done, t),
  );

  // Bagi kartu menjadi beberapa "halaman" sesuai kolom x baris yang diatur admin lewat modal
  // Atur Layout Grid Cetak — supaya hasil cetak fisik benar-benar mengikuti grid yang diinginkan,
  // bukan sekadar reflow otomatis mengikuti lebar kertas seperti sebelumnya.
  const perPage = Math.max(1, settings.columns * settings.rows);
  // Kalau Ukuran Kustom (Cm) aktif, lebar kolom & tinggi baris grid memakai nilai Cm PASTI
  // (bukan lagi 1fr fluid) supaya kartu benar-benar tercetak sesuai ukuran fisik yang diatur
  // admin - lihat window.buildPrintQRCard yang juga menetapkan lebar/tinggi cm yang sama pada
  // tiap kartunya.
  const gridStyle =
    settings.customSize && settings.cardWidthCm && settings.cardHeightCm
      ? `grid-template-columns: repeat(${settings.columns}, ${settings.cardWidthCm}cm); grid-auto-rows: ${settings.cardHeightCm}cm;`
      : `grid-template-columns: repeat(${settings.columns}, 1fr);`;
  let pagesHtml = "";
  for (let p = 0; p < cards.length; p += perPage) {
    const chunk = cards.slice(p, p + perPage);
    const isLastPage = p + perPage >= cards.length;
    pagesHtml += `<div class="print-grid-wrap print-grid-fixed${isLastPage ? "" : " print-page-break"}" style="${gridStyle}">${chunk.join("")}</div>`;
  }
  area.innerHTML = pagesHtml;
  window.hideProgressModal();
  await waitForImagesReady(area);
  window.print();
}

// Cetak Terpilih: mencetak peserta yang dicentang admin di tabel Data Peserta (lihat
// window.toggleGuestSelection/window.selectedGuestIds) - berguna saat hanya sebagian peserta
// yang perlu dicetak ulang kartu QR-nya (mis. salah tercetak, ganti data, atau kloter tertentu).
// Untuk mencetak SEMUA peserta, admin tinggal centang "Pilih Semua" lalu klik tombol ini.
window.printSelectedQR = async function () {
  const selected = window.guests.filter((g) =>
    window.selectedGuestIds.has(g.id),
  );
  if (selected.length === 0)
    return window.showToast(
      window.currentLang === "id"
        ? "Belum ada peserta yang dipilih untuk dicetak!"
        : "No participants selected to print yet!",
      "error",
    );
  await buildAndPrintGuestQRCards(selected, window.t("btn_print_selected"));
};

window.addEventListener("afterprint", () => {
  const area = document.getElementById("print-area");
  if (area) area.innerHTML = "";
});

// ===== Dark Mode =====
window.toggleDarkMode = function (enabled) {
  document.documentElement.classList.toggle("dark", enabled);
  LS.setSetting("dark_mode", enabled ? "1" : "0");
  const toggleEl = document.getElementById("dark-mode-toggle");
  if (toggleEl) toggleEl.checked = enabled;
  // Re-render chart dashboard agar warna sumbu/legend ikut menyesuaikan tema secara langsung
  if (
    window.appState.currentEventId &&
    document
      .getElementById("tab-content-dashboard")
      ?.classList.contains("active")
  ) {
    window.renderDashboard();
  }
};

window.applyDarkModeSetting = function () {
  const enabled = LS.getSetting("dark_mode") === "1";
  document.documentElement.classList.toggle("dark", enabled);
  const toggleEl = document.getElementById("dark-mode-toggle");
  if (toggleEl) toggleEl.checked = enabled;
};

window.exportExcel = function (type) {
  if (window.guests.length === 0)
    return window.showToast("Tidak ada data!", "error");
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  const sourceGuests =
    type === "all" ? window.guests : window.guests.filter((g) => g.scanned);

  // Peringatan bila ada Quest ID yang dipakai lebih dari satu peserta pada data yang akan
  // di-export. Secara normal ID digenerate acak sehingga nyaris mustahil bentrok, tapi tetap
  // diperiksa sebagai pengaman data (mis. hasil restore backup yang tergabung, atau data yang
  // diedit manual) — supaya admin tahu sebelum mengandalkan file Excel untuk pencocokan data.
  const idCounts = {};
  sourceGuests.forEach((g) => {
    idCounts[g.id] = (idCounts[g.id] || 0) + 1;
  });
  const duplicateIds = Object.keys(idCounts).filter((id) => idCounts[id] > 1);

  if (duplicateIds.length > 0) {
    const shownList =
      duplicateIds.slice(0, 5).join(", ") +
      (duplicateIds.length > 5 ? ", ..." : "");
    window.openConfirmCustom(
      window.t("modal_dup_id_title"),
      window.currentLang === "id"
        ? `Ditemukan ${duplicateIds.length} Quest ID yang dipakai lebih dari satu peserta: ${shownList}. Ini bisa menyebabkan salah pencocokan data saat file dibuka di Excel. Tetap lanjutkan export?`
        : `Found ${duplicateIds.length} Quest ID(s) shared by more than one participant: ${shownList}. This may cause mismatched data when the file is opened in Excel. Continue exporting anyway?`,
      () => window.processExportExcel(type, sourceGuests, evt),
    );
    return;
  }
  window.processExportExcel(type, sourceGuests, evt);
};

// Logika export yang sesungguhnya, dipisah dari window.exportExcel supaya bisa dipanggil
// langsung (tanpa duplikat Quest ID) maupun setelah admin mengonfirmasi peringatan duplikat.
window.processExportExcel = function (type, sourceGuests, evt) {
  const seatColLabel =
    evt && evt.seatLabelType === "meja" ? "No Meja" : "No Kursi";
  let data = sourceGuests.map((g, i) => {
    let row = {
      No: i + 1,
      "Quest ID": g.id,
      "Nama Lengkap": g.nama,
      "Asal RS": g.rs,
      Jabatan: g.jabatan,
    };
    if (evt && evt.needsSeat !== false) {
      row[seatColLabel] = g.kursi;
    }
    if (evt && evt.needsHotel) {
      row["No Kamar"] = g.kamar || "-";
      if (type === "all")
        row["Kunci"] = g.kunciDiambil ? "Sudah Diambil" : "Belum";
    }
    if (type === "all") row["Status"] = g.scanned ? "Hadir" : "Belum";
    row["Waktu Absen"] = g.scanTime || "-";
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(
    wb,
    type === "all" ? "List_Seluruh_Peserta.xlsx" : "Daftar_Hadir.xlsx",
  );
};

window.downloadTemplate = function () {
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  const seatColLabel =
    evt && evt.seatLabelType === "meja" ? "No Meja" : "No Kursi";
  const row = {
    "Nama Lengkap": "Dr. Andini",
    "Asal RS": "RS Bunda",
    Jabatan: "Spesialis Anak",
  };
  if (!evt || evt.needsSeat !== false) row[seatColLabel] = "VVIP-1";
  if (evt && evt.needsHotel) row["No Kamar"] = "201";
  const data = [row];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template_Import");
  XLSX.writeFile(wb, "Template_Import_Peserta.xlsx");
};

window.handleImportExcel = function (event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  const evt = LS.getEvents().find(
    (e) => e.id === window.appState.currentEventId,
  );
  reader.onload = async function (e) {
    // BUG FIX: sebelumnya parsing XLSX di sini tidak dibungkus try/catch - kalau file yang
    // diupload rusak, bukan format Excel/CSV yang valid, atau terkunci password, XLSX.read()
    // akan throw di dalam callback async ini (unhandled rejection) sehingga aplikasi terlihat
    // "diam saja" tanpa pesan apa pun ke admin. Sekarang errornya ditangkap & ditampilkan lewat
    // toast, dan input file selalu direset supaya admin bisa langsung mencoba file lain.
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const jsonData = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
      );
      if (jsonData.length === 0) {
        window.showToast("Format Excel salah.", "error");
        event.target.value = "";
        return;
      }

      // Saring baris valid LEBIH DULU (sebelum ditanya gabung/timpa) supaya jumlah yang
      // ditampilkan di modal pilihan benar-benar akurat, bukan sekadar total baris mentah file.
      const validRows = jsonData.filter(
        (row) => row["Nama Lengkap"] && row["Asal RS"],
      );
      if (validRows.length === 0) {
        window.showToast("Format Excel salah.", "error");
        event.target.value = "";
        return;
      }

      const resetInput = () => {
        event.target.value = "";
      };

      if (window.guests.length > 0) {
        // Hitung berapa baris di file yang BENAR-BENAR peserta baru (belum ada di data
        // lama, dan belum muncul berulang di dalam file itu sendiri), sekaligus kumpulkan
        // detail baris yang terdeteksi duplikat (nama, asal RS, & Quest ID lama kalau
        // cocok dengan data yang sudah ada) supaya bisa ditampilkan ke admin lewat tombol
        // "Lihat Data" di modal. Baris duplikat TIDAK dicantumkan/diakumulasikan ke angka
        // "Data Baru" maupun "Jika Gabung" - supaya Sudah Ada + Data Baru selalu = Jika Gabung.
        const seenKeys = new Set(
          window.guests.map((g) => window.guestMatchKey(g.nama, g.rs)),
        );
        const existingByKey = {};
        window.guests.forEach((g) => {
          const k = window.guestMatchKey(g.nama, g.rs);
          if (!existingByKey[k]) existingByKey[k] = g;
        });
        let uniqueNewCount = 0;
        const duplicateRows = [];
        validRows.forEach((row) => {
          const key = window.guestMatchKey(row["Nama Lengkap"], row["Asal RS"]);
          if (seenKeys.has(key)) {
            duplicateRows.push({
              nama: row["Nama Lengkap"],
              rs: row["Asal RS"],
              // null berarti duplikat di dalam file itu sendiri (bukan data lama)
              questId: existingByKey[key] ? existingByKey[key].id : null,
            });
          } else {
            seenKeys.add(key);
            uniqueNewCount++;
          }
        });

        // Event ini sudah punya data peserta -> tanyakan dulu mau digabung atau dihapus & diganti.
        window.openImportModeModal(
          uniqueNewCount,
          window.guests.length,
          window.guests.length + uniqueNewCount,
          duplicateRows,
          (mode) => {
            window.processExcelImport(validRows, evt, mode);
            resetInput();
          },
          resetInput,
        );
      } else {
        // Belum ada data sama sekali di event ini -> tidak ada yang bisa "ditimpa", langsung proses.
        window.processExcelImport(validRows, evt, "merge");
        resetInput();
      }
    } catch (err) {
      console.error("Gagal membaca/memproses file Excel:", err);
      window.showToast(
        window.currentLang === "id"
          ? "File Excel tidak bisa dibaca - pastikan formatnya .xlsx/.xls/.csv yang valid dan tidak terkunci password."
          : "Could not read the Excel file - make sure it is a valid, non password-protected .xlsx/.xls/.csv file.",
        "error",
      );
      event.target.value = "";
    }
  };
  reader.onerror = function () {
    console.error("FileReader gagal membaca file Excel:", reader.error);
    window.showToast(
      window.currentLang === "id"
        ? "Gagal membaca file! Coba lagi atau gunakan file lain."
        : "Failed to read the file! Please try again or use a different file.",
      "error",
    );
    event.target.value = "";
  };
  reader.readAsArrayBuffer(file);
};

// Menampilkan modal pilihan mode import dengan ringkasan angka (sudah ada / data baru / jika digabung).
// newCount & mergeTotal dihitung terpisah oleh pemanggil (sudah memperhitungkan dedup peserta
// yang sama) supaya kedua angka itu akurat - bukan sekadar existingCount + total baris file
// mentah. duplicateRows (array, opsional) berisi detail baris yang terdeteksi duplikat -
// ditampilkan sebagai catatan info + bisa dibuka lewat tombol "Lihat Data"; murni informasi,
// tidak ikut dihitung ke angka manapun.
window.openImportModeModal = function (
  newCount,
  existingCount,
  mergeTotal,
  duplicateRows,
  onChoose,
  onCancel,
) {
  const elExisting = document.getElementById("import-mode-existing-count");
  const elNew = document.getElementById("import-mode-new-count");
  const elTotal = document.getElementById("import-mode-total-count");
  const wrapEl = document.getElementById("import-mode-duplicate-wrap");
  const noteEl = document.getElementById("import-mode-duplicate-note");
  const listEl = document.getElementById("import-mode-duplicate-list");
  const toggleBtn = document.getElementById("import-mode-duplicate-toggle-btn");
  if (elExisting) elExisting.innerText = existingCount;
  if (elNew) elNew.innerText = newCount;
  if (elTotal) elTotal.innerText = mergeTotal;

  window.importModeDuplicateRows = duplicateRows || [];
  const dupCount = window.importModeDuplicateRows.length;
  if (wrapEl) {
    if (dupCount > 0) {
      wrapEl.classList.remove("hidden");
      if (noteEl)
        noteEl.innerText =
          window.currentLang === "id"
            ? `${dupCount} data di file sudah sama dengan data yang ada (nama & asal RS sama) dan tidak akan ditambahkan lagi.`
            : `${dupCount} row(s) in the file already match existing data (same name & hospital) and will not be added again.`;
    } else {
      wrapEl.classList.add("hidden");
    }
  }
  // Reset daftar duplikat ke kondisi tertutup setiap modal ini dibuka, supaya tidak
  // "nyangkut" terbuka dari sesi import sebelumnya.
  if (listEl) {
    listEl.classList.add("hidden");
    listEl.innerHTML = "";
  }
  if (toggleBtn)
    toggleBtn.innerText =
      window.currentLang === "id" ? "Lihat Data" : "View Data";

  window.importModeChooseCallback = onChoose;
  window.importModeCancelCallback = onCancel;
  window.openModalAnimated("modal-import-mode");
};

// Buka/tutup daftar rinci baris file yang terdeteksi duplikat (dipanggil dari tombol
// "Lihat Data" / "Sembunyikan" di modal-import-mode).
window.toggleImportDuplicateList = function () {
  const listEl = document.getElementById("import-mode-duplicate-list");
  const toggleBtn = document.getElementById("import-mode-duplicate-toggle-btn");
  if (!listEl) return;
  const willShow = listEl.classList.contains("hidden");
  if (willShow) {
    window.renderImportDuplicateList();
    listEl.classList.remove("hidden");
    if (toggleBtn)
      toggleBtn.innerText =
        window.currentLang === "id" ? "Sembunyikan" : "Hide";
  } else {
    listEl.classList.add("hidden");
    if (toggleBtn)
      toggleBtn.innerText =
        window.currentLang === "id" ? "Lihat Data" : "View Data";
  }
};

// Merender isi daftar duplikat (nama, asal RS, & Quest ID lama kalau memang cocok dengan
// data yang sudah ada - null/kosong berarti duplikat tsb hasil dobel di dalam file itu
// sendiri, bukan dari data lama) supaya admin bisa mengecek manual data mana saja yang
// dimaksud sebelum memutuskan mode import.
window.renderImportDuplicateList = function () {
  const listEl = document.getElementById("import-mode-duplicate-list");
  if (!listEl) return;
  const rows = window.importModeDuplicateRows || [];
  if (rows.length === 0) {
    listEl.innerHTML = "";
    return;
  }
  listEl.innerHTML = rows
    .map(
      (r) => `
                <div class="px-3 py-2 flex items-center justify-between gap-3 text-[12px]">
                    <div class="min-w-0">
                        <p class="font-semibold text-slate-700 dark:text-slate-200 truncate">${r.nama}</p>
                        <p class="text-slate-400 dark:text-slate-500 truncate">${r.rs}</p>
                    </div>
                    <span class="shrink-0 font-mono text-[10px] text-slate-400 dark:text-slate-500">${r.questId ? r.questId : window.currentLang === "id" ? "Duplikat di file" : "Duplicate in file"}</span>
                </div>
            `,
    )
    .join("");
};

window.cancelImportMode = function () {
  window.closeModalAnimated("modal-import-mode");
  if (typeof window.importModeCancelCallback === "function")
    window.importModeCancelCallback();
  window.importModeChooseCallback = null;
  window.importModeCancelCallback = null;
};

// Dipanggil saat admin memilih salah satu opsi di modal-import-mode.
window.chooseImportMode = function (mode) {
  const chooseCallback = window.importModeChooseCallback;
  const cancelCallback = window.importModeCancelCallback;
  window.closeModalAnimated("modal-import-mode");

  if (mode === "replace") {
    // Tindakan menghapus data lama bersifat permanen & tidak bisa dibatalkan, jadi tetap
    // dimintakan konfirmasi tegas sekali lagi sebelum benar-benar dieksekusi.
    setTimeout(() => {
      window.openConfirmCustom(
        window.currentLang === "id"
          ? "Hapus & Ganti Semua Data?"
          : "Delete & Replace All Data?",
        window.currentLang === "id"
          ? "Tindakan ini akan menghapus PERMANEN seluruh data peserta yang ada saat ini, lalu menggantinya dengan data dari file. Tindakan ini tidak bisa dibatalkan. Lanjutkan?"
          : "This will PERMANENTLY delete all existing participant data, then replace it with the data from the file. This action cannot be undone. Continue?",
        () => {
          if (typeof chooseCallback === "function") chooseCallback("replace");
          window.importModeChooseCallback = null;
          window.importModeCancelCallback = null;
        },
        () => {
          if (typeof cancelCallback === "function") cancelCallback();
          window.importModeChooseCallback = null;
          window.importModeCancelCallback = null;
        },
      );
    }, 350);
  } else {
    if (typeof chooseCallback === "function") chooseCallback("merge");
    window.importModeChooseCallback = null;
    window.importModeCancelCallback = null;
  }
};

// Eksekusi import yang sesungguhnya. mode 'replace' mengosongkan data peserta lama lebih dulu;
// mode 'merge' (default, juga dipakai saat event belum punya data sama sekali) menambahkan
// data baru ke daftar yang sudah ada tanpa menghapus apa pun.
window.processExcelImport = async function (validRows, evt, mode) {
  if (mode === "replace") {
    window.guests = [];
  }
  // Kolom nomor bisa bernama "No Kursi" atau "No Meja" tergantung pilihan seatLabelType
  // event ini — dibaca fleksibel dari keduanya supaya file lama (sebelum fitur ini ada)
  // maupun template baru yang sesuai tetap terbaca dengan benar.
  const seatColLabel = evt.seatLabelType === "meja" ? "No Meja" : "No Kursi";

  window.showProgressModal(
    window.t("btn_import"),
    window.currentLang === "id"
      ? "Memproses data peserta..."
      : "Processing participant data...",
  );
  let c = 0;
  let skipped = 0;
  let duplicateSkipped = 0;
  try {
    for (let idx = 0; idx < validRows.length; idx++) {
      const row = validRows[idx];
      try {
        // Mode gabung: kalau baris ini nama & asal RS-nya sama persis dengan peserta
        // yang sudah ada (termasuk yang baru saja ditambahkan dari baris file
        // sebelumnya di batch import ini - window.guests sudah bertambah tiap
        // iterasi), maka baris ini dianggap "data yang sama" dan TIDAK ditambahkan
        // sebagai entri baru. Quest ID milik entri lama yang sudah ada juga tidak
        // disentuh/di-generate ulang - cukup dilewati & dihitung terpisah dari yang
        // gagal karena error.
        const isDuplicate =
          mode === "merge" &&
          window.guests.some(
            (g) =>
              window.guestMatchKey(g.nama, g.rs) ===
              window.guestMatchKey(row["Nama Lengkap"], row["Asal RS"]),
          );
        if (isDuplicate) {
          duplicateSkipped++;
        } else {
          window.guests.push({
            id: window.generateGuestId(evt.type),
            nama: row["Nama Lengkap"],
            rs: row["Asal RS"],
            jabatan: row["Jabatan"] || "-",
            kursi:
              evt.needsSeat !== false
                ? row[seatColLabel] || row["No Kursi"] || row["No Meja"] || "-"
                : "-",
            kamar: evt.needsHotel ? row["No Kamar"] || "-" : "-",
            kunciDiambil: false,
            pickupScanned: false,
            pickupScanTime: null,
            scanned: false,
            scanTime: null,
            created: Date.now(),
          });
          c++;
        }
      } catch (rowErr) {
        // Satu baris yang bermasalah/tidak terduga TIDAK BOLEH menghentikan proses
        // baris-baris lain yang masih valid - cukup dilewati & dihitung, jumlahnya
        // dilaporkan di toast akhir supaya admin tahu ada yang perlu dicek manual.
        console.error("Baris import dilewati karena error:", rowErr, row);
        skipped++;
      }
      if (idx % 15 === 0 || idx === validRows.length - 1) {
        window.updateProgressModal(idx + 1, validRows.length);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  } finally {
    // finally supaya modal progress TETAP tertutup walau ada error tak terduga yang lolos
    // dari try-catch per baris di atas - jangan sampai layar tersangkut di modal loading.
    window.hideProgressModal();
  }
  if (c > 0) {
    const saved = saveGuests();
    window.renderTable();
    window.renderGenerateSideStats();
    if (saved) {
      let msg =
        mode === "replace"
          ? window.currentLang === "id"
            ? `${c} data peserta berhasil di-import (data lama telah dihapus & diganti).`
            : `${c} participant data imported (old data replaced).`
          : window.currentLang === "id"
            ? `${c} data peserta berhasil di-import (digabung dengan data lama).`
            : `${c} participant data imported and merged with existing data.`;
      if (duplicateSkipped > 0)
        msg +=
          window.currentLang === "id"
            ? ` ${duplicateSkipped} data dilewati karena sudah ada sebelumnya (Quest ID lama tidak berubah).`
            : ` ${duplicateSkipped} rows skipped because they already existed (existing Quest ID kept unchanged).`;
      if (skipped > 0)
        msg +=
          window.currentLang === "id"
            ? ` ${skipped} baris dilewati karena bermasalah.`
            : ` ${skipped} rows skipped due to errors.`;
      window.showToast(msg, "success");
    }
    // Kalau saveGuests() gagal (mis. kuota penuh), safeLocalStorageSet sudah menampilkan
    // toast error-nya sendiri - tidak perlu toast tambahan di sini.
  } else if (duplicateSkipped > 0) {
    // Tidak ada satupun peserta baru ditambahkan karena seluruh baris file ternyata
    // sudah cocok dengan data yang sudah ada - ini BUKAN error format, jadi tidak
    // memakai pesan "Format Excel salah".
    window.showToast(
      window.currentLang === "id"
        ? `Tidak ada data baru ditambahkan - seluruh ${duplicateSkipped} data pada file sudah ada sebelumnya.`
        : `No new data added - all ${duplicateSkipped} rows in the file already existed.`,
      "warning",
    );
  } else window.showToast("Format Excel salah.", "error");
};

// ===== Tanda Tangan Konfirmasi — Kiosk Pengambilan =====
// Mekanisme gambar identik dengan #signature-pad (bukti pengambilan kunci), tapi sengaja
// dipakai canvas & variabel terpisah karena beda konteks/modal.
window.initKioskSignaturePad = function () {
  const canvas = document.getElementById("kiosk-signature-pad");
  if (!canvas) return;
  kioskSigCanvas = canvas;
  kioskSigCtx = canvas.getContext("2d");
  isKioskSigCanvasEmpty = true;

  let isDrawing = false;
  let lastX = 0,
    lastY = 0;

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [clientX - rect.left, clientY - rect.top];
  }

  function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    isKioskSigCanvasEmpty = false;
    [lastX, lastY] = getCoords(e);
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const [x, y] = getCoords(e);
    kioskSigCtx.beginPath();
    kioskSigCtx.moveTo(lastX, lastY);
    kioskSigCtx.lineTo(x, y);
    kioskSigCtx.strokeStyle = "#1e293b"; // slate-800
    kioskSigCtx.lineWidth = 2.5;
    kioskSigCtx.lineCap = "round";
    kioskSigCtx.lineJoin = "round";
    kioskSigCtx.stroke();
    [lastX, lastY] = [x, y];
  }

  function stopDraw(e) {
    e.preventDefault();
    isDrawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseout", stopDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDraw, { passive: false });
};

window.clearKioskSignature = function () {
  if (kioskSigCanvas && kioskSigCtx) {
    kioskSigCtx.clearRect(0, 0, kioskSigCanvas.width, kioskSigCanvas.height);
    isKioskSigCanvasEmpty = true;
  }
};

// Membuka modal tanda tangan begitu QR peserta terbaca di Kiosk Pengambilan. Data peserta
// disimpan sementara (pendingKioskPickupGuest/Evt) untuk dipakai setelah tanda tangan
// dikonfirmasi — lihat window.confirmKioskSignature.
window.openKioskPickupSignature = function (guest, evt) {
  window.playKioskBeep("success"); // konfirmasi audio langsung begitu QR terbaca
  pendingKioskPickupGuest = guest;
  pendingKioskPickupEvt = evt;
  document.getElementById("kiosk-sig-guest-name").innerText = guest.nama;
  window.openModalAnimated("modal-kiosk-signature");
  setTimeout(() => {
    if (!kioskSigCanvas) window.initKioskSignaturePad();
    else window.clearKioskSignature();
  }, 150);
};

// Batal menandatangani: tutup modal & kembalikan kiosk ke mode scan (kamera di-resume),
// TANPA menampilkan Nomor Khusus/Unik peserta.
window.cancelKioskSignature = function () {
  window.closeModalAnimated("modal-kiosk-signature");
  pendingKioskPickupGuest = null;
  pendingKioskPickupEvt = null;
  window.resetKioskToScan();
};

window.confirmKioskSignature = function () {
  if (isKioskSigCanvasEmpty)
    return window.showToast("Tanda tangan belum diisi!", "error");
  window.closeModalAnimated("modal-kiosk-signature");
  const guest = pendingKioskPickupGuest,
    evt = pendingKioskPickupEvt;
  pendingKioskPickupGuest = null;
  pendingKioskPickupEvt = null;

  // Baru ditandai "sudah discan" (guest.pickupScanned/pickupScanTime) DI SINI, setelah
  // tanda tangan benar-benar dikonfirmasi - lihat catatan di window.onKioskScanSuccess.
  // saveGuests() dipanggil manual di sini (bukan cuma mengandalkan
  // window.markKeyPickupFromKiosk di bawah) karena fungsi itu langsung return tanpa
  // menyimpan apa pun kalau event ini tidak butuh data hotel.
  guest.pickupScanned = true;
  guest.pickupScanTime = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  saveGuests();

  // Checkbox "Kunci Diambil" sudah tercentang otomatis sejak QR berhasil discan (lihat
  // window.onKioskScanSuccess) - di sini tanda tangan yang baru saja dibuat hanya
  // melengkapi buktinya (kunciSignature) supaya admin bisa melihat bukti fisiknya.
  const sigData = kioskSigCanvas.toDataURL("image/png");
  window.markKeyPickupFromKiosk(guest, evt, sigData);

  window.showKioskResult("pickup_found", guest, evt);
};

window.initSignaturePad = function () {
  const canvas = document.getElementById("signature-pad");
  if (!canvas) return;
  window.sigCanvas = canvas;
  window.sigCtx = canvas.getContext("2d");
  window.isSigCanvasEmpty = true;

  let isDrawing = false;
  let lastX = 0,
    lastY = 0;

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [clientX - rect.left, clientY - rect.top];
  }

  function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    window.isSigCanvasEmpty = false;
    [lastX, lastY] = getCoords(e);
  }

  function draw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const [x, y] = getCoords(e);
    window.sigCtx.beginPath();
    window.sigCtx.moveTo(lastX, lastY);
    window.sigCtx.lineTo(x, y);
    window.sigCtx.strokeStyle = "#1e293b"; // slate-800
    window.sigCtx.lineWidth = 2.5;
    window.sigCtx.lineCap = "round";
    window.sigCtx.lineJoin = "round";
    window.sigCtx.stroke();
    [lastX, lastY] = [x, y];
  }

  function stopDraw(e) {
    e.preventDefault();
    isDrawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseout", stopDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDraw, { passive: false });
};

window.clearSignature = function () {
  if (window.sigCanvas && window.sigCtx) {
    window.sigCtx.clearRect(
      0,
      0,
      window.sigCanvas.width,
      window.sigCanvas.height,
    );
    window.isSigCanvasEmpty = true;
  }
};

window.cancelSignature = function () {
  if (window.tempCheckboxElement) window.tempCheckboxElement.checked = false;
  window.closeModalAnimated("modal-signature");
};

window.saveSignature = function () {
  const name = document.getElementById("sig-name").value.trim();
  if (!name)
    return window.showToast("Nama pengambil kunci wajib diisi!", "error");
  const requiresSignature = window.currentSigRequiresSignature !== false;
  if (requiresSignature && window.isSigCanvasEmpty)
    return window.showToast("Tanda tangan belum diisi!", "error");

  const sigData = requiresSignature
    ? window.sigCanvas.toDataURL("image/png")
    : null;
  const g = window.guests.find((x) => x.id === window.currentSigGuestId);
  if (g) {
    g.kunciDiambil = true;
    g.kunciDiambilOleh = name;
    g.kunciSignature = sigData;
    // Tandai juga tamu lain yang berbagi kamar & asal RS/instansi yang sama
    const linked = window.findLinkedGuests(g);
    linked.forEach((lg) => {
      lg.kunciDiambil = true;
      lg.kunciDiambilOleh = name;
      lg.kunciSignature = sigData;
    });
    saveGuests();
    window.renderTable();
    window.showToast(
      linked.length > 0
        ? `Bukti pengambilan kunci disimpan untuk ${1 + linked.length} tamu sekamar!`
        : "Bukti pengambilan kunci disimpan!",
      "success",
    );
  }
  window.closeModalAnimated("modal-signature");
};

window.previewSignature = function (guestId) {
  const g = window.guests.find((x) => x.id === guestId);
  if (g && g.kunciDiambil && g.kunciSignature) {
    document.getElementById("preview-sig-name").innerText =
      g.kunciDiambilOleh || "-";
    document.getElementById("preview-sig-img").src = g.kunciSignature || "";
    window.openModalAnimated("modal-preview-signature");
  }
};

window.onload = function () {
  // BUG FIX: listener unhandledrejection duplikat yang tadinya di sini (khusus menyaring error
  // internal Html5QrcodeScanner) sudah digabung ke listener utama di paling atas file - lihat
  // komentar di sana. Didaftarkan di window.onload (belakangan) membuat penyaringannya TIDAK
  // efektif mencegah toast "kesalahan tak terduga" yang sudah keburu tampil duluan.

  window.initSignaturePad();

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
  window.setAuthRole("admin");
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
      console.error(
        "Data sesi login rusak/tidak valid, sesi dihapus & diarahkan ke halaman login.",
        e,
      );
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
  } else switchMainViewAnimated("view-auth");

  // Jam berjalan di header Library Event, diperbarui tiap detik
  window.updateHeaderDateTime();
  setInterval(window.updateHeaderDateTime, 1000);
};
