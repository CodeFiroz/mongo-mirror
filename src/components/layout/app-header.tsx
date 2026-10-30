'use client';

import React from 'react';
import { Database, Terminal, ArrowRight, Wrench } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useTerminalStore } from '@/stores/terminal-store';

export function AppHeader() {
  const { sourceConnection, targetConnection, openModal } = useWorkspaceStore();
  const { isExpanded, toggleExpanded, logs } = useTerminalStore();

  const sourceConnected = sourceConnection?.status === 'connected';
  const targetConnected = targetConnection?.status === 'connected';

  const errorCount = logs.filter((l) => l.level === 'error').length;

  return (
    <header className="h-10.5 w-full bg-[#111115] border-b border-white/[0.08] px-3.5 flex items-center justify-between select-none z-20">
      {/* Brand & App Identifier */}
      <div className="flex items-center gap-2.5">
        <div className="w-6.5 h-6.5 rounded-md bg-zinc-900 border border-white/10 flex items-center justify-center shadow-xs">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs tracking-tight text-zinc-100">
            MongoMirror
          </span>
          <span className="text-[10px] font-mono text-zinc-500 font-medium px-1.5 py-0.5 rounded bg-zinc-900 border border-white/[0.06]">
            v1.0
          </span>
        </div>
      </div>

      {/* Center Dual Connection Bridge */}
      <div className="flex items-center gap-1.5 bg-zinc-900/90 px-2.5 py-1 rounded-full border border-white/[0.08] shadow-xs">
        {/* Source Pill */}
        <button
          onClick={() => openModal('connect-source', { slot: 'source' })}
          className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer group"
          title={sourceConnected ? sourceConnection?.sanitizedUri || 'Connected' : 'Click to connect Source'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              sourceConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'
            }`}
          />
          <span className="text-[11px] text-zinc-500 font-medium group-hover:text-zinc-400">Source:</span>
          <span className="text-[11px] font-mono max-w-[130px] truncate text-zinc-200">
            {sourceConnected ? sourceConnection?.label || 'Connected' : 'Disconnected'}
          </span>
        </button>

        <div className="text-zinc-600 px-1">
          <ArrowRight className="w-3 h-3 text-zinc-500" />
        </div>

        {/* Target Pill */}
        <button
          onClick={() => openModal('connect-target', { slot: 'target' })}
          className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer group"
          title={targetConnected ? targetConnection?.sanitizedUri || 'Connected' : 'Click to connect Target'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              targetConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'
            }`}
          />
          <span className="text-[11px] text-zinc-500 font-medium group-hover:text-zinc-400">Target:</span>
          <span className="text-[11px] font-mono max-w-[130px] truncate text-zinc-200">
            {targetConnected ? targetConnection?.label || 'Connected' : 'Disconnected'}
          </span>
        </button>
      </div>

      {/* Right Tool Status & Operation Console Trigger */}
      <div className="flex items-center gap-2">
        {/* Database Tools Status */}
        <div
          className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.06] text-zinc-400"
          title="MongoDB Tools (mongodump/mongorestore) Detected"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono text-[10px] text-zinc-400">Tools: Ready</span>
        </div>

        {/* Console Toggle Button */}
        <button
          onClick={toggleExpanded}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors cursor-pointer border ${
            isExpanded
              ? 'bg-zinc-800 text-zinc-100 border-white/20'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border-white/[0.08]'
          }`}
          title="Toggle Operation Console (Ctrl + `)"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">Console</span>
          {logs.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                errorCount > 0
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {logs.length}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
