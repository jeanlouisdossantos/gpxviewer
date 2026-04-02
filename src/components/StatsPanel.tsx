interface StatsPanelProps {
  totalDistance: number;
  aboveThresholdDistance: number;
  percentage: number;
  altitudeThreshold: number;
}

export function StatsPanel({
  totalDistance,
  aboveThresholdDistance,
  percentage,
  altitudeThreshold
}: StatsPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Statistiques du parcours</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Distance totale</p>
          <p className="text-3xl font-bold text-gray-900">{totalDistance.toFixed(2)} km</p>
        </div>

        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Au-dessus de {altitudeThreshold}m</p>
          <p className="text-3xl font-bold text-red-600">{aboveThresholdDistance.toFixed(2)} km</p>
          <p className="text-sm text-red-500 mt-1">{percentage.toFixed(1)}% du parcours</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">En dessous de {altitudeThreshold}m</p>
          <p className="text-3xl font-bold text-green-600">
            {(totalDistance - aboveThresholdDistance).toFixed(2)} km
          </p>
          <p className="text-sm text-green-500 mt-1">{(100 - percentage).toFixed(1)}% du parcours</p>
        </div>
      </div>
    </div>
  );
}
