// Remote Samsung (keyCode Tizen 3-4) + fallback e.key hien dai.
// Len/xuong: doi focus. Enter: kich hoat. Back/Return: ve list. Play/Pause: dung/phat.
import { moveFocus, focusItem, getItems } from './ui.js';

export type TvAction =
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'back' }
  | { type: 'play-pause' }
  | { type: 'enter' };

const KEY_CODES: Record<number, string> = {
  13: 'Enter',
  27: 'Escape',
  32: ' ',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  415: 'MediaPlay',
  19: 'MediaPause',
  413: 'MediaStop',
  10009: 'Escape',
  10190: 'MediaPlayPause',
  10252: 'MediaPlayPause',
  427: 'ChannelUp',
  428: 'ChannelDown',
};

export function registerTizenKeys(): void {
  try {
    const w = window as unknown as {
      tizen?: { tvinputdevice?: { registerKey: (k: string) => void } };
    };
    const api = w.tizen && w.tizen.tvinputdevice;
    if (!api) return;
    for (const k of ['MediaPlay', 'MediaPause', 'MediaStop', 'ChannelUp', 'ChannelDown']) {
      try {
        api.registerKey(k);
      } catch {
        // TizenBrew co the da dang ky
      }
    }
  } catch {
    // khong phai Tizen
  }
}

export function setupRemote(onAction: (a: TvAction) => void): () => void {
  registerTizenKeys();

  function onKey(e: KeyboardEvent): void {
    const key = e.key && e.key !== 'Unidentified' ? e.key : KEY_CODES[e.keyCode];
    switch (key) {
      case 'ArrowUp':
      case 'ChannelUp':
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'ArrowDown':
      case 'ChannelDown':
        e.preventDefault();
        moveFocus(1);
        break;
      case 'Enter':
        e.preventDefault();
        if (
          document.activeElement instanceof HTMLElement &&
          (document.activeElement.tagName === 'BUTTON' ||
            document.activeElement.tagName === 'INPUT')
        ) {
          document.activeElement.click();
        } else {
          onAction({ type: 'enter' });
        }
        break;
      case ' ':
      case 'MediaPlayPause':
      case 'MediaPlay':
      case 'MediaPause':
        e.preventDefault();
        onAction({ type: 'play-pause' });
        break;
      case 'Backspace':
      case 'Escape':
        e.preventDefault();
        onAction({ type: 'back' });
        break;
      default:
        if (typeof key === 'string' && /^\d$/.test(key)) {
          const n = parseInt(key, 10);
          if (n >= 1 && n <= getItems().length) {
            e.preventDefault();
            focusItem(n - 1);
          }
        }
        break;
    }
  }

  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
