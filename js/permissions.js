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
  const container = document.getElementById('permissions-container');
  if (!container) return;
  const permissions = user.permissions || {};
  container.innerHTML = FEATURE_PERMISSION_GROUPS.map(group => `
    <div class="mb-4">
      <h4 class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">${group.label}</h4>
      <div class="space-y-2">
        ${group.items.map(item => `
          <label class="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
            <span class="text-sm text-slate-700 dark:text-slate-200"><i class="fa-solid ${item.icon} w-5 text-slate-400"></i>${item.label}</span>
            <input type="checkbox" class="feature-permission-checkbox accent-indigo-600" data-feature-key="${item.key}" ${permissions[item.key] !== false ? 'checked' : ''}>
          </label>`).join('')}
      </div>
    </div>`).join('');
  container.dataset.username = username;
  window.openModalAnimated('modal-user-permissions');
};

window.toggleAllPermissions = function (checked) {
  document.querySelectorAll('#permissions-container .perm-checkbox, #permissions-container .feature-permission-checkbox').forEach(cb => { cb.checked = checked; });
};

window.saveUserPermissions = function() {
  const container = document.getElementById('permissions-container');
  const username = container?.dataset.username;
  if (!username) return;
  const users = LS.getUsers();
  const user = users.find(u => u.username === username);
  if (!user) return;
  user.permissions = {};
  container.querySelectorAll('.feature-permission-checkbox').forEach(el => {
    user.permissions[el.dataset.featureKey] = el.checked;
  });
  LS.setUsers(users);
  window.closeModalAnimated('modal-user-permissions');
  window.showToast(window.currentLang === 'id' ? 'Hak akses disimpan!' : 'Permissions saved!', 'success');
};