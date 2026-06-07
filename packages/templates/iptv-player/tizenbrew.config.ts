export default {
  name: 'iptv-player',
  displayName: 'IPTV Player',
  version: '0.1.0',
  description: 'TV-friendly IPTV channel player with remote control support',
  targetUrl: 'index.html',
  inject: {
    scripts: ['src/inject.ts'],
    styles: ['src/style.css'],
  },
  tvKeys: {
    arrows: true,
    enter: true,
    back: true,
    playPause: true,
    numbers: true,
    volume: true,
  },
};
