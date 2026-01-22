import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const requireAdmin = (request: NextRequest) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const header = request.headers.get('x-admin-password');
  return header === adminPassword;
};

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    listingId,
    status,
    tier,
    bidCpm,
    startAt,
    endAt,
    targeting,
    dailyBudget
  } = body;

  const { rows } = await pool.query(
    `INSERT INTO sponsorships
      (listing_id, status, tier, bid_cpm, start_at, end_at, targeting, daily_budget)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (listing_id)
     DO UPDATE SET status = EXCLUDED.status,
       tier = EXCLUDED.tier,
       bid_cpm = EXCLUDED.bid_cpm,
       start_at = EXCLUDED.start_at,
       end_at = EXCLUDED.end_at,
       targeting = EXCLUDED.targeting,
       daily_budget = EXCLUDED.daily_budget
     RETURNING *`,
    [listingId, status, tier, bidCpm, startAt, endAt, targeting ?? {}, dailyBudget ?? 0]
  );

  return NextResponse.json({ sponsorship: rows[0] });
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT sponsorships.*, listings.name
     FROM sponsorships
     JOIN listings ON listings.id = sponsorships.listing_id
     ORDER BY sponsorships.start_at DESC`
  );

  return NextResponse.json({ sponsorships: rows });
}
