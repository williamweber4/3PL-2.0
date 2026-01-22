# 3PL Marketplace

Map-first warehouse and 3PL listing marketplace powered by Next.js, PostGIS, and MapLibre.

## Quick Start

```bash
docker compose up -d
pnpm install
pnpm db:migrate
pnpm ingest
pnpm dev
```

Set environment variables in `.env.local`:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/threepl
ADMIN_PASSWORD=changeme
NEXT_PUBLIC_TILE_STYLE_URL=https://demotiles.maplibre.org/style.json
```

### Optional: Local tiles

Download an `.mbtiles` file into `data/tiles` and run:

```bash
docker compose --profile tiles up -d
```

Then set:

```bash
NEXT_PUBLIC_TILE_STYLE_URL=http://localhost:8080/styles/basic/style.json
```

## Ingestion

* `pnpm ingest` scrapes public 3plfinder.com listings, queues them, and processes them.
* `pnpm ingest:delta` only refreshes the queue (then run `pnpm worker` to process).
* `pnpm worker` runs a queue worker to process crawl jobs.

If latitude/longitude is missing, listings are stored with `needs_geocode = true` and still appear in the sidebar list.

To enable local geocoding with Nominatim:

```bash
docker compose --profile geocode up -d
```

Then set:

```bash
NOMINATIM_URL=http://localhost:7070
```

## Admin Sponsorships

`/admin` is protected by `ADMIN_PASSWORD` via the `x-admin-password` header. Use a browser extension or proxy to set it.

## Scaling Notes

* Listings use a `geom` geography column with a GIST index and bounding-box queries.
* Text search is backed by `pg_trgm` and a `search_vector` tsvector index.
* For massive scale, partition `listings` by `state` or hash partition by `id` (see `db/migrations/001_init.sql`).
