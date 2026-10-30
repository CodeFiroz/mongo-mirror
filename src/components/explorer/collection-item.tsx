'use client';

import React, { useState } from 'react';
import { CollectionNode } from '@/types/explorer';
import { ConnectionSlot } from '@/types/connection';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { Table, MoreVertical, Download, Upload, Copy, Check, GripVertical, ArrowRightLeft } from 'lucide-react';
import { formatNumber, formatBytes } from '@/lib/utils';
import { toast } from 'sonner';

interface CollectionItemProps {
  slot: ConnectionSlot;
  databaseName: string;
  collection: CollectionNode;
}

export function CollectionItem({ slot, databaseName, collection }: CollectionItemProps) {
  const { openModal, sourceSelection, targetSelection, setSelection, sourceConnection, targetConnection } = useWorkspaceStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentSelection = slot === 'source' ? sourceSelection : targetSelection;
  const isSelected =
    currentSelection?.databaseName === databaseName &&
    currentSelection?.collectionName === collection.name;

  const oppositeSlot = slot === 'source' ? 'target' : 'source';
  const oppositeConnected = (oppositeSlot === 'source' ? sourceConnection : targetConnection)?.status === 'connected';

  const handleCopyNamespace = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ns = `${databaseName}.${collection.name}`;
    navigator.clipboard.writeText(ns);
    setCopied(true);
    toast.success(`Copied "${ns}"`);
    setTimeout(() => setCopied(false), 1500);
    setMenuOpen(false);
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    openModal('export', { slot, database: databaseName, collection: collection.name });
    setMenuOpen(false);
  };

  const handleImport = (e: React.MouseEvent) => {
    e.stopPropagation();
    openModal('import', { slot, database: databaseName, collection: collection.name });
    setMenuOpen(false);
  };

  const handleMigrate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!oppositeConnected) {
      toast.error(`Please connect the ${oppositeSlot.toUpperCase()} MongoDB instance first`);
      return;
    }
    openModal('migrate', {
      slot,
      database: databaseName,
      collection: collection.name,
      targetSlot: oppositeSlot,
      documentCount: collection.documentCount,
    });
    setMenuOpen(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    const payload = {
      type: 'collection',
      slot,
      database: databaseName,
      collection: collection.name,
      documentCount: collection.documentCount,
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() =>
        setSelection(slot, { slot, databaseName, collectionName: collection.name })
      }
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
      className={`group relative flex items-center justify-between py-1 px-2.5 rounded text-xs select-none transition-colors cursor-grab active:cursor-grabbing ${
        isSelected
          ? 'bg-emerald-500/10 text-emerald-300 font-medium border-l-2 border-emerald-400'
          : 'text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100'
      }`}
      title="Click to select, drag to copy into opposite workspace"
    >
      {/* Drag Grip Handle, Name and Icon */}
      <div className="flex items-center gap-1.5 min-w-0">
        <GripVertical className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        <Table className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0" />
        <span className="font-mono text-[12px] truncate">{collection.name}</span>
      </div>

      {/* Badges: Document Count and Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {collection.documentCount !== undefined && (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06] tabular-nums">
            {formatNumber(collection.documentCount)} docs
          </span>
        )}

        {collection.sizeBytes !== undefined && collection.sizeBytes > 0 && (
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums hidden group-hover:inline">
            {formatBytes(collection.sizeBytes)}
          </span>
        )}

        {/* Context Menu Button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Collection options"
          >
            <MoreVertical className="w-3 h-3" />
          </button>

          {/* Context Dropdown */}
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
                  onClick={handleMigrate}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 hover:text-emerald-300 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Migrate to {oppositeSlot === 'source' ? 'Source' : 'Target'}</span>
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={handleExport}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Export JSON / CSV</span>
                </button>
                <button
                  onClick={handleImport}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Import Data</span>
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={handleCopyNamespace}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
                  <span>Copy Namespace</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
