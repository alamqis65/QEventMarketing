// EventQ - Application settings, image cropper, login background slideshow, and backup/restore.
// This file intentionally uses the LS storage facade only.  Do not use localStorage here.

let loginBgRotateTimer = null;
let loginBgActiveLayer = 'a';
let loginBgList = [];
let loginBgCurrentIndex = 0;

function getLoginBgList() {
    if (LS && typeof LS.getLoginBgList === 'function') return LS.getLoginBgList() || [];
    const raw = LS.getSetting('bg_login_list');
    if (!raw) return [];
    try { return JSON.parse(raw) || []; } catch (e) { return []; }
}
function setLoginBgList(list) {
    if (LS && typeof LS.setLoginBgList === 'function') LS.setLoginBgList(list);
    else LS.setSetting('bg_login_list', JSON.stringify(list));
}

window.setCropperSaveEnabled = function(enabled) {
    const btn = document.getElementById('btn-apply-crop');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.innerHTML = enabled
        ? (window.currentLang === 'id' ? 'Simpan Potongan' : 'Save Crop')
        : `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${window.currentLang === 'id' ? 'Memuat...' : 'Loading...'}`;
};

window.updateCropperProgress = function() {
    const wrap = document.getElementById('cropper-progress-wrap');
    if (!wrap) return;
    const total = window.loginBgQueueTotal || 0;
    if (total <= 1) { wrap.classList.add('hidden'); return; }
    const done = window.loginBgQueueDone || 0;
    const current = Math.min(done + 1, total);
    const pct = Math.round((done / total) * 100);
    wrap.classList.remove('hidden');
    const label = document.getElementById('cropper-progress-label');
    const percent = document.getElementById('cropper-progress-percent');
    const bar = document.getElementById('cropper-progress-bar');
    if (label) label.textContent = window.currentLang === 'id' ? `Memproses foto ${current} dari ${total}` : `Processing photo ${current} of ${total}`;
    if (percent) percent.textContent = `${pct}%`;
    if (bar) bar.style.width = `${pct}%`;
};

function loadCropperFile(file, target) {
    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = document.getElementById('cropper-image');
        if (!img) return;
        if (cropper) { cropper.destroy(); cropper = null; }
        window.setCropperSaveEnabled(false);
        const ratio = target === 'event' ? NaN : (target === 'login-bg' ? 16 / 9 : 1);
        img.onload = function() {
            cropper = new Cropper(img, {
                aspectRatio: ratio, viewMode: 1, background: false, zoomable: true,
                ready: function() { window.setCropperSaveEnabled(true); }
            });
        };
        img.src = evt.target.result;
    };
    reader.onerror = function() {
        window.setCropperSaveEnabled(true);
        window.showToast(window.currentLang === 'id' ? 'Gagal membaca file gambar' : 'Failed to read image file', 'error');
    };
    reader.readAsDataURL(file);
}

window.openCropper = function(e, target) {
    const files = Array.from((e && e.target && e.target.files) || []);
    if (!files.length) return;
    cropTarget = target;
    cropSourceFileName = files[0].name || '';
    window.loginBgQueue = target === 'login-bg' ? files.slice(1) : [];
    window.loginBgQueueTotal = target === 'login-bg' ? files.length : 0;
    window.loginBgQueueDone = 0;
    window.openModalAnimated('modal-cropper');
    window.updateCropperProgress();
    loadCropperFile(files[0], target);
    e.target.value = '';
};

window.closeCropper = function() {
    window.closeModalAnimated('modal-cropper');
    if (cropper) setTimeout(() => { cropper.destroy(); cropper = null; }, 300);
    const wrap = document.getElementById('cropper-progress-wrap');
    if (wrap) wrap.classList.add('hidden');
    window.loginBgQueue = [];
    window.loginBgQueueTotal = 0;
    window.loginBgQueueDone = 0;
};

