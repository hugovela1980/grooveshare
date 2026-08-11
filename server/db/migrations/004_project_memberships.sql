BEGIN;

CREATE TABLE project_memberships (
  project_id UUID NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  role TEXT NOT NULL
    CHECK (
      role IN (
        'owner',
        'contributor',
        'viewer'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  PRIMARY KEY (
    project_id,
    user_id
  )
);

CREATE INDEX project_memberships_user_id_idx
  ON project_memberships(user_id);

CREATE UNIQUE INDEX project_memberships_one_owner_idx
  ON project_memberships(project_id)
  WHERE role = 'owner';

COMMIT;