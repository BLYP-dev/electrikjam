# ElectrikJam Astro Migration

Static-first Astro migration for `www.electrikjam.com`, staged on Cloudflare Pages before launch.

## Commands

- `npm run dev` starts the local Astro server.
- `npm run build` validates and builds the static site into `dist/`.
- `npm run import:wordpress` imports WordPress REST content.
- `WP_EXPORT_FILE=wordpress-export.json npm run import:wordpress` imports a WP-CLI JSON export.
- `npm run audit:urls` writes `url-inventory.csv`.
- `npm run compare:parity` writes `parity-report.csv`.

## Staging Protection

The staging build is blocked from indexing with:

- `public/robots.txt`
- `public/_headers`

Do not remove noindex protection until the final production launch plan.
