// EventQ - Additional tools: Custom QR Code Generator, Custom Barcode Generator
// Includes: CRUD, selection, live preview, downloads
// NOTE: Print functions live in js/print.js (buildPrintCustomQRCard, printSingleCustomQR,
// printSelectedCustomQR, buildPrintCustomBarcodeCard, printSingleCustomBarcode,
// printSelectedCustomBarcode, getPrintCustomSettings, saveCustomPrintFieldSetting,
// togglePrintCustomSettingsMenu, closePrintCustomSettingsMenu, createBarcodeCanvasPNG)

// ===== Navigation into tool views =====

window.openToolsListModal = function() { window.openModalAnimated('modal-tools-list'); };

window.openToolQR = function() {
  if (window.hasFeaturePerm && !window.hasFeaturePerm('toolQRGenerator')) return window.showToast('Anda tidak memiliki akses ke fitur Custom QR Code Generator', 'error');
  window.closeModalAnimated('modal-tools-list');
  window.setLoadingText('txt_loading_qr_gen');
  switchMainViewAnimated('view-loading');
  setTimeout(() => {
    switchMainViewAnimated('view-tools-qr');
    document.getElementById('form-custom-qr').reset();
    window.updateCQRPreview();
    window.selectedCustomQRIds = new Set();
    window.renderCustomQRs();
  }, 800);
};

window.openToolBarcode = function() {
  if (window.hasFeaturePerm && !window.hasFeaturePerm('toolBarcodeGenerator')) return window.showToast('Anda tidak memiliki akses ke fitur Custom Barcode Generator', 'error');
  window.closeModalAnimated('modal-tools-list');
  window.setLoadingText('txt_loading_barcode_gen');
  switchMainViewAnimated('view-loading');
  setTimeout(() => {
    switchMainViewAnimated('view-tools-barcode');
    document.getElementById('form-custom-barcode').reset();
    window.updateCBarcodePreview();
    window.selectedCustomBarcodeIds = new Set();
    window.renderCustomBarcodes();
  }, 800);
};

// ===== Custom QR Code Generator =====

// Shared filtered list (no sort) for render + select-all consistency
function getFilteredCustomQRsList() {
  const search = (document.getElementById('search-custom-qr')?.value || '').toLowerCase();
  return LS.getCustomQRs().filter(q => q.name.toLowerCase().includes(search) || q.content.toLowerCase().includes(search));
}

