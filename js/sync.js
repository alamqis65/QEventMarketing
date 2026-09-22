// EventQ - Cross-tab live synchronization
window.syncChannel = null;
try {
  if ('BroadcastChannel' in window) window.syncChannel = new BroadcastChannel('eventq_guests_sync');
} catch (e) { window.syncChannel = null; }
window.tabId = Date.now().toString(36) + Math.random().toString(36).slice(2);

window.broadcastGuestsChanged = function(eventId) {
  if (!window.syncChannel || !eventId) return;
  try {
    window.syncChannel.postMessage({ type: 'guests-changed', eventId, tabId: window.tabId, ts: Date.now() });
  } catch (e) { /* BroadcastChannel may be closed during unload */ }
};

if (window.syncChannel) {
  window.syncChannel.onmessage = function(e) {
    const msg = e.data;
    if (!msg || msg.type !== 'guests-changed' || msg.tabId === window.tabId) return;
    if (msg.eventId !== window.appState.currentEventId) return;
    window.guests = LS.getGuests(msg.eventId);
    window.refreshLiveViewsAfterSync();
  };
}

window.pulseStatElement = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('stat-live-pulse');
  void el.offsetWidth;
  el.classList.add('stat-live-pulse');
  setTimeout(() => el.classList.remove('stat-live-pulse'), 600);
};

window.refreshLiveViewsAfterSync = function() {
  if (!window.appState.currentEventId) return;
  if (typeof window.renderScanStats === 'function') window.renderScanStats();
  if (typeof window.renderGenerateSideStats === 'function') window.renderGenerateSideStats();
  window.pulseStatElement('scan-stat-hadir');
  const appView = document.getElementById('view-app');
  if (appView && !appView.classList.contains('view-hidden')) {
    if (typeof window.renderTable === 'function') window.renderTable();
    window.pulseStatElement('stat-hadir-guests');
  }
  const dashboard = document.getElementById('tab-content-dashboard');
  if (dashboard?.classList.contains('active')) {
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    window.pulseStatElement('dash-hadir');
  }
  const kioskView = document.getElementById('kiosk-mode-view');
  if (kioskView && !kioskView.classList.contains('hidden')) {
    if (typeof window.renderKioskStats === 'function') window.renderKioskStats();
    window.pulseStatElement('kiosk-stat-hadir');
  }
};