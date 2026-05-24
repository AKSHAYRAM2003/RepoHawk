import React from "react";
import { PackageCheck } from "lucide-react";

export default function DependenciesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
      <PackageCheck className="w-12 h-12 text-slate-400 mb-4 opacity-50" />
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Dependencies</h2>
      <p className="text-slate-500 text-sm max-w-md">A breakdown of package.json or requirements.txt for &apos;{id}&apos; will be parsed here.</p>
    </div>
  );
}
