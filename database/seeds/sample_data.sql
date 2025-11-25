-- Sample data for testing (London area)

INSERT INTO heatmap_cells (
  h3_index, h3_level, country_code, region,
  metric_source, metric_type, metric_value,
  transaction_count, confidence_score,
  first_seen, last_seen
) VALUES
  -- Central London
  ('8a1969492d7ffff', 10, 'GB', 'London', 'sample', 'median_price', 850000, 25, 0.9, NOW(), NOW()),
  ('8a19694929bffff', 10, 'GB', 'London', 'sample', 'median_price', 920000, 18, 0.85, NOW(), NOW()),
  ('8a196949297ffff', 10, 'GB', 'London', 'sample', 'median_price', 780000, 32, 0.92, NOW(), NOW()),
  
  -- Outer London
  ('8a19694d2d7ffff', 10, 'GB', 'London', 'sample', 'median_price', 450000, 45, 0.95, NOW(), NOW()),
  ('8a19694d29bffff', 10, 'GB', 'London', 'sample', 'median_price', 520000, 38, 0.9, NOW(), NOW()),
  
  -- Manchester
  ('8a196d452d7ffff', 10, 'GB', 'Manchester', 'sample', 'median_price', 280000, 52, 0.93, NOW(), NOW()),
  ('8a196d4529bffff', 10, 'GB', 'Manchester', 'sample', 'median_price', 310000, 41, 0.88, NOW(), NOW())
;

-- Refresh aggregated view
REFRESH MATERIALIZED VIEW heatmap_aggregated;

-- Compute percentiles
SELECT compute_percentiles('GB');

\echo 'Sample data inserted successfully!'