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
window.createQRCanvas = function(text) {
    return new Promise((resolve) => {
        const holder = document.createElement('div');
        try {
            new QRCode(holder, { text: text, width: 400, height: 400, correctLevel: QRCode.CorrectLevel.M, colorDark: "#000000", colorLight: "#ffffff" });
        } catch (e) {
            console.error('Gagal membuat QR Code:', e);
            resolve(''); return;
        }
        requestAnimationFrame(() => {
            const qrCanvas = holder.querySelector('canvas');
            if (qrCanvas) {
                const paddedCanvas = document.createElement('canvas'); const padding = 40;
                paddedCanvas.width = qrCanvas.width + (padding * 2); paddedCanvas.height = qrCanvas.height + (padding * 2);
                const ctx = paddedCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
                ctx.drawImage(qrCanvas, padding, padding);
                resolve(paddedCanvas.toDataURL("image/png"));
            } else {
                const img = holder.querySelector('img'); resolve(img ? img.src : '');
            }
        });
    });
};

// ── Barcode Canvas Generator ────────────────────────────────────────
window.createBarcodeCanvasPNG = function (content, jsBarcodeOptions) {
  const opts = Object.assign(
    { format: "CODE128", width: 2, height: 100, displayValue: true, background: "#ffffff", lineColor: "#000000", margin: 10 },
    jsBarcodeOptions || {}
  );
  return new Promise((resolve, reject) => {
    try {
      const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(tempSvg, content, opts);
      const xml = new XMLSerializer().serializeToString(tempSvg);
      const image64 = "data:image/svg+xml;base64," + btoa(xml);
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = image64;
    } catch (e) { reject(e); }
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
        await Promise.all(chunk.map(async (item, idx) => {
            results[start + idx] = await workerFn(item);
            done++;
            if (onProgress) onProgress(done, items.length);
        }));
    }
    return results;
}

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
    const imgs = Array.from(container.querySelectorAll('img'));
    if (imgs.length === 0) return Promise.resolve();
    const allLoaded = Promise.all(imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    }));
    // Jaring pengaman: kalau entah kenapa ada gambar yang tidak pernah memicu load/error sama
    // sekali (kasus sangat jarang), jangan sampai proses cetak macet menunggu tanpa henti -
    // batas 5 detik cukup longgar untuk gambar base64 yang seharusnya didekode hampir seketika.
    const timeout = new Promise(resolve => setTimeout(resolve, 5000));
    return Promise.race([allLoaded, timeout]);
}

// ===== Pengaturan Cetak untuk Custom QR Code Generator & Custom Barcode Generator =====
// Terpisah dari window.getPrintQRSettings (itu khusus kartu QR peserta event, dengan field
// sebanyak nama/id/rs/jabatan/kursi/logo). Di sini kartu Custom QR & Custom Barcode tidak
// terikat data peserta, jadi cukup 3 checkbox (Judul Tools, Nama, Konten/Nilai) + switch
// Bingkai. Disimpan dengan key terpisah per tool (type 'qr' / 'barcode') supaya preferensi
// cetak QR Kustom & Barcode Kustom bisa diatur berbeda satu sama lain.
window.getPrintCustomSettings = function(type) {
    const key = type === 'barcode' ? 'print_custom_barcode_fields' : 'print_custom_qr_fields';
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
            frame: parsed.frame !== false
        };
    } catch (e) { return DEFAULTS; }
};

window.saveCustomPrintFieldSetting = function(type, field, value) {
    const s = window.getPrintCustomSettings(type);
    s[field] = value;
    const key = type === 'barcode' ? 'print_custom_barcode_fields' : 'print_custom_qr_fields';
    LS.setSetting(key, JSON.stringify(s));
};

