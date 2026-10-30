'use client';

import React from 'react';
import { Database, Plus, Terminal } from 'lucide-react';
import { ConnectionSlot } from '@/types/connection';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function ExplorerEmptyState({ slot }: { slot: ConnectionSlot }) {
  const { openModal } = useWorkspaceStore();
  const isSource = slot === 'source';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center select-none bg-[#09090b]">
      <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center mb-3 shadow-xs">
        <Database className="w-5 h-5 text-zinc-400" />
      </div>

      <h3 className="text-sm font-medium text-zinc-200 mb-1">
        {isSource ? 'No Source Instance' : 'No Target Instance'}
      </h3>
      <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed mb-4">
        Connect to a local or remote MongoDB instance to explore databases, export collections, or initiate transfers.
      </p>

      <button
        onClick={() => openModal(isSource ? 'connect-source' : 'connect-target', { slot })}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Connect {isSource ? 'Source' : 'Target'}</span>
      </button>

      <div className="mt-6 pt-4 border-t border-white/[0.06] w-full max-w-[260px] text-left">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1.5">
          <Terminal className="w-3 h-3 text-zinc-400" />
          <span>Supported URIs</span>
        </div>
        <div className="space-y-1 font-mono text-[10px] text-zinc-400">
          <div className="truncate text-zinc-300">mongodb://localhost:27017</div>
          <div className="truncate text-zinc-300">mongodb+srv://user:pass@cluster...</div>
        </div>
      </div>
    </div>
  );
}
