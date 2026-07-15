import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('IPTV package format', () => {
  it('publishes as the app package format used by 0.1.5', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.packageType).toBe('app');
    expect(pkg.appPath).toBe('index.html');
    expect(pkg.keys).toEqual([]);
    expect(pkg.files).toEqual(['index.html', 'dist']);
  });

  it('includes auto fullscreen behavior in the app bundle source', () => {
    const injectSource = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(injectSource).toContain('AUTO_FULLSCREEN_DELAY = 10000');
    expect(injectSource).toContain('fullscreen-mode');
    expect(injectSource).toContain('resetFullscreenTimer');
  });
});
