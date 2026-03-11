CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  tg_user_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_last_seen_at_idx
ON users (last_seen_at);

CREATE TABLE IF NOT EXISTS calculations (
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

CREATE INDEX IF NOT EXISTS calculations_user_id_idx
ON calculations (user_id);

CREATE INDEX IF NOT EXISTS calculations_created_at_idx
ON calculations (created_at);

CREATE INDEX IF NOT EXISTS calculations_formula_version_idx
ON calculations (formula_version);