// EventQ - Version info & changelog
// Extracted from app.js lines 69-410

window.APP_VERSION = '1.21.0';
window.APP_CHANGELOG = [
    {
        version: '1.21.0', date: '2026-09-19',
        changes: {
            id: ['Custom QR Code Generator & Custom Barcode Generator: tambah fitur "Cetak Terpilih" - centang QR/Barcode lewat checkbox baru di tabel (bisa "Pilih Semua" sesuai hasil pencarian aktif), lalu cetak hanya yang dicentang lewat tombol "Cetak Terpilih" yang baru menggantikan tombol "Cetak Semua". Indikator jumlah terpilih & tombol "Batal Pilih" ditampilkan di sebelah judul tabel, persis seperti "Cetak Terpilih" di Data Peserta event. Tombol "Cetak Semua" pada kedua tools ini dihapus karena mencetak semua kini cukup lewat "Pilih Semua" + "Cetak Terpilih".'],
            en: ['Custom QR Code Generator & Custom Barcode Generator: added a "Print Selected" feature - check QR/Barcode items via new checkboxes in the table (with a "Select All" that respects the active search), then print only the checked items via the new "Print Selected" button that replaces "Print All". A selected-count indicator and "Clear Selection" button appear next to the table title, matching "Print Selected" in the event Participant Data. The "Print All" button on both tools was removed since printing everything is now just "Select All" + "Print Selected".']
        }
    },
    {
        version: '1.20.0', date: '2026-09-19',
        changes: {
            id: ['Data Peserta: hapus tombol "Cetak Semua QR" dari Toolbar Data Peserta - fungsinya kini sepenuhnya tercakup oleh "Cetak Terpilih" (centang "Pilih Semua" pada checkbox tabel, lalu klik "Cetak Terpilih" untuk mencetak seluruh peserta). Opsi hak akses "Cetak Semua QR" pada modal Kelola Akses Fitur turut dihapus karena fiturnya sudah tidak ada.'],
            en: ['Participant Data: removed the "Print All QR" button from the Participant Data Toolbar - its function is now fully covered by "Print Selected" (check "Select All" in the table checkboxes, then click "Print Selected" to print every participant). The "Print All QR" permission option in the Manage Feature Access modal was also removed since the feature no longer exists.']
        }
    },
    {
        version: '1.19.0', date: '2026-09-19',
        changes: {
            id: ['Data Peserta: tambah fitur "Cetak Terpilih" - centang beberapa peserta lewat checkbox baru di tabel (bisa "Pilih Semua" sesuai hasil pencarian/filter aktif), lalu cetak kartu QR hanya untuk peserta yang dicentang lewat tombol "Cetak Terpilih" baru di sebelah "Cetak Semua QR". Indikator jumlah terpilih & tombol "Batal Pilih" ditampilkan di sebelah judul tabel, dan hasil cetaknya tetap mengikuti Pengaturan Cetak QR (orientasi, layout grid, bingkai, dsb.) yang sama seperti Cetak Semua QR.'],
            en: ['Participant Data: added a "Print Selected" feature - check several participants via new checkboxes in the table (with a "Select All" that respects the active search/filter), then print QR cards for only the checked participants via the new "Print Selected" button next to "Print All QR". A selected-count indicator and "Clear Selection" button appear next to the table title, and the print output still follows the same Print QR Settings (orientation, grid layout, frame, etc.) as Print All QR.']
        }
    },
    {
        version: '1.18.0', date: '2026-09-18',
        changes: {
            id: ['Custom QR Code Generator & Custom Barcode Generator: tambah tombol "Pengaturan Cetak" (ikon slider) di sebelah tombol "Cetak Semua" - berisi checkbox untuk menyalakan/mematikan apa saja yang ikut tercetak di kartu (Judul Tools, Nama, Konten/Nilai) dan switch Bingkai Kartu Cetak, mirip pengaturan cetak QR Code peserta tapi disederhanakan khusus untuk kedua tools mandiri ini. Berlaku untuk cetak satuan maupun Cetak Semua, dan diatur terpisah antara QR Code Kustom & Barcode Kustom.'],
            en: ['Custom QR Code Generator & Custom Barcode Generator: added a "Print Settings" button (slider icon) next to the "Print All" button - contains checkboxes to turn what gets printed on each card on/off (Tool Title, Name, Content/Value) plus a Print Card Frame switch, similar to the participant QR print settings but simplified for these two standalone tools. Applies to both single print and Print All, and is configured separately for Custom QR Code & Custom Barcode.']
        }
    },
    {
        version: '1.17.1', date: '2026-09-13',
        changes: {
            id: ['Perbaikan Bug: logo event terkadang tidak ikut tercetak pada sebagian kartu QR saat mencetak ke printer fisik (walau tampak normal di preview) — penyebabnya proses cetak dipicu sebelum semua gambar (logo & QR Code) selesai dimuat sepenuhnya. Sekarang proses cetak menunggu semua gambar benar-benar siap terlebih dulu. Berlaku untuk semua jenis cetak (QR Peserta, QR Kustom, Barcode Kustom, satuan maupun massal).'],
            en: ["Bug Fix: the event logo sometimes didn't print on some QR cards when printing to a physical printer (despite looking fine in preview) — caused by printing being triggered before all images (logo & QR Code) had fully finished loading. Printing now waits for every image to be fully ready first. Applies to all print types (Participant QR, Custom QR, Custom Barcode, single and bulk)."]
        }
    },
    {
        version: '1.17.0', date: '2026-09-13',
        changes: {
            id: ['Pengaturan Cetak QR Code: tambah checkbox "Jabatan" - kalau diaktifkan, data jabatan peserta ikut tercetak di kartu QR (baik cetak satuan maupun Cetak Semua). Mati secara default.'],
            en: ['QR Code Print Settings: added a "Position" checkbox - when enabled, the participant\'s position/job title is printed on the QR card (both single print and Print All). Off by default.']
        }
    },
    {
        version: '1.16.0', date: '2026-09-13',
        changes: {
            id: ['Event Library: tombol "Duplikat Event" kini menawarkan pilihan - duplikat beserta data peserta (status kehadiran/pengambilan direset) atau duplikat tanpa data peserta. Kalau event asal memang belum punya peserta sama sekali, pilihan tidak ditanyakan - langsung diproses tanpa data.'],
            en: ['Event Library: the "Duplicate Event" button now offers a choice - duplicate with participant data (attendance/pickup status reset) or duplicate without participant data. If the original event has no participants at all, the choice isn\'t asked - it\'s processed without data automatically.']
        }
    },
    {
        version: '1.15.0', date: '2026-09-11',
        changes: {
            id: [
                'Keandalan Data: ID Event & ID Peserta kini dijamin tidak akan pernah kembar/tabrakan satu sama lain (dicek ulang otomatis sebelum dipakai).',
                'Keandalan Data: penyimpanan gagal (mis. penyimpanan browser penuh) kini ditangani dengan pesan peringatan yang jelas, alih-alih gagal secara diam-diam tanpa pemberitahuan - berlaku untuk tambah/edit/import data peserta & duplikat event.',
                'Keandalan Data: import Excel sekarang melewati baris yang bermasalah alih-alih menghentikan seluruh proses import, dengan laporan jumlah baris yang dilewati di akhir.',
                'Ditambahkan jaring pengaman untuk error tak terduga di seluruh aplikasi - menampilkan pesan peringatan alih-alih aplikasi terlihat macet/tidak merespons tanpa penjelasan.'
            ],
            en: [
                'Data Reliability: Event IDs & Participant IDs are now guaranteed never to collide with each other (automatically re-checked before use).',
                'Data Reliability: save failures (e.g. browser storage full) are now handled with a clear warning message instead of failing silently with no notice - covers adding/editing/importing participant data & duplicating events.',
                'Data Reliability: Excel import now skips problematic rows instead of halting the whole import, with a report of how many rows were skipped at the end.',
                'Added an app-wide safety net for unexpected errors - shows a warning message instead of the app appearing stuck/unresponsive with no explanation.'
            ]
        }
    },
    {
        version: '1.14.0', date: '2026-09-11',
        changes: {
            id: ['Event Library: tombol baru "Duplikat Event" di setiap kartu event - membuat event baru dengan seluruh konfigurasi (jenis acara, tanggal, logo, pengaturan kursi/hotel, Nomor Khusus/Unik, kolom disembunyikan) tersalin persis, tanpa ikut membawa data peserta lama. Langsung jadi tanpa modal apa pun - nama diberi akhiran "(Salinan)", tinggal diganti lewat tombol Edit kalau perlu.'],
            en: ['Event Library: new "Duplicate Event" button on every event card - creates a new event with all configuration (event type, date, logo, seat/hotel settings, Special/Unique Numbers, hidden columns) copied exactly, without carrying over old participant data. Created instantly with no modal - named with a "(Copy)" suffix, rename it via the Edit button if needed.']
        }
    },
    {
        version: '1.13.0', date: '2026-09-10',
        changes: {
            id: ['Data Peserta & Daftar Hadir: tambah dropdown "Urutkan" di kedua tabel - bisa mengurutkan berdasarkan Nama, Asal RS/Instansi, atau Jabatan (A-Z maupun Z-A), masing-masing tabel independen satu sama lain.'],
            en: ['Participant Data & Attendance List: added a "Sort by" dropdown to both tables - can now sort by Name, Hospital/Institution, or Position (A-Z or Z-A), independently for each table.']
        }
    },
    {
        version: '1.12.0', date: '2026-09-10',
        changes: {
            id: ['Data Peserta: peringatan otomatis kalau isian Nomor Khusus/Unik (mis. NIK, No. Registrasi) sudah dipakai peserta lain di event yang sama - tampil inline (border amber + pesan di bawah field) begitu diketik di Form Pendaftaran Peserta maupun modal Edit Data Peserta, ditambah konfirmasi sekali lagi saat disimpan. Tidak diblokir otomatis, admin tetap bisa melanjutkan kalau memang disengaja.'],
            en: ['Participant Data: automatic warning if a Special/Unique Number entry (e.g. National ID, Registration No.) is already used by another participant in the same event - shown inline (amber border + message under the field) as it\'s typed in both the Add Participant form and the Edit Participant modal, plus a confirmation prompt again on save. Not auto-blocked - admins can still proceed if it\'s intentional.']
        }
    },
    {
        version: '1.11.0', date: '2026-09-10',
        changes: {
            id: ['Kiosk QR Code Pengambilan: kini memberi peringatan (layar amber + bip & suara peringatan) kalau QR yang sama dipindai lagi setelah Nomor Khusus/Unik-nya pernah tampil sebelumnya, lengkap dengan jam scan pertama - mencegah pengambilan barang/kunci dua kali secara tidak sengaja maupun disengaja. Nomornya tetap ditampilkan (tidak disembunyikan) supaya panitia masih bisa memverifikasi.'],
            en: ['QR Code Pickup Kiosk: now shows a warning (amber screen + warning beep & voice alert) if the same QR is scanned again after its Special/Unique Number has already been shown before, including the first scan time - prevents accidentally or intentionally picking up an item/key twice. The number is still displayed (not hidden) so staff can still verify.']
        }
    },
    {
        version: '1.10.0', date: '2026-09-09',
        changes: {
            id: [
                'Mode Kiosk: jenis kiosk baru "Kiosk Cek Data" - peserta/panitia scan QR hanya untuk menampilkan data diri (Quest ID, asal, jabatan, kursi/meja) apa adanya, tanpa mengubah status kehadiran maupun status pengambilan kunci/tanda tangan sama sekali. Cocok dipakai untuk pengecekan data sewaktu-waktu.',
                'Mode Kiosk: tombol ganti jenis kiosk di header kini membuka daftar ketiga jenis kiosk (Absensi/Pengambilan/Cek Data) sekaligus menandai jenis yang sedang aktif, sebelumnya hanya toggle dua arah antara Kiosk Absensi & Kiosk Pengambilan.'
            ],
            en: [
                'Kiosk Mode: new "Data Check Kiosk" type - participants/staff scan their QR just to display their info (Quest ID, origin, position, seat/table) as-is, without changing attendance or key pickup/signature status at all. Handy for on-the-spot data verification.',
                'Kiosk Mode: the kiosk type switch button in the header now opens the full list of all three kiosk types (Attendance/Pickup/Data Check) and marks which one is currently active, previously it only toggled two-way between Attendance & Pickup Kiosk.'
            ]
        }
    },
    {
        version: '1.9.0', date: '2026-09-07',
        changes: {
            id: ['Perbaikan ikon "Nomor Meja" di Preview QR & kartu Event: sebelumnya memakai ikon tabel data/spreadsheet (fa-table) yang membingungkan, kini diganti ikon meja makan/perjamuan (fa-utensils).'],
            en: ['Fixed the "Table Number" icon on QR Preview & Event cards: previously used a data table/spreadsheet icon (fa-table) which was confusing, now replaced with a dining table icon (fa-utensils).']
        }
    },
    {
        version: '1.8.0', date: '2026-09-07',
        changes: {
            id: ['Kelola Akses Fitur: checkbox izin akses terpisah untuk tombol "Download QR" per peserta di Data Peserta, sebelumnya selalu tampil untuk semua user tanpa bisa dibatasi.'],
            en: ['Feature Access Control: separate permission checkbox for the per-participant "Download QR" button in Participant Data, previously always shown to all users without being restrictable.']
        }
    },
    {
        version: '1.7.0', date: '2026-09-07',
        changes: {
            id: ['Kelola Akses Fitur: checkbox izin akses terpisah untuk "Mode Kiosk", sebelumnya menyatu dengan izin tab Scan Kehadiran - admin kini bisa mengizinkan akses Scan Kehadiran biasa tanpa otomatis membuka akses Mode Kiosk untuk user tersebut, atau sebaliknya.'],
            en: ['Feature Access Control: separate permission checkbox for "Kiosk Mode", previously tied to the Attendance Scan tab permission - admins can now grant regular Attendance Scan access without automatically opening Kiosk Mode access for that user, or vice versa.']
        }
    },
    {
        version: '1.6.0', date: '2026-09-07',
        changes: {
            id: ['Kiosk QR Code Pengambilan: checkbox "Kunci Diambil" di tabel Data Peserta kini otomatis ikut tercentang begitu QR peserta berhasil discan di kios (untuk event yang membutuhkan kunci hotel & peserta punya kamar) - tidak perlu menunggu proses tanda tangan selesai. Jika peserta memang menandatangani, bukti tanda tangannya ikut dilengkapi ke data yang sama.'],
            en: ['Pickup QR Code Kiosk: the "Key Picked Up" checkbox in the Participant Data table is now automatically checked as soon as a participant\'s QR is successfully scanned at the kiosk (for events that require a hotel key and where the participant has a room) - no need to wait for the signature step. If the participant does sign, the signature proof is added to the same record.']
        }
    },
    {
        version: '1.5.0', date: '2026-09-04',
        changes: {
            id: [
                'Pengaturan > Mode Kiosk: toast notifikasi kini muncul saat bahasa suara Text-to-Speech diubah, sebagai konfirmasi visual selain uji coba suara.',
                'Nomor Khusus/Unik Peserta: saat membuat/mengedit event, admin bisa menambahkan jenis nomor unik tambahan (mis. NIK, No. Registrasi) dengan nama & jumlah bebas - otomatis muncul sebagai field di Form Pendaftaran Peserta & modal Edit Data Peserta.'
            ],
            en: [
                'Settings > Kiosk Mode: a toast notification now appears when the Text-to-Speech voice language is changed, as visual confirmation alongside the voice preview.',
                'Custom/Unique Participant Number: when creating/editing an event, admins can add extra unique number types (e.g. National ID, Registration No.) with freely customizable name & count - automatically shown as fields on the Participant Registration Form & Edit Participant modal.'
            ]
        }
    },
    {
        version: '1.4.0', date: '2026-09-03',
        changes: {
            id: ['Pengaturan > Mode Kiosk: switch pilihan bahasa suara Text-to-Speech (Indonesia/English) untuk ucapan sapaan nama peserta, lengkap dengan uji coba suara langsung saat memilih.'],
            en: ['Settings > Kiosk Mode: Text-to-Speech voice language switch (Indonesian/English) for the participant name greeting, with an instant voice preview when selecting.']
        }
    },
    {
        version: '1.3.0', date: '2026-09-01',
        changes: {
            id: ['Mode Kiosk: tombol khusus untuk mengaktifkan/menonaktifkan suara ucapan (Text-to-Speech) nama peserta, terpisah dari tombol suara notifikasi (bip) - operator kiosk kini bisa memilih kombinasi sesuai kebutuhan.'],
            en: ['Kiosk Mode: dedicated button to turn the participant name Text-to-Speech voice on/off, separate from the notification (beep) sound toggle - kiosk operators can now choose the combination that fits their needs.']
        }
    },
    {
        version: '1.2.0', date: '2026-08-28',
        changes: {
            id: ['Local Cross-Tab Sync (BroadcastChannel API): perubahan data peserta, registrasi, dan absensi di satu tab/jendela otomatis memperbarui statistik & tabel di tab/jendela lain secara real-time tanpa perlu refresh - terutama saat Mode Kiosk dijalankan di tab/jendela terpisah dari dashboard admin.'],
            en: ['Local Cross-Tab Sync (BroadcastChannel API): participant, registration, and attendance changes in one tab/window now automatically update stats & tables in other tabs/windows in real time without a refresh - especially useful when Kiosk Mode runs in a separate tab/window from the admin dashboard.']
        }
    },
    {
        version: '1.1.0', date: '2026-08-27',
        changes: {
            id: ['Menambahkan halaman "Tentang Aplikasi" berisi informasi versi dan log pembaruan.', 'Custom QR Code Generator & Custom Barcode Generator dibuat sticky saat scroll.'],
            en: ['Added an "About This App" page showing version info and the update log.', 'Custom QR Code Generator & Custom Barcode Generator headers are now sticky while scrolling.']
        }
    },
    {
        version: '1.0.0', date: '',
        changes: {
            id: ['Manajemen event & peserta (tambah, edit, hapus, impor data).', 'Generator QR Code & Barcode kustom, termasuk cetak label satuan maupun massal.', 'Pemindai QR/Barcode untuk proses check-in peserta.', 'Dashboard statistik kehadiran & asal instansi peserta.', 'Mode gelap (dark mode) di seluruh halaman aplikasi.', 'Dukungan dwibahasa: Indonesia & Inggris.', 'Backup & restore data melalui file JSON.'],
            en: ['Event & participant management (add, edit, delete, import data).', 'Custom QR Code & Barcode generator, including single and bulk label printing.', 'QR/Barcode scanner for participant check-in.', 'Attendance & institution-origin statistics dashboard.', 'Dark mode across the entire application.', 'Bilingual support: Indonesian & English.', 'Backup & restore data via JSON file.']
        }
    }
];

