'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Upload,
  ArchiveRestore,
  HardDrive,
  ShieldAlert,
  Loader2,
  FileArchive,
} from 'lucide-react';
import { DatabaseNode } from '@/types/explorer';
import { formatBytes } from '@/lib/utils';
import { toast } from 'sonner';

interface LocalBackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  path: string;
}

export function RestoreDialog() {
  const { activeModal, modalContext, closeModal, sourceConnection, targetConnection } = useWorkspaceStore();
  const { addLog } = useTerminalStore();
  const queryClient = useQueryClient();

  const isOpen = activeModal === 'restore';
  const [selectedSlot, setSelectedSlot] = useState<'source' | 'target'>('source');

  const [sourceType, setSourceType] = useState<'upload' | 'local'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLocalBackup, setSelectedLocalBackup] = useState<string>('');
  const [targetDbMode, setTargetDbMode] = useState<'original' | 'custom'>('original');
  const [targetDatabase, setTargetDatabase] = useState('');
  const [sourceDatabase, setSourceDatabase] = useState('');
  const [dropFirst, setDropFirst] = useState(false);
  const [useGzip, setUseGzip] = useState(true);
  const [stopOnError, setStopOnError] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalContext) {
      if (modalContext.slot) setSelectedSlot(modalContext.slot);
      if (modalContext.database) {
        setTargetDatabase(modalContext.database);
        setTargetDbMode('custom');
      }
    }
  }, [modalContext]);

  const conn = selectedSlot === 'source' ? sourceConnection : targetConnection;

  // Fetch local backups on server
  const { data: localBackups = [] } = useQuery<LocalBackupFile[]>({
    queryKey: ['local-backups'],
    queryFn: async () => {
      const res = await fetch('/api/operations/restore');
      if (!res.ok) return [];
      const data = await res.json();
      return data.backups || [];
    },
    enabled: isOpen,
  });

  // Fetch databases for target slot
  const { data: databases = [] } = useQuery<DatabaseNode[]>({
    queryKey: ['databases', selectedSlot, conn?.id],
    queryFn: async () => {
      if (!conn?.id) return [];
      const res = await fetch(`/api/connections/${conn.id}/databases`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.databases || [];
    },
    enabled: isOpen && !!conn?.id,
  });

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setSourceType('upload');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!conn?.id) {
      toast.error('No active MongoDB connection found for selected destination');
      return;
    }

    if (sourceType === 'upload' && !selectedFile) {
      toast.error('Please select or upload a mongodump backup archive (.archive / .archive.gz)');
      return;
    }

    if (sourceType === 'local' && !selectedLocalBackup) {
      toast.error('Please select a local backup file from the list');
      return;
    }

    if (targetDbMode === 'custom' && !targetDatabase.trim()) {
      toast.error('Please specify a destination database name');
      return;
    }

    setIsRestoring(true);

    try {
      const targetDbName = targetDbMode === 'custom' ? targetDatabase.trim() : undefined;
      const fileName = sourceType === 'upload' ? selectedFile?.name : selectedLocalBackup;

      addLog({
        level: 'info',
        message: `Starting mongorestore of "${fileName}" into [${conn.label}: ${targetDbName || 'original DB in archive'}]...`,
        details: {
          file: fileName,
          targetDatabase: targetDbName || 'original',
          drop: dropFirst,
          gzip: useGzip,
        },
      });

      const formData = new FormData();
      formData.append('connectionId', conn.id);
      formData.append('slot', selectedSlot);
      if (targetDbName) formData.append('targetDatabase', targetDbName);
      if (sourceDatabase.trim()) formData.append('sourceDatabase', sourceDatabase.trim());
      formData.append('drop', String(dropFirst));
      formData.append('gzip', String(useGzip));
      formData.append('stopOnError', String(stopOnError));

      if (sourceType === 'upload' && selectedFile) {
        formData.append('file', selectedFile);
      } else if (sourceType === 'local' && selectedLocalBackup) {
        formData.append('existingFile', selectedLocalBackup);
      }

      const res = await fetch('/api/operations/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Restore failed');
      }

      addLog({
        level: 'success',
        message: `mongorestore completed! ${data.summary}`,
        details: data,
      });

      toast.success(`Restore completed: ${data.summary}`);

      queryClient.invalidateQueries({ queryKey: ['databases', selectedSlot, conn.id] });
      if (targetDbName) {
        queryClient.invalidateQueries({ queryKey: ['collections', conn.id, targetDbName] });
      }

      closeModal();
    } catch (err: any) {
      const msg = err.message || 'Restore failed';
      addLog({
        level: 'error',
        message: `Restore failed: ${msg}`,
      });
      toast.error(`Restore error: ${msg}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-[#121216] border border-white/[0.08] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#16161c] border-b border-white/[0.07] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/[0.08] flex items-center justify-center">
              <ArchiveRestore className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Import / Restore mongodump Backup
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
        <form onSubmit={handleRestore} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {/* Destination Instance Selector */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
              Destination MongoDB Instance
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedSlot('source')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                  selectedSlot === 'source'
                    ? 'bg-zinc-800/80 border-emerald-500/50 text-zinc-100'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="font-medium text-xs flex items-center justify-between mb-0.5">
                  <span>Source Workspace</span>
                  {sourceConnection?.status === 'connected' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </div>
                <div className="text-[11px] font-mono text-zinc-400 truncate">
                  {sourceConnection?.label || 'Not Connected'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSlot('target')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                  selectedSlot === 'target'
                    ? 'bg-zinc-800/80 border-emerald-500/50 text-zinc-100'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="font-medium text-xs flex items-center justify-between mb-0.5">
                  <span>Target Workspace</span>
                  {targetConnection?.status === 'connected' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </div>
                <div className="text-[11px] font-mono text-zinc-400 truncate">
                  {targetConnection?.label || 'Not Connected'}
                </div>
              </button>
            </div>
          </div>

          {/* Backup Archive Source Selector (Upload vs Local Recent) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-zinc-300 font-medium text-[11px] uppercase tracking-wider">
                Backup Archive Source
              </label>
              <div className="flex items-center bg-zinc-950 p-0.5 rounded-md border border-white/[0.07] text-[11px]">
                <button
                  type="button"
                  onClick={() => setSourceType('upload')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    sourceType === 'upload'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('local')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    sourceType === 'local'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Recent Backups ({localBackups.length})
                </button>
              </div>
            </div>

            {sourceType === 'upload' ? (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".archive,.gz,.tar.gz,.dump,.json"
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <FileArchive className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-zinc-200 truncate">{selectedFile.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {formatBytes(selectedFile.size)} • External mongodump archive
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="px-2 py-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 text-[11px] cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-white/[0.12] hover:border-emerald-500/50 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-zinc-950/60"
                  >
                    <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center mb-2 text-zinc-300">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="font-medium text-zinc-200 mb-0.5">
                      Drop mongodump archive here or click to browse
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Supports official MongoDB Tools archives (<code className="font-mono text-zinc-400">.archive</code>, <code className="font-mono text-zinc-400">.archive.gz</code>)
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {localBackups.length === 0 ? (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-white/[0.08] text-zinc-500 text-center text-[11px]">
                    No local backups found in <code className="font-mono text-zinc-400">data/backups/</code>
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-lg bg-zinc-950 border border-white/[0.08] p-1.5 space-y-1">
                    {localBackups.map((bk) => (
                      <div
                        key={bk.name}
                        onClick={() => setSelectedLocalBackup(bk.name)}
                        className={`px-2.5 py-1.5 rounded flex items-center justify-between cursor-pointer transition-colors ${
                          selectedLocalBackup === bk.name
                            ? 'bg-zinc-800 border border-emerald-500/40 text-zinc-100'
                            : 'hover:bg-zinc-900 text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <HardDrive className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="font-mono text-[11px] truncate">{bk.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {formatBytes(bk.sizeBytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Destination Database Mode */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5 text-[11px] uppercase tracking-wider">
              Target Database Destination
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  targetDbMode === 'original'
                    ? 'bg-zinc-800/80 border-emerald-500/50 text-zinc-100'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">Original Database</span>
                  <input
                    type="radio"
                    name="targetDbMode"
                    checked={targetDbMode === 'original'}
                    onChange={() => setTargetDbMode('original')}
                    className="accent-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Restore into original DB stored in archive</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  targetDbMode === 'custom'
                    ? 'bg-zinc-800/80 border-emerald-500/50 text-zinc-100'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">Specific Database</span>
                  <input
                    type="radio"
                    name="targetDbMode"
                    checked={targetDbMode === 'custom'}
                    onChange={() => setTargetDbMode('custom')}
                    className="accent-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Remap collections to a destination DB</span>
              </label>
            </div>

            {targetDbMode === 'custom' && (
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-zinc-950 border border-white/[0.06]">
                <div>
                  <label className="block text-zinc-400 text-[11px] mb-1">
                    Destination Database Name
                  </label>
                  <input
                    type="text"
                    required
                    list="restore-target-dbs"
                    value={targetDatabase}
                    onChange={(e) => setTargetDatabase(e.target.value)}
                    placeholder="e.g. my_restored_db"
                    className="w-full h-8 px-2.5 rounded-md bg-zinc-900 border border-white/[0.08] text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-500"
                  />
                  <datalist id="restore-target-dbs">
                    {databases.map((db) => (
                      <option key={db.name} value={db.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-zinc-400 text-[11px] mb-1">
                    Original DB in Archive (optional)
                  </label>
                  <input
                    type="text"
                    value={sourceDatabase}
                    onChange={(e) => setSourceDatabase(e.target.value)}
                    placeholder="e.g. rdg (for namespace remap)"
                    className="w-full h-8 px-2.5 rounded-md bg-zinc-900 border border-white/[0.08] text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Options: Drop first & Gzip */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 cursor-pointer">
              <input
                type="checkbox"
                checked={dropFirst}
                onChange={(e) => setDropFirst(e.target.checked)}
                className="rounded border-rose-800 bg-zinc-950 text-rose-500 focus:ring-0 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Drop existing collections before restoring (--drop)</span>
              </div>
            </label>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-white/[0.06]">
              <div>
                <span className="text-zinc-200 font-medium block text-xs">Gzip Decompression (--gzip)</span>
                <span className="text-zinc-500 text-[10px]">Decompress .gz archives automatically</span>
              </div>
              <input
                type="checkbox"
                checked={useGzip}
                onChange={(e) => setUseGzip(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0 cursor-pointer"
              />
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
              disabled={isRestoring || (sourceType === 'upload' && !selectedFile) || (sourceType === 'local' && !selectedLocalBackup)}
              className="px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-zinc-950 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Restoring archive...</span>
                </>
              ) : (
                <>
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  <span>Start mongorestore</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
