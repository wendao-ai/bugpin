UPDATE reports
SET source = 'widget'
WHERE source IS NULL OR source = '';

CREATE INDEX IF NOT EXISTS idx_reports_source ON reports(source);
