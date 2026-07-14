export default {
  name: 'fb-reels-tv',
  displayName: 'ShortVideo TV',
  version: '0.1.20',
  description: 'Public short-video feed player for TizenBrew on Samsung Tizen 3',
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
  },
};
