import React from "react";
import { FileCode2 } from "lucide-react";

export default function SourceFilesPage({ params }: { params: { id: string } }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
      <FileCode2 className="w-12 h-12 text-slate-400 mb-4 opacity-50" />
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Source Files explorer</h2>
      <p className="text-slate-500 text-sm max-w-md">The file tree and raw source code for &apos;{params.id}&apos; will be available here.</p>
    </div>
  );
}