// Popover pengaturan cetak, dirender sebagai portal ke document.body (posisi fixed) supaya
// tidak terpotong area sekitarnya & menutup otomatis saat klik di luar/scroll — pola yang
// sama dengan window.toggleGuestActionMenu di atas.
window.togglePrintCustomSettingsMenu = function(type, btnEl) {
    const existing = document.getElementById('print-custom-settings-menu');
    const wasOpenForThis = existing && existing.dataset.type === type;
    window.closePrintCustomSettingsMenu();
    if (wasOpenForThis) return;

    const s = window.getPrintCustomSettings(type);
    const menu = document.createElement('div');
    menu.id = 'print-custom-settings-menu';
    menu.dataset.type = type;
    menu.className = 'fixed z-[90] w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4';
    menu.style.animation = 'fadeSlideUp 0.15s ease forwards';

    const checkboxRow = (field, label) => `
        <label class="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors mb-2">
            <input type="checkbox" onchange="window.saveCustomPrintFieldSetting('${type}', '${field}', this.checked)" class="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer" ${s[field] ? 'checked' : ''}>
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${label}</span>
        </label>`;

    menu.innerHTML = `
        <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><i class="fa-solid fa-print text-[10px]"></i> ${window.t('lbl_print_custom_settings_title')}</p>
        ${checkboxRow('title', window.t('lbl_print_field_tools_title'))}
        ${checkboxRow('name', window.t('lbl_print_field_name'))}
        ${checkboxRow('content', window.t('lbl_print_field_content'))}
        <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${window.t('lbl_print_frame')}</span>
            <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input type="checkbox" onchange="window.saveCustomPrintFieldSetting('${type}', 'frame', this.checked)" class="sr-only peer" ${s.frame ? 'checked' : ''}>
                <div class="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer peer-checked:bg-indigo-600 transition-colors duration-300"></div>
                <span class="absolute left-1 top-1 bg-white dark:bg-slate-800 w-4 h-4 rounded-full shadow-md transition-transform duration-300 peer-checked:translate-x-5"></span>
            </label>
        </div>`;
    document.body.appendChild(menu);

    const rect = btnEl.getBoundingClientRect();
    const menuWidth = 288; // w-72
    let left = rect.right - menuWidth; if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    let top = rect.bottom + 8;
    const menuHeightEstimate = 260;
    if (top + menuHeightEstimate > window.innerHeight - 8) top = Math.max(8, rect.top - menuHeightEstimate - 8);
    menu.style.left = left + 'px'; menu.style.top = top + 'px';

    setTimeout(() => {
        window._closePrintCustomSettingsMenuHandler = function(ev) { if (!menu.contains(ev.target)) window.closePrintCustomSettingsMenu(); };
        document.addEventListener('click', window._closePrintCustomSettingsMenuHandler, true);
        window.addEventListener('scroll', window.closePrintCustomSettingsMenu, { once: true, capture: true });
    }, 0);
};

window.closePrintCustomSettingsMenu = function() {
    const existing = document.getElementById('print-custom-settings-menu');
    if (existing) existing.remove();
    if (window._closePrintCustomSettingsMenuHandler) { document.removeEventListener('click', window._closePrintCustomSettingsMenuHandler, true); window._closePrintCustomSettingsMenuHandler = null; }
};

// ===== Cetak Custom QR Code (satuan & massal) =====
window.buildPrintCustomQRCard = function(qr, qrUrl, settings) {
    const s = settings || window.getPrintCustomSettings('qr');
    // Konten bisa berupa link/teks panjang; dipotong agar tidak merusak tata letak kartu cetak.
    const contentPreview = qr.content.length > 140 ? qr.content.slice(0, 140) + '…' : qr.content;
    const frameClass = s.frame === false ? ' no-frame' : '';
    return `
        <div class="print-qr-card${frameClass}">
            ${s.title !== false ? `<p class="print-card-event">Custom QR Code</p>` : ''}
            <div class="print-card-body">
                <img src="${qrUrl}" class="print-card-qr">
                <div class="print-card-info">
                    ${s.name !== false ? `<p class="print-card-name">${qr.name}</p>` : ''}
                    ${s.content !== false ? `<p class="print-card-desc">${contentPreview}</p>` : ''}
                </div>
            </div>
        </div>`;
};

window.printSingleCustomQR = async function(id) {
    const qr = LS.getCustomQRs().find(q => q.id === id); if (!qr) return;
    window.showToast(window.t('txt_print_preparing'), 'info');
    const settings = window.getPrintCustomSettings('qr');
    const qrUrl = await window.createQRCanvas(qr.content);
    window.applyPrintOrientationStyle('portrait');
    const area = document.getElementById('print-area');
    area.innerHTML = `<div class="print-single-wrap">${window.buildPrintCustomQRCard(qr, qrUrl, settings)}</div>`;
    await waitForImagesReady(area);
    window.print();
};

// Cetak Terpilih: mencetak Custom QR yang dicentang admin di tabel Daftar QR Code (lihat
// window.toggleCustomQRSelection/window.selectedCustomQRIds) - untuk mencetak SEMUA QR, admin
// tinggal centang "Pilih Semua" lalu klik tombol ini. Pola sama dengan window.printSelectedQR
// di Data Peserta event.
window.printSelectedCustomQR = async function() {
    const qrs = LS.getCustomQRs().filter(q => window.selectedCustomQRIds.has(q.id));
    if (qrs.length === 0) return window.showToast(window.currentLang === 'id' ? 'Belum ada QR Code yang dipilih untuk dicetak!' : 'No QR codes selected to print yet!', 'error');
    window.applyPrintOrientationStyle('portrait');
    const settings = window.getPrintCustomSettings('qr');
    window.showProgressModal(window.t('btn_print_selected'), window.currentLang === 'id' ? 'Menyiapkan label cetak QR...' : 'Preparing QR print labels...');
    const area = document.getElementById('print-area');
    // Dibuat berbarengan dalam batch kecil (bukan satu per satu) — lihat processInChunks di atas.
    const cards = await processInChunks(qrs, async (qr) => {
        const qrUrl = await window.createQRCanvas(qr.content);
        return window.buildPrintCustomQRCard(qr, qrUrl, settings);
    }, (done, t) => window.updateProgressModal(done, t));
    area.innerHTML = `<div class="print-grid-wrap">${cards.join('')}</div>`;
    window.hideProgressModal();
    await waitForImagesReady(area);
    window.print();
};