window.cropperAction = function(action) {
    if (!cropper) return;
    if (action === 'zoom-in') cropper.zoom(0.1);
    if (action === 'zoom-out') cropper.zoom(-0.1);
    if (action === 'rotate-left') cropper.rotate(-45);
    if (action === 'rotate-right') cropper.rotate(45);
};

window.applyCrop = function() {
    if (!cropper) return;
    const isLoginBg = cropTarget === 'login-bg';
    const canvas = cropper.getCroppedCanvas({
        maxWidth: isLoginBg ? 2560 : 1280,
        maxHeight: isLoginBg ? 2560 : 1280,
        imageSmoothingQuality: 'high'
    });
    const base64 = canvas.toDataURL('image/jpeg', isLoginBg ? 0.95 : 0.85);

    if (cropTarget === 'app-logo') {
        LS.setSetting('app_logo', base64);
        applyAppLogo(); window.renderStorageMeter?.();
        window.showToast('Logo Aplikasi Diperbarui', 'success');
    } else if (cropTarget === 'profile') {
        const users = LS.getUsers();
        const user = window.appState && window.appState.currentUser;
        const idx = users.findIndex(u => user && u.username === user.username);
        if (idx > -1) {
            users[idx].profilePic = base64; LS.setUsers(users);
            window.appState.currentUser.profilePic = base64;
            sessionStorage.setItem('qis_session', JSON.stringify(window.appState.currentUser));
            updateProfilePicUI(); window.showToast('Foto Profil Diperbarui', 'success');
        }
    } else if (cropTarget === 'event') {
        const input = document.getElementById('event-logo-base64');
        if (input) input.value = base64;
        if (window.showEventLogoFileInfo) window.showEventLogoFileInfo(cropSourceFileName || 'logo-event.jpg', base64);
        window.showToast('Logo event disetel', 'success');
    } else if (isLoginBg) {
        const list = getLoginBgList(); list.push(base64);
        try { setLoginBgList(list); } catch (err) {
            window.showToast(window.currentLang === 'id' ? 'Penyimpanan penuh. Hapus beberapa foto background lama di Pengaturan sebelum menambah yang baru.' : 'Storage is full. Remove some older background photos before adding new ones.', 'error');
            window.closeCropper(); return;
        }
        window.applyLoginBg();
        window.loginBgQueueDone = (window.loginBgQueueDone || 0) + 1;
        window.updateCropperProgress();
        if (window.loginBgQueue && window.loginBgQueue.length) {
            loadCropperFile(window.loginBgQueue.shift(), 'login-bg'); return;
        }
        const total = window.loginBgQueueTotal || 1;
        window.showToast(total > 1 ? (window.currentLang === 'id' ? `${total} Background Login Ditambahkan` : `${total} Login Backgrounds Added`) : (window.currentLang === 'id' ? 'Background Login Diperbarui' : 'Login Background Updated'), 'success');
    }
    window.closeCropper();
};

function applyAppLogo() {
    const logo = LS.getSetting('app_logo');
    const authIcon = document.getElementById('auth-logo-icon');
    const authImg = document.getElementById('auth-logo-img');
    const setIcon = document.getElementById('setting-app-logo-icon');
    const setImg = document.getElementById('setting-app-logo-preview');
    const favicon = document.getElementById('dynamic-favicon');
    if (logo) {
        if (authImg) { authImg.src = logo; authImg.classList.remove('hidden'); authIcon?.classList.add('hidden'); }
        if (setImg) { setImg.src = logo; setImg.classList.remove('hidden'); setIcon?.classList.add('hidden'); }
        if (favicon) favicon.href = logo;
    } else {
        authImg?.classList.add('hidden'); authIcon?.classList.remove('hidden');
        setImg?.classList.add('hidden'); setIcon?.classList.remove('hidden');
        if (favicon) favicon.href = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📅</text></svg>';
    }
}

window.resetAppLogo = function() {
    LS.removeSetting('app_logo'); applyAppLogo(); window.renderStorageMeter?.();
    window.showToast(window.currentLang === 'id' ? 'Logo dikembalikan ke default' : 'Logo reset to default', 'success');
};

