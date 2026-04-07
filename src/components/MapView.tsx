import { useEffect, useMemo, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngBounds, divIcon } from 'leaflet';
import { Segment } from '../utils/segmentUtils';
import { TrackPoint } from '../utils/gpxParser';
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
  points?: TrackPoint[];
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

function getHighestAndLowestPoints(points: TrackPoint[]): [TrackPoint | null, TrackPoint | null] {
  if (points.length === 0) return [null, null];
  
  let highest = points[0];
  let lowest = points[0];
  
  for (const point of points) {
    if (point.ele > highest.ele) highest = point;
    if (point.ele < lowest.ele) lowest = point;
  }
  
  return [highest, lowest];
}

function createMarkerIcon(bgColor: string, label: string, ariaLabel: string): ReturnType<typeof divIcon> {
  return divIcon({
    html: `<div role="img" aria-label="${ariaLabel}" style="background-color: ${bgColor}; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-size: 18px;">${label}</div>`,
    iconSize: [32, 32],
    className: 'custom-marker'
  });
}

function MapBounds({ bounds }: { bounds: MapViewProps['bounds'] }) {
  const map = useMap();

  useEffect(() => {
    if (bounds.minLat !== Infinity && bounds.maxLat !== -Infinity) {
      try {
        const leafletBounds = new LatLngBounds(
          [bounds.minLat, bounds.minLon],
          [bounds.maxLat, bounds.maxLon]
        );
        map.fitBounds(leafletBounds, { padding: [50, 50] });
      } catch (error) {
        console.error('Erreur lors du calcul des limites de la carte:', error);
      }
    }
  }, [bounds, map]);

  return null;
}

export function MapView({ segments, bounds, useSlopeColoring = false, points = [] }: MapViewProps) {
  const [mapHeight, setMapHeight] = useState(500);

  // Optimiser le calcul des points hauts/bas
  const [highest, lowest] = useMemo(
    () => getHighestAndLowestPoints(points),
    [points]
  );

  // Générer des identifiants uniques pour les segments (basés sur leurs positions)
  const segmentIds = useMemo(
    () => segments.map((_, i) => `segment-${i}-${segments.length}`),
    [segments]
  );

  // Mémoriser les icônes
  const [highestIcon, lowestIcon] = useMemo(
    () => [
      createMarkerIcon('#ef4444', '⬆️', 'Point le plus haut de la trace'),
      createMarkerIcon('#3b82f6', '⬇️', 'Point le plus bas de la trace')
    ],
    []
  );

  // Créer des handlers mémorisés
  const handleSegmentMouseover = useCallback((e: any, segment: Segment) => {
    e.target.setStyle({ weight: 6, opacity: 1 });
    let tooltip = `Distance: ${segment.length.toFixed(2)} km`;
    if (useSlopeColoring && segment.slope !== undefined) {
      tooltip += ` | Pente: ${segment.slope.toFixed(1)}%`;
    }
    e.target.bindTooltip(tooltip, { permanent: false, sticky: true }).openTooltip();
  }, [useSlopeColoring]);

  const handleSegmentMouseout = useCallback((e: any) => {
    e.target.setStyle({ weight: 4, opacity: 0.8 });
    e.target.closeTooltip();
  }, []);

  // Ajuster la hauteur de la carte sur les petits écrans
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setMapHeight(300);
      } else {
        setMapHeight(500);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Vérifier si highest et lowest sont différents
  const hasElevationChange = highest && lowest && highest.ele !== lowest.ele;

  return (
    <MapContainer
      center={[46.2, 6.15]}
      zoom={13}
      style={{ height: `${mapHeight}px`, width: '100%' }}
      className="rounded-lg shadow-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBounds bounds={bounds} />
      {segments.map((segment, index) => (
        <Polyline
          key={segmentIds[index]}
          positions={segment.points}
          pathOptions={{
            color: getSegmentColor(segment, useSlopeColoring),
            weight: 4,
            opacity: 0.8
          }}
          eventHandlers={{
            mouseover: (e) => handleSegmentMouseover(e, segment),
            mouseout: handleSegmentMouseout
          }}
        />
      ))}
      {highest && hasElevationChange && (
        <Marker position={[highest.lat, highest.lon]} icon={highestIcon}>
          <Popup>
            <div className="font-semibold">Point le plus haut</div>
            <div className="text-sm">Altitude: {highest.ele.toFixed(0)} m</div>
          </Popup>
        </Marker>
      )}
      {lowest && hasElevationChange && (
        <Marker position={[lowest.lat, lowest.lon]} icon={lowestIcon}>
          <Popup>
            <div className="font-semibold">Point le plus bas</div>
            <div className="text-sm">Altitude: {lowest.ele.toFixed(0)} m</div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
