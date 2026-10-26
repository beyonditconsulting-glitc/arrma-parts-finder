PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL CHECK(url LIKE 'https://%'),
  publisher TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK(length(sha256) = 64)
);
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  manufacturer TEXT NOT NULL,
  model_number TEXT NOT NULL,
  name TEXT NOT NULL,
  revision TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_locator TEXT NOT NULL,
  UNIQUE(manufacturer, model_number)
);
CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  part_number TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('replacement','upgrade')),
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_locator TEXT NOT NULL,
  UNIQUE(brand, part_number)
);
CREATE TABLE IF NOT EXISTS fitments (
  part_id TEXT NOT NULL REFERENCES parts(id),
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  status TEXT NOT NULL CHECK(status IN ('verified','unverified','incompatible')),
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_locator TEXT NOT NULL,
  notes TEXT NOT NULL,
  PRIMARY KEY(part_id, vehicle_id)
);
-- An offer is a historical observation; it is never implicitly a current price.
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES parts(id),
  retailer TEXT NOT NULL,
  listing_url TEXT NOT NULL CHECK(listing_url LIKE 'https://%'),
  price_minor INTEGER CHECK(price_minor >= 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  shipping_minor INTEGER CHECK(shipping_minor >= 0),
  condition TEXT NOT NULL CHECK(condition IN ('new','used','unknown')),
  availability TEXT NOT NULL CHECK(availability IN ('in_stock','out_of_stock','unknown')),
  observed_at TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_locator TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS parts_number ON parts(part_number);
CREATE INDEX IF NOT EXISTS fitments_vehicle ON fitments(vehicle_id, status);
CREATE INDEX IF NOT EXISTS offers_part ON offers(part_id, observed_at);
