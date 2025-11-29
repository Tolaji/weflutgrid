import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from './ErrorBoundary';

// Conditional imports for native vs web
let MapView: any;
let Polygon: any;

if (Platform.OS === 'web') {
  // Use the web component
  const WebMapComponent = require('./MapComponent.web').default;
  MapView = WebMapComponent;
  Polygon = WebMapComponent.Polygon;
} else {
  // Use the native component
  const NativeMapComponent = require('./MapComponent.native').default;
  MapView = NativeMapComponent;
  Polygon = NativeMapComponent.Polygon;
}

const TILE_API_URL =
  Constants.expoConfig?.extra?.tileApiUrl || 'http://localhost:3000';

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [hexagons, setHexagons] = useState<any[]>([]);
  const [selectedHex, setSelectedHex] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getColor = (value: number, confidence: number): string => {
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
  };

  const formatPrice = (price: number): string => {
    if (price >= 1_000_000) {
      return `£${(price / 1_000_000).toFixed(1)}M`;
    } else if (price >= 1_000) {
      return `£${(price / 1_000).toFixed(0)}K`;
    }
    return `£${price.toFixed(0)}`;
  };

  const loadTiles = useCallback(
    async (region: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    }) => {
      try {
        setLoading(true);
        setError(null);

        const z = Math.floor(Math.log2(360 / region.longitudeDelta));
        const x = Math.floor(
          ((region.longitude + 180) / 360) * Math.pow(2, z)
        );

        const y = Math.floor(
          ((1 -
            Math.log(
              Math.tan((region.latitude * Math.PI) / 180) +
              1 / Math.cos((region.latitude * Math.PI) / 180)) /
            Math.PI) /
            2) *
            Math.pow(2, z)
        );

        const tileUrl = `${TILE_API_URL}/tiles/${z}/${x}/${y}.geojson`;
        console.log('Fetching:', tileUrl);

        const response = await fetch(tileUrl);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const geojson = await response.json();
        console.log('Received features:', geojson.features?.length || 0);

        // loadTiles function, coordinate mapping:
        const hexData = geojson.features.map((feature: any) => {
          // Handle both coordinate formats: [lng, lat] and {latitude, longitude}
          const coordinates = feature.geometry.coordinates[0].map((coord: any) => {
            if (Array.isArray(coord)) {
              return { latitude: coord[1], longitude: coord[0] };
            } else {
              return { latitude: coord.latitude, longitude: coord.longitude };
            }
          });

          return {
            coordinates,
            price: feature.properties.price,
            count: feature.properties.count,
            confidence: feature.properties.confidence,
            value: feature.properties.value,
          };
        });

        setHexagons(hexData);
      } catch (err: any) {
        console.error('Tile loading error:', err);
        setError(err.message || 'Failed to load tiles');
      } finally {
        setLoading(false);
      }
    },
    []
  );

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

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading tiles...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

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
            <Text style={styles.popupValue}>
              {formatPrice(selectedHex.price)}
            </Text>
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
                { width: `${selectedHex.confidence * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

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

      {/* Platform indicator */}
      <View style={styles.platformBadge}>
        <Text style={styles.platformText}>
          {Platform.OS === 'web' ? '🌐 Web' : '📱 Native'}
        </Text>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
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
  errorText: { flex: 1, color: '#c62828', fontSize: 14 },
  dismissText: { color: '#1976d2', fontWeight: 'bold', marginLeft: 10 },
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
  closeButtonText: { fontSize: 24, color: '#999' },
  popupTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  popupRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  popupLabel: { fontSize: 16, color: '#666' },
  popupValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  confidenceMeter: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginTop: 10,
    overflow: 'hidden',
  },
  confidenceBar: { height: '100%', backgroundColor: '#4caf50' },
  legend: {
    position: 'absolute',
    top: 60,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
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
    // Using a gradient for price range visualization
    backgroundColor: Platform.OS === 'web' 
      ? 'linear-gradient(to right, #2dc937, #98d83e, #e7b416, #fc6c00, #cc3232)'
      : '#2dc937', // Fallback for native
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendLabel: { fontSize: 11, color: '#666' },
  legendInfo: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  platformBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(33,150,243,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  platformText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
