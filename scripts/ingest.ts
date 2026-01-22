import { chromium } from 'playwright';
import { pool } from '../lib/db';
import slugify from 'slugify';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'https://www.3plfinder.com';
const USER_AGENT = '3PLFinderBot/1.0 (+https://example.com)';
const MAX_CONCURRENCY = 2;
const REQUEST_DELAY_MS = 1200;
const STORE_HTML = process.env.STORE_HTML === 'true';
const NOMINATIM_URL = process.env.NOMINATIM_URL;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hashContent = (content: string) => crypto.createHash('sha256').update(content).digest('hex');

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

const allowedByRobots = async () => {
  try {
    const response = await fetch(`${BASE_URL}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return true;
    const text = await response.text();
    const lines = text.split('\n');
    const disallows = lines
      .filter((line) => line.toLowerCase().startsWith('disallow'))
      .map((line) => line.split(':')[1]?.trim())
      .filter(Boolean);
    return !disallows.some((pathRule) => pathRule && pathRule.startsWith('/listing'));
  } catch {
    return true;
  }
};

const upsertListing = async (listing: Record<string, unknown>) => {
  await pool.query(
    `INSERT INTO listings
      (listing_id, source_url, source_hash, name, company_name, address, city, state, postal_code, latitude, longitude,
       geom, square_footage, types, services, description, images, website_url, email, phone, slug, last_seen_at, needs_geocode)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
       CASE WHEN $10 IS NOT NULL AND $11 IS NOT NULL THEN ST_SetSRID(ST_MakePoint($11,$10),4326)::geography ELSE NULL END,
       $12,$13,$14,$15,$16,$17,$18,$19,$20,now(),$21)
     ON CONFLICT (listing_id)
     DO UPDATE SET
      source_url = EXCLUDED.source_url,
      source_hash = EXCLUDED.source_hash,
      name = EXCLUDED.name,
      company_name = EXCLUDED.company_name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      postal_code = EXCLUDED.postal_code,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      geom = EXCLUDED.geom,
      square_footage = EXCLUDED.square_footage,
      types = EXCLUDED.types,
      services = EXCLUDED.services,
      description = EXCLUDED.description,
      images = EXCLUDED.images,
      website_url = EXCLUDED.website_url,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      slug = EXCLUDED.slug,
      last_seen_at = now(),
      needs_geocode = EXCLUDED.needs_geocode`,
    [
      listing.listing_id,
      listing.source_url,
      listing.source_hash,
      listing.name,
      listing.company_name,
      listing.address,
      listing.city,
      listing.state,
      listing.postal_code,
      listing.latitude,
      listing.longitude,
      listing.square_footage,
      listing.types,
      listing.services,
      listing.description,
      listing.images,
      listing.website_url,
      listing.email,
      listing.phone,
      listing.slug,
      listing.needs_geocode
    ]
  );
};

const parseListing = async (page: any, url: string) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await sleep(REQUEST_DELAY_MS);
  const content = await page.content();
  const hash = hashContent(content);

  if (STORE_HTML) {
    const dir = path.join(process.cwd(), 'data', 'html');
    await ensureDir(dir);
    const filename = path.join(dir, `${hash}.html`);
    await fs.writeFile(filename, content, 'utf8');
  }

  const name = await page.locator('h1').first().textContent();
  const description = await page.locator('[data-testid="listing-description"], .listing-description, article').first().textContent();
  const addressText = await page.locator('[data-testid="address"], .listing-address, address').first().textContent();
  const location = addressText?.split(',').map((part) => part.trim()) ?? [];
  const city = location[1] ?? null;
  const stateZip = location[2] ?? '';
  const [state, postal_code] = stateZip.split(' ');

  const lat = await page.getAttribute('meta[property="place:location:latitude"]', 'content');
  const lng = await page.getAttribute('meta[property="place:location:longitude"]', 'content');

  const images = await page.locator('img').evaluateAll((imgs: HTMLImageElement[]) =>
    imgs.map((img) => img.src).filter((src) => src.startsWith('http')).slice(0, 5)
  );

  const listingId = url.split('/').filter(Boolean).pop() ?? url;

  let latitude = lat ? Number(lat) : null;
  let longitude = lng ? Number(lng) : null;

  if ((!latitude || !longitude) && NOMINATIM_URL && addressText) {
    const query = new URLSearchParams({
      q: addressText,
      format: 'json',
      limit: '1'
    });
    const response = await fetch(`${NOMINATIM_URL}/search?${query.toString()}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (response.ok) {
      const results = await response.json();
      if (results?.[0]) {
        latitude = Number(results[0].lat);
        longitude = Number(results[0].lon);
      }
    }
  }

  const listing = {
    listing_id: listingId,
    source_url: url,
    source_hash: hash,
    name: name?.trim() ?? 'Unknown',
    company_name: null,
    address: location[0] ?? null,
    city: city,
    state: state ?? null,
    postal_code: postal_code ?? null,
    latitude,
    longitude,
    square_footage: null,
    types: [],
    services: [],
    description: description?.trim() ?? null,
    images,
    website_url: null,
    email: null,
    phone: null,
    slug: slugify(`${name ?? 'listing'}-${listingId}`, { lower: true, strict: true }),
    needs_geocode: !latitude || !longitude
  };

  await upsertListing(listing);
};

const discoverListingUrls = async (page: any) => {
  await page.goto(`${BASE_URL}/listings`, { waitUntil: 'domcontentloaded' });
  await sleep(REQUEST_DELAY_MS);
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors
      .map((anchor) => anchor.getAttribute('href'))
      .filter((href): href is string => Boolean(href))
      .filter((href) => href.includes('/listing/'))
      .map((href) => (href.startsWith('http') ? href : `https://www.3plfinder.com${href}`));
  });
  return Array.from(new Set(links));
};

const enqueueUrls = async (urls: string[]) => {
  for (const url of urls) {
    await pool.query(
      `INSERT INTO crawl_jobs (url, status)
       VALUES ($1, 'queued')
       ON CONFLICT (url) DO NOTHING`,
      [url]
    );
  }
};

const processQueue = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });

  try {
    let hasMore = true;
    while (hasMore) {
      const { rows } = await pool.query(
        `SELECT * FROM crawl_jobs WHERE status = 'queued' ORDER BY id ASC LIMIT $1`,
        [MAX_CONCURRENCY]
      );

      if (!rows.length) {
        hasMore = false;
        break;
      }

      await Promise.all(
        rows.map(async (job: { id: number; url: string; attempts: number }) => {
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
        })
      );

      await sleep(REQUEST_DELAY_MS + Math.random() * 400);
    }
  } finally {
    await browser.close();
  }
};

const main = async () => {
  const isDelta = process.argv.includes('--delta');
  const allowed = await allowedByRobots();
  if (!allowed) {
    console.error('Robots.txt disallows listing crawl.');
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  try {
    const urls = await discoverListingUrls(page);
    await enqueueUrls(urls);
    if (!isDelta) {
      await processQueue();
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
