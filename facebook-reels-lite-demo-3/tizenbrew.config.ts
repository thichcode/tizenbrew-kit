export default {
  name: 'facebook-reels-lite',
  displayName: 'Facebook Reels Lite',
  version: '0.1.0',
  description: 'Safe lightweight TV helper for Facebook Reels browsing',
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
    hideComments: false,
    memorySaver: true,
  },
};
