'use client';

import React, { useState, useRef } from 'react';
import { ConnectionSlot } from '@/types/connection';
import { DatabaseNode } from '@/types/explorer';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { PanelHeader } from '@/components/layout/panel-header';
import { ConnectionCard } from './connection-card';
import { ExplorerEmptyState } from '@/components/explorer/explorer-empty-state';
import { DatabaseTree } from '@/components/explorer/database-tree';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectionPanelProps {
  slot: ConnectionSlot;
}

export function ConnectionPanel({ slot }: ConnectionPanelProps) {
  const { sourceConnection, targetConnection, openModal } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const conn = slot === 'source' ? sourceConnection : targetConnection;
  const isConnected = conn?.status === 'connected';

  const [isDragOverPanel, setIsDragOverPanel] = useState(false);
  const dragCounter = useRef(0);

  // Fetch databases when connected
  const {
    data: databases = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<DatabaseNode[]>({
    queryKey: ['databases', slot, conn?.id],
    queryFn: async () => {
      if (!conn?.id) return [];
      const res = await fetch(`/api/connections/${conn.id}/databases`);
      if (!res.ok) throw new Error('Failed to fetch databases');
      const data = await res.json();
      return data.databases || [];
    },
    enabled: isConnected && !!conn?.id,
  });

  const handleRefreshDatabase = (dbName: string) => {
    queryClient.invalidateQueries({ queryKey: ['collections', conn?.id, dbName] });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('text/plain')) {
      setIsDragOverPanel(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOverPanel(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOverPanel(false);

    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.database) return;

      if (!isConnected || !conn) {
        toast.error(`Please connect the ${slot.toUpperCase()} workspace first to migrate into it`);
        return;
      }

      openModal('migrate', {
        slot: data.slot,
        type: data.type || 'collection',
        database: data.database,
        collection: data.collection,
        targetSlot: slot,
        targetDatabase: data.database,
        targetCollection: data.collection,
        documentCount: data.documentCount,
        collectionsCount: data.collectionsCount,
      });
    } catch (err) {
      console.error('Drop handling error:', err);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative h-full w-full flex flex-col bg-[#09090b] overflow-hidden select-none"
    >
      {/* Panel Top Header */}
      <PanelHeader
        slot={slot}
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
      />

      {/* Main Content: Explorer or Empty State */}
      {isConnected && conn ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#09090b]">
          <ConnectionCard connection={conn} />
          <DatabaseTree
            slot={slot}
            databases={databases}
            isLoading={isLoading}
            onRefresh={() => refetch()}
            onRefreshDatabase={handleRefreshDatabase}
          />
        </div>
      ) : (
        <ExplorerEmptyState slot={slot} />
      )}

      {/* Drag & Drop Overlay */}
      {isDragOverPanel && (
        <div className="absolute inset-2 z-40 bg-[#09090b]/92 backdrop-blur-sm border-2 border-dashed border-emerald-500/50 rounded-lg flex flex-col items-center justify-center p-6 text-center pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-sm">
            <ArrowDownToLine className="w-5 h-5 text-emerald-400 animate-bounce" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-1">
            Drop to copy into {slot} workspace
          </h3>
          <p className="text-xs text-zinc-400 max-w-xs mb-3">
            Directly clone collection or database with conflict handling and index preservation
          </p>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-white/[0.08] text-[11px] font-mono text-zinc-300">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Opens migration configuration</span>
          </div>
        </div>
      )}
    </div>
  );
}
