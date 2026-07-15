import { Channel } from './playlist.js';

let currentFocusIndex = 0;
let channels: Channel[] = [];

export function setChannels(ch: Channel[]): void {
  channels = ch;
}

export function renderChannelList(container: HTMLElement, onSelect: (index: number) => void, onFocused: (index: number) => void): void {
  container.innerHTML = '';

  const grouped = groupChannels(channels);
  let flatIndex = 0;

  for (const entry of grouped) {
    const group = entry.group;
    const groupHeader = document.createElement('div');
    groupHeader.className = 'channel-group';
    groupHeader.textContent = group;
    container.appendChild(groupHeader);

    for (const ch of entry.channels) {
      const btn = document.createElement('button');
      btn.className = 'channel-item';
      btn.textContent = `${flatIndex + 1}. ${ch.name}`;
      btn.dataset.index = String(ch.index);
      btn.dataset.flatIndex = String(flatIndex);

      btn.addEventListener('click', () => {
        onSelect(ch.index);
      });

      btn.addEventListener('focus', () => {
        currentFocusIndex = flatIndex;
        onFocused(ch.index);
      });

      container.appendChild(btn);
      flatIndex++;
    }
  }

  updateCount(container.parentElement?.querySelector('#channel-count') as HTMLElement);
}

function groupChannels(ch: Channel[]): Array<{ group: string; channels: Channel[] }> {
  const groups: Array<{ group: string; channels: Channel[] }> = [];
  for (const c of ch) {
    const group = c.group || 'Other';
    let entry = groups.find((item) => item.group === group);
    if (!entry) {
      entry = { group, channels: [] };
      groups.push(entry);
    }
    entry.channels.push(c);
  }
  return groups;
}

function updateCount(el: HTMLElement | null): void {
  if (el) {
    el.textContent = `${channels.length} channels`;
  }
}

export function setActiveChannel(index: number): void {
  const items = document.querySelectorAll('.channel-item');
  for (let i = 0; i < items.length; i++) {
    const btn = items[i] as HTMLButtonElement;
    const chIdx = parseInt(btn.dataset.index || '-1', 10);
    if (chIdx === index) {
      btn.classList.add('active');
      btn.scrollIntoView(false);
    } else {
      btn.classList.remove('active');
    }
  }
}

export function focusChannelByFlatIndex(flatIndex: number): void {
  const items = document.querySelectorAll('.channel-item');
  if (flatIndex >= 0 && flatIndex < items.length) {
    (items[flatIndex] as HTMLElement).focus();
  }
}

export function getCurrentFocusIndex(): number {
  return currentFocusIndex;
}

export function setCurrentFocusIndex(i: number): void {
  currentFocusIndex = i;
}

export function updateNowPlaying(el: HTMLElement | null, channel: Channel | null): void {
  if (el) {
    el.textContent = channel ? `Now Playing: ${channel.name}` : 'No channel selected';
  }
}

export function updateStatus(el: HTMLElement | null, text: string): void {
  if (el) {
    el.textContent = text;
  }
}
