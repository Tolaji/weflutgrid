/**
 * FHFA (Federal Housing Finance Agency) ETL Processor
 * Extracts house price index data from FHFA and converts to our format
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { h3ToGeo, geoToH3 } = require('h3-js');
const parse = require('csv-parse');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '../../data/processed');
const H3_RESOLUTION = 9; // H3 resolution for hexagonal grid
const DATA_URL = 'https://www.fhfa.gov/DataTools/Downloads/Documents/HPI/HPI_ATBGL.csv';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Download and parse FHFA HPI data
 * @returns {Promise<Array>} - Array of house price index records
 */
async function downloadAndParseData() {
  return new Promise((resolve, reject) => {
    const data = [];

    https.get(DATA_URL, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download FHFA data: HTTP ${response.statusCode}`));
      }

      response
        .pipe(parse({
          columns: true,
          skip_empty_lines: true
        }))
        .on('data', (row) => {
          data.push(row);
        })
        .on('end', () => {
          resolve(data);
        })
        .on('error', (error) => {
          reject(new Error(`Failed to parse FHFA data: ${error.message}`));
        });
    }).on('error', (error) => {
      reject(new Error(`Failed to download FHFA data: ${error.message}`));
    });
  });
}

/**
 * Get state-level coordinates for mapping
 * @param {string} stateCode - Two-letter state code
 * @returns {Object} - Latitude and longitude of the state
 */
function getStateCoordinates(stateCode) {
  // Simplified state coordinates - in a real implementation, this would be more comprehensive
  const stateCoordinates = {
    'AL': { lat: 32.806671, lng: -86.791130 },
    'AK': { lat: 61.370716, lng: -152.404419 },
    'AZ': { lat: 33.729759, lng: -111.431221 },
    'AR': { lat: 34.969704, lng: -92.373123 },
    'CA': { lat: 36.116203, lng: -119.681564 },
    'CO': { lat: 39.059811, lng: -105.311104 },
    'CT': { lat: 41.597782, lng: -72.755371 },
    'DE': { lat: 39.318523, lng: -75.507141 },
    'FL': { lat: 27.664827, lng: -81.515754 },
    'GA': { lat: 33.040619, lng: -83.643074 },
    'HI': { lat: 21.094318, lng: -157.498337 },
    'ID': { lat: 44.240459, lng: -114.478828 },
    'IL': { lat: 40.349457, lng: -88.986137 },
    'IN': { lat: 39.849426, lng: -86.258278 },
    'IA': { lat: 42.011539, lng: -93.210526 },
    'KS': { lat: 38.526600, lng: -96.726486 },
    'KY': { lat: 37.668140, lng: -84.670067 },
    'LA': { lat: 31.169546, lng: -91.867805 },
    'ME': { lat: 44.693947, lng: -69.381927 },
    'MD': { lat: 39.063946, lng: -76.802101 },
    'MA': { lat: 42.230171, lng: -71.530106 },
    'MI': { lat: 43.326618, lng: -84.536095 },
    'MN': { lat: 45.694454, lng: -93.900192 },
    'MS': { lat: 32.741646, lng: -89.678696 },
    'MO': { lat: 38.456085, lng: -92.288368 },
    'MT': { lat: 46.921925, lng: -110.454353 },
    'NE': { lat: 41.125370, lng: -98.268082 },
    'NV': { lat: 38.313515, lng: -117.055374 },
    'NH': { lat: 43.452492, lng: -71.563896 },
    'NJ': { lat: 40.298904, lng: -74.521011 },
    'NM': { lat: 34.840515, lng: -106.248482 },
    'NY': { lat: 42.165726, lng: -74.948051 },
    'NC': { lat: 35.630066, lng: -79.806419 },
    'ND': { lat: 47.528912, lng: -99.784012 },
    'OH': { lat: 40.388783, lng: -82.764915 },
    'OK': { lat: 35.565342, lng: -96.928917 },
    'OR': { lat: 44.572021, lng: -122.070938 },
    'PA': { lat: 40.590752, lng: -77.209755 },
    'RI': { lat: 41.680893, lng: -71.511780 },
    'SC': { lat: 33.856892, lng: -80.945007 },
    'SD': { lat: 44.299782, lng: -99.438828 },
    'TN': { lat: 35.747845, lng: -86.692345 },
    'TX': { lat: 31.054487, lng: -97.563461 },
    'UT': { lat: 40.150032, lng: -111.862434 },
    'VT': { lat: 44.045876, lng: -72.710686 },
    'VA': { lat: 37.769337, lng: -78.169968 },
    'WA': { lat: 47.400902, lng: -121.490494 },
    'WV': { lat: 38.491226, lng: -80.954453 },
    'WI': { lat: 44.268543, lng: -89.616508 },
    'WY': { lat: 42.755966, lng: -107.302490 }
  };

  return stateCoordinates[stateCode] || { lat: 39.8283, lng: -98.5795 }; // Default to center of US
}

/**
 * Convert FHFA data to our standard format and assign to H3 hexagons
 * @param {Array} fhfaData - Raw FHFA data
 * @returns {Array} - Array of H3 hexagons with property data
 */
function convertToH3Format(fhfaData) {
  // Group data by state
  const stateData = {};

  fhfaData.forEach(record => {
    const state = record.state;
    if (!stateData[state]) {
      stateData[state] = [];
    }

    // Extract relevant fields and convert to numbers
    const year = parseInt(record.year);
    const quarter = parseInt(record.qtr);
    const index = parseFloat(record.index_nsa);

    if (!isNaN(year) && !isNaN(quarter) && !isNaN(index)) {
      stateData[state].push({
        year,
        quarter,
        index
      });
    }
  });

  // Process each state and create hexagons
  const result = [];

  Object.keys(stateData).forEach(state => {
    const coords = getStateCoordinates(state);
    const stateRecords = stateData[state];

    if (stateRecords.length === 0) return;

    // Get the most recent record
    stateRecords.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });

    const latestRecord = stateRecords[0];

    // Get the H3 index for the state center
    const centerH3Index = geoToH3(coords.lat, coords.lng, H3_RESOLUTION);

    // Create a buffer of hexagons around the state center
    const kRing = 3; // Number of rings around center
    const hexagons = h3ToGeo(centerH3Index, kRing);

    // Process each hexagon
    hexagons.forEach(h3Index => {
      // Calculate distance from center to apply a decay function
      const [hexLat, hexLng] = h3ToGeo(h3Index);
      const distance = calculateDistance(coords.lat, coords.lng, hexLat, hexLng);
      const decayFactor = Math.exp(-distance / 100); // Decay factor with 100km characteristic distance

      // Calculate estimated property price based on HPI
      // Using a base price adjusted by the index value
      const basePrice = 200000; // Base price in USD
      const priceMultiplier = latestRecord.index / 100; // Normalize index
      const estimatedPrice = basePrice * priceMultiplier * decayFactor;

      // Calculate confidence based on distance from center
      const confidence = Math.max(0.3, 1 - (distance / 300)); // Confidence decreases with distance

      // Calculate normalized value (0-1) for visualization
      const value = Math.min(1, estimatedPrice / 500000); // Normalize against 500k

      result.push({
        h3_index: h3Index,
        price: estimatedPrice,
        count: Math.floor(Math.random() * 50) + 1, // Mock transaction count
        confidence: confidence,
        value: value,
        source: 'fhfa',
        state: state,
        year: latestRecord.year,
        quarter: latestRecord.quarter
      });
    });
  });

  return result;
}

/**
 * Calculate distance between two lat/lng points in km
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Process FHFA data
 * @returns {Promise<Array>} - Array of H3 hexagons with property data
 */
async function processFHFAData() {
  try {
    console.log('Downloading and parsing FHFA data...');
    const fhfaData = await downloadAndParseData();

    console.log(`Downloaded ${fhfaData.length} records from FHFA`);

    console.log('Converting to H3 format...');
    const h3Data = convertToH3Format(fhfaData);

    // Save results to file
    const outputPath = path.join(OUTPUT_DIR, 'fhfa_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(h3Data, null, 2));

    console.log(`Saved ${h3Data.length} records to ${outputPath}`);
    return h3Data;
  } catch (error) {
    console.error(`FHFA ETL process failed: ${error.message}`);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  processFHFAData()
    .then(() => console.log('FHFA ETL process completed successfully'))
    .catch(error => console.error(`FHFA ETL process failed: ${error.message}`));
}

module.exports = {
  downloadAndParseData,
  convertToH3Format,
  processFHFAData
};
