// EventQ - Generic UI helpers (toasts, modals, pagination, tabs, confirm dialog)

window.showToast = function(msg, type = 'success') {
    const t = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    if(type === 'success') { t.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl transition-all duration-400 z-[100] flex items-center gap-3 font-semibold bg-emerald-600 text-white border-emerald-500 toast-hidden`; icon.className = 'fa-solid fa-circle-check text-xl'; }
    else if(type === 'error') { t.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl transition-all duration-400 z-[100] flex items-center gap-3 font-semibold bg-red-600 text-white border-red-500 toast-hidden`; icon.className = 'fa-solid fa-circle-exclamation text-xl'; }
    else if(type === 'warning') { t.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl transition-all duration-400 z-[100] flex items-center gap-3 font-semibold bg-amber-500 text-white border-amber-400 toast-hidden`; icon.className = 'fa-solid fa-triangle-exclamation text-xl'; }
    else { t.className = `fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl transition-all duration-400 z-[100] flex items-center gap-3 font-semibold bg-indigo-600 text-white border-indigo-500 toast-hidden`; icon.className = 'fa-solid fa-bell text-xl'; }
    document.getElementById('toast-msg').innerText = msg;
    // Double rAF: konsisten dengan openModalAnimated, memastikan kondisi awal (toast-hidden)
    // sempat dilukis browser sebelum transisi ke toast-visible dimulai.
    requestAnimationFrame(() => { requestAnimationFrame(() => { t.classList.remove('toast-hidden'); t.classList.add('toast-visible'); }); });
    setTimeout(() => { t.classList.remove('toast-visible'); t.classList.add('toast-hidden'); }, 3500);
};

// Daftar modal yang tampil di atas modal LAIN (berbagi backdrop terpisah "modal-backdrop-nested"
// supaya lapisan blur-nya bertumpuk rapi) - dipakai bersama oleh window.openModalAnimated,
// window.closeModalAnimated, & handler tombol Escape.
const NESTED_MODAL_IDS = ['modal-user-form', 'modal-user-permissions', 'modal-export-auth', 'modal-kiosk-exit-pin', 'modal-confirm', 'modal-cropper', 'modal-edit-custom-qr', 'modal-edit-custom-barcode', 'modal-signature', 'modal-preview-signature'];

window.openModalAnimated = function(id) {
    const backdrop = NESTED_MODAL_IDS.includes(id) ? document.getElementById('modal-backdrop-nested') : document.getElementById('modal-backdrop');
    const modal = document.getElementById(id);
    if (!modal || !backdrop) return;
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    backdrop.classList.remove('hidden'); modal.classList.remove('hidden'); modal.classList.add('flex');
    // Double rAF: memastikan browser benar-benar sempat melukis kondisi awal (scale-down, opacity 0)
    // dulu sebelum kelas "show" ditambahkan.
    requestAnimationFrame(() => { requestAnimationFrame(() => { backdrop.classList.add('show'); content.classList.add('show'); }); });
};

window.closeModalAnimated = function(id) {
    const isNested = NESTED_MODAL_IDS.includes(id);
    const backdrop = isNested ? document.getElementById('modal-backdrop-nested') : document.getElementById('modal-backdrop');
    const modal = document.getElementById(id);
    if (!modal || !backdrop) return;
    const content = modal.querySelector('.modal-content');
    if (content) content.classList.remove('show');

    // Dicek sebagai fungsi karena modal lain bisa dibuka selama animasi penutupan berlangsung.
    const anyOtherSharingBackdrop = () => {
        let found = false;
        document.querySelectorAll('.modal-content').forEach(c => {
            const m = c.closest('div[id^="modal-"]');
            if (m && m.id !== id && !m.classList.contains('hidden') && NESTED_MODAL_IDS.includes(m.id) === isNested) found = true;
        });
        return found;
    };
    if (!anyOtherSharingBackdrop()) backdrop.classList.remove('show');
    setTimeout(() => {
        modal.classList.add('hidden'); modal.classList.remove('flex');
        if (!anyOtherSharingBackdrop()) backdrop.classList.add('hidden');
    }, 400);
};

// ===== Tutup Modal Terbuka dengan Tombol Escape (Event Handler baru) =====
document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    const openModalsWithDismiss = Array.from(document.querySelectorAll('div[id^="modal-"]'))
        .filter(m => !m.classList.contains('hidden') && m.querySelector('[data-modal-dismiss]'));
    if (openModalsWithDismiss.length === 0) return;
    openModalsWithDismiss.sort((a, b) => (parseInt(getComputedStyle(b).zIndex, 10) || 0) - (parseInt(getComputedStyle(a).zIndex, 10) || 0));
    const dismissBtn = openModalsWithDismiss[0].querySelector('[data-modal-dismiss]');
    if (dismissBtn) { e.preventDefault(); dismissBtn.click(); }
});

// Ikon di tengah bingkai scanner loading, disesuaikan dengan konteks aksi yang sedang berjalan.
const LOADING_ICON_MAP = {
    txt_loading: 'fa-calendar-days',
    txt_opening_event: 'fa-calendar-check',
    txt_loading_qr_gen: 'fa-qrcode',
    txt_loading_barcode_gen: 'fa-barcode'
};

window.setLoadingText = function(key) {
    const el = document.getElementById('loading-text');
    if(el) {
        el.setAttribute('data-i18n', key);
        el.innerText = window.t(key);
    }
    const iconEl = document.getElementById('loading-icon');
    if (iconEl) iconEl.className = `fa-solid ${LOADING_ICON_MAP[key] || 'fa-qrcode'} text-3xl text-indigo-500 dark:text-indigo-400 transition-all`;
    const subEl = document.getElementById('loading-subtitle');
    if (subEl) subEl.innerText = window.currentLang === 'id' ? 'Mohon tunggu sebentar...' : 'Please wait a moment...';
};

window.renderPagination = function(totalItems, itemsPerPage, currentPage, containerId, changePageFunc) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if(totalPages <= 1) return; // Hide pagination

    const prevBtn = document.createElement('button');
    prevBtn.className = `w-8 h-8 flex items-center justify-center rounded-lg border ${currentPage === 1 ? 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`;
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left text-xs"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => window[changePageFunc](currentPage - 1);
    container.appendChild(prevBtn);

    for(let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const btn = document.createElement('button');
            btn.className = `w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${currentPage === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`;
            btn.innerText = i;
            btn.onclick = () => window[changePageFunc](i);
            container.appendChild(btn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.className = 'w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium';
            dots.innerText = '...';
            container.appendChild(dots);
        }
    }
    const nextBtn = document.createElement('button');
    nextBtn.className = `w-8 h-8 flex items-center justify-center rounded-lg border ${currentPage === totalPages ? 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`;
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right text-xs"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => window[changePageFunc](currentPage + 1);
    container.appendChild(nextBtn);
};

window.changePageEvents = function(page) { window.currentPageEvents = page; renderEvents(); };
window.changePageGuests = function(page) { window.currentPageGuests = page; window.renderTable(); };
window.changePageAttended = function(page) { window.currentPageAttended = page; window.renderTable(); };
window.changePageCustomQR = function(page) { window.currentPageCustomQR = page; window.renderCustomQRs(); };
window.changePageCustomBarcode = function(page) { window.currentPageCustomBarcode = page; window.renderCustomBarcodes(); };

function switchMainViewAnimated(viewName) {
    const views = ['view-auth', 'view-loading', 'view-library', 'view-app', 'view-settings', 'view-tools-qr', 'view-tools-barcode'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (!el) return;
        if(v === viewName) { el.classList.remove('view-hidden'); el.classList.add('view-visible'); }
        else { el.classList.add('view-hidden'); el.classList.remove('view-visible'); }
    });
}
window.switchMainViewAnimated = switchMainViewAnimated;
window.toggleSwitchMainView = function(viewName) { switchMainViewAnimated(viewName); };

window.switchTab = function(tabName) {
    document.querySelectorAll('#view-app nav button').forEach(btn => btn.classList.remove('tab-active'));
    document.querySelectorAll('.app-tab').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('tab-active');
    setTimeout(() => { document.getElementById(`tab-content-${tabName}`).classList.add('active'); }, 10);
    if (tabName === 'read') setTimeout(() => window.initScanner(), 300); else window.stopScanner();
    if (tabName === 'list' || tabName === 'attended') window.renderTable();
    if (tabName === 'dashboard') window.renderDashboard();
};

// ===== Progress Modal Helper (Import Excel / Bulk Download / Cetak Semua QR) =====
window.showProgressModal = function(title, subtitle) {
    const titleEl = document.getElementById('progress-modal-title'); const subEl = document.getElementById('progress-modal-subtitle');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle || (window.currentLang === 'id' ? 'Mohon tunggu sebentar...' : 'Please wait a moment...');
    window.updateProgressModal(0, 0);
    const modal = document.getElementById('modal-progress');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
};
window.updateProgressModal = function(current, total, subtitle) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const bar = document.getElementById('progress-modal-bar'); const pctEl = document.getElementById('progress-modal-percent');
    const countEl = document.getElementById('progress-modal-count'); const subEl = document.getElementById('progress-modal-subtitle');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (countEl) countEl.textContent = `${current} / ${total}`;
    if (subtitle && subEl) subEl.textContent = subtitle;
};
window.hideProgressModal = function() {
    const modal = document.getElementById('modal-progress');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
};

// --- Generic confirm/delete dialog (used by events, guests, users, custom QR/barcode, restore) ---
window.openConfirmModal = function(type, id) {
    document.getElementById('confirm-type').value = type; document.getElementById('confirm-id').value = id;
    document.querySelector('#modal-confirm h3').innerText = window.t('modal_del_title');
    document.querySelector('#confirm-sub').innerText = window.t('modal_del_sub');
    window.confirmCallback = null; window.confirmCancelCallback = null;
    window.openModalAnimated('modal-confirm');
};

// Pembuka konfirmasi generik berbasis callback (dipakai untuk peringatan batal kunci / batal absen, dsb)
window.openConfirmCustom = function(title, subtitle, onConfirm, onCancel) {
    document.getElementById('confirm-type').value = ''; document.getElementById('confirm-id').value = '';
    document.querySelector('#modal-confirm h3').innerText = title;
    document.querySelector('#confirm-sub').innerText = subtitle;
    window.confirmCallback = onConfirm; window.confirmCancelCallback = onCancel || null;
    window.openModalAnimated('modal-confirm');
};
window.cancelConfirmModal = function() {
    const cb = window.confirmCancelCallback;
    window.confirmCallback = null; window.confirmCancelCallback = null;
    window.closeModalAnimated('modal-confirm');
    if (typeof cb === 'function') cb();
};

window.executeDelete = function() {
    if (typeof window.confirmCallback === 'function') {
        const cb = window.confirmCallback;
        window.confirmCallback = null; window.confirmCancelCallback = null;
        window.closeModalAnimated('modal-confirm'); cb(); return;
    }
    const type = document.getElementById('confirm-type').value; const id = document.getElementById('confirm-id').value;
    if(type === 'event') {
        let events = LS.getEvents(); events = events.filter(e => e.id !== id); LS.setEvents(events);
        LS.removeGuests(id); renderEvents(); window.showToast('Event dihapus.', 'error');
    } else if (type === 'guest') {
        window.guests = window.guests.filter(g => g.id !== id); saveGuests(); window.renderTable(); window.showToast('Data peserta dihapus', 'error');
    } else if (type === 'user') {
        let users = LS.getUsers(); const userToDelete = users.find(u => u.username === id);
        if(userToDelete && userToDelete.isSuperAdmin) window.showToast('Akun Super Admin tidak dapat dihapus!', 'error');
        else { users = users.filter(u => u.username !== id); LS.setUsers(users); window.renderManageUsers(); window.updateSettingsUserCountBadge?.(); window.showToast('Akun berhasil dihapus', 'warning'); }
    } else if (type === 'custom-qr') {
        let qrs = LS.getCustomQRs(); qrs = qrs.filter(q => q.id !== id); LS.setCustomQRs(qrs); window.renderCustomQRs(); window.showToast('QR Code kustom berhasil dihapus', 'error');
    } else if (type === 'custom-barcode') {
        let bcs = LS.getCustomBarcodes(); bcs = bcs.filter(b => b.id !== id); LS.setCustomBarcodes(bcs); window.renderCustomBarcodes(); window.showToast('Barcode kustom berhasil dihapus', 'error');
    } else if (type === 'restore') {
        const data = window.tempRestoreData; window.tempRestoreData = null;
        if (data) {
            LS.setUsers(data.users); LS.setEvents(data.events);
            if(data.customQRs) LS.setCustomQRs(data.customQRs);
            if(data.customBarcodes) LS.setCustomBarcodes(data.customBarcodes);
            if (data.settings && data.settings.app_logo) LS.setSetting('app_logo', data.settings.app_logo); else LS.removeSetting('app_logo');
            if (data.guests) Object.keys(data.guests).forEach(eventId => LS.setGuests(eventId, data.guests[eventId]));
            window.showToast('Restore berhasil! Sistem akan dimuat ulang...', 'success');
            window.closeModalAnimated('modal-confirm'); setTimeout(() => { window.handleLogout(); location.reload(); }, 1500); return;
        }
    }
    window.closeModalAnimated('modal-confirm');
};

// Import mode selection (merge/overwrite).
window.openImportModeModal = function(newCount, existingCount, mergeTotal, duplicateRows, onChoose, onCancel) {
    const elExisting = document.getElementById('import-mode-existing-count');
    const elNew = document.getElementById('import-mode-new-count');
    const elTotal = document.getElementById('import-mode-total-count');
    const wrapEl = document.getElementById('import-mode-duplicate-wrap');
    const noteEl = document.getElementById('import-mode-duplicate-note');
    const listEl = document.getElementById('import-mode-duplicate-list');
    const toggleBtn = document.getElementById('import-mode-duplicate-toggle-btn');
    if (elExisting) elExisting.innerText = existingCount;
    if (elNew) elNew.innerText = newCount;
    if (elTotal) elTotal.innerText = mergeTotal;
    window.importModeDuplicateRows = duplicateRows || [];
    const dupCount = window.importModeDuplicateRows.length;
    if (wrapEl) {
        if (dupCount > 0) { wrapEl.classList.remove('hidden'); if (noteEl) noteEl.innerText = window.currentLang === 'id' ? `${dupCount} data di file sudah sama dengan data yang ada (nama & asal RS sama) dan tidak akan ditambahkan lagi.` : `${dupCount} row(s) in the file already match existing data (same name & hospital) and will not be added again.`; }
        else wrapEl.classList.add('hidden');
    }
    if (listEl) { listEl.classList.add('hidden'); listEl.innerHTML = ''; }
    if (toggleBtn) toggleBtn.innerText = window.currentLang === 'id' ? 'Lihat Data' : 'View Data';
    window.importModeChooseCallback = onChoose; window.importModeCancelCallback = onCancel;
    window.openModalAnimated('modal-import-mode');
};

// Tampilkan/sembunyikan daftar duplikat pada modal import.
window.toggleImportDuplicateList = function() {
    const listEl = document.getElementById('import-mode-duplicate-list');
    const toggleBtn = document.getElementById('import-mode-duplicate-toggle-btn');
    if (!listEl) return;
    const willShow = listEl.classList.contains('hidden');
    if (willShow) {
        const rows = window.importModeDuplicateRows || [];
        listEl.innerHTML = rows.map(r => `<div class="px-3 py-2 flex items-center justify-between gap-3 text-[12px]"><div class="min-w-0"><p class="font-semibold text-slate-700 dark:text-slate-200 truncate">${r.nama}</p><p class="text-slate-400 dark:text-slate-500 truncate">${r.rs}</p></div><span class="shrink-0 font-mono text-[10px] text-slate-400 dark:text-slate-500">${r.questId ? r.questId : (window.currentLang === 'id' ? 'Duplikat di file' : 'Duplicate in file')}</span></div>`).join('');
        listEl.classList.remove('hidden'); if (toggleBtn) toggleBtn.innerText = window.currentLang === 'id' ? 'Sembunyikan' : 'Hide';
    } else { listEl.classList.add('hidden'); if (toggleBtn) toggleBtn.innerText = window.currentLang === 'id' ? 'Lihat Data' : 'View Data'; }
};
window.cancelImportMode = function() {
    window.closeModalAnimated('modal-import-mode');
    if (typeof window.importModeCancelCallback === 'function') window.importModeCancelCallback();
    window.importModeChooseCallback = null; window.importModeCancelCallback = null;
};
window.chooseImportMode = function(mode) {
    window.closeModalAnimated('modal-import-mode');
    const cb = window.importModeChooseCallback;
    window.importModeChooseCallback = null; window.importModeCancelCallback = null;
    if (typeof cb === 'function') cb(mode);
};
