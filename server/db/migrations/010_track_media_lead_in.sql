ALTER TABLE tracks
ADD COLUMN media_lead_in_seconds DOUBLE PRECISION NOT NULL DEFAULT 0
  CHECK (media_lead_in_seconds >= 0 AND media_lead_in_seconds <= 600);
