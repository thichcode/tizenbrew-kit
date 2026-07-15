import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('tizenbrew-iptv package', () => {
  it('publishes as a root index.html + dist app like @kv8n2oryk/iptv-player', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    expect(pkg.name).toBe('tizenbrew-iptv');
    expect(pkg.packageType).toBe('app');
    expect(pkg.appName).toBe('IPTV Player');
    expect(pkg.appPath).toBe('index.html');
    expect(pkg.files).toEqual(['index.html', 'dist']);
    expect(pkg.serviceFile).toBeUndefined();
    expect(pkg.evaluateScriptOnDocumentStart).toBeUndefined();
  });

  it('loads the original-style injected player from root index.html', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');

    expect(html).toContain('Loading IPTV Player');
    expect(html).toContain('<script src="./dist/inject.js"></script>');
    expect(html).not.toContain('./app.js');
  });

  it('keeps original player behavior while replacing hardcoded playlist with QR setup', () => {
    const inject = readFileSync(resolve(root, 'dist/inject.js'), 'utf8');

    expect(inject).toContain('IPTV Player');
    expect(inject).toContain('fullscreen-mode');
    expect(inject).toContain('ChannelUp');
    expect(inject).toContain('VolumeUp');
    expect(inject).toContain('group-title="([^"]*)"');
    expect(inject).toContain('tizenbrew-iptv-setup.dvt-kisu.workers.dev');
    expect(inject).toContain('/setup?code=');
    expect(inject).toContain('/api/config?code=');
    expect(inject).toContain('localStorage');
    expect(inject).toContain('XMLHttpRequest');
    expect(inject).not.toMatch(/raw\.githubusercontent\.com|filtered_playlist|api\.qrserver\.com/);
    expect(inject).not.toMatch(/\bfetch\s*\(|async\s+function|=>|\bconst\b|\blet\b|\?\./);
  });

  it('uses table-based QR rendering (no canvas), has mapData fix, and has Change playlist menu', () => {
    const inject = readFileSync(resolve(root, 'dist/inject.js'), 'utf8');

    expect(inject).not.toMatch(/canvas|getContext/);
    expect(inject).toContain('createElement("table")');
    expect(inject).toContain('createElement("td")');
    expect(inject).toContain('row -= inc');
    expect(inject).toContain('Change playlist');
    expect(inject).toContain('menu-item');
  });
});
