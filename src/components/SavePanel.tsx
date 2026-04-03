import { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { GPXData } from '../utils/gpxParser';
import { checkStorageQuota } from '../utils/indexedDBManager';

interface SavePanelProps {
  gpxData: GPXData | null;
  fileName: string;
  onSave: (traceName: string) => Promise<void>;
}

export function SavePanel({ gpxData, fileName, onSave }: SavePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [traceName, setTraceName] = useState(fileName.replace(/\.gpx$/i, '') || 'Nouvelle trace');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const handleSave = async () => {
    if (!gpxData || !fileName) {
      setError('Veuillez d\'abord charger un fichier GPX');
      return;
    }

    setIsSaving(true);
    setError(null);
    setStorageWarning(null);

    try {
      // Check storage quota
      const quota = await checkStorageQuota();
      if (quota.percentage > 90) {
        setStorageWarning('⚠️ Espace disponible faible! Veuillez nettoyer votre historique.');
      }

      await onSave(traceName);
      setTraceName(fileName.replace(/\.gpx$/i, '') || 'Nouvelle trace');
      setIsOpen(false);
    } catch (err) {
      setError(`Erreur lors de la sauvegarde: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!gpxData) {
    return null;
  }

  return (
    <div className="relative">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium"
        >
          <Save className="w-5 h-5" />
          Sauvegarder
        </button>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">Sauvegarder la trace</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la trace
                </label>
                <input
                  type="text"
                  value={traceName}
                  onChange={(e) => setTraceName(e.target.value)}
                  placeholder="Ex: Randonnée du 3 avril"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={isSaving}
                />
              </div>

              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <p>
                  <strong>Fichier:</strong> {fileName}
                </p>
                <p>
                  <strong>Points:</strong> {gpxData.points.length}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {storageWarning && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">{storageWarning}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setError(null);
                    setStorageWarning(null);
                  }}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
