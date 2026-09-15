import {
  getMatches,
  toPlayables,
  triggerCrawl,
  crawlStatus,
  getBaseUrl,
  setBaseUrl,
} from './api.js';
import { TvPlayer } from './player.js';
import { setItems, getItems, renderList, focusItem, setStatus, setNow, setCount } from './ui.js';
import { setupRemote } from './remote.js';

let player: TvPlayer;
let listEl: HTMLElement | null;
let statusEl: HTMLElement | null;
let nowEl: HTMLElement | null;
let countEl: HTMLElement | null;
let crawlBtn: HTMLButtonElement | null;
let settingsEl: HTMLElement | null;
let baseInput: HTMLInputElement | null;
let polling = false;

async function loadList(): Promise<void> {
  setStatus(statusEl, 'Dang tai lich...');
  try {
    const matches = await getMatches();
    const playables = toPlayables(matches);
    setItems(playables);
    if (listEl) renderList(listEl, (i) => playAt(i));
    setCount(countEl, playables.length);
    setStatus(statusEl, playables.length ? 'San sang' : 'Chua co link xem');
    focusItem(0);
  } catch {
    setStatus(statusEl, 'Loi mang. Kiem tra backend URL trong Cai dat.');
  }
}

function playAt(i: number): void {
  const list = getItems();
  const it = list[i];
  if (!it) return;
  setNow(nowEl, 'Dang phat: ' + it.title);
  setStatus(statusEl, 'Dang tai stream...');
  player.play(it.streamUrl);
}

async function onCrawl(): Promise<void> {
  if (polling) return;
  setStatus(statusEl, 'Dang goi crawl...');
  try {
    // POST crawl (server co the mat vai phut) + poll status song song.
    const p = triggerCrawl();
    polling = true;
    const timer = setInterval(async () => {
      try {
        const s = await crawlStatus();
        setStatus(statusEl, s.crawling ? 'Dang quet lich...' : 'Sap xong...');
        if (!s.crawling) {
          clearInterval(timer);
          polling = false;
        }
      } catch {
        // giu spinner
      }
    }, 5000);
    const r = await p;
    clearInterval(timer);
    polling = false;
    setStatus(statusEl, r.ok ? `Quet xong: ${r.count ?? '?'} tran` : 'Crawl loi');
    await loadList();
  } catch {
    polling = false;
    setStatus(statusEl, 'Crawl loi (server ban hoac dang chay). Thu lai sau.');
  }
}

function toggleSettings(show: boolean): void {
  if (settingsEl) settingsEl.style.display = show ? 'block' : 'none';
  if (show && baseInput) baseInput.value = getBaseUrl();
}

async function saveSettings(): Promise<void> {
  if (baseInput && baseInput.value.trim()) setBaseUrl(baseInput.value.trim());
  toggleSettings(false);
  await loadList();
}

function buildUI(): void {
  document.body.innerHTML =
    '<div id="app">' +
    '<header><h1>FindFootball TV</h1><span id="cnt"></span></header>' +
    '<div id="main"><div id="player-wrap"><video id="player" playsinline></video>' +
    '<div id="now">Chua chon tran</div></div>' +
    '<aside id="side"><div id="actions">' +
    '<button id="btn-crawl">Quet lich moi</button>' +
    '<button id="btn-reload">Tai lai</button>' +
    '<button id="btn-settings">Cai dat</button>' +
    '</div><div id="list"></div></div></div>' +
    '<div id="settings" style="display:none"><label>Backend URL</label>' +
    '<input id="base" type="text"><button id="btn-save">Luu</button></div>' +
    '<footer id="bar"><span id="st">Khoi dong...</span></footer></div>';
  listEl = document.getElementById('list');
  statusEl = document.getElementById('st');
  nowEl = document.getElementById('now');
  countEl = document.getElementById('cnt');
  settingsEl = document.getElementById('settings');
  baseInput = document.getElementById('base') as HTMLInputElement | null;
  crawlBtn = document.getElementById('btn-crawl') as HTMLButtonElement | null;
  player = new TvPlayer(document.getElementById('player') as HTMLVideoElement | null);
  player.on({
    onError: (m) => setStatus(statusEl, 'Loi phat: ' + m),
    onPlaying: () => setStatus(statusEl, 'Dang phat'),
  });
  crawlBtn?.addEventListener('click', () => void onCrawl());
  document.getElementById('btn-reload')?.addEventListener('click', () => void loadList());
  document.getElementById('btn-settings')?.addEventListener('click', () => toggleSettings(true));
  document.getElementById('btn-save')?.addEventListener('click', () => void saveSettings());
}

function start(): void {
  buildUI();
  setupRemote((a) => {
    if (a.type === 'back') {
      if (settingsEl && settingsEl.style.display === 'block') {
        toggleSettings(false);
        return;
      }
      player.stop();
      setNow(nowEl, 'Chua chon tran');
      focusItem(0);
    } else if (a.type === 'play-pause') {
      player.pauseToggle();
    } else if (a.type === 'enter') {
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.click();
    }
  });
  void loadList();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
