'use client';

import React, { useState } from 'react';
import { OperationLog, LogLevel } from '@/types/terminal';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const LEVEL_CONFIG: Record<LogLevel, { text: string; bg: string; dot: string; label: string }> = {
  debug: { text: 'text-zinc-400', bg: 'bg-zinc-800/60 border-white/[0.06]', dot: 'bg-zinc-500', label: 'DBG' },
  info: { text: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', dot: 'bg-sky-400', label: 'INF' },
  success: { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', label: 'OK ' },
  warn: { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', label: 'WRN' },
  error: { text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', dot: 'bg-rose-400', label: 'ERR' },
};

export function TerminalLogRow({ log }: { log: OperationLog }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${
      hasDetails ? '\n' + JSON.stringify(log.details, null, 2) : ''
    }`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Log line copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group text-[12px] font-mono leading-relaxed py-1 px-2 hover:bg-white/[0.03] rounded transition-colors flex flex-col">
      <div className="flex items-start gap-2.5">
        {/* Timestamp */}
        <span
          suppressHydrationWarning
          className="text-zinc-400 shrink-0 select-none text-[11px] tabular-nums pt-0.5"
        >
          {log.timestamp}
        </span>

        {/* Level Tag */}
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] uppercase font-mono font-medium border ${cfg.bg} ${cfg.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span>{cfg.label}</span>
        </span>

        {/* Message */}
        <span className="text-zinc-300 group-hover:text-zinc-100 flex-1 break-words font-mono">
          {log.message}
        </span>

        {/* Action icons on hover */}
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title="Copy log entry"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          {/* Details Toggle Button if present */}
          {hasDetails && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-zinc-400 hover:text-zinc-200 text-[10px] font-mono flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>details</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded JSON details */}
      {hasDetails && showDetails && (
        <div className="mt-1.5 ml-14 p-2.5 rounded bg-zinc-950 border border-white/[0.06] text-[11px] text-zinc-400 overflow-x-auto relative">
          <pre className="font-mono text-zinc-300 select-text leading-tight">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
