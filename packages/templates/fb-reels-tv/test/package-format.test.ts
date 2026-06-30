import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('Facebook Reels TV package format', () => {
  it('publishes under the requested public npm package name', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.name).toBe('@kv8n2oryk/fb-reels-tv');
    expect(pkg.private).toBeUndefined();
    expect(pkg.publishConfig).toEqual({ access: 'public' });
  });

  it('uses the TizenBrew app package format', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.packageType).toBe('app');
    expect(pkg.appName).toBe('Facebook Reels TV');
    expect(pkg.appPath).toBe('index.html');
    expect(pkg.files).toEqual(['index.html', 'dist']);
  });

  it('includes Samsung/Tizen remote key support in the inject source', () => {
    const injectSource = readFileSync(resolve(root, 'src/inject.ts'), 'utf8');

    expect(injectSource).toContain('10009');
    expect(injectSource).toContain('10190');
    expect(injectSource).toContain('10252');
    expect(injectSource).toContain('ArrowUp');
    expect(injectSource).toContain('ArrowDown');
    expect(injectSource).toContain('[fb-reels-tv]');
  });
});
