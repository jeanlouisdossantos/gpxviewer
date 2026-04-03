import { useState, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import { Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { parseGPX, GPXData } from './utils/gpxParser';
import { segmentTrack, calculateStats } from './utils/segmentUtils';
import { MapView } from './components/MapView';
import { StatsPanel } from './components/StatsPanel';
import { SavePanel } from './components/SavePanel';
import { HistoryMenu } from './components/HistoryMenu';
import { saveTrace, SavedTrace, updateTrace } from './utils/indexedDBManager';

function App() {
  const [gpxData, setGpxData] = useState<GPXData | null>(null);
  const [gpxContent, setGpxContent] = useState<string>('');
  const [altitudeThreshold, setAltitudeThreshold] = useState<number>(1000);
  const [fileName, setFileName] = useState<string>('');
  const [useSlopeColoring, setUseSlopeColoring] = useState<boolean>(false);
  const [slopeThreshold1, setSlopeThreshold1] = useState<number>(5);
  const [slopeThreshold2, setSlopeThreshold2] = useState<number>(10);
  const [currentTraceId, setCurrentTraceId] = useState<string | null>(null);
  const [currentTraceName, setCurrentTraceName] = useState<string>('Nouvelle trace');
  const { enqueueSnackbar } = useSnackbar();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setCurrentTraceId(null);
    setCurrentTraceName(file.name.replace(/\.gpx$/i, '') || 'Nouvelle trace');
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        setGpxContent(content);
        const data = parseGPX(content);
        setGpxData(data);
      } catch (error) {
        enqueueSnackbar('Erreur lors de la lecture du fichier GPX', { variant: 'error' });
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveTrace = async (traceName: string) => {
    if (!gpxData || !gpxContent) {
      enqueueSnackbar('Veuillez charger un fichier GPX avant de sauvegarder', { variant: 'warning' });
      return;
    }

    try {
      if (currentTraceId) {
        // Mise à jour de la trace existante
        await updateTrace(currentTraceId, {
          name: traceName,
          gpxContent: gpxContent,
          fileName: fileName,
          bounds: gpxData.bounds,
          altitudeThreshold,
          useSlopeColoring,
          slopeThreshold1,
          slopeThreshold2
        });
        enqueueSnackbar('Trace mise à jour avec succès', { variant: 'success' });
      } else {
        // Création d'une nouvelle trace
        const trace: SavedTrace = {
          id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: traceName,
          gpxContent: gpxContent,
          timestamp: Date.now(),
          fileName: fileName,
          bounds: gpxData.bounds,
          altitudeThreshold,
          useSlopeColoring,
          slopeThreshold1,
          slopeThreshold2
        };

        await saveTrace(trace);
        setCurrentTraceId(trace.id);
        setCurrentTraceName(traceName);
        enqueueSnackbar('Trace sauvegardée avec succès', { variant: 'success' });
      }
    } catch (error) {
      enqueueSnackbar(`Erreur lors de la sauvegarde : ${error instanceof Error ? error.message : 'Erreur inconnue'}`, { variant: 'error' });
    }
  };

  const handleLoadTrace = (trace: SavedTrace) => {
    try {
      setFileName(trace.fileName);
      setGpxContent(trace.gpxContent);
      setCurrentTraceId(trace.id);
      
      // Restaurer les paramètres avec des valeurs par défaut pour les anciennes traces
      setAltitudeThreshold(trace.altitudeThreshold ?? 1000);
      setUseSlopeColoring(trace.useSlopeColoring ?? false);
      setSlopeThreshold1(trace.slopeThreshold1 ?? 5);
      setSlopeThreshold2(trace.slopeThreshold2 ?? 10);
      
      const data = parseGPX(trace.gpxContent);
      setCurrentTraceName(trace.name);
      setGpxData(data);
      enqueueSnackbar(`Trace "${trace.name}" chargée avec succès`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(`Erreur lors du chargement de la trace : ${error instanceof Error ? error.message : 'Erreur inconnue'}`, { variant: 'error' });
    }
  };

  const segments = useMemo(() => {
    if (!gpxData) return [];
    return segmentTrack(gpxData.points, altitudeThreshold, slopeThreshold1, slopeThreshold2, useSlopeColoring);
  }, [gpxData, altitudeThreshold, slopeThreshold1, slopeThreshold2, useSlopeColoring]);

  const [isMapOpen, setIsMapOpen] = useState<boolean>(true);

  const stats = useMemo(() => {
    return calculateStats(segments, gpxData?.points || [], useSlopeColoring, slopeThreshold1, slopeThreshold2, altitudeThreshold);
  }, [segments, gpxData, useSlopeColoring, slopeThreshold1, slopeThreshold2, altitudeThreshold]);

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

              <div className="flex gap-2">
                <SavePanel 
                  gpxData={gpxData} 
                  fileName={fileName}
                  currentTraceName={currentTraceName}
                  onSave={handleSaveTrace}
                  isEditingExisting={currentTraceId !== null}
                />
                <HistoryMenu onLoadTrace={handleLoadTrace} />
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
            <div className="bg-white rounded-lg shadow-lg mb-6">
              <button
                type="button"
                onClick={() => setIsMapOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-gray-800 hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-lg">Carte (vue détaillée)</span>
                {isMapOpen ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </button>

              <div className={`overflow-hidden transition-all duration-300 ${isMapOpen ? 'max-h-[700px]' : 'max-h-0'}`}>
                <div className="p-4">
                  <MapView segments={segments} bounds={gpxData.bounds} useSlopeColoring={useSlopeColoring} />
                </div>
              </div>
            </div>
          )}

          {gpxData && segments.length > 0 && (
            <StatsPanel
              totalDistance={stats.totalDistance}
              aboveThresholdDistance={stats.aboveThresholdDistance}
              belowThresholdDistance={stats.belowThresholdDistance}
              percentage={stats.percentage}
              altitudeThreshold={altitudeThreshold}
              minAltitude={stats.minAltitude}
              maxAltitude={stats.maxAltitude}
              uphillDistance={stats.uphillDistance}
              downhillDistance={stats.downhillDistance}
              flatDistance={stats.flatDistance}
            />
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
