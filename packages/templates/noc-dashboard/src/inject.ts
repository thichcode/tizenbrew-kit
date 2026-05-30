const REFRESH_MINUTES = 5;
let cursorTimer: number | undefined;

function hideCursorAfterInactivity(): void {
  const reset = () => {
    document.body.style.cursor = 'default';
    if (cursorTimer) window.clearTimeout(cursorTimer);
    cursorTimer = window.setTimeout(() => {
      document.body.style.cursor = 'none';
    }, 3000);
  };

  window.addEventListener('mousemove', reset);
  window.addEventListener('keydown', reset);
  reset();
}

function setupAutoRefresh(): void {
  window.setInterval(() => window.location.reload(), REFRESH_MINUTES * 60 * 1000);
}

function setupReconnectOverlay(): void {
  window.addEventListener('offline', () => {
    const overlay = document.createElement('div');
    overlay.id = 'tbk-offline-overlay';
    overlay.textContent = 'Connection lost. Reconnecting...';
    document.body.appendChild(overlay);
  });
}

function setupStatusBadge(): void {
  const badge = document.createElement('div');
  badge.id = 'tbk-status-badge';
  badge.textContent = 'TV MODE';
  document.body.appendChild(badge);
}

hideCursorAfterInactivity();
setupAutoRefresh();
setupReconnectOverlay();
setupStatusBadge();
