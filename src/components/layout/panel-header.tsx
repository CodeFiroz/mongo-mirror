'use client';

import React from 'react';
import { ConnectionSlot } from '@/types/connection';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { toast } from 'sonner';
import { RefreshCw, Unplug, HardDrive, Download, Upload, ArchiveRestore } from 'lucide-react';

interface PanelHeaderProps {
  slot: ConnectionSlot;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function PanelHeader({ slot, onRefresh, isRefreshing }: PanelHeaderProps) {
  const { sourceConnection, targetConnection, openModal, setConnection } = useWorkspaceStore();
  const { addLog } = useTerminalStore();
  const conn = slot === 'source' ? sourceConnection : targetConnection;
  const isConnected = conn?.status === 'connected';

  const handleDisconnect = async () => {
    if (!conn) return;
    try {
      await fetch(`/api/connections/${conn.id}`, { method: 'DELETE' });
      addLog({
        level: 'info',
        message: `Disconnected ${slot.toUpperCase()} MongoDB (${conn.label || conn.id})`,
      });
      toast.success(`Disconnected ${slot.toUpperCase()} MongoDB`);
    } catch {
      // Ignore network errors on local disconnect
    } finally {
      setConnection(slot, null);
    }
  };

  return (
    <div className="h-9 bg-[#131317] border-b border-white/[0.08] px-3 flex items-center justify-between select-none">
      {/* Title & Slot Tag */}
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded uppercase ${
            slot === 'source'
              ? 'bg-zinc-800/90 text-zinc-300 border border-white/10'
              : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {slot}
        </span>
        <span className="text-xs font-medium text-zinc-200">
          {slot === 'source' ? 'Source Instance' : 'Target Instance'}
        </span>
      </div>

      {/* Connection Actions */}
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-6 w-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer transition-colors"
              title="Refresh databases"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={() => openModal('backup', { slot })}
              className="h-6 px-2 flex items-center gap-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 hover:text-white border border-white/[0.08] cursor-pointer transition-colors"
              title="Backup database with mongodump"
            >
              <HardDrive className="w-3 h-3 text-zinc-400" />
              <span>Backup</span>
            </button>

            <button
              onClick={() => openModal('restore', { slot })}
              className="h-6 px-2 flex items-center gap-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 hover:text-white border border-white/[0.08] cursor-pointer transition-colors"
              title="Import external mongodump backup archive"
            >
              <ArchiveRestore className="w-3 h-3 text-emerald-400" />
              <span>Restore</span>
            </button>

            <button
              onClick={() => openModal(slot === 'source' ? 'export' : 'import', { slot })}
              className="h-6 px-2 flex items-center gap-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 hover:text-white border border-white/[0.08] cursor-pointer transition-colors"
              title={slot === 'source' ? 'Export data' : 'Import data'}
            >
              {slot === 'source' ? (
                <>
                  <Download className="w-3 h-3 text-zinc-400" />
                  <span>Export</span>
                </>
              ) : (
                <>
                  <Upload className="w-3 h-3 text-emerald-400" />
                  <span>Import</span>
                </>
              )}
            </button>

            <button
              onClick={handleDisconnect}
              className="h-6 w-6 flex items-center justify-center rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer transition-colors ml-0.5"
              title="Disconnect"
            >
              <Unplug className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button
            onClick={() => openModal(slot === 'source' ? 'connect-source' : 'connect-target', { slot })}
            className="h-6 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
