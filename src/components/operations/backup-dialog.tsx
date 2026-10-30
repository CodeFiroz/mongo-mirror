'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { useQuery } from '@tanstack/react-query';
import { DatabaseNode, CollectionNode } from '@/types/explorer';
import {
  X,
  HardDrive,
  Database,
  Table,
  Download,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { formatBytes, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

export function BackupDialog() {
  const { activeModal, modalContext, closeModal, sourceConnection, targetConnection } = useWorkspaceStore();
  const { addLog } = useTerminalStore();

  const isOpen = activeModal === 'backup';
  const slot = modalContext?.slot || 'source';
  const conn = slot === 'source' ? sourceConnection : targetConnection;

  const [database, setDatabase] = useState(modalContext?.database || '');
  const [collection, setCollection] = useState(modalContext?.collection || '');
  const [useGzip, setUseGzip] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    if (modalContext?.database) setDatabase(modalContext.database);
    if (modalContext?.collection) setCollection(modalContext.collection);
  }, [modalContext]);

  // Fetch available databases on this connection
  const { data: databases = [] } = useQuery<DatabaseNode[]>({
    queryKey: ['databases', slot, conn?.id],
    queryFn: async () => {
      if (!conn?.id) return [];
      const res = await fetch(`/api/connections/${conn.id}/databases`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.databases || [];
    },
    enabled: isOpen && !!conn?.id,
  });

  // Fetch available collections when a database is selected
  const { data: collections = [] } = useQuery<CollectionNode[]>({
    queryKey: ['collections', conn?.id, database],
    queryFn: async () => {
      if (!conn?.id || !database) return [];
      const res = await fetch(`/api/connections/${conn.id}/databases/${encodeURIComponent(database)}/collections`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.collections || [];
    },
    enabled: isOpen && !!conn?.id && !!database,
  });

  if (!isOpen) return null;

  // Validation & Suggestions for database name
  const existingDbNames = databases.map((d) => d.name);
  const isExactDbMatch = existingDbNames.includes(database.trim());
  const suggestedDbs =
    !isExactDbMatch && database.trim()
      ? existingDbNames.filter((d) => d.toLowerCase().includes(database.trim().toLowerCase()))
      : [];

  // Validation & Suggestions for collection name
  const existingCollNames = collections.map((c) => c.name);
  const isExactCollMatch = !collection.trim() || existingCollNames.includes(collection.trim());
  const suggestedColls =
    collection.trim() && !isExactCollMatch
      ? existingCollNames.filter((c) => c.toLowerCase().includes(collection.trim().toLowerCase()))
      : [];

  const handleBackup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!conn?.id) {
      toast.error('No active MongoDB connection found for this slot');
      return;
    }

    if (!database.trim()) {
      toast.error('Please specify a database to back up');
      return;
    }

    if (databases.length > 0 && !isExactDbMatch) {
      const hint = suggestedDbs.length > 0 ? ` Did you mean "${suggestedDbs.join('", "')}"?` : '';
      toast.error(`Database "${database}" not found on this connection.${hint}`);
      return;
    }

    if (collection.trim() && collections.length > 0 && !isExactCollMatch) {
      const hint = suggestedColls.length > 0 ? ` Did you mean "${suggestedColls.join('", "')}"?` : '';
      toast.error(`Collection "${collection}" not found in database "${database}".${hint}`);
      return;
    }

    setIsBackingUp(true);

    try {
      addLog({
        level: 'info',
        message: `Starting native backup for database "${database}"${
          collection ? ` (collection: ${collection})` : ' (all collections)'
        }...`,
        details: { database, collection: collection || 'all', gzip: useGzip },
      });

      const res = await fetch('/api/operations/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: conn.id,
          slot,
          database: database.trim(),
          collection: collection.trim() || undefined,
          gzip: useGzip,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create backup');
      }

      addLog({
        level: 'success',
        message: `Backup archive created: ${data.filename} (${formatBytes(data.sizeBytes)}) in ${data.durationMs}ms`,
        details: { filename: data.filename, size: data.sizeBytes, type: data.type },
      });

      // Trigger direct browser download
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      }, 2000);

      toast.success(`Backup created: ${data.filename} (${formatBytes(data.sizeBytes)})`);
      closeModal();
    } catch (err: any) {
      const msg = err.message || 'Backup failed';
      addLog({
        level: 'error',
        message: `Backup failed for database "${database}": ${msg}`,
      });
      toast.error(`Backup error: ${msg}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-xl bg-[#121216] border border-white/[0.08] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#16161c] border-b border-white/[0.07] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/[0.08] flex items-center justify-center">
              <HardDrive className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Backup MongoDB Database
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

        {/* Form Body */}
        <form onSubmit={handleBackup} className="p-4 space-y-3.5 text-xs">
          {/* Active Connection Banner */}
          <div className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/[0.06] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold block">
                Source Instance ({slot})
              </span>
              <span className="text-zinc-200 font-medium text-xs">{conn?.label || 'MongoDB Instance'}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-zinc-400 block truncate max-w-[180px]">
                {conn?.sanitizedUri || 'Connected'}
              </span>
            </div>
          </div>

          {/* Database Selector / Input with Datalist */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-zinc-300 font-medium flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Database className="w-3 h-3 text-zinc-400" />
                <span>Database</span>
              </label>
              {databases.length > 0 && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  {databases.length} dbs
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                required
                list="backup-db-options"
                value={database}
                onChange={(e) => {
                  setDatabase(e.target.value);
                  setCollection('');
                }}
                placeholder="Select or enter database name"
                className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-500"
              />
              <datalist id="backup-db-options">
                {databases.map((db) => (
                  <option key={db.name} value={db.name}>
                    {db.name} ({db.collections?.length || 0} collections)
                  </option>
                ))}
              </datalist>
            </div>

            {/* Quick database suggestion chips if typo */}
            {suggestedDbs.length > 0 && (
              <div className="mt-1.5 p-2 rounded-lg bg-zinc-900 border border-white/[0.08] text-[11px] text-zinc-300">
                <div className="flex items-center gap-1 font-medium mb-1 text-zinc-400">
                  <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Database not found. Suggestions:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {suggestedDbs.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setDatabase(sug)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[10px] cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collection Selector / Filter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-zinc-300 font-medium flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Table className="w-3 h-3 text-zinc-400" />
                <span>Collection (optional)</span>
              </label>
              {collections.length > 0 && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  {collections.length} colls
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                list="backup-coll-options"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="Leave empty to back up entire database"
                className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <datalist id="backup-coll-options">
                {collections.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} {col.documentCount !== undefined ? `(${formatNumber(col.documentCount)} docs)` : ''}
                  </option>
                ))}
              </datalist>
            </div>

            {/* Quick collection suggestion chips if typo */}
            {suggestedColls.length > 0 && (
              <div className="mt-1.5 p-2 rounded-lg bg-zinc-900 border border-white/[0.08] text-[11px] text-zinc-300">
                <div className="flex items-center gap-1 font-medium mb-1 text-zinc-400">
                  <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Collection not found. Suggestions:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {suggestedColls.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setCollection(sug)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[10px] cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Backup Format Info Banner */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-zinc-300 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Native mongodump Engine</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Creates a point-in-time binary archive (<code className="font-mono text-zinc-300">.archive.gz</code>) preserving BSON data types, ObjectIds, dates, and indexes.
            </p>
          </div>

          {/* Gzip Compression Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-white/[0.06]">
            <div>
              <span className="text-zinc-200 font-medium block text-xs">GZIP Compression</span>
              <span className="text-zinc-500 text-[10px]">Reduces file download size significantly</span>
            </div>
            <input
              type="checkbox"
              checked={useGzip}
              onChange={(e) => setUseGzip(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0 cursor-pointer"
            />
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
              disabled={isBackingUp || !database.trim()}
              className="px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-zinc-950 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isBackingUp ? (
                <>
                  <span className="w-3 h-3 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Dumping database...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Create Backup Archive</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
