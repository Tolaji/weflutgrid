import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon as LeafletPolygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Define proper TypeScript interfaces for better type safety
interface MapViewProps {
  children?: React.ReactNode;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  onRegionChangeComplete?: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => void;
  style?: React.CSSProperties;
}

interface PolygonProps {
  coordinates: Array<{latitude: number, longitude: number}>;
  fillColor: string;
  strokeColor: string;
  strokeWidth?: number;
  onPress?: () => void;
}

export default function MapView({
  children,
  initialRegion,
  onRegionChangeComplete,
  style = {}
}: MapViewProps) {
  // Calculate initial zoom from latitudeDelta if provided
  const calculateZoom = (latitudeDelta?: number) => {
    if (!latitudeDelta) return 13; // Default zoom level
    // Simple approximation: larger delta = lower zoom
    return Math.max(1, Math.min(18, Math.round(Math.log2(360 / latitudeDelta))));
  };

  function MapEvents() {
    const map = useMapEvents({
      moveend: () => {
        try {
          const center = map.getCenter();
          const bounds = map.getBounds();
          const zoom = map.getZoom();

          if (onRegionChangeComplete) {
            onRegionChangeComplete({
              latitude: center.lat,
              longitude: center.lng,
              latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
              longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest()),
            });
          }
        } catch (error) {
          console.error('Error handling map move event:', error);
        }
      }
    });
    return null;
  }

  return (
    <div style={style}>
      <MapContainer
        center={[initialRegion.latitude, initialRegion.longitude]}
        zoom={calculateZoom(initialRegion.latitudeDelta)}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapEvents />
        {children}
      </MapContainer>
    </div>
  );
}

export function Polygon({
  coordinates,
  fillColor,
  strokeColor,
  strokeWidth = 1,
  onPress
}: PolygonProps) {
  // Validate coordinates before processing
  if (!coordinates || coordinates.length === 0) {
    console.warn('Polygon: No coordinates provided');
    return null;
  }

  // Convert coordinate format for Leaflet
  const positions: [number, number][] = coordinates.map(c => [c.latitude, c.longitude]);


  return (
    <LeafletPolygon
      positions={positions}
      pathOptions={{
        fillColor: fillColor,
        color: strokeColor,
        weight: strokeWidth,
        fillOpacity: 0.6,
      }}
      eventHandlers={{
        click: onPress,
      }}
    />
  );
}
