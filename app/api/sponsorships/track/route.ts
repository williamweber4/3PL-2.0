import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sponsorshipId, event } = body;

  if (!sponsorshipId || !['impression', 'click'].includes(event)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const column = event === 'impression' ? 'impressions' : 'clicks';
  await pool.query(
    `UPDATE sponsorships SET ${column} = ${column} + 1 WHERE id = $1`,
    [sponsorshipId]
  );

  return NextResponse.json({ ok: true });
}
