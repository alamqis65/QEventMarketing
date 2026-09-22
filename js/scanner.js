// EventQ - QR attendance scanner (html5-qrcode)

window.initScanner = function () {
  if (scannerInstance === null) {
    scannerInstance = new Html5QrcodeScanner(
      "reader", { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true }, false
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

window.onScanSuccess = function (decodedText) {
  if (isScanLocked) return;
  isScanLocked = true;
  try {
    if (scannerInstance?.getState && scannerInstance.getState() === 2) scannerInstance.pause(true);
  } catch (e) {}

  const g = window.guests.find((x) => x.id === decodedText);
  if (g) {
    if (!g.scanned) {
      g.scanned = true;
      g.scanTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      saveGuests();
      if (typeof window.renderTable === 'function') window.renderTable();
      window.showToast(
        window.currentLang === "id" ? `Selamat datang, ${g.nama}! Kehadiran Anda tercatat.` : `Welcome, ${g.nama}! Attendance recorded.`,
        "success"
      );
    } else {
      window.showToast(window.currentLang === 'id' ? `Mohon maaf, ${g.nama} sudah absen sebelumnya.` : `Sorry, ${g.nama} has already checked in.`, "warning");
    }
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value || '-'; };
    setText("info-id", g.id); setText("info-nama", g.nama); setText("info-rs", g.rs);
    setText("info-jabatan", g.jabatan); setText("info-kursi", g.kursi);
    const evt = LS.getEvents().find((e) => e.id === window.appState.currentEventId);
    const seatWrap = document.getElementById("info-container-kursi");
    if (seatWrap) seatWrap.style.display = evt && evt.needsSeat !== false ? "flex" : "none";
    window.openModalAnimated("modal-info");
  } else {
    window.showToast(window.currentLang === 'id' ? "Data QR tidak ditemukan di Event ini!" : "This QR code was not found in this event!", "error");
    setTimeout(() => window.resumeScannerState(), 2000);
  }
};

window.resumeScannerState = function () {
  isScanLocked = false;
  if (scannerInstance) { try { scannerInstance.resume(); } catch (e) {} }
};

// Generic QR/barcode reader used by the custom tools.
window.openScanReaderModal = function (mode) {
  const title = document.getElementById('scan-reader-title-text');
  const sub = document.getElementById('scan-reader-subtitle');
  if (title) title.innerText = window.t(mode === 'barcode' ? 'modal_scan_barcode_title' : 'modal_scan_qr_title');
  if (sub) sub.innerText = window.t(mode === 'barcode' ? 'modal_scan_barcode_sub' : 'modal_scan_qr_sub');
  document.getElementById('scan-reader-result')?.classList.add('hidden');
  document.getElementById('scan-reader-camera-wrap')?.classList.remove('hidden');
  window.openModalAnimated('modal-scan-reader');
  setTimeout(() => {
    if (scanReaderInstance === null) {
      scanReaderInstance = new Html5QrcodeScanner('reader-scan-generic', { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true }, false);
      scanReaderInstance.render(window.onScanReaderSuccess, () => {});
    }
  }, 300);
};
window.stopScanReaderInstance = function () {
  if (scanReaderInstance) { scanReaderInstance.clear().catch(e => console.warn(e)); scanReaderInstance = null; }
};
window.closeScanReaderModal = function () { window.closeModalAnimated('modal-scan-reader'); window.stopScanReaderInstance(); };
window.onScanReaderSuccess = function (decodedText) {
  window.stopScanReaderInstance();
  document.getElementById('scan-reader-camera-wrap')?.classList.add('hidden');
  const resultText = document.getElementById('scan-reader-result-text');
  const openLinkBtn = document.getElementById('scan-reader-open-link');
  if (resultText) resultText.innerText = decodedText;
  const isUrl = /^https?:\/\//i.test((decodedText || '').trim());
  if (openLinkBtn) {
    if (isUrl) { openLinkBtn.href = decodedText.trim(); openLinkBtn.classList.remove('hidden'); }
    else { openLinkBtn.classList.add('hidden'); openLinkBtn.removeAttribute('href'); }
  }
  document.getElementById('scan-reader-result')?.classList.remove('hidden');
  window.showToast(window.t('toast_scan_success'), 'success');
};
window.resumeScanReader = function () {
  document.getElementById('scan-reader-result')?.classList.add('hidden');
  document.getElementById('scan-reader-camera-wrap')?.classList.remove('hidden');
  if (scanReaderInstance === null) {
    scanReaderInstance = new Html5QrcodeScanner('reader-scan-generic', { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true }, false);
    scanReaderInstance.render(window.onScanReaderSuccess, () => {});
  }
};
window.copyScanResult = function () {
  const text = document.getElementById('scan-reader-result-text')?.innerText;
  if (!text) return;
  const done = () => window.showToast(window.t('toast_copied'), 'success');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => window.showToast(window.t('toast_copy_failed'), 'error'));
  else { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch { window.showToast(window.t('toast_copy_failed'), 'error'); } document.body.removeChild(ta); }
};