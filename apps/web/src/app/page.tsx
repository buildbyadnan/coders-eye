export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">
          CodersEye
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Cross-repository AI code review for GitHub PRs
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-gray-800 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">CLI Tool</h2>
            <p className="text-gray-400 mb-4">
              Install and use CodersEye from your terminal
            </p>
            <code className="block bg-gray-900 p-3 rounded text-sm">
              npm install -g coders-eye
            </code>
          </div>

          <div className="p-6 border border-gray-800 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Cloud Dashboard</h2>
            <p className="text-gray-400 mb-4">
              Connect your GitHub org and let CodersEye handle reviews
            </p>
            <button className="bg-white text-black px-4 py-2 rounded font-medium hover:bg-gray-200 transition-colors">
              Coming Soon
            </button>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
          <ol className="space-y-4 text-gray-400">
            <li className="flex gap-4">
              <span className="text-white font-mono">1.</span>
              <div>
                <strong className="text-white">Index</strong> — Clone your org&apos;s repos and extract symbols into a local SQLite database
              </div>
            </li>
            <li className="flex gap-4">
              <span className="text-white font-mono">2.</span>
              <div>
                <strong className="text-white">Analyze</strong> — Fetch PR diff and search for related code across all indexed repos
              </div>
            </li>
            <li className="flex gap-4">
              <span className="text-white font-mono">3.</span>
              <div>
                <strong className="text-white">Context</strong> — Build a rich context window with cross-repo references for Claude Code
              </div>
            </li>
            <li className="flex gap-4">
              <span className="text-white font-mono">4.</span>
              <div>
                <strong className="text-white">Review</strong> — Claude Code analyzes the PR with full awareness of your org&apos;s codebase
              </div>
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
