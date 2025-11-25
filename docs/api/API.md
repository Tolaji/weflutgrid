# WeflutGrid API Documentation

## Base URL
```
https://your-project.vercel.app
```

## Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "weflutgrid-tiles"
}
```

### GET /tiles/{z}/{x}/{y}.geojson

Returns property data as GeoJSON for the specified tile.

**Parameters:**
- `z` (number): Zoom level (0-20)
- `x` (number): Tile X coordinate
- `y` (number): Tile Y coordinate

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "price": 650000,
        "count": 25,
        "confidence": 0.9,
        "value": 0.75
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-0.1276, 51.5074],
          [-0.1275, 51.5074],
          ...
        ]]
      }
    }
  ]
}
```

**Example:**
```bash
curl https://your-project.vercel.app/tiles/10/512/341.geojson
```

## Rate Limiting

- Free tier: 100 requests/minute per IP
- Cached tiles: No rate limit

## Caching

Tiles are cached for:
- Zoom 0-6: 7 days
- Zoom 7-12: 1 day
- Zoom 13+: 1 hour

## Errors
```json
{
  "error": "Failed to generate tile",
  "message": "Database connection failed"
}
```

Status codes:
- 200: Success
- 400: Invalid parameters
- 429: Rate limit exceeded
- 500: Server error
```

---

## **Complete Project Summary**
```
TOTAL FILES: 45+
TOTAL LINES: ~15,000

STRUCTURE:
├── Root config (8 files)
├── Database (4 files)
├── Scripts (6 files)
├── Source code (10 files)
├── Vercel tiles API (4 files)
├── Mobile app (10+ files)
├── GitHub workflows (3 files)
└── Documentation (4 files)

DEPLOYMENT TIME: ~40 minutes
MONTHLY COST: $0
INFRASTRUCTURE: 100% free tier