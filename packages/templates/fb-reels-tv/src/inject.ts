const LOG_PREFIX = '[fb-reels-tv]';
const CLEANUP_DELAY_MS = 350;
const NAVIGATION_SCROLL_RATIO = 0.82;

const KEY_CODES: Record<number, string> = {
  13: 'Enter',
  27: 'Escape',
  32: ' ',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  10009: 'Escape',
  10190: 'MediaPlayPause',
  10252: 'MediaPlayPause',
};

const HIDE_SELECTORS = [
  '[aria-label="Stories"]',
  '[aria-label="Comments"]',
  '[role="complementary"]',
  '[data-pagelet="RightRail"]',
  '[data-pagelet="VideoChatHomeUnit"]',
  'div[aria-label="Comment"]',
];

let cleanupTimer: number | undefined;

function log(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.info(LOG_PREFIX, message);
    return;
  }
  console.info(LOG_PREFIX, message, detail);
}

function normalizedKey(event: KeyboardEvent): string {
  if (event.key && event.key !== 'Unidentified') return event.key;
  return KEY_CODES[event.keyCode] ?? KEY_CODES[event.which] ?? '';
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

function currentVideo(): HTMLVideoElement | undefined {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  return videos.find((video) => isVisible(video)) ?? videos[0];
}

function toggleVideoPlayback(): void {
  const video = currentVideo();
  if (!video) {
    log('No visible video found for play/pause');
    return;
  }

  if (video.paused) {
    video.play().catch((error: unknown) => log('Video play failed', error));
    return;
  }

  video.pause();
}

function navigateReel(direction: 1 | -1): void {
  const amount = Math.max(320, Math.floor(window.innerHeight * NAVIGATION_SCROLL_RATIO));
  window.scrollBy({ top: amount * direction, left: 0, behavior: 'smooth' });
}

function enterTvMode(): void {
  document.documentElement.classList.add('fb-reels-tv-mode');
  document.body.classList.add('fb-reels-tv-mode');
}

function exitFullscreenLikeMode(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch((error: unknown) => log('Exit fullscreen failed', error));
  }
}

function clickPrimaryControl(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLElement && typeof active.click === 'function') {
    active.click();
    return true;
  }

  const selectors = ['[aria-label="Play"]', '[aria-label="Pause"]', '[role="button"]'];
  for (const selector of selectors) {
    const el = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible);
    if (el) {
      el.click();
      return true;
    }
  }

  return false;
}

function hideHeavyPanels(): void {
  for (const selector of HIDE_SELECTORS) {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      el.style.display = 'none';
    });
  }
}

function reduceMotion(): void {
  document.documentElement.style.scrollBehavior = 'auto';
}

function cleanupDom(): void {
  enterTvMode();
  reduceMotion();
  hideHeavyPanels();
}

function scheduleCleanup(): void {
  if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
  cleanupTimer = window.setTimeout(cleanupDom, CLEANUP_DELAY_MS);
}

function setupKeyboardNavigation(): void {
  window.addEventListener(
    'keydown',
    (event) => {
      const key = normalizedKey(event);

      if (key === 'ArrowUp') {
        event.preventDefault();
        navigateReel(-1);
        scheduleCleanup();
        return;
      }

      if (key === 'ArrowDown') {
        event.preventDefault();
        navigateReel(1);
        scheduleCleanup();
        return;
      }

      if (key === ' ' || key === 'MediaPlayPause') {
        event.preventDefault();
        toggleVideoPlayback();
        return;
      }

      if (key === 'Enter') {
        event.preventDefault();
        if (!clickPrimaryControl()) toggleVideoPlayback();
        return;
      }

      if (key === 'Escape' || key === 'Backspace') {
        exitFullscreenLikeMode();
      }
    },
    { capture: true },
  );
}

function setupDomObserver(): void {
  const observer = new MutationObserver(scheduleCleanup);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function boot(): void {
  try {
    cleanupDom();
    setupKeyboardNavigation();
    setupDomObserver();
    log('Loaded');
  } catch (error) {
    log('Boot failed', error);
  }
}

boot();
