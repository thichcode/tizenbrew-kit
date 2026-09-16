export default {
  name: 'findfootball-tv',
  displayName: 'FindFootball TV',
  version: '0.1.0',
  description: 'Lich bong da + chon link xem (HLS) qua AVPlay',
  targetUrl: 'https://find-football-tizenbrew.onrender.com',
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
