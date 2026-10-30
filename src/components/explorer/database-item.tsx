'use client';

import React, { useState, useRef } from 'react';
import { DatabaseNode, CollectionNode } from '@/types/explorer';
import { ConnectionSlot } from '@/types/connection';
import { CollectionItem } from './collection-item';
import { useWorkspaceStore } from '@/stores/workspace-store';
import {
  ChevronRight,
  ChevronDown,
  Database,
  HardDrive,
  MoreVertical,
  Copy,
  RefreshCw,
  Check,
  Loader2,
  GripVertical,
  ArrowRightLeft,
  ArchiveRestore,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface DatabaseItemProps {
  slot: ConnectionSlot;
  database: DatabaseNode;
  onRefreshDatabase?: (dbName: string) => void;
}

export function DatabaseItem({ slot, database, onRefreshDatabase }: DatabaseItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragOverDb, setIsDragOverDb] = useState(false);
  const dbDragCounter = useRef(0);

  const { openModal, sourceConnection, targetConnection } = useWorkspaceStore();
  const conn = slot === 'source' ? sourceConnection : targetConnection;
  const oppositeSlot = slot === 'source' ? 'target' : 'source';
  const oppositeConn = oppositeSlot === 'source' ? sourceConnection : targetConnection;
  const oppositeConnected = oppositeConn?.status === 'connected';

  // On-demand fetch collections with stats when expanded
  const {
    data: fetchedCollections,
    isLoading: isFetchingCollections,
    refetch,
  } = useQuery<CollectionNode[]>({
    queryKey: ['collections', conn?.id, database.name],
    queryFn: async () => {
      if (!conn?.id) return [];
      const res = await fetch(`/api/connections/${conn.id}/databases/${encodeURIComponent(database.name)}/collections`);
      if (!res.ok) throw new Error('Failed to load collections');
      const data = await res.json();
      return data.collections || [];
    },
    enabled: isExpanded && !!conn?.id,
    staleTime: 1000 * 30,
  });

  const collections = fetchedCollections || database.collections || [];

  const handleCopyName = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(database.name);
    setCopied(true);
    toast.success(`Copied database name "${database.name}"`);
    setTimeout(() => setCopied(false), 1500);
    setMenuOpen(false);
  };

  const handleBackup = (e: React.MouseEvent) => {
    e.stopPropagation();
    openModal('backup', { slot, database: database.name });
    setMenuOpen(false);
  };

  const handleMigrateDatabase = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!oppositeConnected) {
      toast.error(`Please connect the ${oppositeSlot.toUpperCase()} MongoDB instance first`);
      return;
    }
    openModal('migrate', {
      slot,
      type: 'database',
      database: database.name,
      targetSlot: oppositeSlot,
      targetDatabase: database.name,
      collectionsCount: collections.length,
    });
    setMenuOpen(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    const payload = {
      type: 'database',
      slot,
      database: database.name,
      collectionsCount: collections.length,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDbDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dbDragCounter.current += 1;
    setIsDragOverDb(true);
  };

  const handleDbDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dbDragCounter.current -= 1;
    if (dbDragCounter.current <= 0) {
      dbDragCounter.current = 0;
      setIsDragOverDb(false);
    }
  };

  const handleDbDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDbDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dbDragCounter.current = 0;
    setIsDragOverDb(false);

    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.database) return;

      openModal('migrate', {
        slot: data.slot,
        type: data.type || 'collection',
        database: data.database,
        collection: data.collection,
        targetSlot: slot,
        targetDatabase: database.name, // Specifically targeted to this DB
        targetCollection: data.collection,
        documentCount: data.documentCount,
        collectionsCount: data.collectionsCount,
      });
    } catch (err) {
      console.error('Failed to parse dropped item', err);
    }
  };

  return (
    <div className="flex flex-col select-none">
      {/* Database Row Header */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnter={handleDbDragEnter}
        onDragLeave={handleDbDragLeave}
        onDragOver={handleDbDragOver}
        onDrop={handleDbDrop}
        onClick={() => setIsExpanded(!isExpanded)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        className={`group relative flex items-center justify-between py-1 px-2 rounded-md text-xs transition-colors cursor-grab active:cursor-grabbing ${
          isDragOverDb
            ? 'bg-emerald-500/10 border border-emerald-500/60 text-emerald-200'
            : 'hover:bg-white/[0.04] text-zinc-200'
        }`}
        title="Click to expand, drag to migrate entire database, or drop collections here"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-200 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-zinc-300" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            )}
          </button>

          <Database className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 transition-colors shrink-0" />
          <span className="font-mono text-[12px] font-medium text-zinc-200 truncate">{database.name}</span>

          {isDragOverDb && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
              Drop to copy into "{database.name}"
            </span>
          )}
        </div>

        {/* Database Stats and Context Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {database.sizeOnDisk !== undefined && database.sizeOnDisk > 0 && (
            <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
              {formatBytes(database.sizeOnDisk)}
            </span>
          )}

          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06] tabular-nums">
            {collections.length} colls
          </span>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Database options"
            >
              <MoreVertical className="w-3 h-3" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 w-52 rounded-lg bg-[#141419] border border-white/[0.1] shadow-2xl py-1 z-40 text-xs font-sans">
                  <button
                    onClick={handleMigrateDatabase}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 hover:text-emerald-300 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Migrate Database to {oppositeSlot.toUpperCase()}</span>
                  </button>
                  <button
                    onClick={handleBackup}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Backup Database</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal('restore', { slot, database: database.name });
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 hover:text-emerald-300 cursor-pointer"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Restore Backup into DB</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      refetch();
                      if (onRefreshDatabase) onRefreshDatabase(database.name);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Refresh Collections</span>
                  </button>
                  <div className="my-1 border-t border-white/[0.06]" />
                  <button
                    onClick={handleCopyName}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
                    <span>Copy Name</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Collections List with Tree Guide Line */}
      {isExpanded && (
        <div className="border-l border-white/[0.08] ml-4 pl-1.5 my-0.5 space-y-0.5">
          {isFetchingCollections && collections.length === 0 ? (
            <div className="py-2 pl-6 flex items-center gap-2 text-[11px] text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
              <span>Fetching collections...</span>
            </div>
          ) : collections.length > 0 ? (
            collections.map((col) => (
              <CollectionItem
                key={col.name}
                slot={slot}
                databaseName={database.name}
                collection={col}
              />
            ))
          ) : (
            <div className="py-1.5 pl-6 text-[11px] text-zinc-600 italic font-mono">
              (no collections)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
