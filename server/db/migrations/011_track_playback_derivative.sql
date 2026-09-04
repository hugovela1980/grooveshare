BEGIN;

ALTER TABLE tracks
  ADD COLUMN playback_derivative_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN playback_derivative_version TEXT NOT NULL DEFAULT 'opus-playback-v1',
  ADD COLUMN playback_derivative_file_path TEXT,
  ADD COLUMN playback_derivative_mime_type TEXT,
  ADD COLUMN playback_derivative_file_size INTEGER,
  ADD CONSTRAINT tracks_playback_derivative_status_check
    CHECK (
      playback_derivative_status IN ('pending', 'processing', 'ready', 'failed')
    ),
  ADD CONSTRAINT tracks_playback_derivative_version_check
    CHECK (length(trim(playback_derivative_version)) > 0),
  ADD CONSTRAINT tracks_playback_derivative_artifact_check
    CHECK (
      (
        playback_derivative_status = 'ready'
        AND playback_derivative_file_path IS NOT NULL
        AND length(trim(playback_derivative_file_path)) > 0
        AND playback_derivative_mime_type IS NOT NULL
        AND length(trim(playback_derivative_mime_type)) > 0
        AND playback_derivative_file_size IS NOT NULL
        AND playback_derivative_file_size >= 0
      )
      OR
      (
        playback_derivative_status <> 'ready'
        AND playback_derivative_file_path IS NULL
        AND playback_derivative_mime_type IS NULL
        AND playback_derivative_file_size IS NULL
      )
    );

COMMIT;
