export default {
  name: 'blank-module',
  displayName: 'Blank Module',
  version: '0.1.0',
  description: 'Starter template for a lightweight TizenBrew-compatible module',
  targetUrl: 'https://example.com',
  inject: {
    scripts: ['src/inject.ts'],
    styles: ['src/style.css'],
  },
};
