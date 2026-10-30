'use client';

import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { X, Download, FileJson, FileSpreadsheet, Database, Table, Check } from 'lucide-react';
import { toast } from 'sonner';

export function ExportDialog() {
  const { activeModal, modalContext, closeModal, sourceConnection, targetConnection } = useWorkspaceStore();
  const { addLog } = useTerminalStore();

  const isOpen = activeModal === 'export';
  const slot = modalContext?.slot || 'source';
  const conn = slot === 'source' ? sourceConnection : targetConnection;

  const defaultDb = modalContext?.database || '';
  const defaultColl = modalContext?.collection || '';

  const [database, setDatabase] = useState(defaultDb);
  const [collection, setCollection] = useState(defaultColl);
  const [format, setFormat] = useState<'json' | 'ejson' | 'csv'>('json');
  const [limit, setLimit] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  // Sync state if modalContext changes
  React.useEffect(() => {
    if (modalContext?.database) setDatabase(modalContext.database);
    if (modalContext?.collection) setCollection(modalContext.collection);
  }, [modalContext]);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conn?.id) {
      toast.error('No active MongoDB connection found for this slot');
      return;
    }

    if (!database.trim() || !collection.trim()) {
      toast.error('Please specify both database and collection name');
      return;
    }

    setIsExporting(true);

    try {
      addLog({
        level: 'info',
        message: `Initiating export for "${database}.${collection}" (format: ${format.toUpperCase()})`,
        details: { database, collection, format, limit: limit || 'all' },
      });

      const params = new URLSearchParams({
        connectionId: conn.id,
        db: database.trim(),
        collection: collection.trim(),
        format,
      });

      if (limit && parseInt(limit, 10) > 0) {
        params.append('limit', limit);
      }

      const downloadUrl = `/api/operations/export?${params.toString()}`;

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${database}_${collection}.${format === 'csv' ? 'csv' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      addLog({
        level: 'success',
        message: `Export started for "${database}.${collection}". Downloading file...`,
      });

      toast.success(`Exporting "${database}.${collection}" (${format.toUpperCase()})`);
      closeModal();
    } catch (err: any) {
      const msg = err.message || 'Export failed';
      addLog({
        level: 'error',
        message: `Export failed for "${database}.${collection}": ${msg}`,
      });
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-xl bg-[#121216] border border-white/[0.08] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#16161c] border-b border-white/[0.07] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/[0.08] flex items-center justify-center">
              <Download className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Export Collection Data
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

        {/* Body */}
        <form onSubmit={handleExport} className="p-4 space-y-3.5 text-xs">
          {/* Target Namespace */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Database className="w-3 h-3 text-zinc-400" />
                <span>Database</span>
              </label>
              <input
                type="text"
                required
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="Database name"
                className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Table className="w-3 h-3 text-zinc-400" />
                <span>Collection</span>
              </label>
              <input
                type="text"
                required
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="Collection name"
                className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Format Selection Cards */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5 text-[11px] uppercase tracking-wider">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors flex flex-col justify-between h-20 ${
                  format === 'json'
                    ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100 shadow-xs'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <FileJson className="w-4 h-4 text-zinc-300" />
                  {format === 'json' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div>
                  <div className="font-medium text-xs text-zinc-200">JSON</div>
                  <div className="text-[10px] text-zinc-500">Standard Array</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('ejson')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors flex flex-col justify-between h-20 ${
                  format === 'ejson'
                    ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100 shadow-xs'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <FileJson className="w-4 h-4 text-zinc-300" />
                  {format === 'ejson' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div>
                  <div className="font-medium text-xs text-zinc-200">Extended</div>
                  <div className="text-[10px] text-zinc-500">Preserves BSON</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors flex flex-col justify-between h-20 ${
                  format === 'csv'
                    ? 'bg-zinc-800/90 border-emerald-500/50 text-zinc-100 shadow-xs'
                    : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <FileSpreadsheet className="w-4 h-4 text-zinc-300" />
                  {format === 'csv' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div>
                  <div className="font-medium text-xs text-zinc-200">CSV</div>
                  <div className="text-[10px] text-zinc-500">Flat Spreadsheet</div>
                </div>
              </button>
            </div>
          </div>

          {/* Optional Limit */}
          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
              Document Limit (optional)
            </label>
            <input
              type="number"
              min="1"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Leave empty to export all documents"
              className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
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
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-zinc-950 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isExporting ? 'Exporting...' : 'Export & Download'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
