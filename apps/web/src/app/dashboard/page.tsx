export default function Dashboard() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 border border-gray-800 rounded-lg">
            <h3 className="text-sm text-gray-400 mb-1">Repos Indexed</h3>
            <p className="text-3xl font-bold">—</p>
          </div>
          <div className="p-6 border border-gray-800 rounded-lg">
            <h3 className="text-sm text-gray-400 mb-1">Reviews Completed</h3>
            <p className="text-3xl font-bold">—</p>
          </div>
          <div className="p-6 border border-gray-800 rounded-lg">
            <h3 className="text-sm text-gray-400 mb-1">Issues Found</h3>
            <p className="text-3xl font-bold">—</p>
          </div>
        </div>

        <div className="border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Reviews</h2>
          <p className="text-gray-400">
            Connect your GitHub organization to start seeing review history here.
          </p>
        </div>
      </div>
    </main>
  );
}
