BEGIN;

ALTER TABLE tracks
  ADD COLUMN uploaded_by_user_id UUID
    REFERENCES users(id)
    ON DELETE SET NULL;

CREATE INDEX tracks_uploaded_by_user_id_idx
  ON tracks(uploaded_by_user_id);

COMMIT;
