export default {
  name: 'fb-reels-tv',
  displayName: 'Facebook Reels TV',
  version: '0.1.0',
  description: 'Facebook Reels TV helper for TizenBrew on Samsung Tizen 3',
  targetUrl: 'https://www.facebook.com/reel',
  inject: {
    scripts: ['src/inject.ts'],
    styles: ['src/style.css'],
  },
  tvKeys: {
    arrows: true,
    enter: true,
    back: true,
    playPause: true,
  },
  performance: {
    removeAnimations: true,
    lazyMedia: true,
    hideComments: true,
    memorySaver: true,
  },
};
