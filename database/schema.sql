-- WeflutGrid Database Schema (Optimized for Free Tier)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS h3;
CREATE EXTENSION IF NOT EXISTS h3_postgis;

-- Main heatmap data table
CREATE TABLE heatmap_cells (
  id BIGSERIAL PRIMARY KEY,
  h3_index TEXT NOT NULL,
  h3_level INT NOT NULL,
  country_code TEXT,
  region TEXT,
  metric_source TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'median_price',
  metric_value NUMERIC,
  transaction_count INT DEFAULT 0,
  confidence_score NUMERIC DEFAULT 0.0,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for upserts
CREATE UNIQUE INDEX idx_h3_source_type_unique 
ON heatmap_cells (h3_index, metric_source, metric_type);

-- Performance indexes
CREATE INDEX idx_h3_level ON heatmap_cells (h3_level);
CREATE INDEX idx_country ON heatmap_cells (country_code);
CREATE INDEX idx_updated ON heatmap_cells (updated_at DESC);

-- Spatial index (PostGIS)
CREATE INDEX idx_h3_geom ON heatmap_cells 
USING GIST (h3_cell_to_geometry(h3_index));

-- Materialized view for aggregated data
CREATE MATERIALIZED VIEW heatmap_aggregated AS
SELECT 
  h3_index,
  h3_level,
  country_code,
  region,
  
  -- Weighted average based on confidence
  SUM(metric_value * confidence_score) / NULLIF(SUM(confidence_score), 0) 
    AS weighted_metric,
  
  -- Total transactions
  SUM(transaction_count) AS tx_count,
  
  -- Average confidence
  AVG(confidence_score) AS avg_confidence,
  
  -- Percentile ranking (computed later)
  0.5 AS normalized_value,
  
  -- Latest update
  MAX(last_seen) AS last_update,
  
  -- Data freshness indicator
  CASE 
    WHEN MAX(last_seen) > NOW() - INTERVAL '7 days' THEN 'fresh'
    WHEN MAX(last_seen) > NOW() - INTERVAL '30 days' THEN 'recent'
    ELSE 'stale'
  END AS freshness
  
FROM heatmap_cells
WHERE metric_type = 'median_price'
GROUP BY h3_index, h3_level, country_code, region;

-- Index on materialized view
CREATE UNIQUE INDEX idx_aggregated_h3 ON heatmap_aggregated (h3_index);
CREATE INDEX idx_aggregated_level ON heatmap_aggregated (h3_level);
CREATE INDEX idx_aggregated_country ON heatmap_aggregated (country_code);

-- Function to refresh aggregated view
CREATE OR REPLACE FUNCTION refresh_heatmap_aggregated()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY heatmap_aggregated;
END;
$$ LANGUAGE plpgsql;

-- ETL tracking table
CREATE TABLE etl_runs (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  status TEXT NOT NULL,
  rows_processed INT DEFAULT 0,
  rows_inserted INT DEFAULT 0,
  rows_updated INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_etl_source ON etl_runs (source_name);
CREATE INDEX idx_etl_started ON etl_runs (started_at DESC);

-- Helper function to compute normalized percentile values
CREATE OR REPLACE FUNCTION compute_percentiles(p_country_code TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
  percentile_values NUMERIC[];
BEGIN
  -- Get all metric values for the country (or global if NULL)
  SELECT PERCENTILE_CONT(ARRAY[0.1, 0.25, 0.5, 0.75, 0.9]) 
    WITHIN GROUP (ORDER BY weighted_metric)
  INTO percentile_values
  FROM heatmap_aggregated
  WHERE (p_country_code IS NULL OR country_code = p_country_code);
  
  -- Update normalized values
  UPDATE heatmap_aggregated
  SET normalized_value = CASE
    WHEN weighted_metric <= percentile_values[1] THEN 0.1
    WHEN weighted_metric <= percentile_values[2] THEN 0.25
    WHEN weighted_metric <= percentile_values[3] THEN 0.5
    WHEN weighted_metric <= percentile_values[4] THEN 0.75
    WHEN weighted_metric <= percentile_values[5] THEN 0.9
    ELSE 1.0
  END
  WHERE (p_country_code IS NULL OR country_code = p_country_code);
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE heatmap_cells IS 'Raw property data aggregated by H3 hexagon';
COMMENT ON TABLE etl_runs IS 'ETL job execution tracking';
COMMENT ON MATERIALIZED VIEW heatmap_aggregated IS 'Pre-aggregated view for fast tile generation';
