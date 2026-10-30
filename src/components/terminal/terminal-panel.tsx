'use client';

import React, { useEffect, useRef } from 'react';
import { TerminalControls } from './terminal-controls';
import { TerminalLogRow } from './terminal-log-row';
import { useTerminalStore } from '@/stores/terminal-store';

export function TerminalPanel() {
  const { logs, filter, searchQuery, autoScroll, setAutoScroll, isExpanded } = useTerminalStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter logs based on level and search query
  const filteredLogs = logs.filter((log) => {
    if (filter !== 'ALL' && log.level.toUpperCase() !== filter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchLevel = log.level.toLowerCase().includes(q);
      const matchOp = log.operationId?.toLowerCase().includes(q);
      return matchMsg || matchLevel || matchOp;
    }
    return true;
  });

  // Auto-scroll logic
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filteredLogs, autoScroll]);

  // Detect manual user scrolling
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 24;

    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  if (!isExpanded) {
    return (
      <div className="w-full bg-[#08080a] border-t border-white/[0.08]">
        <TerminalControls />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#070709] border-t border-white/[0.08] overflow-hidden select-text">
      {/* Terminal Toolbar */}
      <TerminalControls />

      {/* Log Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 text-xs italic select-none">
            {logs.length === 0 ? 'No console events recorded in this session' : 'No logs match active filters'}
          </div>
        ) : (
          filteredLogs.map((log) => <TerminalLogRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
