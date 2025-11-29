/**
 * Numbeo ETL Processor
 * Extracts cost of living and property price data from Numbeo API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { h3ToGeo, geoToH3 } = require('h3-js');

// Configuration
const API_KEY = process.env.NUMBEO_API_KEY || '';
const OUTPUT_DIR = path.join(__dirname, '../../data/processed');
const H3_RESOLUTION = 9; // H3 resolution for hexagonal grid

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Fetch cost of living indices for a specific city
 * @param {string} city - City name
 * @param {string} country - Country code
 * @returns {Promise<Object>} - Cost of living data
 */
async function fetchCostOfLiving(city, country) {
  return new Promise((resolve, reject) => {
    const url = `https://www.numbeo.com/api/cost_of_living?api_key=${API_KEY}&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Numbeo API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Fetch property price indices for a specific city
 * @param {string} city - City name
 * @param {string} country - Country code
 * @returns {Promise<Object>} - Property price data
 */
async function fetchPropertyPrices(city, country) {
  return new Promise((resolve, reject) => {
    const url = `https://www.numbeo.com/api/property_prices?api_key=${API_KEY}&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Numbeo API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Convert Numbeo data to our standard format and assign to H3 hexagons
 * @param {Object} costOfLiving - Cost of living data from Numbeo
 * @param {Object} propertyPrices - Property price data from Numbeo
 * @param {number} lat - Latitude of the city
 * @param {number} lng - Longitude of the city
 * @returns {Array} - Array of H3 hexagons with property data
 */
function convertToH3Format(costOfLiving, propertyPrices, lat, lng) {
  // Get the H3 index for the city center
  const centerH3Index = geoToH3(lat, lng, H3_RESOLUTION);

  // Create a buffer of hexagons around the city center
  const kRing = 3; // Number of rings around center
  const hexagons = h3ToGeo(centerH3Index, kRing);

  // Process each hexagon
  const result = hexagons.map(h3Index => {
    // Calculate distance from center to apply a decay function
    const [hexLat, hexLng] = h3ToGeo(h3Index);
    const distance = calculateDistance(lat, lng, hexLat, hexLng);
    const decayFactor = Math.exp(-distance / 10); // Decay factor with 10km characteristic distance

    // Extract relevant metrics from Numbeo data
    const rentIndex = costOfLiving.rent_index || 50;
    const propertyPriceIndex = propertyPrices.price_to_rent_ratio_out_of_city_center || 20;

    // Calculate estimated property price (in local currency)
    // Using a combination of rent index and property price index
    const basePrice = 100000; // Base price in local currency
    const priceMultiplier = (rentIndex / 100) * (propertyPriceIndex / 20);
    const estimatedPrice = basePrice * priceMultiplier * decayFactor;

    // Calculate confidence based on distance from center
    const confidence = Math.max(0.3, 1 - (distance / 30)); // Confidence decreases with distance

    // Calculate normalized value (0-1) for visualization
    const value = Math.min(1, estimatedPrice / 1000000); // Normalize against 1M

    return {
      h3_index: h3Index,
      price: estimatedPrice,
      count: Math.floor(Math.random() * 50) + 1, // Mock transaction count
      confidence: confidence,
      value: value
    };
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
 * Process Numbeo data for a list of cities
 * @param {Array} cities - Array of city objects with name, country, lat, lng
 */
async function processCities(cities) {
  const results = [];

  for (const city of cities) {
    try {
      console.log(`Processing ${city.name}, ${city.country}...`);

      // Fetch data from Numbeo
      const costOfLiving = await fetchCostOfLiving(city.name, city.country);
      const propertyPrices = await fetchPropertyPrices(city.name, city.country);

      // Convert to H3 format
      const h3Data = convertToH3Format(costOfLiving, propertyPrices, city.lat, city.lng);

      results.push(...h3Data);

      console.log(`Processed ${h3Data.length} hexagons for ${city.name}`);
    } catch (error) {
      console.error(`Error processing ${city.name}: ${error.message}`);
    }
  }

  // Save results to file
  const outputPath = path.join(OUTPUT_DIR, 'numbeo_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`Saved ${results.length} records to ${outputPath}`);
  return results;
}

// Main execution
if (require.main === module) {
  // Example cities to process
  const cities = [
    { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
    { name: 'Manchester', country: 'United Kingdom', lat: 53.4808, lng: -2.2426 },
    { name: 'Birmingham', country: 'United Kingdom', lat: 52.4862, lng: -1.8904 },
    { name: 'Edinburgh', country: 'United Kingdom', lat: 55.9533, lng: -3.1883 },
    { name: 'Glasgow', country: 'United Kingdom', lat: 55.8642, lng: -4.2518 }
  ];

  processCities(cities)
    .then(() => console.log('Numbeo ETL process completed successfully'))
    .catch(error => console.error(`Numbeo ETL process failed: ${error.message}`));
}

module.exports = {
  fetchCostOfLiving,
  fetchPropertyPrices,
  convertToH3Format,
  processCities
};
