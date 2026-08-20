BEGIN;

ALTER TABLE projects
  ADD COLUMN bpm DOUBLE PRECISION NOT NULL DEFAULT 120
    CHECK (bpm > 0 AND bpm <= 999),
  ADD COLUMN time_signature_numerator SMALLINT NOT NULL DEFAULT 4
    CHECK (time_signature_numerator BETWEEN 1 AND 32),
  ADD COLUMN time_signature_denominator SMALLINT NOT NULL DEFAULT 4
    CHECK (time_signature_denominator IN (1, 2, 4, 8, 16, 32));

COMMIT;
