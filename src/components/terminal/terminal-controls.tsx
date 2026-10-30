'use client';

import React from 'react';
import { Trash2, Download, Search, ChevronDown, ChevronUp, TerminalSquare } from 'lucide-react';
import { useTerminalStore } from '@/stores/terminal-store';
import { LogFilter } from '@/types/terminal';
import { toast } from 'sonner';

const FILTERS: LogFilter[] = ['ALL', 'INFO', 'SUCCESS', 'WARN', 'ERROR'];

export function TerminalControls() {
  const {
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    clearLogs,
    autoScroll,
    setAutoScroll,
    logs,
    isExpanded,
    toggleExpanded,
    heightPercent,
    setHeightPercent,
  } = useTerminalStore();

  const handleExportLogs = () => {
    if (logs.length === 0) {
      toast.error('No logs available to export');
      return;
    }
    try {
      const content = logs
        .map(
          (l) =>
            `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${
              l.details ? ' ' + JSON.stringify(l.details) : ''
            }`
        )
        .join('\n');

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mongo-migration-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success('Console logs exported');
    } catch (err: any) {
      toast.error(`Failed to export logs: ${err.message}`);
    }
  };

  return (
    <div className="h-8 bg-[#0c0c0e] border-b border-white/[0.07] px-3 flex items-center justify-between text-xs select-none">
      {/* Left: Section Title, Filter Pills, and Height Presets */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 font-mono font-medium text-zinc-400 text-[11px] tracking-tight">
          <TerminalSquare className="w-3.5 h-3.5 text-zinc-400" />
          <span>Console</span>
          {logs.length > 0 && (
            <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
              ({logs.length})
            </span>
          )}
        </div>

        {/* Level Filters */}
        <div className="flex items-center bg-zinc-900/90 p-0.5 rounded border border-white/[0.07]">
          {FILTERS.map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100 font-medium shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* Height Presets (when expanded) */}
        {isExpanded && (
          <div className="hidden sm:flex items-center bg-zinc-900/90 p-0.5 rounded border border-white/[0.07] text-[10px] font-mono">
            <button
              onClick={() => setHeightPercent(30)}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                heightPercent <= 35
                  ? 'bg-zinc-800 text-emerald-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Compact height (30%)"
            >
              30%
            </button>
            <button
              onClick={() => setHeightPercent(50)}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                heightPercent > 35 && heightPercent <= 65
                  ? 'bg-zinc-800 text-emerald-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Half screen (50%)"
            >
              50%
            </button>
            <button
              onClick={() => setHeightPercent(80)}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                heightPercent > 65
                  ? 'bg-zinc-800 text-emerald-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Expanded height (80%)"
            >
              80%
            </button>
          </div>
        )}
      </div>

      {/* Right: Search, AutoScroll, Clear, Export, Collapse */}
      <div className="flex items-center gap-1.5">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="w-3 h-3 absolute left-2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-28 sm:w-36 focus:w-48 transition-all h-5.5 pl-6 pr-2 rounded bg-zinc-900 border border-white/[0.07] text-[11px] text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        {/* Auto Scroll Toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`flex items-center gap-1.5 h-5.5 px-2 rounded text-[11px] border cursor-pointer transition-colors ${
            autoScroll
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-zinc-900 text-zinc-400 border-white/[0.06] hover:text-zinc-300'
          }`}
          title="Auto-scroll to latest log entries"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${autoScroll ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="hidden sm:inline">Auto-scroll</span>
        </button>

        {/* Clear */}
        <button
          onClick={clearLogs}
          disabled={logs.length === 0}
          className="flex items-center gap-1 h-5.5 px-2 rounded text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.07] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
          title="Clear console output"
        >
          <Trash2 className="w-3 h-3" />
          <span className="hidden sm:inline">Clear</span>
        </button>

        {/* Export Logs */}
        <button
          onClick={handleExportLogs}
          disabled={logs.length === 0}
          className="flex items-center gap-1 h-5.5 px-2 rounded text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.07] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
          title="Download log file"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Toggle Collapse */}
        <button
          onClick={toggleExpanded}
          className="h-5.5 w-5.5 flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.07] cursor-pointer transition-colors"
          title={isExpanded ? 'Collapse console' : 'Expand console'}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