window.renderCustomQRs = function() {
  const qrs = LS.getCustomQRs();
  const tbody = document.getElementById('table-body-custom-qr');
  if (!tbody) return;

  // Prune stale IDs from selection
  const ids = new Set(qrs.map(q => q.id));
  window.selectedCustomQRIds.forEach(id => { if (!ids.has(id)) window.selectedCustomQRIds.delete(id); });

  const filtered = getFilteredCustomQRsList();
  filtered.sort((a, b) => b.created - a.created);

  tbody.innerHTML = '';
  const badge = document.getElementById('qr-total-badge');
  if (badge) badge.innerText = qrs.length;

  const ITEMS_PER_PAGE = 5;
  let totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (window.currentPageCustomQR > totalPages && totalPages > 0) window.currentPageCustomQR = totalPages;
  const paginated = filtered.slice((window.currentPageCustomQR - 1) * ITEMS_PER_PAGE, window.currentPageCustomQR * ITEMS_PER_PAGE);

  if (filtered.length === 0) {
    document.getElementById('empty-state-custom-qr')?.classList.remove('hidden');
  } else {
    document.getElementById('empty-state-custom-qr')?.classList.add('hidden');
    paginated.forEach(qr => {
      const date = new Date(qr.created).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const isLink = /^https?:\/\//i.test(qr.content.trim());
      const typeBadge = isLink
        ? '<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md shrink-0"><i class="fa-solid fa-link"></i> Link</span>'
        : '<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md shrink-0"><i class="fa-solid fa-font"></i> Teks</span>';
      const checked = window.selectedCustomQRIds.has(qr.id) ? 'checked' : '';
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';
      tr.innerHTML = `
        <td class="px-4 py-3.5 text-center"><input type="checkbox" onchange="window.toggleCustomQRSelection('${qr.id}',this.checked)" ${checked} class="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"></td>
        <td class="px-5 py-3.5 text-sm font-bold text-slate-800">${qr.name}</td>
        <td class="px-5 py-3.5 text-sm text-slate-600 max-w-[220px]" title="${qr.content}"><div class="flex items-center">${typeBadge}<span class="truncate">${qr.content}</span></div></td>
        <td class="px-5 py-3.5 text-sm text-slate-500">${date}</td>
        <td class="px-5 py-3.5 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1">
            <button onclick="window.previewCustomQR('${qr.id}')" class="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors" title="Preview"><i class="fa-solid fa-qrcode"></i></button>
            <button onclick="window.downloadCustomQR('${qr.id}')" class="w-8 h-8 rounded-lg text-purple-600 hover:bg-purple-100 transition-colors" title="Download"><i class="fa-solid fa-download"></i></button>
            <button onclick="window.printSingleCustomQR('${qr.id}')" class="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors" title="Cetak"><i class="fa-solid fa-print"></i></button>
            <button onclick="window.editCustomQR('${qr.id}')" class="w-8 h-8 rounded-lg text-amber-500 hover:bg-amber-100 transition-colors" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button onclick="window.openConfirmModal('custom-qr','${qr.id}')" class="w-8 h-8 rounded-lg text-red-500 hover:bg-red-100 transition-colors" title="Hapus"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }
  window.renderPagination(filtered.length, ITEMS_PER_PAGE, window.currentPageCustomQR, 'pagination-custom-qr', 'changePageCustomQR');
  window.updateCustomQRSelectionUI();
};

// ===== Custom QR Selection =====

window.toggleCustomQRSelection = function(id, checked) {
  if (checked) window.selectedCustomQRIds.add(id); else window.selectedCustomQRIds.delete(id);
  window.updateCustomQRSelectionUI();
};
window.toggleSelectAllCustomQR = function(checked) {
  getFilteredCustomQRsList().forEach(q => { if (checked) window.selectedCustomQRIds.add(q.id); else window.selectedCustomQRIds.delete(q.id); });
  window.renderCustomQRs();
};
window.clearCustomQRSelection = function() { window.selectedCustomQRIds.clear(); window.renderCustomQRs(); };
window.updateCustomQRSelectionUI = function() {
  const count = window.selectedCustomQRIds.size;
  const ind = document.getElementById('selected-cqr-indicator'); if (ind) ind.style.display = count > 0 ? 'inline-flex' : 'none';
  const txt = document.getElementById('selected-cqr-count-text'); if (txt) txt.innerText = (window.currentLang === 'id' ? `${count} QR dipilih` : `${count} QR selected`);
  const b = document.getElementById('badge-print-selected-cqr-count'); if (b) { b.innerText = count; b.style.display = count > 0 ? 'inline-flex' : 'none'; }
  const cb = document.getElementById('checkbox-select-all-cqr');
  if (cb) {
    const f = getFilteredCustomQRsList(), sel = f.filter(q => window.selectedCustomQRIds.has(q.id)).length;
    cb.checked = f.length > 0 && sel === f.length; cb.indeterminate = sel > 0 && sel < f.length;
  }
};

// ===== Live QR preview while typing =====

let _cqrPreviewDebounce = null;
window.updateCQRPreview = function() {
  const contentEl = document.getElementById('cqr-content'), counterEl = document.getElementById('cqr-char-count');
  if (counterEl && contentEl) counterEl.innerText = contentEl.value.length;
  clearTimeout(_cqrPreviewDebounce);
  _cqrPreviewDebounce = setTimeout(() => {
    const v = (contentEl?.value || '').trim(), empty = document.getElementById('cqr-preview-empty'), box = document.getElementById('cqr-preview-canvas');
    if (!empty || !box) return;
    if (!v) { empty.classList.remove('hidden'); box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.innerHTML = '';
    new QRCode(box, { text: v, width: 140, height: 140, colorDark: '#1e293b', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    empty.classList.add('hidden'); box.classList.remove('hidden');
  }, 150);
};

// ===== QR CRUD =====

window.handleCustomQRSubmit = function(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-cqr'), orig = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> ${window.t('btn_generating')}`; btn.disabled = true; btn.classList.add('opacity-80','cursor-not-allowed');
  setTimeout(() => {
    const name = document.getElementById('cqr-name').value.trim(), content = document.getElementById('cqr-content').value.trim();
    let qrs = LS.getCustomQRs();
    const newId = 'CQR-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    qrs.push({ id: newId, name, content, created: Date.now() });
    LS.setCustomQRs(qrs); e.target.reset(); window.updateCQRPreview(); window.renderCustomQRs();
    window.showToast('Custom QR Code berhasil disimpan!', 'success'); window.previewCustomQR(newId);
    btn.innerHTML = orig; btn.disabled = false; btn.classList.remove('opacity-80','cursor-not-allowed');
  }, 800);
};

window.previewCustomQR = function(id) {
  const qr = LS.getCustomQRs().find(q => q.id === id); if (!qr) return;
  const box = document.getElementById('custom-qrcode-container'); box.innerHTML = '';
  new QRCode(box, { text: qr.content, width: 220, height: 220, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  document.getElementById('modal-custom-qr-name').innerText = qr.name;
  document.getElementById('modal-custom-qr-content').innerText = qr.content;
  window.openModalAnimated('modal-preview-custom-qr');
};
window.editCustomQR = function(id) {
  const qr = LS.getCustomQRs().find(q => q.id === id); if (!qr) return;
  document.getElementById('edit-cqr-id').value = qr.id; document.getElementById('edit-cqr-name').value = qr.name; document.getElementById('edit-cqr-content').value = qr.content;
  window.openModalAnimated('modal-edit-custom-qr');
};
window.handleEditCustomQRSubmit = function(e) {
  e.preventDefault();
  const id = document.getElementById('edit-cqr-id').value, name = document.getElementById('edit-cqr-name').value.trim(), content = document.getElementById('edit-cqr-content').value.trim();
  let qrs = LS.getCustomQRs(); const i = qrs.findIndex(q => q.id === id);
  if (i >= 0) { qrs[i].name = name; qrs[i].content = content; LS.setCustomQRs(qrs); window.renderCustomQRs(); window.closeModalAnimated('modal-edit-custom-qr'); window.showToast('Data QR Code berhasil diupdate!', 'success'); }
};
window.downloadCustomQR = async function(id) {
  const qr = LS.getCustomQRs().find(q => q.id === id); if (!qr) return;
  window.showToast('Menyiapkan unduhan QR...', 'info');
  const url = await window.createQRCanvas(qr.content);
  const a = document.createElement('a'); a.href = url; a.download = `QR_${qr.name}.png`; a.click();
};

// ===== Custom Barcode Generator =====

function getFilteredCustomBarcodesList() {
  const search = (document.getElementById('search-custom-barcode')?.value || '').toLowerCase();
  return LS.getCustomBarcodes().filter(b => b.name.toLowerCase().includes(search) || b.content.toLowerCase().includes(search));
}

window.renderCustomBarcodes = function() {
  const bcs = LS.getCustomBarcodes();
  const tbody = document.getElementById('table-body-custom-barcode');
  if (!tbody) return;
  const ids = new Set(bcs.map(b => b.id));
  window.selectedCustomBarcodeIds.forEach(id => { if (!ids.has(id)) window.selectedCustomBarcodeIds.delete(id); });

  const filtered = getFilteredCustomBarcodesList();
  filtered.sort((a, b) => b.created - a.created);
  tbody.innerHTML = '';
  const badge = document.getElementById('barcode-total-badge');
  if (badge) badge.innerText = bcs.length;

  const ITEMS_PER_PAGE = 5;
  let totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (window.currentPageCustomBarcode > totalPages && totalPages > 0) window.currentPageCustomBarcode = totalPages;
  const paginated = filtered.slice((window.currentPageCustomBarcode - 1) * ITEMS_PER_PAGE, window.currentPageCustomBarcode * ITEMS_PER_PAGE);

  if (filtered.length === 0) {
    document.getElementById('empty-state-custom-barcode')?.classList.remove('hidden');
  } else {
    document.getElementById('empty-state-custom-barcode')?.classList.add('hidden');
    paginated.forEach(bc => {
      const date = new Date(bc.created).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const checked = window.selectedCustomBarcodeIds.has(bc.id) ? 'checked' : '';
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';
      tr.innerHTML = `
        <td class="px-4 py-3.5 text-center"><input type="checkbox" onchange="window.toggleCustomBarcodeSelection('${bc.id}',this.checked)" ${checked} class="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"></td>
        <td class="px-5 py-3.5 text-sm font-bold text-slate-800">${bc.name}</td>
        <td class="px-5 py-3.5 text-sm text-slate-600 max-w-[200px] truncate" title="${bc.content}">${bc.content}</td>
        <td class="px-5 py-3.5 text-sm text-slate-500">${date}</td>
        <td class="px-5 py-3.5 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1">
            <button onclick="window.previewCustomBarcode('${bc.id}')" class="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors" title="Preview"><i class="fa-solid fa-barcode"></i></button>
            <button onclick="window.downloadCustomBarcode('${bc.id}')" class="w-8 h-8 rounded-lg text-purple-600 hover:bg-purple-100 transition-colors" title="Download"><i class="fa-solid fa-download"></i></button>
            <button onclick="window.printSingleCustomBarcode('${bc.id}')" class="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors" title="Cetak"><i class="fa-solid fa-print"></i></button>
            <button onclick="window.editCustomBarcode('${bc.id}')" class="w-8 h-8 rounded-lg text-amber-500 hover:bg-amber-100 transition-colors" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button onclick="window.openConfirmModal('custom-barcode','${bc.id}')" class="w-8 h-8 rounded-lg text-red-500 hover:bg-red-100 transition-colors" title="Hapus"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }
  window.renderPagination(filtered.length, ITEMS_PER_PAGE, window.currentPageCustomBarcode, 'pagination-custom-barcode', 'changePageCustomBarcode');
  window.updateCustomBarcodeSelectionUI();
};

// ===== Custom Barcode Selection =====

window.toggleCustomBarcodeSelection = function(id, checked) {
  if (checked) window.selectedCustomBarcodeIds.add(id); else window.selectedCustomBarcodeIds.delete(id);
  window.updateCustomBarcodeSelectionUI();
};
window.toggleSelectAllCustomBarcode = function(checked) {
  getFilteredCustomBarcodesList().forEach(b => { if (checked) window.selectedCustomBarcodeIds.add(b.id); else window.selectedCustomBarcodeIds.delete(b.id); });
  window.renderCustomBarcodes();
};
window.clearCustomBarcodeSelection = function() { window.selectedCustomBarcodeIds.clear(); window.renderCustomBarcodes(); };
window.updateCustomBarcodeSelectionUI = function() {
  const count = window.selectedCustomBarcodeIds.size;
  const ind = document.getElementById('selected-cbarcode-indicator'); if (ind) ind.style.display = count > 0 ? 'inline-flex' : 'none';
  const txt = document.getElementById('selected-cbarcode-count-text'); if (txt) txt.innerText = (window.currentLang === 'id' ? `${count} Barcode dipilih` : `${count} barcodes selected`);
  const b = document.getElementById('badge-print-selected-cbarcode-count'); if (b) { b.innerText = count; b.style.display = count > 0 ? 'inline-flex' : 'none'; }
  const cb = document.getElementById('checkbox-select-all-cbarcode');
  if (cb) {
    const f = getFilteredCustomBarcodesList(), sel = f.filter(q => window.selectedCustomBarcodeIds.has(q.id)).length;
    cb.checked = f.length > 0 && sel === f.length; cb.indeterminate = sel > 0 && sel < f.length;
  }
};

// ===== Live Barcode preview while typing =====

let _cbarcodePreviewDebounce = null;
window.updateCBarcodePreview = function() {
  const contentEl = document.getElementById('cbarcode-content'), counterEl = document.getElementById('cbarcode-char-count');
  if (counterEl && contentEl) counterEl.innerText = contentEl.value.length;
  clearTimeout(_cbarcodePreviewDebounce);
  _cbarcodePreviewDebounce = setTimeout(() => {
    const v = (contentEl?.value || '').trim(), empty = document.getElementById('cbarcode-preview-empty'), svg = document.getElementById('cbarcode-preview-svg');
    if (!empty || !svg) return;
    if (!v) { empty.classList.remove('hidden'); svg.classList.add('hidden'); return; }
    try {
      JsBarcode(svg, v, { format: 'CODE128', width: 1.6, height: 60, displayValue: true, background: '#ffffff', lineColor: '#1e293b', margin: 4, fontSize: 12 });
      empty.classList.add('hidden'); svg.classList.remove('hidden');
    } catch (e) { empty.classList.remove('hidden'); svg.classList.add('hidden'); }
  }, 150);
};

// ===== Barcode CRUD =====

window.handleCustomBarcodeSubmit = function(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-cbarcode'), orig = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> ${window.t('btn_generating')}`; btn.disabled = true; btn.classList.add('opacity-80','cursor-not-allowed');
  setTimeout(() => {
    const name = document.getElementById('cbarcode-name').value.trim(), content = document.getElementById('cbarcode-content').value.trim();
    let bcs = LS.getCustomBarcodes();
    const newId = 'BAR-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    bcs.push({ id: newId, name, content, created: Date.now() });
    LS.setCustomBarcodes(bcs); e.target.reset(); window.updateCBarcodePreview(); window.renderCustomBarcodes();
    window.showToast('Custom Barcode berhasil disimpan!', 'success'); window.previewCustomBarcode(newId);
    btn.innerHTML = orig; btn.disabled = false; btn.classList.remove('opacity-80','cursor-not-allowed');
  }, 800);
};

window.previewCustomBarcode = function(id) {
  const bc = LS.getCustomBarcodes().find(b => b.id === id); if (!bc) return;
  try {
    JsBarcode('#custom-barcode-svg', bc.content, { format: 'CODE128', width: 2, height: 80, displayValue: true, background: '#ffffff', lineColor: '#1e293b', margin: 0 });
    document.getElementById('modal-custom-barcode-name').innerText = bc.name;
    document.getElementById('modal-custom-barcode-content').innerText = bc.content;
    window.openModalAnimated('modal-preview-custom-barcode');
  } catch (err) { window.showToast('Teks tidak kompatibel untuk dibuat Barcode.', 'error'); }
};
window.editCustomBarcode = function(id) {
  const bc = LS.getCustomBarcodes().find(b => b.id === id); if (!bc) return;
  document.getElementById('edit-cbarcode-id').value = bc.id; document.getElementById('edit-cbarcode-name').value = bc.name; document.getElementById('edit-cbarcode-content').value = bc.content;
  window.openModalAnimated('modal-edit-custom-barcode');
};
window.handleEditCustomBarcodeSubmit = function(e) {
  e.preventDefault();
  const id = document.getElementById('edit-cbarcode-id').value, name = document.getElementById('edit-cbarcode-name').value.trim(), content = document.getElementById('edit-cbarcode-content').value.trim();
  let bcs = LS.getCustomBarcodes(); const i = bcs.findIndex(b => b.id === id);
  if (i >= 0) { bcs[i].name = name; bcs[i].content = content; LS.setCustomBarcodes(bcs); window.renderCustomBarcodes(); window.closeModalAnimated('modal-edit-custom-barcode'); window.showToast('Data Barcode berhasil diupdate!', 'success'); }
};
window.downloadCustomBarcode = function(id) {
  const bc = LS.getCustomBarcodes().find(b => b.id === id); if (!bc) return;
  window.showToast('Menyiapkan unduhan Barcode...', 'info');
  // createBarcodeCanvasPNG is defined in js/print.js
  window.createBarcodeCanvasPNG(bc.content)
    .then(url => { const a = document.createElement('a'); a.href = url; a.download = `Barcode_${bc.name}.png`; a.click(); })
    .catch(() => window.showToast('Gagal memproses gambar Barcode untuk diunduh.', 'error'));
};
