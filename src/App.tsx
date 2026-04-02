import { useState, useMemo } from 'react';
import { Upload } from 'lucide-react';
import { parseGPX, GPXData } from './utils/gpxParser';
import { segmentTrack, calculateStats } from './utils/segmentUtils';
import { MapView } from './components/MapView';
import { StatsPanel } from './components/StatsPanel';

function App() {
  const [gpxData, setGpxData] = useState<GPXData | null>(null);
  const [altitudeThreshold, setAltitudeThreshold] = useState<number>(1000);
  const [fileName, setFileName] = useState<string>('');
  const [useSlopeColoring, setUseSlopeColoring] = useState<boolean>(false);
  const [slopeThreshold1, setSlopeThreshold1] = useState<number>(5);
  const [slopeThreshold2, setSlopeThreshold2] = useState<number>(10);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const data = parseGPX(content);
        setGpxData(data);
      } catch (error) {
        alert('Erreur lors de la lecture du fichier GPX');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  const segments = useMemo(() => {
    if (!gpxData) return [];
    return segmentTrack(gpxData.points, altitudeThreshold, slopeThreshold1, slopeThreshold2, useSlopeColoring);
  }, [gpxData, altitudeThreshold, slopeThreshold1, slopeThreshold2, useSlopeColoring]);

  const stats = useMemo(() => {
    return calculateStats(segments);
  }, [segments]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Analyseur de traces GPX
            </h1>
            <p className="text-gray-600">
              Visualisez votre parcours et analysez les segments par altitude
            </p>
          </header>

          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fichier GPX
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".gpx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="gpx-upload"
                  />
                  <label
                    htmlFor="gpx-upload"
                    className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">
                      {fileName || 'Choisir un fichier GPX'}
                    </span>
                  </label>
                </div>
              </div>

              {!useSlopeColoring && (
                <div className="flex-1">
                  <label htmlFor="altitude" className="block text-sm font-medium text-gray-700 mb-2">
                    Altitude seuil (mètres)
                  </label>
                  <input
                    id="altitude"
                    type="number"
                    value={altitudeThreshold}
                    onChange={(e) => setAltitudeThreshold(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Altitude en mètres"
                  />
                </div>
              )}

              {useSlopeColoring && (
                <>
                  <div className="flex-1">
                    <label htmlFor="slope1" className="block text-sm font-medium text-gray-700 mb-2">
                      Seuil bas de pente (%)
                    </label>
                    <input
                      id="slope1"
                      type="number"
                      min={0}
                      value={slopeThreshold1}
                      onChange={(e) => setSlopeThreshold1(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 5"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="slope2" className="block text-sm font-medium text-gray-700 mb-2">
                      Seuil haut de pente (%)
                    </label>
                    <input
                      id="slope2"
                      type="number"
                      min={0}
                      value={slopeThreshold2}
                      onChange={(e) => setSlopeThreshold2(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 10"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg">
                <input
                  id="slope-toggle"
                  type="checkbox"
                  checked={useSlopeColoring}
                  onChange={(e) => setUseSlopeColoring(e.target.checked)}
                  className="w-5 h-5 text-blue-500 cursor-pointer"
                />
                <label htmlFor="slope-toggle" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Colorer par pente
                </label>
              </div>
            </div>

            {gpxData && (
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {useSlopeColoring ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 rounded" style={{ backgroundColor: '#fca5a5' }}></div>
                      <span className="text-gray-600">Montée légère (&lt;{slopeThreshold1}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                      <span className="text-gray-600">Montée modérée ({slopeThreshold1}%-{slopeThreshold2}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 rounded" style={{ backgroundColor: '#991b1b' }}></div>
                      <span className="text-gray-600">Montée raide (&gt;{slopeThreshold2}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 rounded" style={{ backgroundColor: '#93c5fd' }}></div>
                      <span className="text-gray-600">Descente légère (&lt;{slopeThreshold1}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                      <span className="text-gray-600">Descente modérée ({slopeThreshold1}%-{slopeThreshold2}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 rounded" style={{ backgroundColor: '#1e3a8a' }}></div>
                      <span className="text-gray-600">Descente raide (&gt;{slopeThreshold2}%)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-green-500 rounded"></div>
                      <span className="text-gray-600">En dessous de {altitudeThreshold}m</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-red-500 rounded"></div>
                      <span className="text-gray-600">Au-dessus de {altitudeThreshold}m</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {gpxData && segments.length > 0 && (
            <>
              <MapView segments={segments} bounds={gpxData.bounds} useSlopeColoring={useSlopeColoring} />
              {!useSlopeColoring && (
                <StatsPanel
                  totalDistance={stats.totalDistance}
                  aboveThresholdDistance={stats.aboveThresholdDistance}
                  percentage={stats.percentage}
                  altitudeThreshold={altitudeThreshold}
                />
              )}
            </>
          )}

          {!gpxData && (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Aucun fichier chargé
              </h3>
              <p className="text-gray-500">
                Importez un fichier GPX pour commencer l'analyse
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
