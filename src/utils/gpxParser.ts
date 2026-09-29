export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
}

export interface GPXData {
  points: TrackPoint[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export function parseGPX(gpxString: string): GPXData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxString, 'text/xml');

  // DOMParser ne leve pas d'exception sur un XML invalide : il produit un
  // document contenant <parsererror>. On doit verifier explicitement.
  const parseErrors = xmlDoc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    throw new Error('Fichier GPX invalide (XML mal formé)');
  }

  const trkpts = xmlDoc.getElementsByTagName('trkpt');
  const points: TrackPoint[] = [];

  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  for (let i = 0; i < trkpts.length; i++) {
    const trkpt = trkpts[i];
    const lat = parseFloat(trkpt.getAttribute('lat') || '0');
    const lon = parseFloat(trkpt.getAttribute('lon') || '0');
    const eleNode = trkpt.getElementsByTagName('ele')[0];
    const ele = eleNode ? parseFloat(eleNode.textContent || '0') : 0;

    if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(ele)) {
      throw new Error(`Point GPX invalide à l'index ${i}`);
    }

    points.push({ lat, lon, ele });

    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }

  if (points.length === 0) {
    throw new Error('Aucun point de trace (<trkpt>) trouvé dans le fichier GPX');
  }

  return {
    points,
    bounds: { minLat, maxLat, minLon, maxLon }
  };
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Distances cumulées (en km) le long de la trace : result[i] = distance
 * parcourue entre points[0] et points[i]. Calule la haversine une seule
 * fois par intervalle au lieu de la recalculer dans chaque module.
 */
export function computeCumulativeDistances(points: TrackPoint[]): number[] {
  if (points.length === 0) return [];
  const cumulative = new Array<number>(points.length);
  cumulative[0] = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    cumulative[i] = cumulative[i - 1] + calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
  }
  return cumulative;
}
