import { TrackPoint, computeCumulativeDistances } from './gpxParser';

export interface Segment {
  points: [number, number][];
  isAboveThreshold: boolean;
  length: number;
  slope?: number;
  slopeCategory?: 'uphill-gentle' | 'uphill-moderate' | 'uphill-steep' | 'downhill-gentle' | 'downhill-moderate' | 'downhill-steep';
  /** Indices de début (inclus) et de fin (exclu) des points de la trace couverts par ce segment */
  startIndex: number;
  endIndex: number;
}

export function calculateSlope(ele1: number, ele2: number, horizontalDistance: number): number {
  if (horizontalDistance === 0) return 0;
  const elevationDifference = ele2 - ele1;
  return (elevationDifference / horizontalDistance) * 100;
}

export function segmentTrack(
  points: TrackPoint[],
  altitudeThreshold: number,
  slopeThreshold1: number = 5,
  slopeThreshold2: number = 10,
  useSlopeColoring: boolean = false,
  cumulativeDistances?: number[]
): Segment[] {
  if (points.length < 2) return [];

  const distances = cumulativeDistances ?? computeCumulativeDistances(points);

  if (useSlopeColoring) {
    // Compute signed slope for each interval, group consecutive intervals by slope category
    type Interval = {
      p1: [number, number];
      p2: [number, number];
      distance: number;
      slope: number;
      category: Segment['slopeCategory'];
    };

    const intervals: Interval[] = [];
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const distance = distances[i] - distances[i - 1];
      const slope = calculateSignedSlope(curr.ele - prev.ele, distance);
      intervals.push({
        p1: [prev.lat, prev.lon],
        p2: [curr.lat, curr.lon],
        distance,
        slope,
        category: getSlopeCategory(slope, slopeThreshold1, slopeThreshold2)
      });
    }

    const segments: Segment[] = [];
    let groupStart = 0;

    for (let i = 1; i <= intervals.length; i++) {
      if (i === intervals.length || intervals[i].category !== intervals[groupStart].category) {
        const group = intervals.slice(groupStart, i);
        const segPoints: [number, number][] = [group[0].p1, ...group.map(iv => iv.p2)];
        const totalLength = group.reduce((sum, iv) => sum + iv.distance, 0);
        const avgSlope = group.reduce((sum, iv) => sum + iv.slope, 0) / group.length;
        segments.push({
          points: segPoints,
          isAboveThreshold: false,
          length: totalLength,
          slope: avgSlope,
          slopeCategory: group[0].category,
          startIndex: groupStart,
          endIndex: i
        });
        groupStart = i;
      }
    }

    return segments;
  }

  // Altitude-based segmentation
  const segments: Segment[] = [];
  let currentSegment: [number, number][] = [[points[0].lat, points[0].lon]];
  let currentIsAbove = points[0].ele >= altitudeThreshold;
  let currentLength = 0;
  let currentStartIndex = 0;

  for (let i = 1; i < points.length; i++) {
    const currentPoint = points[i];
    const isAbove = currentPoint.ele >= altitudeThreshold;

    const segmentDistance = distances[i] - distances[i - 1];

    if (isAbove === currentIsAbove) {
      currentSegment.push([currentPoint.lat, currentPoint.lon]);
      currentLength += segmentDistance;
    } else {
      currentSegment.push([currentPoint.lat, currentPoint.lon]);
      currentLength += segmentDistance;
      segments.push({
        points: currentSegment,
        isAboveThreshold: currentIsAbove,
        length: currentLength,
        startIndex: currentStartIndex,
        endIndex: i
      });
      currentSegment = [[currentPoint.lat, currentPoint.lon]];
      currentIsAbove = isAbove;
      currentLength = 0;
      currentStartIndex = i;
    }
  }

  if (currentSegment.length > 0) {
    segments.push({
      points: currentSegment,
      isAboveThreshold: currentIsAbove,
      length: currentLength,
      startIndex: currentStartIndex,
      endIndex: points.length - 1
    });
  }

  return segments;
}

export function calculateSignedSlope(elevationChange: number, horizontalDistance: number): number {
  if (horizontalDistance === 0) return 0;
  // horizontalDistance in km, elevationChange in meters
  return (elevationChange / (horizontalDistance * 1000)) * 100;
}

