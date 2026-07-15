export default {
  name: 'tizeniptv',
  displayName: 'TizenIPTV',
  version: '1.2.5',
  description: 'Tizen IPTV player for TizenBrew with remote control',
  targetUrl: 'https://localhost',
  inject: {
    scripts: ['src/inject.ts'],
    styles: [],
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
