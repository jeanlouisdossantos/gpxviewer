import { TrackPoint, calculateDistance } from './gpxParser';

export interface Segment {
  points: [number, number][];
  isAboveThreshold: boolean;
  length: number;
  slope?: number;
  slopeCategory?: 'uphill-gentle' | 'uphill-moderate' | 'uphill-steep' | 'downhill-gentle' | 'downhill-moderate' | 'downhill-steep';
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
  useSlopeColoring: boolean = false
): Segment[] {
  if (points.length < 2) return [];

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
      const distance = calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
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
          slopeCategory: group[0].category
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

  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    const isAbove = currentPoint.ele >= altitudeThreshold;

    const segmentDistance = calculateDistance(
      prevPoint.lat,
      prevPoint.lon,
      currentPoint.lat,
      currentPoint.lon
    );

    if (isAbove === currentIsAbove) {
      currentSegment.push([currentPoint.lat, currentPoint.lon]);
      currentLength += segmentDistance;
    } else {
      currentSegment.push([currentPoint.lat, currentPoint.lon]);
      currentLength += segmentDistance;
      segments.push({
        points: currentSegment,
        isAboveThreshold: currentIsAbove,
        length: currentLength
      });
      currentSegment = [[currentPoint.lat, currentPoint.lon]];
      currentIsAbove = isAbove;
      currentLength = 0;
    }
  }

  if (currentSegment.length > 0) {
    segments.push({
      points: currentSegment,
      isAboveThreshold: currentIsAbove,
      length: currentLength
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

export function getSlopeCategory(
  slope: number,
  threshold1: number,
  threshold2: number
): Segment['slopeCategory'] {
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

export function calculateStats(segments: Segment[]) {
  const totalDistance = segments.reduce((sum, seg) => sum + seg.length, 0);
  const aboveThresholdDistance = segments
    .filter(seg => seg.isAboveThreshold)
    .reduce((sum, seg) => sum + seg.length, 0);

  const percentage = totalDistance > 0 ? (aboveThresholdDistance / totalDistance) * 100 : 0;

  return {
    totalDistance,
    aboveThresholdDistance,
    percentage
  };
}
