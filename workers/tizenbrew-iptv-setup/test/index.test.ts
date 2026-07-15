import { describe, expect, it } from 'vitest';
import worker, { Env } from '../src/index';

class MemoryKV {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function env(): Env {
  return { PLAYLIST_CONFIGS: new MemoryKV() };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('tizenbrew IPTV setup worker', () => {
  it('serves the setup form for a valid device code', async () => {
    const response = await worker.fetch(new Request('https://setup.example.com/setup?code=ABC123'), env());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('ABC123');
  });

  it('rejects missing setup code', async () => {
    const response = await worker.fetch(new Request('https://setup.example.com/setup'), env());

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({ error: 'Missing or invalid code' });
  });

  it('rejects invalid playlist URLs', async () => {
    const response = await worker.fetch(
      new Request('https://setup.example.com/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'ABC123', playlistUrl: 'javascript:alert(1)' }),
      }),
      env(),
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({ error: 'Invalid playlistUrl' });
  });

  it('stores and returns a playlist URL by code', async () => {
    const testEnv = env();
    const playlistUrl = 'https://example.com/list.m3u';

    const post = await worker.fetch(
      new Request('https://setup.example.com/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'ABC123', playlistUrl }),
      }),
      testEnv,
    );
    expect(post.status).toBe(200);
    expect(await json(post)).toEqual({ ok: true });

    const get = await worker.fetch(new Request('https://setup.example.com/api/config?code=ABC123'), testEnv);
    expect(get.status).toBe(200);
    expect(await json(get)).toEqual({ playlistUrl });
  });

  it('returns pending for a code without submitted playlist', async () => {
    const response = await worker.fetch(new Request('https://setup.example.com/api/config?code=ABC123'), env());

    expect(response.status).toBe(404);
    expect(await json(response)).toEqual({ pending: true });
  });
});
