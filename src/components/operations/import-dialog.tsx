'use client';

import React, { useState, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileUp, Database, Table, CheckCircle2, ShieldAlert, ArchiveRestore } from 'lucide-react';
import { formatBytes, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

export function ImportDialog() {
  const { activeModal, modalContext, openModal, closeModal, sourceConnection, targetConnection } = useWorkspaceStore();
  const { addLog } = useTerminalStore();
  const queryClient = useQueryClient();

  const isOpen = activeModal === 'import';
  const slot = modalContext?.slot || 'target';
  const conn = slot === 'target' ? (targetConnection || sourceConnection) : sourceConnection;

  const defaultDb = modalContext?.database || '';
  const defaultColl = modalContext?.collection || '';

  const [database, setDatabase] = useState(defaultDb);
  const [collection, setCollection] = useState(defaultColl);
  const [file, setFile] = useState<File | null>(null);
  const [conflictPolicy, setConflictPolicy] = useState<'skip' | 'upsert' | 'fail'>('skip');
  const [dropFirst, setDropFirst] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if modalContext changes
  React.useEffect(() => {
    if (modalContext?.database) setDatabase(modalContext.database);
    if (modalContext?.collection) setCollection(modalContext.collection);
  }, [modalContext]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.archive') || droppedFile.name.endsWith('.archive.gz') || droppedFile.name.endsWith('.dump')) {
        toast.info('Detected mongodump archive! Switching to Restore Backup...');
        openModal('restore', { slot, database, collection });
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.name.endsWith('.archive') || selected.name.endsWith('.archive.gz') || selected.name.endsWith('.dump')) {
        toast.info('Detected mongodump archive! Switching to Restore Backup...');
        openModal('restore', { slot, database, collection });
        return;
      }
      setFile(selected);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!conn?.id) {
      toast.error('No active MongoDB connection found for this slot');
      return;
    }

    if (!file) {
      toast.error('Please select a JSON or CSV file to import');
      return;
    }

    if (!database.trim() || !collection.trim()) {
      toast.error('Please specify target database and collection names');
      return;
    }

    setIsImporting(true);

    try {
      addLog({
        level: 'info',
        message: `Importing "${file.name}" (${formatBytes(file.size)}) into ${slot.toUpperCase()}: ${database}.${collection}...`,
        details: { conflictPolicy, dropFirst, size: file.size },
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('connectionId', conn.id);
      formData.append('slot', slot);
      formData.append('database', database.trim());
      formData.append('collection', collection.trim());
      formData.append('conflictPolicy', conflictPolicy);
      formData.append('dropFirst', dropFirst ? 'true' : 'false');

      const res = await fetch('/api/operations/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import file');
      }

      const { stats } = data;
      addLog({
        level: 'success',
        message: `Successfully imported ${formatNumber(stats.insertedCount)} documents into "${database}.${collection}" (${stats.durationMs}ms)`,
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
        `Import completed: ${formatNumber(stats.insertedCount)} docs inserted`
      );

      queryClient.invalidateQueries({ queryKey: ['collections', conn.id, database.trim()] });
      queryClient.invalidateQueries({ queryKey: ['databases', slot, conn.id] });

      closeModal();
    } catch (err: any) {
      const msg = err.message || 'Import failed';
      addLog({
        level: 'error',
        message: `Import failed: ${msg}`,
      });
      toast.error(`Import error: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg rounded-xl bg-[#121216] border border-white/[0.08] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#16161c] border-b border-white/[0.07] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/[0.08] flex items-center justify-center">
              <Upload className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Import Data into {slot === 'source' ? 'Source' : 'Target'}
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

        {/* Switcher Tabs: Data File vs mongodump Archive */}
        <div className="px-4 pt-3.5 shrink-0">
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-white/[0.07] text-xs">
            <button
              type="button"
              className="flex-1 py-1 rounded-md text-xs font-medium cursor-default bg-zinc-800 text-zinc-100 shadow-xs flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Data File (JSON / CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => openModal('restore', { slot, database, collection })}
              className="flex-1 py-1 rounded-md text-xs font-medium cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <ArchiveRestore className="w-3.5 h-3.5 text-zinc-400" />
              <span>mongodump Backup</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleImport} className="p-4 space-y-3.5 text-xs">
          {/* File Upload Dropzone */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
              Select Data File (.json, .csv)
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : file
                  ? 'border-emerald-500/40 bg-zinc-950'
                  : 'border-white/[0.12] hover:border-zinc-500 bg-zinc-950/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className="font-medium text-xs text-zinc-200 truncate max-w-[300px]">
                      {file.name}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {formatBytes(file.size)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                  <FileUp className="w-5 h-5 text-zinc-400" />
                  <span className="text-zinc-200 font-medium">
                    Drop file here or click to browse
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Supports JSON array, Extended JSON (EJSON), or CSV files
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Destination Database & Collection */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Database className="w-3 h-3 text-zinc-400" />
                <span>Destination Database</span>
              </label>
              <input
                type="text"
                required
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="Database name"
                className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Table className="w-3 h-3 text-zinc-400" />
                <span>Destination Collection</span>
              </label>
              <input
                type="text"
                required
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="Collection name"
                className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Duplicate & Conflict Handling Policy */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5 text-[11px] uppercase tracking-wider">
              Conflict Policy
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
                    name="policy"
                    checked={conflictPolicy === 'skip'}
                    onChange={() => setConflictPolicy('skip')}
                    className="accent-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Insert new, ignore existing IDs</span>
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
                    name="policy"
                    checked={conflictPolicy === 'upsert'}
                    onChange={() => setConflictPolicy('upsert')}
                    className="accent-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Replace existing matching IDs</span>
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
                    name="policy"
                    checked={conflictPolicy === 'fail'}
                    onChange={() => setConflictPolicy('fail')}
                    className="accent-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Abort on first duplicate error</span>
              </label>
            </div>
          </div>

          {/* Destructive Drop Toggle */}
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
                <span>Drop existing destination collection before importing</span>
              </div>
            </label>
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
              disabled={isImporting || !file}
              className="px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-zinc-950 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isImporting ? (
                <>
                  <span className="w-3 h-3 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Import Data</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
