// Configuration
const TILE_API_URL = 'https://weflutgrid.vercel.app/api/tiles';
const INITIAL_LOCATION = { lat: 51.5074, lng: -0.1278 }; // London
const INITIAL_ZOOM = 11;

// State
let map;
let currentPolygons = [];
let selectedPolygon = null;
let isLoading = false;

// Initialize the map
function initMap() {
    // Create the map
    map = L.map('map').setView([INITIAL_LOCATION.lat, INITIAL_LOCATION.lng], INITIAL_ZOOM);

    // Add the tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Set up event listeners
    map.on('moveend', handleMapMove);

    // Initial load
    handleMapMove();
}

// Handle map movement
function handleMapMove() {
    if (isLoading) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // Convert bounds to tile coordinates
    const tiles = getTilesInBounds(bounds, zoom);

    // Load tiles
    loadTiles(tiles, zoom);
}

// Get tiles in the current map bounds
function getTilesInBounds(bounds, zoom) {
    const tiles = [];

    // Convert lat/lng bounds to tile coordinates
    const northWest = latLngToTile(bounds.getNorth(), bounds.getWest(), zoom);
    const southEast = latLngToTile(bounds.getSouth(), bounds.getEast(), zoom);

    // Generate all tiles in the visible area
    for (let x = northWest.x; x <= southEast.x; x++) {
        for (let y = northWest.y; y <= southEast.y; y++) {
            tiles.push({ z: zoom, x, y });
        }
    }

    return tiles;
}

// Convert lat/lng to tile coordinates
function latLngToTile(lat, lng, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

    return { x, y };
}

// Load tiles from the API
async function loadTiles(tiles, zoom) {
    if (tiles.length === 0) return;

    setLoading(true);

    try {
        // Clear existing polygons
        clearPolygons();

        // Load tiles in parallel
        const promises = tiles.map(tile => loadTile(tile.z, tile.x, tile.y));
        const results = await Promise.all(promises);

        // Process results
        let totalFeatures = 0;
        results.forEach(geojson => {
            if (geojson && geojson.features) {
                totalFeatures += geojson.features.length;
                addPolygons(geojson.features);
            }
        });

        // Update legend
        updateLegend(totalFeatures);

    } catch (error) {
        showError(`Failed to load tiles: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

// Load a single tile
async function loadTile(z, x, y) {
    try {
        const response = await fetch(`${TILE_API_URL}/${z}/${x}/${y}.geojson`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Failed to load tile ${z}/${x}/${y}:`, error);
        return null;
    }
}

// Add polygons to the map
function addPolygons(features) {
    features.forEach(feature => {
        const { properties, geometry } = feature;

        // Create the polygon
        const polygon = L.polygon(geometry.coordinates[0].map(coord => [coord[1], coord[0]]), {
            color: '#000',
            weight: 1,
            opacity: 0.3,
            fillColor: getColor(properties.value, properties.confidence),
            fillOpacity: properties.confidence * 0.8
        });

        // Add click event
        polygon.on('click', () => selectPolygon(properties));

        // Add to map and track
        polygon.addTo(map);
        currentPolygons.push(polygon);
    });
}

// Clear all polygons from the map
function clearPolygons() {
    currentPolygons.forEach(polygon => {
        map.removeLayer(polygon);
    });
    currentPolygons = [];
}

// Select a polygon and show its details
function selectPolygon(properties) {
    // Close previous selection if any
    if (selectedPolygon) {
        selectedPolygon.setStyle({ weight: 1 });
    }

    // Find and highlight the selected polygon
    const polygon = currentPolygons.find(p => {
        // This is a simplified check - in a real implementation, you'd match by properties
        return true;
    });

    if (polygon) {
        polygon.setStyle({ weight: 3 });
        selectedPolygon = polygon;
    }

    // Show the info panel
    showInfoPanel(properties);
}

// Show the info panel with property details
function showInfoPanel(properties) {
    document.getElementById('info-panel').classList.remove('hidden');

    // Format price
    let price = properties.price;
    if (price >= 1_000_000) {
        price = `£${(price / 1_000_000).toFixed(1)}M`;
    } else if (price >= 1_000) {
        price = `£${(price / 1_000).toFixed(0)}K`;
    } else {
        price = `£${price.toFixed(0)}`;
    }

    // Update panel content
    document.getElementById('median-price').textContent = price;
    document.getElementById('transaction-count').textContent = properties.count;
    document.getElementById('confidence').textContent = `${(properties.confidence * 100).toFixed(0)}%`;
    document.getElementById('confidence-bar').style.width = `${properties.confidence * 100}%`;
}

// Get color based on value and confidence
function getColor(value, confidence) {
    const colors = [
        { threshold: 0.2, color: 'rgba(45, 201, 55, ALPHA)' },
        { threshold: 0.4, color: 'rgba(152, 216, 62, ALPHA)' },
        { threshold: 0.6, color: 'rgba(231, 180, 22, ALPHA)' },
        { threshold: 0.8, color: 'rgba(252, 108, 0, ALPHA)' },
        { threshold: 1.0, color: 'rgba(204, 50, 50, ALPHA)' },
    ];

    const alpha = Math.max(0.3, confidence * 0.8);

    for (const { threshold, color } of colors) {
        if (value <= threshold) {
            return color.replace('ALPHA', alpha.toFixed(2));
        }
    }

    return colors[colors.length - 1].color.replace('ALPHA', alpha.toFixed(2));
}

// Update the legend info
function updateLegend(featureCount) {
    document.getElementById('legend-info').textContent = `${featureCount} areas shown`;
}

// Show loading indicator
function setLoading(loading) {
    isLoading = loading;
    const loadingElement = document.getElementById('loading');

    if (loading) {
        loadingElement.classList.remove('hidden');
    } else {
        loadingElement.classList.add('hidden');
    }
}

// Show error message
function showError(message) {
    const errorBanner = document.getElementById('error-banner');
    const errorMessage = document.getElementById('error-message');

    errorMessage.textContent = message;
    errorBanner.classList.remove('hidden');
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize map
    initMap();

    // Set up event listeners
    document.getElementById('close-panel').addEventListener('click', () => {
        document.getElementById('info-panel').classList.add('hidden');

        if (selectedPolygon) {
            selectedPolygon.setStyle({ weight: 1 });
            selectedPolygon = null;
        }
    });

    document.getElementById('dismiss-error').addEventListener('click', () => {
        document.getElementById('error-banner').classList.add('hidden');
    });
});
