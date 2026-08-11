BEGIN;

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE tracks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL
    CHECK (file_size >= 0),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX tracks_project_id_idx
  ON tracks(project_id);

CREATE TABLE project_mix_channels (
  project_id UUID NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,
  channel_number SMALLINT NOT NULL
    CHECK (channel_number BETWEEN 1 AND 4),
  track_id UUID NOT NULL
    REFERENCES tracks(id)
    ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  volume DOUBLE PRECISION NOT NULL
    CHECK (volume >= 0 AND volume <= 1),

  PRIMARY KEY (project_id, channel_number)
);

COMMIT;