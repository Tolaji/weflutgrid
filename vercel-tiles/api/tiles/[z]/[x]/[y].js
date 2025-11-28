import { Pool } from 'pg';
import h3 from 'h3-js';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000
});

// Zoom to H3 level mapping
const ZOOM_TO_H3 = {
  0: 2, 1: 2, 2: 3, 3: 4, 4: 4, 5: 5,
  6: 6, 7: 7, 8: 7, 9: 8, 10: 8, 11: 9,
  12: 9, 13: 10, 14: 10, 15: 10, 16: 11,
  17: 11, 18: 11, 19: 12, 20: 12
};

/**
 * Convert tile coordinates to bounding box
 */
function tileToBBox(z, x, y) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  const lat1 = (Math.atan(Math.sinh(n)) * 180) / Math.PI;
  const lng1 = (x / Math.pow(2, z)) * 360 - 180;
  
  const n2 = Math.PI - (2 * Math.PI * (y + 1)) / Math.pow(2, z);
  const lat2 = (Math.atan(Math.sinh(n2)) * 180) / Math.PI;
  const lng2 = ((x + 1) / Math.pow(2, z)) * 360 - 180;
  
  return [lng1, lat2, lng2, lat1];
}

/**
 * Get H3 cells for bounding box at specific resolution
 */
function getH3CellsForBBox(west, south, east, north, resolution) {
  try {
    // Use polyfill to get all H3 cells covering the bbox
    const polygon = [
      [
        [west, south],
        [east, south], 
        [east, north],
        [west, north],
        [west, south]
      ]
    ];
    
    return h3.polygonToCells(polygon, resolution);
  } catch (error) {
    console.warn('H3 polyfill failed, using center point:', error.message);
    // Fallback: just get the center cell
    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;
    return [h3.latLngToCell(centerLat, centerLng, resolution)];
  }
}

/**
 * Main tile handler
 */
export default async function handler(req, res) {
  const { z, x, y } = req.query;
  
  const zoom = parseInt(z);
  const tileX = parseInt(x);
  const tileY = parseInt(y);
  
  if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
    return res.status(400).json({ error: 'Invalid tile coordinates' });
  }
  
  const h3Level = ZOOM_TO_H3[zoom] || 8;
  const [west, south, east, north] = tileToBBox(zoom, tileX, tileY);
  
  try {
    // Get H3 cells for this tile
    const h3Cells = getH3CellsForBBox(west, south, east, north, h3Level);
    
    if (h3Cells.length === 0) {
      return res.status(200).json({
        type: 'FeatureCollection',
        features: []
      });
    }
    
    // Query database using the NEW view with percentiles
    const placeholders = h3Cells.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT 
        h3_index,
        h3_level,
        weighted_metric as price,
        tx_count as count,
        avg_confidence as confidence,
        normalized_value as value
      FROM heatmap_with_percentiles
      WHERE h3_index IN (${placeholders})
        AND h3_level = $${h3Cells.length + 1}
      LIMIT 2000
    `;
    
    const params = [...h3Cells, h3Level];
    const result = await pool.query(query, params);
    
    // Convert to GeoJSON with H3-js generated geometries
    const features = result.rows.map(row => {
      try {
        const boundary = h3.cellToBoundary(row.h3_index, true);
        const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
        coordinates.push(coordinates[0]); // Close polygon
        
        return {
          type: 'Feature',
          properties: {
            price: parseFloat(row.price) || 0,
            count: parseInt(row.count) || 0,
            confidence: parseFloat(row.confidence) || 0,
            value: parseFloat(row.value) || 0.5,
            h3_index: row.h3_index,
            h3_level: row.h3_level
          },
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          }
        };
      } catch (error) {
        console.warn('Failed to generate geometry for H3 cell:', row.h3_index, error.message);
        return null;
      }
    }).filter(feature => feature !== null);
    
    const geojson = {
      type: 'FeatureCollection',
      features
    };
    
    // Set headers for caching and CORS
    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(200).json(geojson);
    
  } catch (error) {
    console.error('Tile generation error:', error);
    
    // Return empty feature collection on error
    return res.status(200).json({
      type: 'FeatureCollection',
      features: []
    });
  }
}