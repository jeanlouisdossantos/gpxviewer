import { useCallback, useMemo, useRef, useState } from 'react';
import { TrackPoint, computeCumulativeDistances } from '../utils/gpxParser';
import { calculateSignedSlope, getSlopeCategory } from '../utils/segmentUtils';

interface AltitudeProfileProps {
  points: TrackPoint[];
  useSlopeColoring?: boolean;
  slopeThreshold1?: number;
  slopeThreshold2?: number;
  onHover?: (index: number | null) => void; // index of point hovered, or null
  /** Index de point imposé depuis l'extérieur (ex: survol d'un segment sur la carte) */
  externalHoverIndex?: number | null;
  cumulativeDistances?: number[];
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

export function AltitudeProfile({ points, useSlopeColoring = false, slopeThreshold1 = 5, slopeThreshold2 = 10, onHover, externalHoverIndex = null, cumulativeDistances }: AltitudeProfileProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; elevation: number; distance: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);

  const cumulative = useMemo(
    () => cumulativeDistances ?? computeCumulativeDistances(points),
    [points, cumulativeDistances]
  );

  const profile = useMemo(() => {
    const result: { distance: number; elevation: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      result.push({ distance: cumulative[i], elevation: points[i].ele });
    }
    return result;
  }, [points, cumulative]);

  const width = 700;
  const height = 260;
  const padding = 32;

  // Le SVG garde son ratio (preserveAspectRatio "xMidYMid meet" par défaut):
  // il est mis à l'échelle uniformément puis centré dans son conteneur.
  // Toute conversion client <-> viewBox doit donc passer par ce facteur
  // d'échelle et ces offsets, sinon le survol est décalé.
  const getSvgMetrics = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const scale = Math.min(rect.width / width, rect.height / height);
    return {
      rect,
      scale,
      offsetX: (rect.width - width * scale) / 2,
      offsetY: (rect.height - height * scale) / 2
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
        const distanceKm = Math.max( cumulative[i] - cumulative[i - 1], 0.000001 );
        const slope = calculateSignedSlope(points[i].ele - points[i-1].ele, distanceKm);
        const cat = getSlopeCategory(slope, slopeThreshold1, slopeThreshold2);
        color = SLOPE_COLOR_MAP[cat] ?? color;
      }
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color });
    }
    return segs;
  }, [coords, points, cumulative, useSlopeColoring, slopeThreshold1, slopeThreshold2]);

  const handleHoverIndex = useCallback((index: number | null) => {
    // throttle via rAF
    pendingIndexRef.current = index;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const idx = pendingIndexRef.current;
        pendingIndexRef.current = null;
        if (idx === null) {
          setTooltip(null);
          onHover?.(null);
          return;
        }
        const entry = profile[idx];
        if (!entry) return;
        // compute tooltip position relative to container
        const metrics = getSvgMetrics();
        if (metrics) {
          const x = padding + (entry.distance / Math.max(totalDistance, 1)) * (width - padding * 2);
          const y = height - padding - ((entry.elevation - minElevation) / elevationRange) * (height - padding * 2);
          // map svg (viewBox) coords to client pixels, letterbox inclus
          const clientXPos = metrics.rect.left + metrics.offsetX + x * metrics.scale;
          const clientYPos = metrics.rect.top + metrics.offsetY + y * metrics.scale;
          setTooltip({ x: clientXPos, y: clientYPos, elevation: entry.elevation, distance: entry.distance });
        }
        onHover?.(idx);
      });
    }
  }, [profile, onHover, totalDistance, minElevation, elevationRange, getSvgMetrics]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const metrics = getSvgMetrics();
    if (!metrics) return;
    // convert client px -> svg viewBox x, letterbox inclus
    const svgX = (e.clientX - metrics.rect.left - metrics.offsetX) / metrics.scale;

    // If mouse is outside the drawing area (left/right padding), ignore hover
    if (svgX < padding || svgX > (width - padding)) {
      handleHoverIndex(null);
      return;
    }

    // find closest point by svg x (distances cumulées croissantes -> recherche binaire)
    const target = padding + ((svgX - padding) / (width - padding * 2)) * Math.max(totalDistance, 1);
    let lo = 0;
    let hi = profile.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (profile[mid].distance < target) lo = mid + 1;
      else hi = mid;
    }
    // recule d'un cran si le point précédent est plus proche
    let closest = lo;
    if (lo > 0 && Math.abs(profile[lo - 1].distance - target) <= Math.abs(profile[lo].distance - target)) {
      closest = lo - 1;
    }
    handleHoverIndex(closest);
  }, [profile, totalDistance, handleHoverIndex, getSvgMetrics]);

  const handleMouseLeave = useCallback(() => {
    handleHoverIndex(null);
  }, [handleHoverIndex]);

  // Curseur externe (survol d'un segment sur la carte)
  const externalCoord = externalHoverIndex != null && coords[externalHoverIndex] ? coords[externalHoverIndex] : null;

  return (
    <div className="relative rounded-lg bg-slate-50 border border-slate-200 p-4">
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
            <circle key={i} cx={c.x} cy={c.y} r={6} fill="transparent" pointerEvents="all" onMouseEnter={() => handleHoverIndex(i)} />
          ))}

          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" />
          <text x={padding} y={padding - 8} className="text-xs fill-slate-500" fontSize="12">{maxElevation.toFixed(0)} m</text>
          <text x={padding} y={height - padding + 18} className="text-xs fill-slate-500" fontSize="12">{minElevation.toFixed(0)} m</text>
          <text x={width - padding} y={height - 8} textAnchor="end" className="text-xs fill-slate-500" fontSize="12">{totalDistance.toFixed(2)} km</text>

          {/* curseur vertical piloté depuis la carte */}
          {externalCoord && (
            <g pointerEvents="none">
              <line x1={externalCoord.x} y1={padding} x2={externalCoord.x} y2={height - padding} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
              <circle cx={externalCoord.x} cy={externalCoord.y} r={5} fill="#f59e0b" stroke="white" strokeWidth={2} />
            </g>
          )}
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
