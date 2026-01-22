import { pool } from '../lib/db';
import { chromium } from 'playwright';
import crypto from 'crypto';
import slugify from 'slugify';

const USER_AGENT = '3PLFinderBot/1.0 (+https://example.com)';
const REQUEST_DELAY_MS = 1200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hashContent = (content: string) => crypto.createHash('sha256').update(content).digest('hex');

const parseListing = async (page: any, url: string) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await sleep(REQUEST_DELAY_MS);
  const content = await page.content();
  const hash = hashContent(content);

  const name = await page.locator('h1').first().textContent();
  const description = await page.locator('[data-testid="listing-description"], .listing-description, article').first().textContent();
  const addressText = await page.locator('[data-testid="address"], .listing-address, address').first().textContent();
  const location = addressText?.split(',').map((part) => part.trim()) ?? [];
  const city = location[1] ?? null;
  const stateZip = location[2] ?? '';
  const [state, postal_code] = stateZip.split(' ');

  const lat = await page.getAttribute('meta[property="place:location:latitude"]', 'content');
  const lng = await page.getAttribute('meta[property="place:location:longitude"]', 'content');

  const listingId = url.split('/').filter(Boolean).pop() ?? url;

  await pool.query(
    `INSERT INTO listings
      (listing_id, source_url, source_hash, name, address, city, state, postal_code, latitude, longitude, geom, description, slug, needs_geocode)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       CASE WHEN $9 IS NOT NULL AND $10 IS NOT NULL THEN ST_SetSRID(ST_MakePoint($10,$9),4326)::geography ELSE NULL END,
       $11,$12,$13)
     ON CONFLICT (listing_id)
     DO UPDATE SET source_hash = EXCLUDED.source_hash, last_seen_at = now()`,
    [
      listingId,
      url,
      hash,
      name?.trim() ?? 'Unknown',
      location[0] ?? null,
      city,
      state ?? null,
      postal_code ?? null,
      lat ? Number(lat) : null,
      lng ? Number(lng) : null,
      description?.trim() ?? null,
      slugify(`${name ?? 'listing'}-${listingId}`, { lower: true, strict: true }),
      !lat || !lng
    ]
  );
};

const processQueue = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });

  try {
    while (true) {
      const { rows } = await pool.query(
        `SELECT * FROM crawl_jobs WHERE status = 'queued' ORDER BY id ASC LIMIT 1`
      );

      if (!rows.length) {
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const job = rows[0];
      await pool.query(`UPDATE crawl_jobs SET status = 'processing', updated_at = now() WHERE id = $1`, [job.id]);
      const page = await context.newPage();
      try {
        await parseListing(page, job.url);
        await pool.query(`UPDATE crawl_jobs SET status = 'done', updated_at = now() WHERE id = $1`, [job.id]);
      } catch (error) {
        await pool.query(
          `UPDATE crawl_jobs SET status = 'failed', attempts = attempts + 1, last_error = $2, updated_at = now() WHERE id = $1`,
          [job.id, String(error)]
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
};

processQueue().catch((error) => {
  console.error(error);
  process.exit(1);
});
