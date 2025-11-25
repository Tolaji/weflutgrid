import { sql } from '@vercel/postgres';
import h3 from 'h3-js';

export const config = {
  runtime: 'edge',
};

// Tile bbox calculation
function tileToBBox(z, x, y) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  const lat = (Math.atan(Math.sinh(n)) * 180) / Math.PI;
  const lng1 = (x / Math.pow(2, z)) * 360 - 180;
  const lng2 = ((x + 1) / Math.pow(2, z)) * 360 - 180;
  const lat1 = lat;
  const lat2 = (Math.atan(Math.sinh(n - (2 * Math.PI) / Math.pow(2, z))) * 180) / Math.PI;
  return [lng1, lat2, lng2, lat1];
}

export default async function handler(request) {
  const { z, x, y } = request.query;
  
  // Parse coordinates
  const zoom = parseInt(z);
  const tileX = parseInt(x);
  const tileY = parseInt(y);
  
  // Get H3 level based on zoom
  const h3Level = zoom <= 6 ? 6 : zoom <= 9 ? 8 : zoom <= 12 ? 9 : 10;
  
  // Get bounding box
  const bbox = tileToBBox(zoom, tileX, tileY);
  
  try {
    // Query database (using Vercel's managed Postgres or connect to Supabase)
    const { rows } = await sql`
      SELECT 
        h3_index,
        metric_value,
        tx_count,
        confidence
      FROM heatmap_aggregated
      WHERE h3_level = ${h3Level}
      LIMIT 1000
    `;
    
    // Convert to GeoJSON
    const features = rows.map(row => {
      const boundary = h3.cellToBoundary(row.h3_index, true);
      const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
      coordinates.push(coordinates[0]);
      
      return {
        type: 'Feature',
        properties: {
          price: row.metric_value,
          count: row.tx_count,
          confidence: row.confidence,
          // Normalize value (0-1) for color gradient
          value: row.metric_value / 1000000
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      };
    });
    
    const geojson = {
      type: 'FeatureCollection',
      features
    };
    
    return new Response(JSON.stringify(geojson), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('Tile error:', error);
    return new Response(JSON.stringify({ error: 'Tile generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}