# Headless WordPress Setup

ElectrikJam can keep WordPress as the CMS while Astro/Cloudflare Pages serves the public front end.

## Model

- WordPress on Kinsta remains the editorial CMS.
- Astro builds a static site from a WordPress JSON export.
- Cloudflare Pages serves the front end.
- A WordPress publish/update webhook can trigger a Cloudflare Pages deploy.
- The public front end keeps canonicals on `https://www.electrikjam.com`.

## Current Build Behavior

`npm run build` now runs `npm run sync:wordpress` first.

If no WordPress sync source is configured, the sync step exits cleanly and Astro builds from the committed content snapshot.

If `WP_EXPORT_URL` or `WP_EXPORT_FILE` is configured, the sync step imports fresh WordPress content before Astro builds.

## Cloudflare Pages Environment Variables

Set these in Cloudflare Pages when the WordPress export endpoint is installed:

```text
WP_EXPORT_URL=https://cms.electrikjam.com/wp-json/electrikjam/v1/export
WP_EXPORT_TOKEN=<secret token>
WP_IMPORT_LIMIT=-1
WP_PAGE_IMPORT_LIMIT=-1
WP_MEDIA_MODE=remote
WP_MEDIA_ORIGIN=https://cms.electrikjam.com
```

Use `WP_MEDIA_MODE=local` only when media is synced into `public/wp-content/uploads` before the build.

## WordPress Export Endpoint

Install `wordpress/electrikjam-headless-export.php` as a WordPress plugin.

Configure a token in WordPress/Kinsta, preferably in `wp-config.php`:

```php
define('EJ_HEADLESS_EXPORT_TOKEN', 'replace-with-a-long-random-secret');
```

The endpoint is:

```text
/wp-json/electrikjam/v1/export
```

The build sends the token as:

```text
Authorization: Bearer <secret token>
```

## Deployment Flow

1. Editor publishes or updates content in WordPress.
2. WordPress triggers a Cloudflare Pages deploy hook.
3. Cloudflare runs `npm run build`.
4. `sync:wordpress` fetches the export.
5. Astro imports content and builds the static site.
6. Cloudflare deploys the updated front end.

## Launch Notes

Before switching `www.electrikjam.com` to Cloudflare Pages:

- Keep WordPress reachable at a CMS/admin hostname such as `cms.electrikjam.com`.
- Keep the WordPress public front end blocked from indexing once Astro is production.
- Make sure media URLs point either to the Astro static media copy or to the CMS media origin.
- Keep Kinsta available as rollback until parity checks pass.