// ===== Cetak Custom Barcode (satuan & massal) =====
window.buildPrintCustomBarcodeCard = function(bc, barcodeUrl, settings) {
    const s = settings || window.getPrintCustomSettings('barcode');
    // Catatan: teks Konten/Nilai untuk Barcode dikendalikan lewat opsi displayValue saat
    // membuat gambar barcode-nya (lihat window.createBarcodeCanvasPNG di pemanggilnya),
    // bukan lewat elemen teks terpisah di sini — supaya tidak dobel dengan teks yang sudah
    // otomatis ditampilkan JsBarcode di bawah garis barcode.
    const frameClass = s.frame === false ? ' no-frame' : '';
    const nameRow = s.name !== false ? `<div class="print-card-info"><p class="print-card-name">${bc.name}</p></div>` : '';
    return `
        <div class="print-qr-card print-card-barcode-wrap${frameClass}">
            ${s.title !== false ? `<p class="print-card-event">Custom Barcode</p>` : ''}
            <div class="print-card-body">
                <img src="${barcodeUrl}" class="print-card-barcode-img">
                ${nameRow}
            </div>
        </div>`;
};

window.printSingleCustomBarcode = async function(id) {
    const bc = LS.getCustomBarcodes().find(b => b.id === id); if (!bc) return;
    window.showToast(window.t('txt_print_preparing'), 'info');
    try {
        const settings = window.getPrintCustomSettings('barcode');
        const barcodeUrl = await window.createBarcodeCanvasPNG(bc.content, { displayValue: settings.content !== false });
        window.applyPrintOrientationStyle('portrait');
        const area = document.getElementById('print-area');
        area.innerHTML = `<div class="print-single-wrap">${window.buildPrintCustomBarcodeCard(bc, barcodeUrl, settings)}</div>`;
        await waitForImagesReady(area);
        window.print();
    } catch (e) { window.showToast('Teks tidak kompatibel untuk dibuat Barcode. Gunakan standar ASCII.', 'error'); }
};

// Cetak Terpilih: mencetak Custom Barcode yang dicentang admin di tabel Daftar Barcode (lihat
// window.toggleCustomBarcodeSelection/window.selectedCustomBarcodeIds) - untuk mencetak SEMUA
// Barcode, admin tinggal centang "Pilih Semua" lalu klik tombol ini. Pola sama dengan
// window.printSelectedQR di Data Peserta event.
window.printSelectedCustomBarcode = async function() {
    const bcs = LS.getCustomBarcodes().filter(b => window.selectedCustomBarcodeIds.has(b.id));
    if (bcs.length === 0) return window.showToast(window.currentLang === 'id' ? 'Belum ada Barcode yang dipilih untuk dicetak!' : 'No barcodes selected to print yet!', 'error');
    window.applyPrintOrientationStyle('portrait');
    const settings = window.getPrintCustomSettings('barcode');
    window.showProgressModal(window.t('btn_print_selected'), window.currentLang === 'id' ? 'Menyiapkan label cetak Barcode...' : 'Preparing Barcode print labels...');
    const area = document.getElementById('print-area');
    let skipped = 0;
    // Dibuat berbarengan dalam batch kecil (bukan satu per satu) — lihat processInChunks di atas.
    const cardsRaw = await processInChunks(bcs, async (bc) => {
        try {
            const barcodeUrl = await window.createBarcodeCanvasPNG(bc.content, { displayValue: settings.content !== false });
            return window.buildPrintCustomBarcodeCard(bc, barcodeUrl, settings);
        } catch (e) { skipped++; return ''; }
    }, (done, t) => window.updateProgressModal(done, t));
    area.innerHTML = `<div class="print-grid-wrap">${cardsRaw.filter(Boolean).join('')}</div>`;
    window.hideProgressModal();
    if (skipped > 0) window.showToast(`${skipped} Barcode dilewati (konten tidak kompatibel)`, 'error');
    await waitForImagesReady(area);
    window.print();
};

