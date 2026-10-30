'use client';

import React, { useState } from 'react';
import { DatabaseNode } from '@/types/explorer';
import { ConnectionSlot } from '@/types/connection';
import { DatabaseItem } from './database-item';
import { Search, FolderTree, RefreshCw, X } from 'lucide-react';

interface DatabaseTreeProps {
  slot: ConnectionSlot;
  databases: DatabaseNode[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onRefreshDatabase?: (dbName: string) => void;
}

export function DatabaseTree({
  slot,
  databases,
  isLoading,
  onRefresh,
  onRefreshDatabase,
}: DatabaseTreeProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter databases and collections
  const filteredDatabases = databases
    .map((db) => {
      const dbMatch = db.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (dbMatch) return db;

      const matchingColls = db.collections?.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (matchingColls && matchingColls.length > 0) {
        return {
          ...db,
          collections: matchingColls,
        };
      }
      return null;
    })
    .filter(Boolean) as DatabaseNode[];

  const totalCollections = databases.reduce(
    (acc, db) => acc + (db.collections?.length || 0),
    0
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none bg-[#0a0a0d]">
      {/* Explorer Search and Stats Bar */}
      <div className="h-8.5 px-3 border-b border-white/[0.06] flex items-center justify-between gap-2 bg-[#0e0e12]">
        <div className="relative flex-1 flex items-center">
          <Search className="w-3 h-3 absolute left-2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search databases or collections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-6 pl-6 pr-6 rounded bg-zinc-900 border border-white/[0.06] text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 font-mono"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono shrink-0">
          <span className="tabular-nums">{databases.length} DBs</span>
          <span>•</span>
          <span className="tabular-nums">{totalCollections} Colls</span>
        </div>
      </div>

      {/* Database Tree Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
        {isLoading ? (
          <div className="h-40 flex flex-col items-center justify-center text-zinc-500 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span className="text-xs">Loading database tree...</span>
          </div>
        ) : filteredDatabases.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-zinc-500 gap-1.5 text-xs">
            <FolderTree className="w-5 h-5 text-zinc-600" />
            <span>{searchTerm ? 'No matching databases found' : 'No databases accessible'}</span>
          </div>
        ) : (
          filteredDatabases.map((db) => (
            <DatabaseItem
              key={db.name}
              slot={slot}
              database={db}
              onRefreshDatabase={onRefreshDatabase}
            />
          ))
        )}
      </div>
    </div>
  );
}
