function hideHeavyPanels(): void {
  const selectors = ['[aria-label="Stories"]', '[role="complementary"]'];
  selectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.style.display = 'none';
    });
  });
}

function setupKeyboardNavigation(): void {
  window.addEventListener('keydown', (event) => {
    // Remote key mapping placeholder:
    // Arrow keys -> directional navigation
    // Enter -> primary action
    // Backspace/Escape -> back action
    if (event.key === 'f' || event.key === 'F') {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  });
}

function setupPerformanceObserver(): void {
  const observer = new PerformanceObserver((list) => {
    for (const item of list.getEntries()) {
      if (item.duration > 1000) {
        console.info('[facebook-reels-lite] Long task:', item.name, item.duration);
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['longtask'] as PerformanceEntryType[] });
  } catch {
    // Browser may not support longtask entries.
  }
}

hideHeavyPanels();
setupKeyboardNavigation();
setupPerformanceObserver();
