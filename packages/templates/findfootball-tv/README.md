# FindFootball TV

TizenBrew module: lich bong da + chon link xem (HLS) tren TV Samsung.

## Chuc nang (2)

1. **Quet lich (trigger crawl)** — nut "Quet lich moi" goi `POST /api/crawl`
   ve backend, poll `GET /api/crawl-status` hien tien trinh.
2. **Chon phat (select player)** — list tran co `streamUrl` tu
   `matches.json`, Enter de phat qua AVPlay (uu tien, Tizen 3-4),
   fallback `<video>` native.

## Cau hinh

- Backend mac dinh: `https://find-football-tizenbrew.onrender.com`
- Doi backend: mo man hinh Cai dat trong app (luu localStorage).

## Build / Package

```bash
pnpm exec tizenbrew-kit doctor
pnpm exec tizenbrew-kit build
pnpm exec tizenbrew-kit package
```

## Cai len TV

Lay `release/findfootball-tv-0.1.0.zip` (hoac URL publish npm)
nap vao TizenBrew module store/URL tren TV.
