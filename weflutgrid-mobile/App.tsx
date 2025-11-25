import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Polygon, Region } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';

// Get tile API URL from config
const TILE_API_URL = Constants.expoConfig?.extra?.tileApiUrl || 'http://localhost:3000';

interface HexagonData {
  coordinates: Array<{ latitude: number; longitude: number }>;
  price: number;
  count: number;
  confidence: number;
  value: number;
}

export default function App() {
  const [hexagons, setHexagons] = useState<HexagonData[]>([]);
  const [selectedHex, setSelectedHex] = useState<HexagonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTiles = useCallback(async (region: Region) => {
    setLoading(true);
    setError(null);

    try {
      // Calculate tile coordinates from region
      const z = Math.floor(Math.log2(360 / region.longitudeDelta));
      const x = Math.floor((region.longitude + 180) / 360 * Math.pow(2, z));
      const y = Math.floor(
        (1 - Math.log(Math.tan(region.latitude * Math.PI / 180) + 
         1 / Math.cos(region.latitude * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z)
      );

      const tileUrl = `${TILE_API_URL}/tiles/${z}/${x}/${y}.geojson`;
      console.log('Fetching tile:', tileUrl);

      const response = await fetch(tileUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const geojson = await response.json();
      
      const hexData: HexagonData[] = geojson.features.map((feature: any) => ({
        coordinates: feature.geometry.coordinates[0].map(([lng, lat]: number[]) => ({
          latitude: lat,
          longitude: lng
        })),
        price: feature.properties.price,
        count: feature.properties.count,
        confidence: feature.properties.confidence,
        value: feature.properties.value
      }));

      setHexagons(hexData);
      console.log(`Loaded ${hexData.length} hexagons`);

    } catch (err) {
      console.error('Failed to load tiles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tiles');
    } finally {
      setLoading(false);
    }
  }, []);

  const getColor = (value: number, confidence: number): string => {
    // Color gradient from green (low) to red (high)
    const colors = [
      { threshold: 0.2, color: 'rgba(45, 201, 55, ALPHA)' },
      { threshold: 0.4, color: 'rgba(152, 216, 62, ALPHA)' },
      { threshold: 0.6, color: 'rgba(231, 180, 22, ALPHA)' },
      { threshold: 0.8, color: 'rgba(252, 108, 0, ALPHA)' },
      { threshold: 1.0, color: 'rgba(204, 50, 50, ALPHA)' }
    ];

    // Adjust opacity based on confidence
    const alpha = Math.max(0.3, confidence * 0.8);

    for (const { threshold, color } of colors) {
      if (value <= threshold) {
        return color.replace('ALPHA', alpha.toFixed(2));
      }
    }

    return colors[colors.length - 1].color.replace('ALPHA', alpha.toFixed(2));
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000000) {
      return `£${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `£${(price / 1000).toFixed(0)}K`;
    }
    return `£${price.toFixed(0)}`;
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 51.5074,
          longitude: -0.1276,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        onRegionChangeComplete={loadTiles}
      >
        {hexagons.map((hex, index) => (
          <Polygon
            key={index}
            coordinates={hex.coordinates}
            fillColor={getColor(hex.value, hex.confidence)}
            strokeColor="rgba(0,0,0,0.15)"
            strokeWidth={1}
            tappable
            onPress={() => setSelectedHex(hex)}
          />
        ))}
      </MapView>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading tiles...</Text>
        </View>
      )}

      {/* Error message */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}
            </Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Property info popup */}
      {selectedHex && (
        <View style={styles.popup}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedHex(null)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.popupTitle}>Property Data</Text>

          <View style={styles.popupRow}>
            <Text style={styles.popupLabel}>Median Price:</Text>
            <Text style={styles.popupValue}>{formatPrice(selectedHex.price)}</Text>
          </View>

          <View style={styles.popupRow}>
            <Text style={styles.popupLabel}>Transactions:</Text>
            <Text style={styles.popupValue}>{selectedHex.count}</Text>
          </View>

          <View style={styles.popupRow}>
            <Text style={styles.popupLabel}>Confidence:</Text>
            <Text style={styles.popupValue}>
              {(selectedHex.confidence * 100).toFixed(0)}%
            </Text>
          </View>

          <View style={styles.confidenceMeter}>
            <View
              style={[
                styles.confidenceBar,
                { width: `${selectedHex.confidence * 100}%` }
              ]}
            />
          </View>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Price Range</Text>
        <View style={styles.legendGradient} />
        <View style={styles.legendLabels}>
          <Text style={styles.legendLabel}>Low</Text>
          <Text style={styles.legendLabel}>Medium</Text>
          <Text style={styles.legendLabel}>High</Text>
        </View>
        {hexagons.length > 0 && (
          <Text style={styles.legendInfo}>
            {hexagons.length} areas shown
          </Text>
        )}
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  errorBanner: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorText: {
    flex: 1,
    color: '#c62828',
    fontSize: 14,
  },
  dismissText: {
    color: '#1976d2',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  popup: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#999',
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  popupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  popupLabel: {
    fontSize: 16,
    color: '#666',
  },
  popupValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  confidenceMeter: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginTop: 10,
    overflow: 'hidden',
  },
  confidenceBar: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  legend: {
    position: 'absolute',
    top: 60,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 10,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  legendGradient: {
    height: 24,
    borderRadius: 4,
    marginBottom: 6,
    backgroundColor: '#2dc937',
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendLabel: {
    fontSize: 11,
    color: '#666',
  },
  legendInfo: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});
        