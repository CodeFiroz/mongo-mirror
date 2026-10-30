'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  X,
  ArrowRight,
  Database,
  Table,
  ShieldAlert,
  Zap,
  Layers,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import { CollectionNode } from '@/types/explorer';
import { formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

export function MigrateDialog() {
  const { activeModal, modalContext, closeModal, sourceConnection, targetConnection } = useWorkspaceStore();
  const { addLog } = useTerminalStore();
  const queryClient = useQueryClient();

  const isOpen = activeModal === 'migrate';

  // Determine source and target slots
  const sourceSlot = modalContext?.slot || 'source';
  const targetSlot = modalContext?.targetSlot || (sourceSlot === 'source' ? 'target' : 'source');

  const sourceConn = sourceSlot === 'source' ? sourceConnection : targetConnection;
  const targetConn = targetSlot === 'target' ? targetConnection : sourceConnection;

  const [migrationMode, setMigrationMode] = useState<'collection' | 'database'>('collection');
  const [sourceDb, setSourceDb] = useState('');
  const [sourceColl, setSourceColl] = useState('');
  const [targetDb, setTargetDb] = useState('');
  const [targetColl, setTargetColl] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [conflictPolicy, setConflictPolicy] = useState<'skip' | 'upsert' | 'fail'>('skip');
  const [dropFirst, setDropFirst] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (modalContext) {
      const isDb = modalContext.type === 'database' || !modalContext.collection;
      setMigrationMode(isDb ? 'database' : 'collection');
      const srcDb = modalContext.database || '';
      const srcColl = modalContext.collection || '';
      setSourceDb(srcDb);
      setSourceColl(srcColl);
      setTargetDb(modalContext.targetDatabase || srcDb);
      setTargetColl(modalContext.targetCollection || srcColl);
    }
  }, [modalContext]);

  // Fetch available collections when in database mode
  const { data: dbCollections = [] } = useQuery<CollectionNode[]>({
    queryKey: ['collections', sourceConn?.id, sourceDb],
    queryFn: async () => {
      if (!sourceConn?.id || !sourceDb) return [];
      const res = await fetch(
        `/api/connections/${sourceConn.id}/databases/${encodeURIComponent(sourceDb)}/collections`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.collections || [];
    },
    enabled: isOpen && !!sourceConn?.id && !!sourceDb,
  });

  // Default select all collections when dbCollections loads
  useEffect(() => {
    if (dbCollections.length > 0) {
      setSelectedCollections(dbCollections.map((c) => c.name));
    }
  }, [dbCollections]);

  if (!isOpen) return null;

  const toggleCollection = (colName: string) => {
    setSelectedCollections((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    );
  };

  const selectAllCollections = () => {
    setSelectedCollections(dbCollections.map((c) => c.name));
  };

  const deselectAllCollections = () => {
    setSelectedCollections([]);
  };

  const handleMigrate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceConn?.id || !targetConn?.id) {
      toast.error('Both Source and Target instances must be connected to copy data');
      return;
    }

    if (!sourceDb.trim() || !targetDb.trim()) {
      toast.error('Please specify both source and target database names');
      return;
    }

    if (migrationMode === 'collection' && (!sourceColl.trim() || !targetColl.trim())) {
      toast.error('Please specify both source and target collection names');
      return;
    }

    if (migrationMode === 'database' && selectedCollections.length === 0) {
      toast.error('Please select at least one collection to migrate');
      return;
    }

    setIsMigrating(true);

    try {
      if (migrationMode === 'collection') {
        addLog({
          level: 'info',
          message: `Starting direct collection migration: [${sourceConn.label}: ${sourceDb}.${sourceColl}] ➔ [${targetConn.label}: ${targetDb}.${targetColl}]...`,
          details: { conflictPolicy, dropFirst },
        });

        const res = await fetch('/api/operations/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'collection',
            sourceConnectionId: sourceConn.id,
            sourceSlot,
            sourceDatabase: sourceDb.trim(),
            sourceCollection: sourceColl.trim(),
            targetConnectionId: targetConn.id,
            targetSlot,
            targetDatabase: targetDb.trim(),
            targetCollection: targetColl.trim(),
            conflictPolicy,
            dropFirst,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Migration failed');

        const { stats } = data;
        addLog({
          level: 'success',
          message: `Successfully migrated ${formatNumber(stats.insertedCount)} documents to "${targetDb}.${targetColl}" (${stats.durationMs}ms)`,
          details: stats,
        });

        if (stats.skippedCount > 0) {
          addLog({
            level: 'warn',
            message: `Skipped ${formatNumber(stats.skippedCount)} duplicate documents (policy: ${conflictPolicy})`,
          });
        }

        if (stats.modifiedCount > 0 || stats.upsertedCount > 0) {
          addLog({
            level: 'info',
            message: `Updated ${formatNumber(stats.modifiedCount + stats.upsertedCount)} existing documents`,
          });
        }

        toast.success(
          `Migration complete! ${formatNumber(stats.insertedCount)} docs copied to ${targetDb}.${targetColl}`
        );
      } else {
        // Database mode
        addLog({
          level: 'info',
          message: `Starting database migration: [${sourceConn.label}: ${sourceDb}] ➔ [${targetConn.label}: ${targetDb}] (${selectedCollections.length} collections)...`,
          details: { collections: selectedCollections, conflictPolicy, dropFirst },
        });

        const res = await fetch('/api/operations/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'database',
            sourceConnectionId: sourceConn.id,
            sourceSlot,
            sourceDatabase: sourceDb.trim(),
            targetConnectionId: targetConn.id,
            targetSlot,
            targetDatabase: targetDb.trim(),
            collections: selectedCollections,
            conflictPolicy,
            dropFirst,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Database migration failed');

        const { stats } = data;
        addLog({
          level: 'success',
          message: `Database migration completed! ${stats.totalCollections} collections, ${formatNumber(stats.insertedCount)} docs copied to database "${targetDb}" in ${stats.durationMs}ms`,
          details: stats,
        });

        if (stats.skippedCount > 0) {
          addLog({
            level: 'warn',
            message: `Total skipped duplicate documents: ${formatNumber(stats.skippedCount)}`,
          });
        }

        toast.success(
          `Database migrated! ${stats.totalCollections} collections, ${formatNumber(stats.insertedCount)} docs copied`
        );
      }

      queryClient.invalidateQueries({ queryKey: ['collections', targetConn.id, targetDb.trim()] });
      queryClient.invalidateQueries({ queryKey: ['databases', targetSlot, targetConn.id] });

      closeModal();
    } catch (err: any) {
      const msg = err.message || 'Migration failed';
      addLog({
        level: 'error',
        message: `Migration failed: ${msg}`,
      });
      toast.error(`Migration error: ${msg}`);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl bg-[#121216] border border-white/[0.08] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#16161c] border-b border-white/[0.07] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/[0.08] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Direct Data Migration
              </h2>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-4 pt-3.5 shrink-0">
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-white/[0.07] text-xs">
            <button
              type="button"
              onClick={() => setMigrationMode('collection')}
              className={`flex-1 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors text-center flex items-center justify-center gap-1.5 ${
                migrationMode === 'collection'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Single Collection</span>
            </button>
            <button
              type="button"
              onClick={() => setMigrationMode('database')}
              className={`flex-1 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors text-center flex items-center justify-center gap-1.5 ${
                migrationMode === 'database'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Entire Database</span>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleMigrate} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {/* Visual Source -> Target Flow Card */}
          <div className="p-3 rounded-lg bg-zinc-950 border border-white/[0.06] flex items-center justify-between gap-3">
            {/* Source Pill */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-mono font-medium text-zinc-400 tracking-wider mb-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                <span>SOURCE ({sourceSlot})</span>
              </div>
              <div className="font-medium text-xs text-zinc-200 truncate">
                {sourceConn?.label || 'Source MongoDB'}
              </div>
              <div className="font-mono text-[11px] text-zinc-400 truncate">
                {sourceDb}{migrationMode === 'collection' ? `.${sourceColl}` : ` (${dbCollections.length} colls)`}
              </div>
              {migrationMode === 'collection' && modalContext?.documentCount !== undefined && (
                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  {formatNumber(modalContext.documentCount)} documents
                </div>
              )}
            </div>

            {/* Migration Arrow */}
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-white/[0.08] flex items-center justify-center shrink-0 text-zinc-400">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>

            {/* Target Pill */}
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[10px] uppercase font-mono font-medium text-emerald-400 tracking-wider mb-0.5 flex items-center justify-end gap-1.5">
                <span>TARGET ({targetSlot})</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="font-medium text-xs text-zinc-200 truncate">
                {targetConn?.label || 'Target MongoDB'}
              </div>
              <div className="font-mono text-[11px] text-zinc-400 truncate">
                {targetDb || 'target_db'}{migrationMode === 'collection' ? `.${targetColl || 'target_coll'}` : ` (live copy)`}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Direct server-side clone
              </div>
            </div>
          </div>

          {/* Destination Configuration */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
              Destination Namespaces
            </label>
            <div className={`grid gap-2 ${migrationMode === 'collection' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="block text-zinc-400 text-[11px] mb-1 flex items-center gap-1">
                  <Database className="w-3 h-3 text-zinc-400" />
                  <span>Target Database</span>
                </label>
                <input
                  type="text"
                  required
                  value={targetDb}
                  onChange={(e) => setTargetDb(e.target.value)}
                  placeholder="Target database name"
                  className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-500"
                />
              </div>

              {migrationMode === 'collection' && (
                <div>
                  <label className="block text-zinc-400 text-[11px] mb-1 flex items-center gap-1">
                    <Table className="w-3 h-3 text-zinc-400" />
                    <span>Target Collection Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={targetColl}
                    onChange={(e) => setTargetColl(e.target.value)}
                    placeholder="Target collection name"
                    className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* If Database Mode: Collections Checklist */}
          {migrationMode === 'database' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-zinc-300 font-medium flex items-center gap-1 text-[11px] uppercase tracking-wider">
                  <Layers className="w-3 h-3 text-zinc-400" />
                  <span>Collections ({selectedCollections.length}/{dbCollections.length})</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllCollections}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-600">•</span>
                  <button
                    type="button"
                    onClick={deselectAllCollections}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-36 overflow-y-auto rounded-lg bg-zinc-950 border border-white/[0.08] p-1.5 space-y-0.5">
                {dbCollections.length === 0 ? (
                  <div className="text-zinc-500 text-[11px] py-2 text-center">
                    No collections found or loading...
                  </div>
                ) : (
                  dbCollections.map((col) => {
                    const isChecked = selectedCollections.includes(col.name);
                    return (
                      <div
                        key={col.name}
                        onClick={() => toggleCollection(col.name)}
                        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                          isChecked ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          )}
                          <span className="font-mono text-[11px] truncate">{col.name}</span>
                        </div>
                        {col.documentCount !== undefined && (
                          <span className="text-[10px] font-mono text-zinc-400">
                            {formatNumber(col.documentCount)} docs
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Conflict Policy Cards */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5 text-[11px] uppercase tracking-wider">
              Conflict & Duplicate Key Policy
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between ${
                  conflictPolicy === 'skip'
                    ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">Skip</span>
                  <input
                    type="radio"
                    name="migratePolicy"
                    checked={conflictPolicy === 'skip'}
                    onChange={() => setConflictPolicy('skip')}
                    className="accent-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Insert new docs, keep existing IDs</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between ${
                  conflictPolicy === 'upsert'
                    ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">Upsert</span>
                  <input
                    type="radio"
                    name="migratePolicy"
                    checked={conflictPolicy === 'upsert'}
                    onChange={() => setConflictPolicy('upsert')}
                    className="accent-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Replace/update existing documents</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between ${
                  conflictPolicy === 'fail'
                    ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">Fail</span>
                  <input
                    type="radio"
                    name="migratePolicy"
                    checked={conflictPolicy === 'fail'}
                    onChange={() => setConflictPolicy('fail')}
                    className="accent-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Abort immediately on duplicate key</span>
              </label>
            </div>
          </div>

          {/* Clean Slate Option (Drop First) */}
          <div>
            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 cursor-pointer">
              <input
                type="checkbox"
                checked={dropFirst}
                onChange={(e) => setDropFirst(e.target.checked)}
                className="rounded border-rose-800 bg-zinc-950 text-rose-500 focus:ring-0 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Drop destination collection(s) before copy (clean slate)</span>
              </div>
            </label>
          </div>

          {/* Pre-Migration Confirmation Banner */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-white/[0.06] flex items-center gap-2 text-zinc-300 text-[11px]">
            <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <div>
              <span>
                Target: <strong className="text-zinc-100">{migrationMode === 'collection' ? `${sourceDb}.${sourceColl}` : `${selectedCollections.length} collections`}</strong> ➔ <strong className="text-zinc-100">{targetDb}{migrationMode === 'collection' ? `.${targetColl}` : ''}</strong> (policy: <span className="font-mono text-zinc-200">{conflictPolicy.toUpperCase()}</span>).
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-white/[0.07] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMigrating || (migrationMode === 'database' && selectedCollections.length === 0)}
              className="px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-zinc-950 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isMigrating ? (
                <>
                  <span className="w-3 h-3 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Copying data...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    Start Migration
                    {migrationMode === 'database' ? ` (${selectedCollections.length} colls)` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
