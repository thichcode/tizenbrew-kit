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

export function setupRemote(
  player: Player,
  getChannels: () => Channel[],
  getCurrentIndex: () => number,
  setCurrentIndex: (i: number) => void,
  onAction: (action: RemoteAction) => void,
): () => void {
  let numberBuffer = '';
  let numberTimer: ReturnType<typeof setTimeout> | undefined;

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

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        onAction({ type: 'channel-up' });
        break;
      case 'ArrowDown':
        e.preventDefault();
        onAction({ type: 'channel-down' });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onAction({ type: 'seek', delta: -10 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        onAction({ type: 'seek', delta: 10 });
        break;
      case 'Enter':
        e.preventDefault();
        if (idx >= 0 && idx < channels.length) {
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
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          numberBuffer += e.key;
          clearTimeout(numberTimer);
          numberTimer = setTimeout(flushNumberBuffer, 1000);
          onAction({ type: 'number-input', digit: e.key });
        }
        break;
    }
  }

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    clearTimeout(numberTimer);
  };
}