window.renderAppVersionInfo = function() {
    document.querySelectorAll('.app-version-badge').forEach(el => { el.textContent = 'v' + window.APP_VERSION; });
    document.querySelectorAll('.app-version-footer-tag').forEach(el => { el.textContent = `· v${window.APP_VERSION}`; });
    const list = document.getElementById('app-changelog-list');
    if (!list) return;
    list.innerHTML = window.APP_CHANGELOG.map((entry, idx) => {
        const dateLabel = entry.date
            ? new Date(entry.date + 'T00:00:00').toLocaleDateString(window.currentLang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
            : (window.currentLang === 'id' ? 'Rilis awal' : 'Initial release');
        const changesForLang = entry.changes[window.currentLang] || entry.changes.id;
        const changesHtml = changesForLang.map(c => `<li class="flex gap-2"><i class="fa-solid fa-circle text-[4px] mt-2 text-slate-300 dark:text-slate-600 shrink-0"></i><span>${c}</span></li>`).join('');
        const isLast = idx === window.APP_CHANGELOG.length - 1;
        return `
            <div class="${isLast ? '' : 'border-b border-slate-100 dark:border-slate-700 pb-5'}">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">v${entry.version}</span>
                    <span class="text-xs text-slate-400 dark:text-slate-500">${dateLabel}</span>
                </div>
                <ul class="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">${changesHtml}</ul>
            </div>`;
    }).join('');
};