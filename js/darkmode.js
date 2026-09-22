// EventQ - Dark Mode
window.toggleDarkMode = function(enabled) {
  document.documentElement.classList.toggle('dark', enabled);
  LS.setSetting('dark_mode', enabled ? '1' : '0');
  const toggleEl = document.getElementById('dark-mode-toggle');
  if (toggleEl) toggleEl.checked = enabled;
  if (window.appState.currentEventId && document.getElementById('tab-content-dashboard')?.classList.contains('active')) {
    window.renderDashboard();
  }
};

window.applyDarkModeSetting = function() {
  const enabled = LS.getSetting('dark_mode') === '1';
  document.documentElement.classList.toggle('dark', enabled);
  const toggleEl = document.getElementById('dark-mode-toggle');
  if (toggleEl) toggleEl.checked = enabled;
};