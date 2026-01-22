import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { LRUCache } from 'lru-cache';

const MAX_POINTS = 1000;
const cache = new LRUCache<string, unknown>({ max: 200, ttl: 1000 * 30 });

export async function GET(request: NextRequest) {
  const cacheKey = request.url;
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get('bbox');
  const state = searchParams.get('state');
  const city = searchParams.get('city');
  const types = searchParams.get('types');
  const services = searchParams.get('services');
  const minSqft = searchParams.get('minSqft');
  const maxSqft = searchParams.get('maxSqft');
  const keyword = searchParams.get('keyword');

  if (!bbox) {
    return NextResponse.json({ error: 'bbox is required' }, { status: 400 });
  }

  const [west, south, east, north] = bbox.split(',').map(Number);
  if ([west, south, east, north].some((value) => Number.isNaN(value))) {
    return NextResponse.json({ error: 'bbox must be comma-separated numbers' }, { status: 400 });
  }

  const mapFilters: string[] = [];
  const mapValues: Array<string | number | string[]> = [west, south, east, north];
  const listFilters: string[] = [];
  const listValues: Array<string | number | string[]> = [];

  const addFilter = (condition: string, value: string | number | string[]) => {
    mapValues.push(value);
    mapFilters.push(condition.replace('?', `$${mapValues.length}`));
    listValues.push(value);
    listFilters.push(condition.replace('?', `$${listValues.length}`));
  };

  if (state) addFilter('state = ?', state);
  if (city) addFilter('city = ?', city);
  if (types) addFilter('types && ?::text[]', types.split(',').map((type) => type.trim()));
  if (services) addFilter('services && ?::text[]', services.split(',').map((service) => service.trim()));
  if (minSqft) addFilter('square_footage >= ?', Number(minSqft));
  if (maxSqft) addFilter('square_footage <= ?', Number(maxSqft));
  if (keyword) addFilter(`search_vector @@ plainto_tsquery('english', ?)`, keyword);

  const filterClause = mapFilters.length ? `AND ${mapFilters.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      listing_id,
      name,
      company_name,
      city,
      state,
      square_footage,
      types,
      services,
      description,
      latitude,
      longitude,
      slug,
      (SELECT status FROM sponsorships WHERE sponsorships.listing_id = listings.id
        AND status = 'active'
        AND now() BETWEEN start_at AND end_at
        LIMIT 1) AS sponsorship_status
    FROM listings
    WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
      AND geom IS NOT NULL
      ${filterClause}
    ORDER BY sponsorship_status DESC NULLS LAST, square_footage DESC NULLS LAST
    LIMIT ${MAX_POINTS};
  `;

  const { rows } = await pool.query(query, mapValues);

  const listFiltersClause = listFilters.length ? `WHERE ${listFilters.join(' AND ')}` : '';
  const listQuery = `
    SELECT
      id,
      listing_id,
      name,
      company_name,
      city,
      state,
      square_footage,
      types,
      services,
      description,
      latitude,
      longitude,
      slug,
      (SELECT status FROM sponsorships WHERE sponsorships.listing_id = listings.id
        AND status = 'active'
        AND now() BETWEEN start_at AND end_at
        LIMIT 1) AS sponsorship_status
    FROM listings
    ${listFiltersClause}
    ORDER BY sponsorship_status DESC NULLS LAST, square_footage DESC NULLS LAST
    LIMIT 50;
  `;

  const { rows: listRows } = await pool.query(listQuery, listValues);

  const response = { listings: listRows, points: rows };
  cache.set(cacheKey, response);
  return NextResponse.json(response);
}
