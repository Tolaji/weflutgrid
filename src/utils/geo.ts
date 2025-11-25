import h3 from 'h3-js';

/**
 * Convert tile coordinates to bounding box [west, south, east, north]
 */
export function tileToBBox(z: number, x: number, y: number): [number, number, number, number] {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  const lat1 = (Math.atan(Math.sinh(n)) * 180) / Math.PI;
  const lng1 = (x / Math.pow(2, z)) * 360 - 180;
  
  const n2 = Math.PI - (2 * Math.PI * (y + 1)) / Math.pow(2, z);
  const lat2 = (Math.atan(Math.sinh(n2)) * 180) / Math.PI;
  const lng2 = ((x + 1) / Math.pow(2, z)) * 360 - 180;
  
  return [lng1, lat2, lng2, lat1]; // [west, south, east, north]
}

/**
 * Convert H3 index to GeoJSON polygon
 */
export function h3ToGeoJSON(h3Index: string): any {
  const boundary = h3.cellToBoundary(h3Index, true);
  const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
  coordinates.push(coordinates[0]); // Close the polygon
  
  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
}

/**
 * Get all H3 cells within a bounding box
 */
export function getH3CellsInBBox(
  bbox: [number, number, number, number],
  h3Level: number
): string[] {
  const [west, south, east, north] = bbox;
  
  // Create polygon from bbox
  const polygon = [[
    [north, west],
    [north, east],
    [south, east],
    [south, west],
    [north, west]
  ]];
  
  return h3.polygonToCells(polygon, h3Level, true);
}

/**
 * Calculate distance between two coordinates in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}