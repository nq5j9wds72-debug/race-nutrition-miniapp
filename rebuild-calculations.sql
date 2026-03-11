BEGIN;

DROP TABLE IF EXISTS calculations;

CREATE TABLE calculations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  formula_version TEXT NOT NULL,
  race_type TEXT,
  duration_min INTEGER,
  input_json JSONB NOT NULL,
  result_json JSONB NOT NULL,
  warnings_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX calculations_user_id_idx
ON calculations (user_id);

CREATE INDEX calculations_created_at_idx
ON calculations (created_at);

CREATE INDEX calculations_formula_version_idx
ON calculations (formula_version);

COMMIT;