window.resetLoginBg = function() {
    LS.removeSetting('bg_login');
    if (LS.getLoginBgList) LS.setLoginBgList([]); else LS.removeSetting('bg_login_list');
    window.applyLoginBg();
    window.showToast(window.currentLang === 'id' ? 'Background dikembalikan ke default' : 'Background reset to default', 'success');
};
window.removeLoginBg = function(idx) {
    const list = getLoginBgList(); list.splice(idx, 1); setLoginBgList(list); window.applyLoginBg();
    window.showToast(window.currentLang === 'id' ? 'Foto background dihapus' : 'Background photo removed', 'success');
};
window.renderLoginBgSettingsList = function() {
    const el = document.getElementById('setting-bg-login-thumbs'); if (!el) return;
    el.innerHTML = getLoginBgList().map((src, i) => `<div class="relative w-24 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group shrink-0"><img src="${src}" class="w-full h-full object-cover"><button type="button" onclick="window.removeLoginBg(${i})" class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
    window.renderStorageMeter?.();
};

window.renderStorageMeter = function() {
    const bar = document.getElementById('storage-meter-bar');
    const text = document.getElementById('storage-meter-text');
    const pctEl = document.getElementById('storage-meter-percent');
    if (!bar || !text || !pctEl) return;
    // Cache is the application's storage facade; measuring it also works with the API-backed store.
    const store = window.Cache && Cache._store ? Cache._store : {};
    let chars = 0;
    Object.keys(store).forEach(k => { chars += k.length + String(store[k] ?? '').length; });
    const bytes = chars * 2, quota = 5 * 1024 * 1024;
    const pct = Math.min(100, Math.round(bytes / quota * 100));
    const size = bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
    bar.style.width = `${pct}%`; pctEl.textContent = `${pct}%`;
    text.textContent = window.currentLang === 'id' ? `${size} terpakai dari ~5 MB` : `${size} used of ~5 MB`;
    bar.classList.remove('bg-emerald-500','dark:bg-emerald-400','bg-amber-500','dark:bg-amber-400','bg-red-500','dark:bg-red-400');
    const color = pct < 60 ? ['bg-emerald-500','dark:bg-emerald-400'] : pct < 85 ? ['bg-amber-500','dark:bg-amber-400'] : ['bg-red-500','dark:bg-red-400'];
    bar.classList.add(...color);
};

function renderAuthBgDots() {
    const wrap = document.getElementById('auth-bg-dots'); if (!wrap) return;
    if (loginBgList.length <= 1) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = loginBgList.map((_, i) => `<button type="button" onclick="window.jumpToLoginBg(${i})" class="h-2 rounded-full transition-all duration-300 ${i === loginBgCurrentIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'}" aria-label="Background ${i + 1}"></button>`).join('');
}
function goToLoginBgIndex(idx) {
    const a = document.getElementById('auth-bg-layer-a'), b = document.getElementById('auth-bg-layer-b');
    if (!a || !b || !loginBgList[idx]) return;
    const showing = loginBgActiveLayer === 'a' ? b : a;
    const hiding = loginBgActiveLayer === 'a' ? a : b;
    showing.style.backgroundImage = `url('${loginBgList[idx]}')`; showing.style.opacity = '1'; hiding.style.opacity = '0';
    loginBgActiveLayer = loginBgActiveLayer === 'a' ? 'b' : 'a'; loginBgCurrentIndex = idx; renderAuthBgDots();
}
window.jumpToLoginBg = function(idx) { if (idx !== loginBgCurrentIndex && loginBgList[idx]) { goToLoginBgIndex(idx); window.restartLoginBgRotation(); } };
window.getLoginBgIntervalSec = function() { const n = parseInt(LS.getSetting('bg_login_interval'), 10); return !isNaN(n) && n > 0 ? Math.min(n, 120) : 7; };
window.setLoginBgIntervalSec = function(sec) { let n = Math.round(Number(sec)); if (!isFinite(n)) n = 7; n = Math.max(1, Math.min(120, n)); LS.setSetting('bg_login_interval', String(n)); return n; };
window.syncBgIntervalUI = function(sec) { document.getElementById('bg-interval-slider')?.setAttribute('value', Math.min(10, Math.max(1, sec))); const c = document.getElementById('bg-interval-custom'); if (c) c.value = sec; const v = document.getElementById('bg-interval-value'); if (v) v.textContent = `${sec} ${window.currentLang === 'id' ? 'detik' : 'sec'}`; };
window.loadBgIntervalSettingsUI = function() { window.syncBgIntervalUI(window.getLoginBgIntervalSec()); };
window.onBgIntervalSliderInput = function(v) { const n = window.setLoginBgIntervalSec(v); window.syncBgIntervalUI(n); window.restartLoginBgRotation(); };
window.onBgIntervalCustomChange = window.onBgIntervalSliderInput;
window.restartLoginBgRotation = function() { if (loginBgRotateTimer) clearInterval(loginBgRotateTimer); loginBgRotateTimer = null; if (loginBgList.length > 1) loginBgRotateTimer = setInterval(() => goToLoginBgIndex((loginBgCurrentIndex + 1) % loginBgList.length), window.getLoginBgIntervalSec() * 1000); };

window.applyLoginBg = function() {
    loginBgList = getLoginBgList(); loginBgCurrentIndex = 0;
    const panel = document.getElementById('auth-bg-panel'), overlay = document.getElementById('auth-bg-overlay');
    const a = document.getElementById('auth-bg-layer-a'), b = document.getElementById('auth-bg-layer-b');
    if (loginBgRotateTimer) clearInterval(loginBgRotateTimer); loginBgRotateTimer = null;
    if (loginBgList.length && a && b) {
        a.style.backgroundImage = `url('${loginBgList[0]}')`; a.style.opacity = '1'; b.style.backgroundImage = ''; b.style.opacity = '0'; loginBgActiveLayer = 'a';
        panel?.classList.remove('bg-gradient-to-br','from-indigo-500','via-indigo-600','to-purple-700'); overlay?.classList.remove('bg-slate-900/10'); overlay?.classList.add('bg-slate-900/40');
        window.restartLoginBgRotation();
    } else {
        a && (a.style.opacity = '0'); b && (b.style.opacity = '0'); panel?.classList.add('bg-gradient-to-br','from-indigo-500','via-indigo-600','to-purple-700'); overlay?.classList.remove('bg-slate-900/40'); overlay?.classList.add('bg-slate-900/10');
    }
    renderAuthBgDots(); window.renderLoginBgSettingsList();
};

window.toggleAuthCaption = function(enabled) { LS.setSetting('auth_caption', enabled ? '1' : '0'); window.applyAuthCaptionSetting(); };
window.setAuthCaption = window.toggleAuthCaption;
window.resetAuthCaption = function() { LS.removeSetting('auth_caption'); window.applyAuthCaptionSetting(); };
window.applyAuthCaptionSetting = function() {
    const enabled = LS.getSetting('auth_caption') !== '0';
    ['auth-bg-branding','auth-bg-scrim-top','auth-bg-scrim-bottom'].forEach(id => document.getElementById(id)?.classList.toggle('hidden', !enabled));
    const toggle = document.getElementById('auth-caption-toggle'); if (toggle) toggle.checked = enabled;
};

window.getKioskResetDurationSec = function() { const n = parseInt(LS.getSetting('kiosk_reset_duration'), 10); return !isNaN(n) && n > 0 ? Math.min(n, 30) : 4; };
window.setKioskResetDurationSec = function(sec) { let n = Math.round(Number(sec)); if (!isFinite(n)) n = 4; n = Math.max(1, Math.min(30, n)); LS.setSetting('kiosk_reset_duration', String(n)); return n; };
window.syncKioskResetDurationUI = function(sec) { const s = document.getElementById('kiosk-reset-slider'); if (s) s.value = Math.min(10, Math.max(1, sec)); const c = document.getElementById('kiosk-reset-custom'); if (c) c.value = sec; const v = document.getElementById('kiosk-reset-value'); if (v) v.textContent = `${sec} ${window.currentLang === 'id' ? 'detik' : 'sec'}`; };
window.loadKioskResetDurationSettingUI = function() { window.syncKioskResetDurationUI(window.getKioskResetDurationSec()); };
window.onKioskResetDurationSliderInput = function(v) { const n = window.setKioskResetDurationSec(v); window.syncKioskResetDurationUI(n); };
window.onKioskResetDurationCustomChange = window.onKioskResetDurationSliderInput;
window.getKioskPickupSignatureEnabled = function() { const v = LS.getSetting('kiosk_pickup_signature'); return v === null ? true : v === '1'; };
window.toggleKioskPickupSignature = function(v) { LS.setSetting('kiosk_pickup_signature', v ? '1' : '0'); };
window.loadKioskPickupSignatureSettingUI = function() { const e = document.getElementById('kiosk-pickup-signature-toggle'); if (e) e.checked = window.getKioskPickupSignatureEnabled(); };
window.getKioskTTSLang = window.getKioskTTSLang || function() { return LS.getSetting('kiosk_tts_lang') === 'id' ? 'id' : 'en'; };
window.setKioskTTSLang = function(lang) { lang = lang === 'id' ? 'id' : 'en'; LS.setSetting('kiosk_tts_lang', lang); window.loadKioskTTSLangSettingUI(); };
window.loadKioskTTSLangSettingUI = function() { const lang = window.getKioskTTSLang(); const hidden = document.getElementById('kiosk-tts-lang-value'); if (hidden) hidden.value = lang; document.getElementById('btn-tts-lang-id')?.classList.toggle('tab-active', lang === 'id'); document.getElementById('btn-tts-lang-en')?.classList.toggle('tab-active', lang === 'en'); };
window.loadKioskPinSettingsUI = function() { const status = document.getElementById('kiosk-pin-status'); const input = document.getElementById('kiosk-exit-pin'); if (input) input.value = ''; if (status) status.textContent = LS.getSetting('kiosk_exit_pin') ? (window.currentLang === 'id' ? 'PIN tersimpan.' : 'PIN saved.') : (window.currentLang === 'id' ? 'Belum ada PIN khusus.' : 'No custom PIN set.'); };
window.saveKioskExitPin = function(e) { e?.preventDefault(); const input = document.getElementById('kiosk-exit-pin'); LS.setSetting('kiosk_exit_pin', input ? input.value.trim() : ''); window.loadKioskPinSettingsUI(); window.showToast('PIN keluar kiosk berhasil disimpan!', 'success'); };

window.openSettingsView = function() {
    const isAdmin = window.appState?.currentUser?.role === 'admin';
    const userSection = document.getElementById('admin-user-manage-section'); if (userSection) userSection.style.display = isAdmin ? 'flex' : 'none';
    window.loadPrintQRSettingsUI?.(); window.applyAuthCaptionSetting(); window.loadBgIntervalSettingsUI(); window.renderStorageMeter(); window.loadKioskPinSettingsUI(); window.loadKioskResetDurationSettingUI(); window.loadKioskTTSLangSettingUI(); window.loadKioskPickupSignatureSettingUI();
    if (isAdmin) window.updateSettingsUserCountBadge?.();
    if (window.switchSettingsSection) window.switchSettingsSection(isAdmin ? 'users' : 'appearance');
    switchMainViewAnimated('view-settings');
};
window.backToLibraryFromSettings = function() { loadLibrary(); };
window.switchSettingsSection = function(section) {
    document.querySelectorAll('.settings-nav-btn').forEach(btn => btn.classList.remove('settings-nav-active'));
    document.querySelectorAll('.settings-section').forEach(panel => panel.classList.add('hidden'));
    const navBtn = document.querySelector(`.settings-nav-btn[data-section="${section}"]`);
    if (navBtn) navBtn.classList.add('settings-nav-active');
    const panel = document.getElementById(`settings-section-${section}`);
    if (panel) panel.classList.remove('hidden');
    const contentArea = document.getElementById('settings-content-area');
    if (contentArea) contentArea.scrollTop = 0;
};
window.resetProfilePic = function() { const users = LS.getUsers(), user = window.appState?.currentUser, i = users.findIndex(u => user && u.username === user.username); if (i > -1) { users[i].profilePic = ''; LS.setUsers(users); user.profilePic = ''; sessionStorage.setItem('qis_session', JSON.stringify(user)); updateProfilePicUI(); window.showToast(window.currentLang === 'id' ? 'Foto Profil Direset' : 'Profile Picture Reset', 'success'); } };
function updateProfilePicUI() { const img = document.getElementById('profile-pic-display'), icon = document.getElementById('profile-pic-icon'); if (!img || !icon) return; if (window.appState?.currentUser?.profilePic) { img.src = window.appState.currentUser.profilePic; img.classList.remove('hidden'); icon.classList.add('hidden'); } else { img.classList.add('hidden'); icon.classList.remove('hidden'); } }

window.resetAllSettings = function() {
    ['app_logo','bg_login','bg_login_list','bg_login_interval','auth_caption','print_qr_fields','dark_mode','kiosk_reset_duration','kiosk_tts_lang','kiosk_pickup_signature','kiosk_exit_pin'].forEach(k => LS.removeSetting(k));
    window.currentLang = 'id'; applyAppLogo(); window.applyLoginBg(); window.applyAuthCaptionSetting(); window.loadBgIntervalSettingsUI(); window.loadKioskResetDurationSettingUI(); window.loadKioskTTSLangSettingUI(); window.loadKioskPickupSignatureSettingUI(); window.applyDarkModeSetting?.(); window.applyLanguage?.(); window.loadPrintQRSettingsUI?.(); window.showToast(window.t('confirm_reset'), 'success');
};
window.confirmResetAllSettings = function() { if (window.openConfirmCustom) window.openConfirmCustom(window.currentLang === 'id' ? 'Kembalikan Pengaturan Semula?' : 'Restore Default Settings?', window.currentLang === 'id' ? 'Semua pengaturan aplikasi akan dikembalikan ke default.' : 'All application settings will be restored to their defaults.', window.resetAllSettings); else window.resetAllSettings(); };

window.exportBackupJSON = function() {
    const data = { users: LS.getUsers(), events: LS.getEvents(), settings: {}, guests: {}, customQRs: LS.getCustomQRs(), customBarcodes: LS.getCustomBarcodes() };
    ['app_logo','bg_login','bg_login_list','bg_login_interval','auth_caption','print_qr_fields','dark_mode','kiosk_reset_duration','kiosk_tts_lang','kiosk_pickup_signature','kiosk_exit_pin'].forEach(k => { const v = LS.getSetting(k); if (v !== null && v !== undefined) data.settings[k] = v; });
    data.events.forEach(ev => { data.guests[ev.id] = LS.getGuests(ev.id); });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `EventQ_Backup_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); window.showToast('Backup berhasil diunduh!', 'success');
};
window.importBackupJSON = function(event) {
    const file = event?.target?.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { try { const data = JSON.parse(e.target.result); if (!data.users || !data.events) throw new Error('invalid'); window.tempRestoreData = data; document.getElementById('confirm-type').value = 'restore'; document.getElementById('confirm-id').value = 'all'; document.querySelector('#modal-confirm h3').innerText = window.t('modal_restore_title'); document.querySelector('#confirm-sub').innerText = window.t('modal_restore_sub'); window.openModalAnimated('modal-confirm'); } catch (err) { window.showToast('Format file backup tidak valid!', 'error'); } event.target.value = ''; };
    reader.onerror = function() { event.target.value = ''; window.showToast(window.currentLang === 'id' ? 'Gagal membaca file!' : 'Failed to read the file!', 'error'); };
    reader.readAsText(file);
};
