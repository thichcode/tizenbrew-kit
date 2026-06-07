import { fetchPlaylist, Channel } from './playlist.js';
import { Player } from './player.js';
import { setupRemote } from './remote.js';
import {
  setChannels,
  renderChannelList,
  setActiveChannel,
  focusChannelByFlatIndex,
  getCurrentFocusIndex,
  setCurrentFocusIndex,
  updateNowPlaying,
  updateStatus,
} from './ui.js';

let channels: Channel[] = [];
let currentIndex = -1;
let player: Player;

async function init(): Promise<void> {
  const videoEl = document.getElementById('player') as HTMLVideoElement;
  const channelListEl = document.getElementById('channel-list') as HTMLElement;
  const nowPlayingEl = document.getElementById('now-playing') as HTMLElement;
  const statusEl = document.getElementById('status-text') as HTMLElement;
  const loadingEl = document.getElementById('loading') as HTMLElement;

  if (!videoEl || !channelListEl) return;

  player = new Player(videoEl);

  updateStatus(statusEl, 'Fetching playlist...');
  loadingEl.style.display = 'block';

  try {
    channels = await fetchPlaylist();
    setChannels(channels);

    renderChannelList(
      channelListEl,
      (index) => selectChannel(index),
      (index) => {
        currentIndex = index;
        setActiveChannel(index);
      },
    );

    loadingEl.style.display = 'none';
    updateStatus(statusEl, 'Ready');

    if (channels.length > 0) {
      focusChannelByFlatIndex(0);
    }
  } catch (err) {
    loadingEl.style.display = 'none';
    updateStatus(statusEl, `Error: ${(err as Error).message}`);
  }

  player.on('play', () => {
    updateStatus(statusEl, 'Playing');
  });

  player.on('pause', () => {
    updateStatus(statusEl, 'Paused');
  });

  player.on('error', (err) => {
    updateStatus(statusEl, `Error: ${err.message}`);
  });

  player.on('loadstart', () => {
    updateStatus(statusEl, 'Loading stream...');
  });

  player.on('canplay', () => {
    updateStatus(statusEl, 'Playing');
  });

  setupRemote(
    player,
    () => channels,
    () => currentIndex,
    (i) => {
      currentIndex = i;
      setActiveChannel(i);
      const flatIndex = channels.findIndex((c) => c.index === i);
      if (flatIndex >= 0) focusChannelByFlatIndex(flatIndex);
    },
    (action) => {
      switch (action.type) {
        case 'channel-up': {
          const next = Math.min(currentIndex + 1, channels.length - 1);
          if (next !== currentIndex) {
            currentIndex = next;
            setActiveChannel(next);
            const flatIndex = channels.findIndex((c) => c.index === next);
            if (flatIndex >= 0) focusChannelByFlatIndex(flatIndex);
            selectChannel(next);
          }
          break;
        }
        case 'channel-down': {
          const prev = Math.max(currentIndex - 1, 0);
          if (prev !== currentIndex) {
            currentIndex = prev;
            setActiveChannel(prev);
            const flatIndex = channels.findIndex((c) => c.index === prev);
            if (flatIndex >= 0) focusChannelByFlatIndex(flatIndex);
            selectChannel(prev);
          }
          break;
        }
        case 'select':
          selectChannel(action.channelIndex);
          break;
        case 'play-pause':
          player.togglePlay();
          break;
        case 'seek':
          player.seek(action.delta);
          break;
        case 'volume':
          player.setVolume(action.delta);
          break;
        case 'back':
          videoEl.blur();
          const flatIndex = channels.findIndex((c) => c.index === currentIndex);
          if (flatIndex >= 0) focusChannelByFlatIndex(flatIndex);
          break;
      }
    },
  );
}

function selectChannel(index: number): void {
  const channel = channels.find((c) => c.index === index);
  if (!channel) return;

  currentIndex = index;
  setActiveChannel(index);
  updateNowPlaying(document.getElementById('now-playing'), channel);
  player.load(channel.url);
}

document.addEventListener('DOMContentLoaded', init);
