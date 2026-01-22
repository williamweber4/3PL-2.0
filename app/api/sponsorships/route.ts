import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const city = searchParams.get('city');
  const types = searchParams.get('types');
  const services = searchParams.get('services');
  const keyword = searchParams.get('keyword');

  const filters: string[] = [`status = 'active'`, `now() BETWEEN start_at AND end_at`];
  const values: Array<string | string[]> = [];

  if (state) {
    values.push(state);
    filters.push(`(targeting->'states' IS NULL OR targeting->'states' ? $${values.length})`);
  }
  if (city) {
    values.push(city);
    filters.push(`(targeting->'cities' IS NULL OR targeting->'cities' ? $${values.length})`);
  }
  if (types) {
    const list = types.split(',').map((item) => item.trim());
    values.push(list);
    filters.push(`(targeting->'types' IS NULL OR targeting->'types' ?| $${values.length})`);
  }
  if (services) {
    const list = services.split(',').map((item) => item.trim());
    values.push(list);
    filters.push(`(targeting->'services' IS NULL OR targeting->'services' ?| $${values.length})`);
  }
  if (keyword) {
    values.push(keyword);
    filters.push(`(targeting->>'keyword' IS NULL OR $${values.length} ILIKE '%' || (targeting->>'keyword') || '%')`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT sponsorships.*, listings.name, listings.slug
     FROM sponsorships
     JOIN listings ON listings.id = sponsorships.listing_id
     ${whereClause}
     ORDER BY
       CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END,
       bid_cpm DESC NULLS LAST`,
    values
  );

  return NextResponse.json({ sponsorships: rows });
}
