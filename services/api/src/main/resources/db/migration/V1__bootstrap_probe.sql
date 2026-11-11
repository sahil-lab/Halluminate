CREATE TABLE bootstrap_probes (
    id UUID PRIMARY KEY,
    fixture VARCHAR(32) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bootstrap_probes_synthetic_only
        CHECK (fixture = 'phase-1-synthetic')
);
