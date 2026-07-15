export interface Channel {
  name: string;
  url: string;
  group?: string;
  logo?: string;
  index: number;
}

export const DEFAULT_PLAYLIST_URL =
  'https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv';

export function fetchPlaylist(url = DEFAULT_PLAYLIST_URL): Promise<Channel[]> {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parseM3U(xhr.responseText));
        } else {
          reject(new Error('Failed to fetch playlist: ' + xhr.status + ' ' + xhr.statusText));
        }
      }
    };
    xhr.onerror = function () {
      reject(new Error('Network error fetching playlist'));
    };
    xhr.send();
  });
}

export function parseM3U(content: string): Channel[] {
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF:')) continue;

    const infoMatch = line.match(/#EXTINF:-?\d+[^,]*,(.*)/);
    if (!infoMatch) continue;

    const name = infoMatch[1].trim();
    const groupMatch = line.match(/group-title="([^"]*)"/);
    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
    let skip = 1;
    while (lines[i + skip] && lines[i + skip].trim().startsWith('#')) skip++;
    const urlLine = lines[i + skip]?.trim();

    if (urlLine && !urlLine.startsWith('#')) {
      channels.push({
        name,
        url: urlLine,
        group: groupMatch?.[1] || detectGroup(name),
        logo: logoMatch?.[1],
        index: channels.length,
      });
      i += skip;
    }
  }

  return channels;
}

function detectGroup(name: string): string {
  const upper = name.toUpperCase();
  for (const prefix of ['VTV', 'HTVC', 'HTV', 'SCTV', 'THVL', 'BTV', 'KTV', 'NTV', 'K+', 'BBC', 'CNN']) {
    if (upper.startsWith(prefix)) return prefix;
  }
  return 'Other';
}
