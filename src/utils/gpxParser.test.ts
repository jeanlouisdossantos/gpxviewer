import { describe, it, expect } from 'vitest';
import { parseGPX, calculateDistance, computeCumulativeDistances, TrackPoint } from './gpxParser';

const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="46.2" lon="6.15">
        <ele>500</ele>
      </trkpt>
      <trkpt lat="46.201" lon="6.151">
        <ele>600</ele>
      </trkpt>
      <trkpt lat="46.202" lon="6.152">
        <ele>700</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('parseGPX', () => {
  it('parse une trace valide et calcule les bornes', () => {
    const data = parseGPX(validGpx);
    expect(data.points).toHaveLength(3);
    expect(data.points[0]).toEqual({ lat: 46.2, lon: 6.15, ele: 500 });
    expect(data.bounds).toEqual({
      minLat: 46.2,
      maxLat: 46.202,
      minLon: 6.15,
      maxLon: 6.152
    });
  });

  it('attribue ele=0 quand la balise <ele> est absente', () => {
    const gpx = `<gpx><trkseg><trkpt lat="1" lon="2"></trkpt></trkseg></gpx>`;
    const data = parseGPX(gpx);
    expect(data.points[0].ele).toBe(0);
  });

  it('leve une erreur sur un XML mal formé (parsererror)', () => {
    expect(() => parseGPX('<gpx><unclosed>')).toThrow(/invalide|GPX/i);
  });

  it('leve une erreur quand aucun <trkpt> nest present', () => {
    expect(() => parseGPX('<gpx version="1.1"></gpx>')).toThrow(/Aucun point/i);
  });

  it('leve une erreur sur des coordonnees non numeriques', () => {
    const gpx = `<gpx><trkseg><trkpt lat="abc" lon="6.15"></trkpt></trkseg></gpx>`;
    expect(() => parseGPX(gpx)).toThrow(/invalide/i);
  });
});

describe('calculateDistance', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(calculateDistance(46.2, 6.15, 46.2, 6.15)).toBe(0);
  });

  it('calcule correctement la distance haversine (~111 km pour 1 degre de latitude)', () => {
    const d = calculateDistance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

describe('computeCumulativeDistances', () => {
  it('retourne un tableau de meme longueur, croissant, commencant a 0', () => {
    const points: TrackPoint[] = [
      { lat: 0, lon: 0, ele: 10 },
      { lat: 0.01, lon: 0, ele: 20 },
      { lat: 0.02, lon: 0, ele: 30 }
    ];
    const cum = computeCumulativeDistances(points);
    expect(cum).toHaveLength(3);
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeGreaterThan(0);
    expect(cum[2]).toBeGreaterThan(cum[1]);
  });

  it('retourne un tableau vide pour une trace vide', () => {
    expect(computeCumulativeDistances([])).toEqual([]);
  });
});
