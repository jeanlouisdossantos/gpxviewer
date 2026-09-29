import { describe, it, expect } from 'vitest';
import {
  calculateSignedSlope,
  calculateAbsoluteSlope,
  getSlopeCategory,
  segmentTrack,
  calculateStats,
  Segment
} from './segmentUtils';
import { TrackPoint, computeCumulativeDistances } from './gpxParser';

function makePoints(elevations: number[], latStep = 0.001): TrackPoint[] {
  return elevations.map((ele, i) => ({ lat: 46 + i * latStep, lon: 6.15, ele }));
}

describe('calculateSignedSlope', () => {
  it('retourne 0 pour une distance nulle', () => {
    expect(calculateSignedSlope(100, 0)).toBe(0);
  });

  it('calcule la pente signee (100 m sur 1 km = 10%)', () => {
    expect(calculateSignedSlope(100, 1)).toBeCloseTo(10, 5);
    expect(calculateSignedSlope(-100, 1)).toBeCloseTo(-10, 5);
  });

  it('calculateAbsoluteSlope ignore le signe', () => {
    expect(calculateAbsoluteSlope(-50, 1)).toBeCloseTo(5, 5);
  });
});

describe('getSlopeCategory', () => {
  it('categorise une pente nulle comme montee legere', () => {
    expect(getSlopeCategory(0, 5, 10)).toBe('uphill-gentle');
  });

  it('respecte les bornes des seuils', () => {
    expect(getSlopeCategory(4.9, 5, 10)).toBe('uphill-gentle');
    expect(getSlopeCategory(5, 5, 10)).toBe('uphill-moderate');
    expect(getSlopeCategory(9.9, 5, 10)).toBe('uphill-moderate');
    expect(getSlopeCategory(10, 5, 10)).toBe('uphill-steep');
  });

  it('distingue montee et descente', () => {
    expect(getSlopeCategory(-4, 5, 10)).toBe('downhill-gentle');
    expect(getSlopeCategory(-7, 5, 10)).toBe('downhill-moderate');
    expect(getSlopeCategory(-12, 5, 10)).toBe('downhill-steep');
  });
});

describe('segmentTrack (mode altitude)', () => {
  const points = makePoints([900, 950, 1050, 1100, 800]);

  it('decoupe la trace aux franchissements du seuil', () => {
    const segments = segmentTrack(points, 1000);
    expect(segments).toHaveLength(3);
    expect(segments[0].isAboveThreshold).toBe(false);
    expect(segments[1].isAboveThreshold).toBe(true);
    expect(segments[2].isAboveThreshold).toBe(false);
  });

  it('les indices startIndex/endIndex (inclusifs) couvrent tous les points', () => {
    const segments = segmentTrack(points, 1000);
    expect(segments[0].startIndex).toBe(0);
    expect(segments[0].endIndex).toBe(2);
    expect(segments[1].startIndex).toBe(2);
    // le point de franchissement (1050 -> 800 au point 4) appartient aux deux segments adjacents
    expect(segments[1].endIndex).toBe(4);
    expect(segments[2].startIndex).toBe(4);
    expect(segments[2].endIndex).toBe(points.length - 1);
  });

  it('la somme des longueurs des segments vaut la distance totale', () => {
    const segments = segmentTrack(points, 1000);
    const cumulative = computeCumulativeDistances(points);
    const total = segments.reduce((sum, seg) => sum + seg.length, 0);
    expect(total).toBeCloseTo(cumulative[cumulative.length - 1], 10);
  });

  it('retourne [] pour moins de 2 points', () => {
    expect(segmentTrack([], 1000)).toEqual([]);
    expect(segmentTrack(makePoints([500]), 1000)).toEqual([]);
  });

  it('utilise les distances cumulees passees en parametre sans les recalculer', () => {
    const cumulative = computeCumulativeDistances(points);
    const withParam = segmentTrack(points, 1000, 5, 10, false, cumulative);
    const withoutParam = segmentTrack(points, 1000);
    expect(withParam).toEqual(withoutParam);
  });
});

describe('segmentTrack (mode pente)', () => {
  it('regroupe les intervalles consecutifs de meme categorie', () => {
    // 1 degre de latitude ~ 111 km ; 0.001 degre ~ 111 m
    // ele: +5/point -> ~4.5% (gentle), +20/point -> ~18% (steep)
    const points = makePoints([0, 5, 10, 30, 50, 45, 35]);
    const segments = segmentTrack(points, 1000, 5, 10, true);
    expect(segments).toHaveLength(4);
    expect(segments[0].slopeCategory).toBe('uphill-gentle');
    expect(segments[1].slopeCategory).toBe('uphill-steep');
    expect(segments[2].slopeCategory).toBe('downhill-gentle');
    expect(segments[3].slopeCategory).toBe('downhill-moderate');
  });

  it('chaque segment porte des indices de points coherents', () => {
    const points = makePoints([0, 5, 10, 30, 50]);
    const segments: Segment[] = segmentTrack(points, 1000, 5, 10, true);
    expect(segments[0].startIndex).toBe(0);
    expect(segments[segments.length - 1].endIndex).toBe(points.length - 1);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startIndex).toBe(segments[i - 1].endIndex);
    }
  });
});

describe('calculateStats', () => {
  it('calcule min/max et la repartition montee/descente/plat', () => {
    const points = makePoints([100, 110, 105, 105, 90]);
    const segments = segmentTrack(points, 1000);
    const stats = calculateStats(segments, points, false, 5, 10, 1000);
    expect(stats.minAltitude).toBe(90);
    expect(stats.maxAltitude).toBe(110);
    expect(stats.totalDistance).toBeGreaterThan(0);
    // toutes les altitudes < 1000 -> 100% en dessous
    expect(stats.aboveThresholdDistance).toBe(0);
    expect(stats.percentage).toBe(0);
  });

  it('interpole la distance au-dessus du seuil au franchissement', () => {
    // 2 points: 900 m -> 1100 m, seuil 1000 -> exactement la moitie au-dessus
    const points = makePoints([900, 1100], 0.01);
    const segments = segmentTrack(points, 1000);
    const stats = calculateStats(segments, points, false, 5, 10, 1000);
    expect(stats.aboveThresholdDistance).toBeCloseTo(stats.totalDistance / 2, 5);
    expect(stats.percentage).toBeCloseTo(50, 5);
  });

  it('gere un grand nombre de points sans depasser la pile dappels', () => {
    const count = 200000;
    const points: TrackPoint[] = Array.from({ length: count }, (_, i) => ({
      lat: 46 + i * 0.00001,
      lon: 6.15,
      ele: (i % 100) * 20
    }));
    const segments = segmentTrack(points, 1000);
    expect(() => calculateStats(segments, points, false, 5, 10, 1000)).not.toThrow();
    const stats = calculateStats(segments, points, false, 5, 10, 1000);
    expect(stats.minAltitude).toBe(0);
    expect(stats.maxAltitude).toBe(1980);
  });

  it('retourne des valeurs par defaut pour une trace vide', () => {
    const stats = calculateStats([], [], false, 5, 10, 1000);
    expect(stats.totalDistance).toBe(0);
    expect(stats.minAltitude).toBe(0);
    expect(stats.maxAltitude).toBe(0);
  });
});
