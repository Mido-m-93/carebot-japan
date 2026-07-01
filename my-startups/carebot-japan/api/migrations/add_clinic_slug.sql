-- Add slug column to clinics for per-clinic booking URLs (/book/{slug})
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS clinics_slug_idx ON clinics(slug);
