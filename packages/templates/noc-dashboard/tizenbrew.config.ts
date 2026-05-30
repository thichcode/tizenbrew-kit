import { defineTizenBrewModule } from '@tizenbrew-kit/core';

export default defineTizenBrewModule({
  name: 'noc-dashboard',
  displayName: 'NOC Dashboard TV View',
  version: '0.1.0',
  description: 'TV-friendly internal NOC dashboard helper',
  targetUrl: 'https://example.internal/dashboard',
  inject: {
    scripts: ['src/inject.ts'],
    styles: ['src/style.css'],
  },
});
