CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  listing_id TEXT UNIQUE NOT NULL,
  source_url TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geom GEOGRAPHY(POINT, 4326),
  square_footage INTEGER,
  types TEXT[] DEFAULT '{}',
  services TEXT[] DEFAULT '{}',
  description TEXT,
  images TEXT[] DEFAULT '{}',
  website_url TEXT,
  email TEXT,
  phone TEXT,
  slug TEXT NOT NULL,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  needs_geocode BOOLEAN DEFAULT false,
  search_vector tsvector
);

CREATE INDEX IF NOT EXISTS listings_geom_idx ON listings USING GIST (geom);
CREATE INDEX IF NOT EXISTS listings_state_idx ON listings(state);
CREATE INDEX IF NOT EXISTS listings_city_idx ON listings(city);
CREATE INDEX IF NOT EXISTS listings_types_idx ON listings USING GIN (types);
CREATE INDEX IF NOT EXISTS listings_services_idx ON listings USING GIN (services);
CREATE INDEX IF NOT EXISTS listings_search_idx ON listings USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS listings_name_trgm_idx ON listings USING GIN (name gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS listings_slug_idx ON listings(slug);

CREATE TABLE IF NOT EXISTS sponsorships (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER UNIQUE REFERENCES listings(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','paused','expired')),
  tier TEXT NOT NULL CHECK (tier IN ('gold','silver','bronze')),
  bid_cpm NUMERIC,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  targeting JSONB DEFAULT '{}',
  daily_budget NUMERIC DEFAULT 0,
  spend_today NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('queued','processing','done','failed')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crawl_jobs_status_idx ON crawl_jobs(status);

CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW.services, ' ')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listings_search_vector_update ON listings;
CREATE TRIGGER listings_search_vector_update
  BEFORE INSERT OR UPDATE ON listings
  FOR EACH ROW EXECUTE PROCEDURE update_search_vector();
