import { create } from 'zustand';

interface MapState {
  selectedMetric: 'median_price' | 'price_per_sqm' | 'rental_price';
  showConfidenceOverlay: boolean;
  minConfidence: number;
  setSelectedMetric: (metric: MapState['selectedMetric']) => void;
  toggleConfidenceOverlay: () => void;
  setMinConfidence: (value: number) => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedMetric: 'median_price',
  showConfidenceOverlay: false,
  minConfidence: 0.5,
  
  setSelectedMetric: (metric) => set({ selectedMetric: metric }),
  toggleConfidenceOverlay: () => set((state) => ({ 
    showConfidenceOverlay: !state.showConfidenceOverlay 
  })),
  setMinConfidence: (value) => set({ minConfidence: value }),
}));