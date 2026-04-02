import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import { Segment } from '../utils/segmentUtils';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  segments: Segment[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  useSlopeColoring?: boolean;
}

function getSegmentColor(segment: Segment, useSlopeColoring: boolean): string {
  if (useSlopeColoring && segment.slopeCategory) {
    switch (segment.slopeCategory) {
      case 'uphill-gentle': return '#fca5a5'; // rouge clair
      case 'uphill-moderate': return '#ef4444'; // rouge moyen
      case 'uphill-steep': return '#991b1b'; // rouge foncé
      case 'downhill-gentle': return '#93c5fd'; // bleu clair
      case 'downhill-moderate': return '#3b82f6'; // bleu moyen
      case 'downhill-steep': return '#1e3a8a'; // bleu foncé
    }
  }
  return segment.isAboveThreshold ? '#ef4444' : '#22c55e';
}

function MapBounds({ bounds }: { bounds: MapViewProps['bounds'] }) {
  const map = useMap();

  useEffect(() => {
    if (bounds.minLat !== Infinity) {
      const leafletBounds = new LatLngBounds(
        [bounds.minLat, bounds.minLon],
        [bounds.maxLat, bounds.maxLon]
      );
      map.fitBounds(leafletBounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  return null;
}

export function MapView({ segments, bounds, useSlopeColoring = false }: MapViewProps) {
  return (
    <MapContainer
      center={[46.2, 6.15]}
      zoom={13}
      style={{ height: '500px', width: '100%' }}
      className="rounded-lg shadow-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBounds bounds={bounds} />
      {segments.map((segment, index) => (
        <Polyline
          key={index}
          positions={segment.points}
          pathOptions={{
            color: getSegmentColor(segment, useSlopeColoring),
            weight: 4,
            opacity: 0.8
          }}
          eventHandlers={{
            mouseover: (e) => {
              e.target.setStyle({ weight: 6, opacity: 1 });
              let tooltip = `Distance: ${segment.length.toFixed(2)} km`;
              if (useSlopeColoring && segment.slope !== undefined) {
                tooltip += ` | Pente: ${segment.slope.toFixed(1)}%`;
              }
              e.target.bindTooltip(tooltip, { permanent: false, sticky: true }).openTooltip();
            },
            mouseout: (e) => {
              e.target.setStyle({ weight: 4, opacity: 0.8 });
              e.target.closeTooltip();
            }
          }}
        />
      ))}
    </MapContainer>
  );
}
