# Headless WordPress Setup

ElectrikJam keeps WordPress on Kinsta as the CMS while Astro/Cloudflare Pages serves the public front end.

## Recommended Model

- WordPress remains the editorial interface.
- A private GitHub Action connects to Kinsta over SSH.
- The action runs the WordPress export via WP-CLI.
- Astro imports that export into `src/content` and `src/data`.
- The action commits the updated content snapshot back to GitHub.
- Cloudflare Pages deploys the static Astro front end from GitHub.

This avoids exposing a public content export endpoint and avoids Kinsta/Cloudflare bot protection blocking Cloudflare Pages builds.

## Why Not Public REST Export?

The WordPress export plugin works inside WordPress, but the public REST endpoint is challenged by Kinsta/Cloudflare bot protection before requests reach WordPress. Because of that, the reliable production path is SSH/WP-CLI export into GitHub Actions.

The plugin remains in `wordpress/electrikjam-headless-export.php` as an optional tool, but it is not required for the recommended flow.

## GitHub Secrets

Add these repository secrets in GitHub:

```text
WP_SSH_HOST=144.24.26.68
WP_SSH_PORT=41141
WP_SSH_USER=electrikjam
WP_SSH_PASSWORD=<Kinsta SSH password>
WP_PATH=/www/electrikjam_275/public
```

The workflow is:

```text
.github/workflows/sync-wordpress.yml
```

It can be run manually from GitHub Actions.

## Cloudflare Pages Build

Cloudflare Pages should keep using:

```text
Build command: npm run build
Output directory: dist
Production branch: main
```

Do not set WordPress SSH secrets in Cloudflare Pages. WordPress sync happens in GitHub Actions, then Cloudflare deploys the committed static snapshot.

## Publishing Flow

1. Editor publishes or updates content in WordPress.
2. Run the GitHub Action manually, or trigger it with a WordPress webhook later.
3. The action exports WordPress content over SSH.
4. The action imports content into Astro.
5. The action verifies the Astro build.
6. The action commits content changes to `main`.
7. Cloudflare Pages deploys from GitHub.

## Future Automation

Later, add a small WordPress hook on `save_post` that triggers GitHub's `repository_dispatch` event:

```text
wordpress-content-updated
```

For now, manual action runs are safer while migration parity is still being checked.

## Launch Notes

Before switching `www.electrikjam.com` to Cloudflare Pages:

- Keep WordPress reachable for admin/CMS work.
- Move WordPress admin/media to a CMS hostname such as `cms.electrikjam.com`.
- Update imported media handling once the final CMS hostname is decided.
- Keep staging noindexed until launch.
- Keep Kinsta available as rollback until parity checks pass.
