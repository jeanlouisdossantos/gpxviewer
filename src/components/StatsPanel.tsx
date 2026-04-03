interface StatsPanelProps {
  totalDistance: number;
  aboveThresholdDistance: number;
  percentage: number;
  belowThresholdDistance: number;
  altitudeThreshold: number;
  minAltitude: number;
  maxAltitude: number;
  uphillDistance: number;
  downhillDistance: number;
  flatDistance: number;
}

export function StatsPanel({
  totalDistance,
  aboveThresholdDistance,
  belowThresholdDistance,
  percentage,
  altitudeThreshold,
  minAltitude,
  maxAltitude,
  uphillDistance,
  downhillDistance,
  flatDistance
}: StatsPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Statistiques du parcours</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Distance totale</p>
          <p className="text-3xl font-bold text-gray-900">{totalDistance.toFixed(2)} km</p>
          <p className="text-sm text-gray-500 mt-1">Altitude min/max : {minAltitude.toFixed(0)}m / {maxAltitude.toFixed(0)}m</p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Montée totale</p>
          <p className="text-3xl font-bold text-blue-700">{uphillDistance.toFixed(2)} km</p>
        </div>

        <div className="bg-indigo-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Descente totale</p>
          <p className="text-3xl font-bold text-indigo-700">{downhillDistance.toFixed(2)} km</p>
        </div>

        <div className="bg-teal-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Relativement plat</p>
          <p className="text-3xl font-bold text-teal-700">{flatDistance.toFixed(2)} km</p>
        </div>

        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Au-dessus de {altitudeThreshold}m</p>
          <p className="text-2xl font-bold text-red-600">{aboveThresholdDistance.toFixed(2)} km</p>
          <p className="text-xs text-red-500 mt-1">{percentage.toFixed(1)}% du parcours</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">En dessous de {altitudeThreshold}m</p>
          <p className="text-2xl font-bold text-green-600">{belowThresholdDistance.toFixed(2)} km</p>
          <p className="text-xs text-green-500 mt-1">{(100 - percentage).toFixed(1)}% du parcours</p>
        </div>
      </div>
    </div>
  );
}
