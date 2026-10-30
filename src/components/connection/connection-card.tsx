'use client';

import React from 'react';
import { ConnectionInfo } from '@/types/connection';
import { Server, HardDrive } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export function ConnectionCard({ connection }: { connection: ConnectionInfo }) {
  return (
    <div className="bg-[#111115] border-b border-white/[0.06] px-3 py-2 flex items-center justify-between text-xs select-none">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6.5 h-6.5 rounded bg-zinc-900 border border-white/[0.08] flex items-center justify-center shrink-0">
          <Server className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-100 truncate max-w-[200px]">
              {connection.label || 'MongoDB Cluster'}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-zinc-900 text-zinc-400 border border-white/[0.06]">
              {connection.serverVersion ? `v${connection.serverVersion}` : 'Connected'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[280px]">
            {connection.sanitizedUri || 'mongodb://••••••••'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 text-zinc-400 text-[11px] font-mono">
        {connection.pingMs !== undefined && (
          <div className="flex items-center gap-1.5" title="Round-trip latency">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="tabular-nums">{connection.pingMs}ms</span>
          </div>
        )}
        {connection.totalSize !== undefined && (
          <div className="flex items-center gap-1 text-zinc-500" title="Total database storage">
            <HardDrive className="w-3 h-3 text-zinc-500" />
            <span className="tabular-nums">{formatBytes(connection.totalSize)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