export function calculateAbsoluteSlope(elevationChange: number, horizontalDistance: number): number {
  return Math.abs(calculateSignedSlope(elevationChange, horizontalDistance));
}

export type SlopeCategory = NonNullable<Segment['slopeCategory']>;

export function getSlopeCategory(
  slope: number,
  threshold1: number,
  threshold2: number
): SlopeCategory {
  const abs = Math.abs(slope);
  if (slope >= 0) {
    if (abs < threshold1) return 'uphill-gentle';
    if (abs < threshold2) return 'uphill-moderate';
    return 'uphill-steep';
  } else {
    if (abs < threshold1) return 'downhill-gentle';
    if (abs < threshold2) return 'downhill-moderate';
    return 'downhill-steep';
  }
}

function calculateAboveThresholdDistance(points: TrackPoint[], altitudeThreshold: number, distances: number[]): number {
  let aboveDistance = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segmentDistance = distances[i] - distances[i - 1];
    const prevAbove = prev.ele >= altitudeThreshold;
    const currAbove = curr.ele >= altitudeThreshold;

    if (prevAbove && currAbove) {
      aboveDistance += segmentDistance;
    } else if (prevAbove !== currAbove) {
      const elevationDiff = curr.ele - prev.ele;
      if (elevationDiff !== 0) {
        const ratio = Math.abs((altitudeThreshold - prev.ele) / elevationDiff);
        const abovePortion = currAbove ? 1 - ratio : ratio;
        aboveDistance += segmentDistance * abovePortion;
      }
    }
  }

  return aboveDistance;
}

export function calculateStats(
  segments: Segment[],
  points: TrackPoint[],
  useSlopeColoring: boolean,
  _slopeThreshold1: number,
  _slopeThreshold2: number,
  altitudeThreshold: number,
  cumulativeDistances?: number[]
) {
  const distances = cumulativeDistances ?? computeCumulativeDistances(points);

  const totalDistance = segments.reduce((sum, seg) => sum + seg.length, 0);
  const aboveThresholdDistance = calculateAboveThresholdDistance(points, altitudeThreshold, distances);

  const percentage = totalDistance > 0 ? (aboveThresholdDistance / totalDistance) * 100 : 0;

  // Boucles explicites plutôt que Math.min(...points) : le spread sur un
  // grand tableau depasse la taille de pile d'appels (RangeError au-dela
  // de ~100k points).
  let minAltitude = Infinity;
  let maxAltitude = -Infinity;
  for (const p of points) {
    if (p.ele < minAltitude) minAltitude = p.ele;
    if (p.ele > maxAltitude) maxAltitude = p.ele;
  }
  if (!points.length) {
    minAltitude = 0;
    maxAltitude = 0;
  }

  let uphillDistance = 0;
  let downhillDistance = 0;
  let flatDistance = 0;

  if (points.length > 1) {
    for (let i = 1; i < points.length; i++) {
      const elevationDiff = points[i].ele - points[i - 1].ele;
      const segmentDistance = distances[i] - distances[i - 1];

      if (Math.abs(elevationDiff) < 1) {
        flatDistance += segmentDistance;
      } else if (elevationDiff > 0) {
        uphillDistance += segmentDistance;
      } else {
        downhillDistance += segmentDistance;
      }
    }
  }

  // En mode pente, on se base sur les catégories de segments
  if (useSlopeColoring) {
    uphillDistance = 0;
    downhillDistance = 0;
    flatDistance = 0;

    segments.forEach((seg) => {
      if (!seg.slopeCategory) return;
      if (seg.slopeCategory.startsWith('uphill')) {
        uphillDistance += seg.length;
      } else if (seg.slopeCategory.startsWith('downhill')) {
        downhillDistance += seg.length;
      }
      if (seg.slopeCategory.endsWith('gentle')) {
        flatDistance += seg.length;
      }
    });
  }

  return {
    totalDistance,
    aboveThresholdDistance,
    percentage,
    belowThresholdDistance: Math.max(0, totalDistance - aboveThresholdDistance),
    minAltitude,
    maxAltitude,
    uphillDistance,
    downhillDistance,
    flatDistance
  };
}
