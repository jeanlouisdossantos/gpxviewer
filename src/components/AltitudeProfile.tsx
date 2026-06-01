import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrackPoint, calculateDistance } from '../utils/gpxParser';
import { calculateSignedSlope, getSlopeCategory } from '../utils/segmentUtils';

interface AltitudeProfileProps {
  points: TrackPoint[];
  useSlopeColoring?: boolean;
  slopeThreshold1?: number;
  slopeThreshold2?: number;
  onHover?: (index: number | null) => void; // index of point hovered, or null
}

// Couleurs basées sur la pente (plat/descente -> vert, faux plat -> orange, forte pente -> rouge)
const SLOPE_COLOR_MAP: Record<string, string> = {
  'uphill-gentle': '#fb923c',
  'uphill-moderate': '#f97316',
  'uphill-steep': '#dc2626',
  'downhill-gentle': '#16a34a',
  'downhill-moderate': '#16a34a',
  'downhill-steep': '#16a34a'
};

export function AltitudeProfile({ points, useSlopeColoring = false, slopeThreshold1 = 5, slopeThreshold2 = 10, onHover }: AltitudeProfileProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; elevation: number; distance: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);

  const profile = useMemo(() => {
    const result: { distance: number; elevation: number }[] = [];
    let totalDistance = 0;
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (i > 0) {
        const previous = points[i - 1];
        totalDistance += calculateDistance(previous.lat, previous.lon, point.lat, point.lon);
      }
      result.push({ distance: totalDistance, elevation: point.ele });
    }
    return result;
  }, [points]);

  const width = 700;
  const height = 260;
  const padding = 32;

  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (svgRef.current) setContainerWidth(svgRef.current.clientWidth);
    };

    updateWidth();

    // Prefer ResizeObserver when available
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && svgRef.current) {
      ro = new ResizeObserver(() => updateWidth());
      ro.observe(svgRef.current);
    } else {
      window.addEventListener('resize', updateWidth);
    }

    return () => {
      if (ro && svgRef.current) ro.unobserve(svgRef.current);
      else window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const totalDistance = profile.length ? profile[profile.length - 1].distance : 0;
  const minElevation = profile.length ? Math.min(...profile.map((entry) => entry.elevation)) : 0;
  const maxElevation = profile.length ? Math.max(...profile.map((entry) => entry.elevation)) : 0;
  const elevationRange = maxElevation - minElevation || 1;

  // coords are computed in SVG viewBox coordinate space (0..width, 0..height)
  const coords = useMemo(() => profile.map((entry) => {
    const x = padding + (entry.distance / Math.max(totalDistance, 1)) * (width - padding * 2);
    const y = height - padding - ((entry.elevation - minElevation) / elevationRange) * (height - padding * 2);
    return { x, y, elevation: entry.elevation, distance: entry.distance };
  }), [profile, totalDistance, minElevation, elevationRange]);

  // Intervalles entre points: couleur par pente
  const segments = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1];
      const b = coords[i];
      let color = '#1d4ed8';
      if (useSlopeColoring && points[i - 1] && points[i]) {
        const distanceKm = Math.max( calculateDistance(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon), 0.000001 );
        const slope = calculateSignedSlope(points[i].ele - points[i-1].ele, distanceKm);
        const cat = getSlopeCategory(slope, slopeThreshold1, slopeThreshold2);
        color = SLOPE_COLOR_MAP[cat] ?? color;
      }
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color });
    }
    return segs;
  }, [coords, points, useSlopeColoring, slopeThreshold1, slopeThreshold2]);

  const handleHoverIndex = useCallback((index: number | null, clientX?: number, clientY?: number) => {
    // throttle via rAF
    pendingIndexRef.current = index;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const idx = pendingIndexRef.current;
        pendingIndexRef.current = null;
        setHoverIndex(idx);
        if (idx === null) {
          setTooltip(null);
          onHover?.(null);
          return;
        }
        const entry = profile[idx];
        if (!entry) return;
        // compute tooltip position relative to container
        if (svgRef.current) {
          const rect = svgRef.current.getBoundingClientRect();
          const x = padding + (entry.distance / Math.max(totalDistance, 1)) * (width - padding * 2);
          const y = height - padding - ((entry.elevation - minElevation) / elevationRange) * (height - padding * 2);
          // map svg (viewBox) coords to client pixels using svg rect
          const scaleX = rect.width / width;
          const scaleY = rect.height / height;
          const clientXPos = rect.left + x * scaleX;
          const clientYPos = rect.top + y * scaleY;
          setTooltip({ x: clientXPos, y: clientYPos, elevation: entry.elevation, distance: entry.distance });
        }
        onHover?.(idx);
      });
    }
  }, [profile, onHover, totalDistance, minElevation, elevationRange]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // px inside svg
    // convert mouseX (client px) -> svg viewBox x
    const svgX = (mouseX / rect.width) * width;

    // If mouse is outside the drawing area (left/right padding), ignore hover
    if (svgX < padding || svgX > (width - padding)) {
      handleHoverIndex(null);
      return;
    }

    // find closest point by svg x
    let closest = 0;
    let bestDist = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - svgX);
      if (d < bestDist) {
        bestDist = d;
        closest = i;
      }
    });
    handleHoverIndex(closest, e.clientX, e.clientY);
  }, [coords, handleHoverIndex]);

  const handleMouseLeave = useCallback(() => {
    handleHoverIndex(null);
  }, [handleHoverIndex]);

  return (
    <div ref={containerRef} className="relative rounded-lg bg-slate-50 border border-slate-200 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Profil altimétrique</h3>
          <p className="mt-1 text-sm text-slate-500">Analyse de l'élévation le long de la trace</p>
        </div>
        <div className="text-sm text-slate-600">
          Distance totale : <span className="font-semibold">{totalDistance.toFixed(2)} km</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden relative">
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-64" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <defs>
            <linearGradient id="profileGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M ${padding},${height - padding} ${coords.map(c => `${c.x},${c.y}`).join(' ')} ${width - padding},${height - padding}`} fill="url(#profileGradient)" />

          {segments.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={3} strokeLinecap="round" />
          ))}

          {/* markers for points: invisible circles for hover precision */}
          {coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={6} fill="transparent" pointerEvents="all" onMouseEnter={(ev) => handleHoverIndex(i, ev.clientX, ev.clientY)} />
          ))}

          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" />
          <text x={padding} y={padding - 8} className="text-xs fill-slate-500" fontSize="12">{maxElevation.toFixed(0)} m</text>
          <text x={padding} y={height - padding + 18} className="text-xs fill-slate-500" fontSize="12">{minElevation.toFixed(0)} m</text>
          <text x={width - padding} y={height - 8} textAnchor="end" className="text-xs fill-slate-500" fontSize="12">{totalDistance.toFixed(2)} km</text>
        </svg>

        {tooltip && (
          <div style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 36, pointerEvents: 'none' }} className="bg-white border border-slate-200 rounded shadow px-3 py-2 text-xs">
            <div><strong>{tooltip.elevation.toFixed(0)} m</strong></div>
            <div>{tooltip.distance.toFixed(2)} km parcourus</div>
            <div>{(totalDistance - tooltip.distance).toFixed(2)} km restants</div>
          </div>
        )}
      </div>
    </div>
  );
}
