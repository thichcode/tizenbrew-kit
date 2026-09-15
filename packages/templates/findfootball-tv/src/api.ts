// API client cho backend find_football (Render). Dung XHR de chay
// duoc ca tren WebKit cu (Tizen 3-4) khong co fetch day du.

export interface StreamLink {
  label: string;
  url: string;
  streamUrl?: string;
}

export interface MatchItem {
  home: string;
  away: string;
  league: string;
  kickoffISO: string;
  isLive: boolean;
  links: StreamLink[];
}

export interface Playable {
  id: number;
  title: string;
  time: string;
  streamUrl: string;
  pageUrl: string;
}

const DEFAULT_BASE = 'https://find-football-tizenbrew.onrender.com';
const LS_KEY = 'findfootball_tv_base';

export function getBaseUrl(): string {
  try {
    return localStorage.getItem(LS_KEY) || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export function setBaseUrl(url: string): void {
  try {
    localStorage.setItem(LS_KEY, url.replace(/\/+$/, ''));
  } catch {
    // bo qua khi khong co localStorage
  }
}

function request(method: string, path: string, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, getBaseUrl() + path, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText || '{}'));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      } else {
        reject(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(body === undefined ? null : JSON.stringify(body));
  });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

export async function getMatches(): Promise<MatchItem[]> {
  const data = await request('GET', '/matches.json');
  return Array.isArray(data) ? (data as MatchItem[]) : [];
}

// List phang cac stream xem duoc (co streamUrl), moi nhat truoc.
export function toPlayables(matches: MatchItem[]): Playable[] {
  const out: Playable[] = [];
  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime(),
  );
  for (const m of sorted) {
    for (const l of m.links || []) {
      if (!l.streamUrl) continue;
      out.push({
        id: out.length,
        title: `${m.home} vs ${m.away} — ${l.label}`,
        time: fmtTime(m.kickoffISO),
        streamUrl: l.streamUrl,
        pageUrl: l.url,
      });
    }
  }
  return out;
}

export function triggerCrawl(): Promise<{ ok: boolean; count?: number }> {
  return request('POST', '/api/crawl').then((r) => r as { ok: boolean; count?: number });
}

export function crawlStatus(): Promise<{ crawling: boolean }> {
  return request('GET', '/api/crawl-status').then((r) => r as { crawling: boolean });
}

export function triggerSniff(pageUrl: string): Promise<{ ok: boolean; streamUrl?: string }> {
  return request('POST', '/api/sniff', { url: pageUrl }).then(
    (r) => r as { ok: boolean; streamUrl?: string },
  );
}
