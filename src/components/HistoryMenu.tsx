import { useEffect, useState } from 'react';
import { History, Trash2, X, Download } from 'lucide-react';
import { getTraces, deleteTrace, SavedTrace } from '../utils/indexedDBManager';

interface HistoryMenuProps {
  onLoadTrace: (trace: SavedTrace) => void;
}

function downloadTrace(trace: SavedTrace) {
  const blob = new Blob([trace.gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${trace.name.replace(/[\\/:*?"<>|]/g, '_')}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function HistoryMenu({ onLoadTrace }: HistoryMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [traces, setTraces] = useState<SavedTrace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTraces = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const savedTraces = await getTraces();
      setTraces(savedTraces);
    } catch (err) {
      setError(`Erreur lors du chargement: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les traces dès le montage pour afficher le compteur
  useEffect(() => {
    loadTraces();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadTraces();
    }
  }, [isOpen]);

  const handleLoadTrace = (trace: SavedTrace) => {
    onLoadTrace(trace);
    setIsOpen(false);
  };

  const handleDeleteTrace = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette trace ?')) {
      try {
        await deleteTrace(id);
        setTraces(traces.filter(t => t.id !== id));
      } catch (err) {
        setError(`Erreur lors de la suppression: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
      >
        <History className="w-5 h-5" />
        Historique
        {traces.length > 0 && (
          <span className="ml-2 bg-white text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
            {traces.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 flex flex-col z-[10000] relative">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
              <h2 className="text-xl font-bold">Historique des traces</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-blue-700 p-1 rounded"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="text-center text-gray-500 py-8">
                  Chargement...
                </div>
              ) : error ? (
                <div className="text-center text-red-600 py-8">
                  {error}
                </div>
              ) : traces.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune trace sauvegardée</p>
                  <p className="text-sm mt-2">Chargez un fichier GPX et cliquez sur "Sauvegarder"</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {traces.map((trace) => (
                    <li key={trace.id} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors group flex items-start justify-between gap-2">
                      <button
                        onClick={() => handleLoadTrace(trace)}
                        className="flex-1 text-left"
                      >
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                          {trace.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {trace.fileName}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(trace.timestamp)}
                        </p>
                      </button>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => downloadTrace(trace)}
                          className="p-2 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                          title="Télécharger le fichier GPX"
                          aria-label={`Télécharger ${trace.name}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTrace(trace.id)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Supprimer"
                          aria-label={`Supprimer ${trace.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
