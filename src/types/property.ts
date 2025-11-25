export interface PropertyTransaction {
  id: string;
  price: number;
  date: Date;
  postcode: string;
  type: 'detached' | 'semi-detached' | 'terraced' | 'flat' | 'other';
  newBuild: boolean;
  tenure: 'freehold' | 'leasehold';
  address: string;
  city?: string;
  county?: string;
}

export interface H3Cell {
  h3_index: string;
  h3_level: number;
  country_code: string;
  region?: string;
  metric_source: string;
  metric_type: string;
  metric_value: number;
  transaction_count: number;
  confidence_score: number;
  first_seen: Date;
  last_seen: Date;
}

export interface AggregatedCell {
  h3_index: string;
  h3_level: number;
  country_code: string;
  region?: string;
  weighted_metric: number;
  tx_count: number;
  avg_confidence: number;
  normalized_value: number;
  last_update: Date;
  freshness: 'fresh' | 'recent' | 'stale';
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    price: number;
    count: number;
    confidence: number;
    value: number;
    h3_index?: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}