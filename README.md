# TizenBrew Kit

`@tizenbrew-kit/core` + `@tizenbrew-kit/cli` is a TypeScript monorepo for creating lightweight, TizenBrew-compatible TV web modules.

## What this project is
- A developer productivity toolkit
- A typed config + manifest helper library
- A CLI for scaffolding, development, build, packaging, and diagnostics

## What this project is not
- Not the TizenBrew source code
- Not a DRM bypass or authentication bypass tool
- Not a private-data scraping toolkit

## Requirements
- Node.js >= 20
- pnpm

## Installation
```bash
pnpm install
pnpm -r build
```

## Quick start
```bash
pnpm --filter @tizenbrew-kit/cli build
pnpm exec tizenbrew-kit create my-tv-module -t blank
cd my-tv-module
pnpm exec tizenbrew-kit doctor
pnpm exec tizenbrew-kit build
pnpm exec tizenbrew-kit package
```

## CLI commands
- `tizenbrew-kit create <name> --template <blank|youtube-tv-lite|facebook-reels-lite|noc-dashboard>`
- `tizenbrew-kit dev`
- `tizenbrew-kit build`
- `tizenbrew-kit package`
- `tizenbrew-kit doctor`

## Config reference
```ts
import { defineTizenBrewModule } from '@tizenbrew-kit/core';

export default defineTizenBrewModule({
  name: 'facebook-reels-lite',
  displayName: 'Facebook Reels Lite',
  version: '0.1.0',
  description: 'Lightweight TV web module',
  targetUrl: 'https://www.facebook.com/reel',
  inject: {
    scripts: ['src/inject.ts'],
    styles: ['src/style.css'],
  },
  tvKeys: {
    arrows: true,
    enter: true,
    back: true,
    playPause: true,
  },
  performance: {
    removeAnimations: true,
    lazyMedia: true,
    hideComments: false,
    memorySaver: true,
  },
});
```

## Templates
- `blank`: minimal starter files
- `facebook-reels-lite`: safe UI simplification + TV navigation helper
- `youtube-tv-lite`: YouTube TV navigation helper (no ad-blocking claims)
- `noc-dashboard`: internal dashboard TV mode helper

## Build module
```bash
tizenbrew-kit build
```
Outputs:
- `dist/*.js` bundled scripts
- `dist/*.css`
- `dist/manifest.json`
- `dist/module.json`
- `dist/README.md`

## Package module
```bash
tizenbrew-kit package
```
Output:
- `release/<module-name>-<version>.zip`

## Use with TizenBrew
1. Build and package module.
2. Extract/copy `dist/` artifacts into your TizenBrew module workflow.
3. Ensure target URL and asset names match your loader expectations.

## Troubleshooting
- Run `tizenbrew-kit doctor`
- Ensure `tizenbrew.config.ts` exists
- Ensure `inject.scripts` and `inject.styles` files exist
- Ensure Node version >= 20

## Security notes
- Do not include credential harvesting logic.
- Do not collect private user data.
- Keep scripts transparent and reviewable.

## Legal notes
- Respect website ToS and local regulations.
- Do not bypass authentication/DRM/paid content protections.
- Do not use unofficial APIs for restricted access.

## GitHub Actions (CI/Release/NPM)

This repository includes workflows:

- `ci.yml`: lint + test + build on PR and push to `main`
- `release.yml`: on tag `v*.*.*`, run checks, publish to npm, create GitHub Release
- `tag-on-main.yml`: manual workflow to create git tag from `package.json` version

### Required GitHub Secrets

- `NPM_TOKEN`: npm automation token with publish permission for:
  - `@tizenbrew-kit/core`
  - `@tizenbrew-kit/cli`

### Typical release flow

1. Bump versions in package files.
2. Merge to `main`.
3. Run **Tag from package version** workflow (or push `vX.Y.Z` tag manually).
4. `release.yml` publishes npm packages and creates GitHub Release notes.
