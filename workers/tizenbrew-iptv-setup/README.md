# TizenBrew IPTV Setup Worker

Cloudflare Worker relay for setting a playlist URL on a TizenBrew IPTV app through a QR code flow.

## API

- `GET /setup?code=ABC123` renders the phone setup form.
- `POST /api/config` stores `{ "code": "ABC123", "playlistUrl": "https://example.com/list.m3u" }`.
- `GET /api/config?code=ABC123` returns `{ "playlistUrl": "https://example.com/list.m3u" }` after the phone submits it.

## Deploy

Install dependencies from this folder if needed:

```bash
pnpm install
```

Create the KV namespace:

```bash
pnpm exec wrangler kv namespace create PLAYLIST_CONFIGS
```

Copy the generated KV namespace `id` into `wrangler.toml`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`.

Deploy:

```bash
pnpm exec wrangler deploy
```

After deploy, send the Worker URL back so the TV app can use it as `SETUP_API_BASE`.

## Local Test

```bash
pnpm exec vitest run test/index.test.ts
```
