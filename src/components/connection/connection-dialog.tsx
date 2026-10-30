'use client';

import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { X, Database, AlertCircle } from 'lucide-react';
import { maskUri } from '@/lib/utils';
import { toast } from 'sonner';

export function ConnectionDialog() {
  const { activeModal, modalContext, closeModal, setConnection } = useWorkspaceStore();
  const { addLog } = useTerminalStore();

  const isOpen = activeModal === 'connect-source' || activeModal === 'connect-target';
  const slot = modalContext?.slot || (activeModal === 'connect-target' ? 'target' : 'source');

  const [mode, setMode] = useState<'uri' | 'form'>('uri');
  const [label, setLabel] = useState(slot === 'source' ? 'Local MongoDB' : 'Target MongoDB');
  const [uri, setUri] = useState('mongodb://localhost:27017');

  // Form mode state
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('27017');
  const [authDb, setAuthDb] = useState('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [useSsl, setUseSsl] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    let finalUri = uri.trim();
    if (mode === 'form') {
      const auth = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
      const ssl = useSsl ? '?ssl=true' : '';
      const authSource = authDb ? `?authSource=${encodeURIComponent(authDb)}` : '';
      finalUri = `mongodb://${auth}${host}:${port}/${authSource}`;
    }

    if (!finalUri.startsWith('mongodb://') && !finalUri.startsWith('mongodb+srv://')) {
      setError('Connection string must start with mongodb:// or mongodb+srv://');
      setIsLoading(false);
      return;
    }

    try {
      addLog({
        level: 'info',
        message: `Connecting to ${slot.toUpperCase()} MongoDB (${maskUri(finalUri)})...`,
      });

      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, uri: finalUri, label }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to establish MongoDB connection');
      }

      setConnection(slot, {
        id: data.connectionId,
        slot,
        label: label || data.label,
        status: 'connected',
        serverVersion: data.serverVersion,
        hosts: data.hosts,
        isAtlas: data.isAtlas,
        pingMs: data.pingMs,
        databaseCount: data.databaseCount,
        totalSize: data.totalSize,
        sanitizedUri: data.sanitizedUri || maskUri(finalUri),
        connectedAt: new Date().toISOString(),
      });

      addLog({
        level: 'success',
        message: `Successfully connected to ${slot.toUpperCase()} MongoDB (v${data.serverVersion || 'unknown'})`,
        details: { hosts: data.hosts, pingMs: data.pingMs },
      });

      toast.success(`Connected to ${slot.toUpperCase()} MongoDB`);
      closeModal();
    } catch (err: any) {
      const msg = err.message || 'Connection failed';
      setError(msg);
      addLog({
        level: 'error',
        message: `Failed to connect to ${slot.toUpperCase()} MongoDB: ${msg}`,
      });
      toast.error(`Connection failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-md rounded-xl bg-[#121216] border border-white/[0.08] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 bg-[#16161c] border-b border-white/[0.07] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/[0.08] flex items-center justify-center">
              <Database className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Connect {slot === 'source' ? 'Source' : 'Target'} MongoDB
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

        {/* Tab Toggle: URI or Form */}
        <div className="px-4 pt-3.5">
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-white/[0.07] text-xs">
            <button
              type="button"
              onClick={() => setMode('uri')}
              className={`flex-1 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors text-center ${
                mode === 'uri'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Connection URI
            </button>
            <button
              type="button"
              onClick={() => setMode('form')}
              className={`flex-1 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors text-center ${
                mode === 'form'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Connection Form
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConnect} className="p-4 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="font-mono text-[11px] break-words">{error}</div>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
              Display Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production Cluster or Local Docker"
              className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {mode === 'uri' ? (
            <div>
              <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
                MongoDB Connection String
              </label>
              <textarea
                rows={3}
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="mongodb://localhost:27017 or mongodb+srv://..."
                className="w-full p-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-[11px] leading-relaxed resize-none transition-colors"
              />
              <span className="text-[10px] text-zinc-500 block mt-1">
                Credentials are kept strictly in local memory and never transmitted externally.
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
                    Host
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost"
                    className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
                    Port
                  </label>
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="27017"
                    className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
                    Username (optional)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1 text-[11px] uppercase tracking-wider">
                    Password (optional)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sslCheck"
                  checked={useSsl}
                  onChange={(e) => setUseSsl(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="sslCheck" className="text-zinc-300 cursor-pointer select-none">
                  Use TLS/SSL encryption
                </label>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-white/[0.07] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-zinc-950 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isLoading && <span className="w-3 h-3 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />}
              <span>{isLoading ? 'Connecting...' : 'Connect'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
