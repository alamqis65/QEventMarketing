// EventQ - Feature permissions
// Extracted from newVersion/app.js (feature permission system).

const FEATURE_PERMISSION_GROUPS = [
  { label: 'Tools Tambahan (Library)', items: [
    { key: 'toolQRGenerator', label: 'Custom QR Code Generator', icon: 'fa-qrcode' },
    { key: 'toolBarcodeGenerator', label: 'Custom Barcode Generator', icon: 'fa-barcode' },
  ] },
  { label: 'Tab di Dalam Event', items: [
    { key: 'tabDashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { key: 'tabGenerate', label: 'Buat QR Peserta', icon: 'fa-user-plus' },
    { key: 'tabScan', label: 'Scan Kehadiran', icon: 'fa-expand' },
    { key: 'kioskMode', label: 'Mode Kiosk', icon: 'fa-tablet-screen-button' },
  ] },
  { label: 'Toolbar Data Peserta', items: [
    { key: 'bulkDownloadQR', label: 'Bulk Download QR', icon: 'fa-file-zipper' },
    { key: 'printSelectedQR', label: 'Cetak Terpilih', icon: 'fa-square-check' },
    { key: 'exportExcelList', label: 'Export Excel', icon: 'fa-file-excel' },
    { key: 'importExcelList', label: 'Import Excel', icon: 'fa-upload' },
    { key: 'downloadTemplate', label: 'Unduh Template', icon: 'fa-download' },
    { key: 'markAllAttendance', label: 'Absen Semua', icon: 'fa-user-check' },
    { key: 'cancelAllAttendance', label: 'Batal Absen Semua', icon: 'fa-user-xmark' },
  ] },
  { label: 'Toolbar Daftar Hadir', items: [
    { key: 'exportExcelAttended', label: 'Export Excel', icon: 'fa-file-excel' },
  ] },
  { label: 'Tombol Aksi per Peserta (Data Peserta)', items: [
    { key: 'actionManual', label: 'Absen Manual', icon: 'fa-check' },
    { key: 'actionPreviewQR', label: 'Preview QR', icon: 'fa-qrcode' },
    { key: 'actionDownloadQR', label: 'Download QR', icon: 'fa-download' },
    { key: 'actionPrintQR', label: 'Cetak QR', icon: 'fa-print' },
    { key: 'actionEdit', label: 'Edit', icon: 'fa-pen' },
    { key: 'actionDelete', label: 'Hapus', icon: 'fa-trash' },
  ] },
];
const ALL_FEATURE_KEYS = FEATURE_PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

function getDefaultPermissions() {
  const p = {};
  ALL_FEATURE_KEYS.forEach(k => { p[k] = true; });
  return p;
}

window.hasFeaturePerm = function(key) {
  const u = window.appState.currentUser;
  if (!u) return false;
  if (u.role === 'admin' && u.isSuperAdmin) return true;
  if (!u.permissions || u.permissions[key] === undefined) return true;
  return u.permissions[key] !== false;
};

window.applyFeaturePermissions = function() {
  const setVisible = (id, allowed) => {
    const el = document.getElementById(id);
    if (el) el.style.display = allowed ? '' : 'none';
  };
  const canToolQR = window.hasFeaturePerm('toolQRGenerator');
  const canToolBarcode = window.hasFeaturePerm('toolBarcodeGenerator');
  setVisible('btn-lib-tools', canToolQR || canToolBarcode);
  setVisible('tool-card-qr-gen', canToolQR);
  setVisible('tool-card-barcode-gen', canToolBarcode);
  setVisible('btn-tools-shortcut-to-barcode', canToolBarcode);
  setVisible('btn-tools-shortcut-to-qr', canToolQR);
  setVisible('tab-dashboard', window.hasFeaturePerm('tabDashboard'));
  setVisible('tab-generate', window.hasFeaturePerm('tabGenerate'));
  setVisible('tab-read', window.hasFeaturePerm('tabScan'));
  setVisible('btn-kiosk-mode', window.hasFeaturePerm('kioskMode'));
  setVisible('btn-bulk-download-qr', window.hasFeaturePerm('bulkDownloadQR'));
  setVisible('btn-print-selected-qr', window.hasFeaturePerm('printSelectedQR'));
  setVisible('btn-export-excel-list', window.hasFeaturePerm('exportExcelList'));
  setVisible('btn-import-excel', window.hasFeaturePerm('importExcelList'));
  setVisible('btn-download-template', window.hasFeaturePerm('downloadTemplate'));
  setVisible('btn-mark-all-attendance', window.hasFeaturePerm('markAllAttendance'));
  setVisible('btn-cancel-all-attendance', window.hasFeaturePerm('cancelAllAttendance'));
  setVisible('btn-export-excel-attended', window.hasFeaturePerm('exportExcelAttended'));
};

window.getDefaultTabName = function() {
  if (window.hasFeaturePerm('tabDashboard')) return 'dashboard';
  if (window.hasFeaturePerm('tabGenerate')) return 'generate';
  if (window.hasFeaturePerm('tabScan')) return 'read';
  return 'list';
};

window.openUserPermissions = function(username) {
  const user = LS.getUsers().find(u => u.username === username);
  if (!user) return;
  if (user.isSuperAdmin) return window.showToast(window.currentLang === 'id' ? 'Super Admin selalu memiliki akses penuh' : 'Super Admin always has full access', 'info');

  const currentUser = window.appState.currentUser;
  const amISuper = currentUser?.isSuperAdmin === true;
  if (username === currentUser?.username) return window.showToast(window.currentLang === 'id' ? 'Tidak dapat mengubah akses fitur diri sendiri' : 'You cannot change your own feature access', 'error');
  if (!amISuper && user.role !== 'public') return window.showToast(window.currentLang === 'id' ? 'Admin hanya dapat mengubah akses fitur untuk user Public' : 'Admins can only manage Public users', 'error');

  const target = document.getElementById('perm-target-username'); if (target) target.value = username;
  const nameEl = document.getElementById('perm-user-name'); if (nameEl) nameEl.innerText = `${user.name} (@${user.username})`;
  const permissions = { ...getDefaultPermissions(), ...(user.permissions || {}) };
  const container = document.getElementById('user-permissions-list'); if (!container) return;
  container.innerHTML = FEATURE_PERMISSION_GROUPS.map(group => `
    <div>
      <p class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">${group.label}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        ${group.items.map(item => `
          <label class="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm">
            <input type="checkbox" class="perm-checkbox w-4 h-4 shrink-0 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer" data-perm-key="${item.key}" ${permissions[item.key] ? 'checked' : ''}>
            <i class="fa-solid ${item.icon} text-slate-400 dark:text-slate-500 w-4 text-center text-xs shrink-0"></i>
            <span class="text-slate-700 dark:text-slate-200 font-medium truncate">${item.label}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');
  const toggle = document.getElementById('perm-toggle-all'); if (toggle) toggle.checked = ALL_FEATURE_KEYS.every(k => permissions[k]);
  container.dataset.username = username;
  window.openModalAnimated('modal-user-permissions');
};

window.toggleAllPermissions = function (checked) {
  document.querySelectorAll('#user-permissions-list .perm-checkbox').forEach(cb => { cb.checked = checked; });
};

window.saveUserPermissions = function() {
  const container = document.getElementById('user-permissions-list');
  const username = document.getElementById('perm-target-username')?.value || container?.dataset.username;
  if (!username || !container) return;
  const users = LS.getUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return;
  const permissions = {};
  container.querySelectorAll('.perm-checkbox').forEach(cb => { permissions[cb.dataset.permKey] = cb.checked; });
  users[idx].permissions = permissions;
  LS.setUsers(users);
  if (window.appState.currentUser?.username === username) {
    window.appState.currentUser.permissions = permissions;
    sessionStorage.setItem('qis_session', JSON.stringify(window.appState.currentUser));
    if (window.appState.currentEventId) window.applyFeaturePermissions();
  }
  window.closeModalAnimated('modal-user-permissions');
  window.renderManageUsers?.();
  window.refreshUserManageSection?.();
  window.showToast(`${window.currentLang === 'id' ? 'Akses fitur untuk' : 'Feature access for'} ${users[idx].name} ${window.currentLang === 'id' ? 'berhasil diperbarui!' : 'updated successfully!'}`, 'success');
};