// ===== Print QR Code (dengan info tambahan & orientasi yang bisa diatur di Pengaturan) =====
window.getPrintQRSettings = function() {
    const raw = LS.getSetting('print_qr_fields');
    const DEFAULTS = { eventName: true, nama: true, id: true, rs: true, jabatan: false, kursi: true, showLogo: false, frame: true, orientation: 'portrait', columns: 2, rows: 4, customSize: false, cardWidthCm: 6, cardHeightCm: 9 };
    if (!raw) return DEFAULTS;
    try {
        const parsed = JSON.parse(raw);
        // Kolom 1-6, baris 1-10 — batas wajar supaya kartu tidak jadi terlalu kecil untuk dipindai
        // atau justru kepotong karena melebihi tinggi halaman fisik.
        const clamp = (v, def, min, max) => { const n = parseInt(v, 10); return (isNaN(n) || n < min || n > max) ? def : n; };
        // Ukuran Kustom (Cm): 1-30cm — batas wajar untuk label/kartu QR fisik (di bawah 1cm QR
        // sudah pasti tidak bisa dipindai, di atas 30cm sudah tidak lagi wajar disebut "kartu").
        // Dibulatkan 1 desimal supaya nilai seperti 5.5cm tetap didukung tanpa presisi berlebihan.
        const clampFloat = (v, def, min, max) => { const n = parseFloat(v); return (isNaN(n) || n < min || n > max) ? def : Math.round(n * 10) / 10; };
        return {
            // Default nyala — sebelumnya nama/judul event SELALU tercetak tanpa opsi mati, jadi
            // pengguna lama (belum pernah menyimpan pengaturan ini) tetap melihat perilaku yang sama.
            eventName: parsed.eventName !== false,
            nama: parsed.nama !== false, id: parsed.id !== false, rs: parsed.rs !== false, kursi: parsed.kursi !== false,
            jabatan: parsed.jabatan === true, // default mati — field baru bersifat opt-in, sama seperti showLogo
            showLogo: parsed.showLogo === true, // default mati — fitur baru bersifat opt-in
            frame: parsed.frame !== false, // default nyala — bingkai kartu cetak tetap tampil kecuali dimatikan manual
            orientation: parsed.orientation === 'landscape' ? 'landscape' : 'portrait',
            columns: clamp(parsed.columns, 2, 1, 6),
            rows: clamp(parsed.rows, 4, 1, 10),
            // Kalau diaktifkan, kartu QR (cetak satuan maupun massal) memakai lebar & tinggi PASTI
            // dalam cm ini - lihat window.buildPrintQRCard & buildAndPrintGuestQRCards. Default mati —
            // perilaku lama (lebar mengikuti kolom grid/lebar kertas) tetap dipakai kecuali admin
            // sengaja mengaktifkannya lewat modal "Atur Layout Grid Cetak".
            customSize: parsed.customSize === true,
            cardWidthCm: clampFloat(parsed.cardWidthCm, 6, 1, 30),
            cardHeightCm: clampFloat(parsed.cardHeightCm, 9, 1, 30)
        };
    } catch(e) { return DEFAULTS; }
};

window.loadPrintQRSettingsUI = function() {
    const s = window.getPrintQRSettings();
    const elEventName = document.getElementById('print-field-eventname');
    const elNama = document.getElementById('print-field-nama'); const elId = document.getElementById('print-field-id'); const elRs = document.getElementById('print-field-rs'); const elJabatan = document.getElementById('print-field-jabatan'); const elKursi = document.getElementById('print-field-kursi'); const elLogo = document.getElementById('print-field-logo'); const elFrame = document.getElementById('print-field-frame');
    if(elEventName) elEventName.checked = s.eventName;
    if(elNama) elNama.checked = s.nama; if(elId) elId.checked = s.id; if(elRs) elRs.checked = s.rs; if(elJabatan) elJabatan.checked = s.jabatan; if(elKursi) elKursi.checked = s.kursi; if(elLogo) elLogo.checked = s.showLogo; if(elFrame) elFrame.checked = s.frame;
    window.updateOrientationButtonsUI(s.orientation);
    const elCols = document.getElementById('print-layout-columns'); const elRows = document.getElementById('print-layout-rows');
    if (elCols) elCols.value = s.columns; if (elRows) elRows.value = s.rows;
    const elCustomSize = document.getElementById('print-layout-custom-size-toggle');
    const elWidthCm = document.getElementById('print-layout-width-cm'); const elHeightCm = document.getElementById('print-layout-height-cm');
    if (elCustomSize) elCustomSize.checked = s.customSize;
    if (elWidthCm) elWidthCm.value = s.cardWidthCm; if (elHeightCm) elHeightCm.value = s.cardHeightCm;
    const customSizeFields = document.getElementById('print-layout-custom-size-fields');
    if (customSizeFields) customSizeFields.classList.toggle('hidden', !s.customSize);
};

