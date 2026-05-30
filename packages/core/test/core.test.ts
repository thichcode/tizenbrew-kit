import { createManifest, validateConfig } from '../src/index';
import { describe, expect, it } from 'vitest';

const validConfig = {
  name: 'facebook-reels-lite',
  displayName: 'Facebook Reels Lite',
  version: '0.1.0',
  description: 'Lightweight TV web module',
  targetUrl: 'https://www.facebook.com/reel',
  inject: {
    scripts: ['src/inject.ts'],
    styles: ['src/style.css'],
  },
};

describe('@tizenbrew-kit/core', () => {
  it('validates a correct config', () => {
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  it('throws for invalid URL', () => {
    expect(() =>
      validateConfig({
        ...validConfig,
        targetUrl: 'invalid-url',
      }),
    ).toThrow(/targetUrl/);
  });

  it('creates manifest with expected defaults', () => {
    const manifest = createManifest(validConfig);
    expect(manifest.name).toBe('facebook-reels-lite');
    expect(manifest.capabilities.tvKeys.arrows).toBe(true);
    expect(manifest.capabilities.performance.memorySaver).toBe(false);
  });
});
