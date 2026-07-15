import { Player } from './player.js';
import { Channel } from './playlist.js';

export type RemoteAction =
  | { type: 'channel-up' }
  | { type: 'channel-down' }
  | { type: 'select'; channelIndex: number }
  | { type: 'play-pause' }
  | { type: 'seek'; delta: number }
  | { type: 'volume'; delta: number }
  | { type: 'back' }
  | { type: 'number-input'; digit: string };

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
  427: 'ChannelUp',
  428: 'ChannelDown',
  447: 'VolumeUp',
  448: 'VolumeDown',
};

function registerTizenKeys(): void {
  const api = (window as typeof window & {
    tizen?: { tvinputdevice?: { registerKey: (key: string) => void } };
  }).tizen;

  for (const key of ['MediaPlay', 'MediaPause', 'MediaStop', 'ChannelUp', 'ChannelDown']) {
    try {
      api?.tvinputdevice?.registerKey(key);
    } catch {
      // TizenBrew may already have registered this key.
    }
  }
}

export function setupRemote(
  player: Player,
  getChannels: () => Channel[],
  getCurrentIndex: () => number,
  isLegacyMode: () => boolean,
  setCurrentIndex: (i: number) => void,
  onAction: (action: RemoteAction) => void,
): () => void {
  let numberBuffer = '';
  let numberTimer: ReturnType<typeof setTimeout> | undefined;
  registerTizenKeys();

  function flushNumberBuffer(): void {
    if (numberBuffer.length > 0) {
      const num = parseInt(numberBuffer, 10);
      const channels = getChannels();
      if (num >= 1 && num <= channels.length) {
        onAction({ type: 'select', channelIndex: num - 1 });
      }
      numberBuffer = '';
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    const channels = getChannels();
    const idx = getCurrentIndex();
    const key = e.key && e.key !== 'Unidentified' ? e.key : KEY_CODES[e.keyCode];

    switch (key) {
      case 'ArrowUp':
        e.preventDefault();
        if (isLegacyMode()) {
          onAction({ type: 'channel-up' });
        } else {
          moveFocus(-1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (isLegacyMode()) {
          onAction({ type: 'channel-down' });
        } else {
          moveFocus(1);
        }
        break;
      case 'ArrowLeft':
        if (document.activeElement instanceof HTMLInputElement) break;
        e.preventDefault();
        onAction({ type: 'seek', delta: -10 });
        break;
      case 'ArrowRight':
        if (document.activeElement instanceof HTMLInputElement) break;
        e.preventDefault();
        onAction({ type: 'seek', delta: 10 });
        break;
      case 'Enter':
        e.preventDefault();
        if (
          document.activeElement instanceof HTMLElement &&
          ['BUTTON', 'INPUT'].indexOf(document.activeElement.tagName) >= 0
        ) {
          document.activeElement.click();
        } else if (idx >= 0 && idx < channels.length) {
          onAction({ type: 'select', channelIndex: idx });
        }
        break;
      case ' ':
        e.preventDefault();
        onAction({ type: 'play-pause' });
        break;
      case 'Backspace':
      case 'Escape':
        e.preventDefault();
        onAction({ type: 'back' });
        break;
      case 'MediaPlayPause':
      case 'MediaPlay':
      case 'MediaPause':
        e.preventDefault();
        onAction({ type: 'play-pause' });
        break;
      case 'VolumeUp':
        e.preventDefault();
        onAction({ type: 'volume', delta: 0.1 });
        break;
      case 'VolumeDown':
        e.preventDefault();
        onAction({ type: 'volume', delta: -0.1 });
        break;
      case 'ChannelUp':
        e.preventDefault();
        onAction({ type: 'channel-up' });
        break;
      case 'ChannelDown':
        e.preventDefault();
        onAction({ type: 'channel-down' });
        break;
      default:
        if (key && key >= '0' && key <= '9') {
          e.preventDefault();
          numberBuffer += key;
          clearTimeout(numberTimer);
          numberTimer = setTimeout(flushNumberBuffer, 1000);
          onAction({ type: 'number-input', digit: key });
        }
        break;
    }
  }

  function moveFocus(delta: number): void {
    const nodes = document.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="file"])');
    const focusable: HTMLElement[] = [];
    for (let i = 0; i < nodes.length; i++) focusable.push(nodes[i]);
    if (focusable.length === 0) return;

    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = current < 0 ? 0 : Math.max(0, Math.min(focusable.length - 1, current + delta));
    focusable[next]?.focus();
  }

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    clearTimeout(numberTimer);
  };
}