window.savePrintQRSettings = function(silent) {
    const elCols = document.getElementById('print-layout-columns'); const elRows = document.getElementById('print-layout-rows');
    const elFrame = document.getElementById('print-field-frame');
    const elJabatan = document.getElementById('print-field-jabatan');
    const elEventName = document.getElementById('print-field-eventname');
    const elCustomSize = document.getElementById('print-layout-custom-size-toggle');
    const elWidthCm = document.getElementById('print-layout-width-cm'); const elHeightCm = document.getElementById('print-layout-height-cm');
    const settings = {
        eventName: elEventName ? elEventName.checked : true,
        nama: document.getElementById('print-field-nama').checked,
        id: document.getElementById('print-field-id').checked,
        rs: document.getElementById('print-field-rs').checked,
        jabatan: elJabatan ? elJabatan.checked : false,
        kursi: document.getElementById('print-field-kursi').checked,
        showLogo: document.getElementById('print-field-logo').checked,
        frame: elFrame ? elFrame.checked : true,
        orientation: document.getElementById('print-orientation-value').value || 'portrait',
        // Dibaca dari input di modal "Atur Layout Grid Cetak" (tetap ada di DOM walau modalnya
        // sedang tertutup), supaya toggle checkbox lain tidak diam-diam mereset pengaturan grid.
        columns: elCols ? elCols.value : 2,
        rows: elRows ? elRows.value : 4,
        // Ukuran Kustom (Cm) - sama-sama dibaca dari modal "Atur Layout Grid Cetak" walau modalnya
        // sedang tertutup, lihat window.getPrintQRSettings untuk validasi & clamp nilainya.
        customSize: elCustomSize ? elCustomSize.checked : false,
        cardWidthCm: elWidthCm ? elWidthCm.value : 6,
        cardHeightCm: elHeightCm ? elHeightCm.value : 9
    };
    LS.setSetting('print_qr_fields', JSON.stringify(settings));
    if (!silent) window.showToast(window.t('txt_print_saved'), 'success');
};

// Menampilkan modal pengaturan layout grid cetak massal, mengisi ulang nilai kolom/baris
// tersimpan saat ini, dan langsung merender pratinjau visualnya.
window.openPrintLayoutModal = function() {
    const s = window.getPrintQRSettings();
    document.getElementById('print-layout-columns').value = s.columns;
    document.getElementById('print-layout-rows').value = s.rows;
    const elCustomSize = document.getElementById('print-layout-custom-size-toggle');
    const elWidthCm = document.getElementById('print-layout-width-cm'); const elHeightCm = document.getElementById('print-layout-height-cm');
    const customSizeFields = document.getElementById('print-layout-custom-size-fields');
    if (elCustomSize) elCustomSize.checked = s.customSize;
    if (elWidthCm) elWidthCm.value = s.cardWidthCm; if (elHeightCm) elHeightCm.value = s.cardHeightCm;
    if (customSizeFields) customSizeFields.classList.toggle('hidden', !s.customSize);
    window.renderPrintLayoutPreview();
    window.openModalAnimated('modal-print-layout');
};

// Menampilkan/menyembunyikan input Lebar & Tinggi (Cm) saat toggle "Gunakan Ukuran Kustom (Cm)"
// diklik, lalu langsung merender ulang pratinjau supaya efeknya terlihat tanpa perlu simpan dulu.
window.togglePrintCustomSizeUI = function(checked) {
    const fields = document.getElementById('print-layout-custom-size-fields');
    if (fields) fields.classList.toggle('hidden', !checked);
    window.renderPrintLayoutPreview();
};

