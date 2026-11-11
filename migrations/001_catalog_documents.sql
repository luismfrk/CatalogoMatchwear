CREATE TABLE IF NOT EXISTS catalog_documents (
  name text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_documents_updated_at_idx
  ON catalog_documents (updated_at DESC);
