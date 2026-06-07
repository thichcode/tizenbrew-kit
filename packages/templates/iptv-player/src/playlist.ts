export interface Channel {
  name: string;
  url: string;
  group?: string;
  logo?: string;
  index: number;
}

const PLAYLIST_URL = 'https://raw.githubusercontent.com/thichcode/thichcode/main/filtered_playlist.m3u';

export async function fetchPlaylist(): Promise<Channel[]> {
  const response = await fetch(PLAYLIST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return parseM3U(text);
}

export function parseM3U(content: string): Channel[] {
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const infoMatch = line.match(/#EXTINF:-?\d+,(.*)/);
      if (!infoMatch) continue;

      const name = infoMatch[1].trim();
      let group: string | undefined;
      const groupMatch = line.match(/group-title="([^"]*)"/);
      if (groupMatch) {
        group = groupMatch[1];
      } else {
        group = detectGroup(name);
      }

      const urlLine = lines[i + 1]?.trim();
      if (urlLine && !urlLine.startsWith('#')) {
        channels.push({
          name,
          url: urlLine,
          group,
          index,
        });
        index++;
        i++;
      }
    }
  }

  return channels;
}

function detectGroup(name: string): string {
  const upper = name.toUpperCase();
  if (upper.startsWith('VTV')) return 'VTV';
  if (upper.startsWith('HTV')) return 'HTV';
  if (upper.startsWith('HTVC')) return 'HTVC';
  if (upper.startsWith('SCTV')) return 'SCTV';
  if (upper.startsWith('THVL')) return 'THVL';
  if (upper.startsWith('BTV')) return 'BTV';
  if (upper.startsWith('KTV')) return 'KTV';
  if (upper.startsWith('NTV')) return 'NTV';
  if (upper.startsWith('K+') || upper.startsWith('K+')) return 'K+';
  if (upper.startsWith('BBC')) return 'BBC';
  if (upper.startsWith('CNN')) return 'CNN';
  return 'Other';
}
