export default {
  name: 'youtube-tv-lite',
  displayName: 'YouTube TV Lite',
  version: '0.1.0',
  description: 'Lightweight helper for YouTube TV navigation on Tizen',
  targetUrl: 'https://www.youtube.com/tv',
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
};
