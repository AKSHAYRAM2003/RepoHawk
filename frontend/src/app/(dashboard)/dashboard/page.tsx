export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Repository Dashboard</h1>
      <p className="text-slate-400 mb-8">Paste a GitHub URL below to generate its architecture.</p>
      
      {/* Input Placeholder */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg max-w-2xl shadow-xl">
        <form className="flex gap-4">
          <input 
            type="url" 
            placeholder="https://github.com/owner/repo" 
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-4 py-2 outline-none focus:border-blue-500 transition-colors"
          />
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded transition-colors">
            Analyze
          </button>
        </form>
      </div>
    </div>
  );
}
