export const H3_LEVELS = {
  GLOBAL: 2,
  CONTINENT: 3,
  COUNTRY: 4,
  REGION: 6,
  CITY: 8,
  NEIGHBORHOOD: 9,
  STREET: 10,
  BUILDING: 11
} as const;

export const ZOOM_TO_H3_LEVEL: Record<number, number> = {
  0: 2, 1: 2, 2: 3,
  3: 4, 4: 4, 5: 5,
  6: 6, 7: 7, 8: 7,
  9: 8, 10: 8, 11: 9,
  12: 9, 13: 10, 14: 10,
  15: 10, 16: 11, 17: 11,
  18: 11, 19: 12, 20: 12
};

export const DATA_SOURCES = {
  UK_LAND_REGISTRY: 'uk_land_registry',
  NUMBEO: 'numbeo',
  FHFA: 'fhfa'
} as const;

export const METRIC_TYPES = {
  MEDIAN_PRICE: 'median_price',
  PRICE_PER_SQM: 'price_per_sqm',
  RENTAL_PRICE: 'rental_price'
} as const;

export const TILE_CACHE_TTL = {
  LOW_ZOOM: 7 * 24 * 3600,   // 7 days for zoom 0-6
  MID_ZOOM: 24 * 3600,        // 1 day for zoom 7-12
  HIGH_ZOOM: 3600             // 1 hour for zoom 13+
};

export const COUNTRIES = {
  GB: { name: 'United Kingdom', currency: 'GBP', symbol: '£' },
  US: { name: 'United States', currency: 'USD', symbol: '$' },
  DE: { name: 'Germany', currency: 'EUR', symbol: '€' },
  FR: { name: 'France', currency: 'EUR', symbol: '€' },
  ES: { name: 'Spain', currency: 'EUR', symbol: '€' }
} as const;