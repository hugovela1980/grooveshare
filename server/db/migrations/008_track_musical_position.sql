BEGIN;

ALTER TABLE tracks
  ADD COLUMN musical_start_bar INTEGER NOT NULL DEFAULT 1
    CHECK (musical_start_bar >= 1),
  ADD COLUMN musical_start_beat DOUBLE PRECISION NOT NULL DEFAULT 1
    CHECK (musical_start_beat >= 1 AND musical_start_beat <= 32),
  ADD COLUMN musical_span_beats DOUBLE PRECISION
    CHECK (musical_span_beats IS NULL OR musical_span_beats > 0);

COMMIT;