// Menggambar ulang grid kotak-kotak kecil di modal sesuai jumlah kolom/baris yang sedang diisi,
// supaya admin langsung membayangkan hasil akhirnya tanpa harus mencetak dulu. Bentuk kotak kini
// ikut menyesuaikan orientasi kertas (Portrait/Landscape) yang sedang dipilih, dan di bawahnya
// ditampilkan perkiraan lebar kartu sesungguhnya di atas kertas beserta peringatan bila kombinasi
// kolom yang dipilih berisiko membuat QR Code jadi terlalu kecil untuk dipindai dengan mudah.
window.renderPrintLayoutPreview = function() {
    const colsInput = document.getElementById('print-layout-columns');
    const rowsInput = document.getElementById('print-layout-rows');
    const grid = document.getElementById('print-layout-preview-grid');
    const countLabel = document.getElementById('print-layout-preview-count');
    const hintEl = document.getElementById('print-layout-size-hint');
    if (!colsInput || !rowsInput || !grid) return;

    const cols = Math.min(6, Math.max(1, parseInt(colsInput.value, 10) || 1));
    const rows = Math.min(10, Math.max(1, parseInt(rowsInput.value, 10) || 1));

    const orientation = document.getElementById('print-orientation-value')?.value === 'landscape' ? 'landscape' : 'portrait';

    // Ukuran Kustom (Cm): kalau toggle "Gunakan Ukuran Kustom (Cm)" aktif, kotak pratinjau &
    // keterangan ukuran memakai lebar/tinggi PASTI yang diisi admin (bukan lagi estimasi otomatis
    // mengikuti lebar kertas) — lihat window.togglePrintCustomSizeUI, window.buildPrintQRCard &
    // buildAndPrintGuestQRCards untuk penerapannya di hasil cetak sesungguhnya.
    const customToggle = document.getElementById('print-layout-custom-size-toggle');
    const isCustomSize = !!(customToggle && customToggle.checked);
    const widthCmInput = document.getElementById('print-layout-width-cm');
    const heightCmInput = document.getElementById('print-layout-height-cm');
    const widthCm = Math.min(30, Math.max(1, parseFloat(widthCmInput?.value) || 6));
    const heightCm = Math.min(30, Math.max(1, parseFloat(heightCmInput?.value) || 9));

    // Ukuran kotak pratinjau "alami" (sebelum diskalakan) - mode auto pakai rasio kartu A4
    // standar, Ukuran Kustom (Cm) pakai rasio Cm asli (6px per cm sebagai acuan visual saja).
    const PREVIEW_PX_PER_CM = 6;
    let naturalBoxW, naturalBoxH;
    if (isCustomSize) {
        naturalBoxW = widthCm * PREVIEW_PX_PER_CM;
        naturalBoxH = heightCm * PREVIEW_PX_PER_CM;
    } else {
        naturalBoxW = orientation === 'landscape' ? 42 : 28;
        naturalBoxH = orientation === 'landscape' ? 24 : 34;
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
    const naturalGridW = (cols * naturalBoxW) + ((cols - 1) * GAP_PX);
    const naturalGridH = (rows * naturalBoxH) + ((rows - 1) * GAP_PX);
    const scale = Math.min(1, PREVIEW_AREA_W / naturalGridW, PREVIEW_AREA_H / naturalGridH);
    const boxW = Math.max(3, Math.round(naturalBoxW * scale));
    const boxH = Math.max(3, Math.round(naturalBoxH * scale));
    const gapPx = Math.max(1, Math.round(GAP_PX * scale));

    const boxClass = isCustomSize ? 'print-layout-preview-box custom-size' : (orientation === 'landscape' ? 'print-layout-preview-box landscape' : 'print-layout-preview-box');
    const boxStyle = ` style="width:${boxW}px; height:${boxH}px;"`;

    grid.style.gap = `${gapPx}px`;
    grid.style.gridTemplateColumns = `repeat(${cols}, ${boxW}px)`;
    grid.innerHTML = Array.from({ length: cols * rows }).map(() => `<div class="${boxClass}"${boxStyle}></div>`).join('');
    if (countLabel) countLabel.innerText = cols * rows;

    if (hintEl) {
        if (isCustomSize) {
            // Lebar area cetak setelah margin 10mm tiap sisi (sinkron dengan
            // window.applyPrintOrientationStyle) untuk kertas A4: Portrait 21cm - 2cm = 19cm,
            // Landscape 29.7cm - 2cm = 27.7cm. Gap antar kartu 14px (.print-grid-fixed di
            // styles.css) dikonversi ke cm (96 CSS px = 25.4mm, jadi 14px ≈ 0.37cm).
            const printableWidthCm = orientation === 'landscape' ? 27.7 : 19;
            const GAP_CM = 0.37;
            const totalWidthCm = Math.round(((cols * widthCm) + ((cols - 1) * GAP_CM)) * 10) / 10;
            const isTooWide = totalWidthCm > printableWidthCm;
            hintEl.className = isTooWide
                ? 'text-xs text-center mt-2 font-semibold text-amber-600 dark:text-amber-400'
                : 'text-xs text-center mt-2 text-slate-400 dark:text-slate-500';
            const idText = isTooWide
                ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Total lebar ${cols} kolom × ${widthCm}cm ≈ ${totalWidthCm}cm, melebihi lebar cetak kertas A4 (±${printableWidthCm}cm). Kurangi jumlah kolom atau lebar kartu.`
                : `Ukuran kartu ${widthCm}cm × ${heightCm}cm (total lebar ±${totalWidthCm}cm untuk ${cols} kolom).`;
            const enText = isTooWide
                ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Total width of ${cols} column(s) × ${widthCm}cm ≈ ${totalWidthCm}cm exceeds A4 printable width (±${printableWidthCm}cm). Reduce the column count or card width.`
                : `Card size ${widthCm}cm × ${heightCm}cm (total width ±${totalWidthCm}cm for ${cols} column(s)).`;
            hintEl.innerHTML = window.currentLang === 'id' ? idText : enText;
        } else {
            // Acuan kertas A4 dengan margin cetak 10mm di tiap sisi (sinkron dengan
            // window.applyPrintOrientationStyle) — 96 CSS px setara persis 25.4mm, jadi perhitungan
            // ini berlaku untuk kertas ukuran apapun yang dipakai, bukan hanya di layar.
            const GAP_PX = 14; // sinkron dengan gap pada .print-grid-fixed di styles.css
            const printableWidthPx = orientation === 'landscape' ? 1047 : 718;
            const estWidth = Math.max(1, Math.floor((printableWidthPx - (cols - 1) * GAP_PX) / cols));
            const estMm = Math.round(estWidth * 0.2646);
            const isTooSmall = estWidth < 130;
            hintEl.className = isTooSmall
                ? 'text-xs text-center mt-2 font-semibold text-amber-600 dark:text-amber-400'
                : 'text-xs text-center mt-2 text-slate-400 dark:text-slate-500';
            const idText = isTooSmall
                ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Kartu ±${estMm}mm/kolom — QR Code berisiko terlalu kecil untuk dipindai.`
                : `Perkiraan lebar kartu ±${estMm}mm per kolom (acuan kertas A4).`;
            const enText = isTooSmall
                ? `<i class="fa-solid fa-triangle-exclamation mr-1"></i>Card ±${estMm}mm/column — QR Code may be too small to scan.`
                : `Estimated card width ±${estMm}mm per column (A4 reference).`;
            hintEl.innerHTML = window.currentLang === 'id' ? idText : enText;
        }
    }
};

// Menyimpan pengaturan kolom/baris grid cetak (dengan validasi batas wajar) lalu menutup modal.
window.savePrintLayoutSettings = function() {
    const colsInput = document.getElementById('print-layout-columns');
    const rowsInput = document.getElementById('print-layout-rows');
    const cols = Math.min(6, Math.max(1, parseInt(colsInput.value, 10) || 2));
    const rows = Math.min(10, Math.max(1, parseInt(rowsInput.value, 10) || 4));
    colsInput.value = cols; rowsInput.value = rows;

    // Validasi & bulatkan nilai Ukuran Kustom (Cm) - 1 desimal, batas wajar 1-30cm (lihat
    // window.getPrintQRSettings untuk alasan batasnya).
    const widthCmInput = document.getElementById('print-layout-width-cm');
    const heightCmInput = document.getElementById('print-layout-height-cm');
    if (widthCmInput) widthCmInput.value = Math.round(Math.min(30, Math.max(1, parseFloat(widthCmInput.value) || 6)) * 10) / 10;
    if (heightCmInput) heightCmInput.value = Math.round(Math.min(30, Math.max(1, parseFloat(heightCmInput.value) || 9)) * 10) / 10;

    window.savePrintQRSettings(true);
    window.closeModalAnimated('modal-print-layout');
    window.showToast(window.t('txt_print_layout_saved'), 'success');
};

window.setPrintOrientation = function(mode) {
    const hiddenEl = document.getElementById('print-orientation-value');
    if (hiddenEl) hiddenEl.value = mode;
    window.updateOrientationButtonsUI(mode);
    window.savePrintQRSettings();
};

window.updateOrientationButtonsUI = function(mode) {
    const btnP = document.getElementById('btn-orientation-portrait'); const btnL = document.getElementById('btn-orientation-landscape');
    const hiddenEl = document.getElementById('print-orientation-value');
    if (hiddenEl) hiddenEl.value = mode;
    if (btnP) btnP.classList.toggle('tab-active', mode === 'portrait');
    if (btnL) btnL.classList.toggle('tab-active', mode === 'landscape');
};

window.applyPrintOrientationStyle = function(orientation) {
    const styleTag = document.getElementById('dynamic-print-page-style');
    if (styleTag) styleTag.textContent = `@page { size: ${orientation}; margin: 10mm; }`;
};

window.buildPrintQRCard = function(guest, evt, qrUrl, settings) {
    const showSeat = settings.kursi && evt && evt.needsSeat !== false && guest.kursi && guest.kursi !== '-';
    const eventName = evt ? (evt.type === 'Lain-lain' && evt.typeDetail ? `${evt.name} — ${evt.typeDetail}` : evt.name) : '';
    const orientationClass = settings.orientation === 'landscape' ? ' landscape' : '';
    // Logo hanya disisipkan bila pengaturan diaktifkan DAN event yang bersangkutan memang punya logo tersimpan
    const showLogo = settings.showLogo && evt && evt.logo;
    const logoClass = showLogo ? ' has-logo' : '';
    const logoImg = showLogo ? `<img src="${evt.logo}" class="print-card-logo" alt="Logo Event">` : '';
    // Bingkai (border) kartu bisa dimatikan per pengaturan aplikasi — dipakai saat admin mencetak
    // di atas kertas/stiker yang sudah punya desain/bingkai sendiri.
    const frameClass = settings.frame === false ? ' no-frame' : '';
    // Ukuran Kustom (Cm): kalau diaktifkan lewat modal "Atur Layout Grid Cetak", kartu memakai
    // lebar & tinggi PASTI dalam cm (bukan lagi lebar baku 260px/400px atau fluid 100% kolom
    // grid) — berlaku untuk Cetak Satuan (printSingleQR) maupun Cetak Terpilih (printSelectedQR)
    // supaya ukuran fisik kartu tetap konsisten di kedua mode. overflow:hidden mencegah konten
    // yang lebih panjang dari tinggi kartu membocor keluar & merusak kerapian grid saat dicetak.
    const customSizeStyle = (settings.customSize && settings.cardWidthCm && settings.cardHeightCm)
        ? ` style="width:${settings.cardWidthCm}cm; height:${settings.cardHeightCm}cm; overflow:hidden;"`
        : '';

    return `
        <div class="print-qr-card${orientationClass}${logoClass}${frameClass}"${customSizeStyle}>
            ${logoImg}
            ${settings.eventName !== false && eventName ? `<p class="print-card-event">${eventName}</p>` : ''}
            <div class="print-card-body">
                <img src="${qrUrl}" class="print-card-qr">
                <div class="print-card-info">
                    ${settings.nama ? `<p class="print-card-name">${guest.nama}</p>` : ''}
                    ${settings.rs ? `<p class="print-card-rs">${guest.rs}</p>` : ''}
                    ${settings.jabatan && guest.jabatan && guest.jabatan !== '-' ? `<p class="print-card-jabatan">${guest.jabatan}</p>` : ''}
                    ${showSeat ? `<p class="print-card-kursi">${guest.kursi}</p>` : ''}
                    ${settings.id ? `<p class="print-card-id">${guest.id}</p>` : ''}
                </div>
            </div>
        </div>`;
};

window.printSingleQR = async function(id) {
    const g = window.guests.find(x => x.id === id);
    if (!g) return;
    const evt = LS.getEvents().find(e => e.id === window.appState.currentEventId);
    window.showToast(window.t('txt_print_preparing'), 'info');
    const qrUrl = await window.createQRCanvas(g.id);
    const settings = window.getPrintQRSettings();
    window.applyPrintOrientationStyle(settings.orientation);
    const area = document.getElementById('print-area');
    area.innerHTML = `<div class="print-single-wrap">${window.buildPrintQRCard(g, evt, qrUrl, settings)}</div>`;
    await waitForImagesReady(area);
    window.print();
};

// Logika inti cetak kartu QR peserta (build kartu per-batch, susun jadi halaman grid sesuai
// Layout Cetak tersimpan, lalu window.print()) - dipakai oleh Cetak Terpilih (peserta yang
// dicentang admin di tabel Data Peserta, termasuk saat "Pilih Semua" dicentang untuk mencetak
// seluruh peserta). Dipisah jadi fungsi sendiri supaya perbaikan cukup dilakukan di satu tempat.
async function buildAndPrintGuestQRCards(guestsList, progressTitle) {
    const evt = LS.getEvents().find(e => e.id === window.appState.currentEventId);
    const settings = window.getPrintQRSettings();
    window.applyPrintOrientationStyle(settings.orientation);
    window.showProgressModal(progressTitle, window.currentLang === 'id' ? 'Menyiapkan label cetak QR...' : 'Preparing QR print labels...');
    const area = document.getElementById('print-area');
    // Dibuat berbarengan dalam batch kecil (bukan satu per satu secara berurutan) — lihat
    // processInChunks di atas. Urutan hasil tetap dijaga sesuai urutan guestsList yang diberikan.
    const cards = await processInChunks(guestsList, async (g) => {
        const qrUrl = await window.createQRCanvas(g.id);
        return window.buildPrintQRCard(g, evt, qrUrl, settings);
    }, (done, t) => window.updateProgressModal(done, t));

    // Bagi kartu menjadi beberapa "halaman" sesuai kolom x baris yang diatur admin lewat modal
    // Atur Layout Grid Cetak — supaya hasil cetak fisik benar-benar mengikuti grid yang diinginkan,
    // bukan sekadar reflow otomatis mengikuti lebar kertas seperti sebelumnya.
    const perPage = Math.max(1, settings.columns * settings.rows);
    // Kalau Ukuran Kustom (Cm) aktif, lebar kolom & tinggi baris grid memakai nilai Cm PASTI
    // (bukan lagi 1fr fluid) supaya kartu benar-benar tercetak sesuai ukuran fisik yang diatur
    // admin - lihat window.buildPrintQRCard yang juga menetapkan lebar/tinggi cm yang sama pada
    // tiap kartunya.
    const gridStyle = (settings.customSize && settings.cardWidthCm && settings.cardHeightCm)
        ? `grid-template-columns: repeat(${settings.columns}, ${settings.cardWidthCm}cm); grid-auto-rows: ${settings.cardHeightCm}cm;`
        : `grid-template-columns: repeat(${settings.columns}, 1fr);`;
    let pagesHtml = '';
    for (let p = 0; p < cards.length; p += perPage) {
        const chunk = cards.slice(p, p + perPage);
        const isLastPage = (p + perPage) >= cards.length;
        pagesHtml += `<div class="print-grid-wrap print-grid-fixed${isLastPage ? '' : ' print-page-break'}" style="${gridStyle}">${chunk.join('')}</div>`;
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
window.printSelectedQR = async function() {
    const selected = window.guests.filter(g => window.selectedGuestIds.has(g.id));
    if (selected.length === 0) return window.showToast(window.currentLang === 'id' ? 'Belum ada peserta yang dipilih untuk dicetak!' : 'No participants selected to print yet!', 'error');
    await buildAndPrintGuestQRCards(selected, window.t('btn_print_selected'));
};

window.addEventListener('afterprint', () => { const area = document.getElementById('print-area'); if (area) area.innerHTML = ''; });
