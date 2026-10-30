'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Panel, Separator, type GroupImperativeHandle } from 'react-resizable-panels';
import { ConnectionPanel } from '@/components/connection/connection-panel';
import { TerminalPanel } from '@/components/terminal/terminal-panel';
import { useTerminalStore } from '@/stores/terminal-store';

export function WorkspaceLayout() {
  const { isExpanded, heightPercent, setHeightPercent } = useTerminalStore();
  const groupRef = useRef<GroupImperativeHandle>(null);

  // Sync heightPercent changes from presets to Group layout (enforcing minimum 300px)
  useEffect(() => {
    if (groupRef.current && isExpanded) {
      try {
        const totalHeight = typeof window !== 'undefined' ? window.innerHeight - 42 : 900;
        const minPercent = totalHeight > 0 ? (300 / totalHeight) * 100 : 35;
        const targetPercent = Math.max(minPercent, heightPercent);

        const topSize = Math.max(5, 100 - targetPercent);
        const bottomSize = Math.min(95, targetPercent);
        groupRef.current.setLayout({
          'workspace-panel': topSize,
          'terminal-panel': bottomSize,
        });
      } catch {
        // Layout handle not ready yet
      }
    }
  }, [heightPercent, isExpanded]);

  return (
    <div className="flex-1 w-full h-[calc(100vh-2.625rem)] overflow-hidden bg-[#09090b]">
      {isExpanded ? (
        <Group
          orientation="vertical"
          groupRef={groupRef}
          onLayoutChanged={(layout) => {
            const terminalSize = layout['terminal-panel'];
            if (terminalSize && typeof terminalSize === 'number') {
              setHeightPercent(Math.round(terminalSize));
            }
          }}
        >
          {/* Top Main Workspace (Dual Split Panels) */}
          <Panel id="workspace-panel" defaultSize={65} minSize={10}>
            <Group orientation="horizontal">
              <Panel defaultSize={50} minSize={20}>
                <ConnectionPanel slot="source" />
              </Panel>

              {/* Horizontal Separator */}
              <Separator className="w-1.5 bg-[#0f0f13] hover:bg-zinc-800 active:bg-zinc-700 transition-colors cursor-col-resize z-20 flex items-center justify-center group relative border-x border-white/[0.06] select-none">
                <div className="h-8 w-0.5 rounded-full bg-zinc-600 group-hover:bg-emerald-400 transition-colors" />
              </Separator>

              <Panel defaultSize={50} minSize={20}>
                <ConnectionPanel slot="target" />
              </Panel>
            </Group>
          </Panel>

          {/* Vertical Separator */}
          <Separator className="h-1.5 bg-[#0f0f13] hover:bg-zinc-800 active:bg-zinc-700 transition-colors cursor-row-resize z-20 flex items-center justify-center group relative border-y border-white/[0.06] select-none shrink-0">
            <div className="w-12 h-0.5 rounded-full bg-zinc-600 group-hover:bg-emerald-400 transition-colors" />
          </Separator>

          {/* Bottom Terminal Panel */}
          <Panel id="terminal-panel">
            <TerminalPanel />
          </Panel>
        </Group>
      ) : (
        <div className="h-full w-full flex flex-col">
          {/* Dual Split Panels */}
          <div className="flex-1 overflow-hidden">
            <Group orientation="horizontal">
              <Panel defaultSize={50} minSize={20}>
                <ConnectionPanel slot="source" />
              </Panel>

              <Separator className="w-1.5 bg-[#0f0f13] hover:bg-zinc-800 active:bg-zinc-700 transition-colors cursor-col-resize z-20 flex items-center justify-center group relative border-x border-white/[0.06] select-none">
                <div className="h-8 w-0.5 rounded-full bg-zinc-600 group-hover:bg-emerald-400 transition-colors" />
              </Separator>

              <Panel defaultSize={50} minSize={20}>
                <ConnectionPanel slot="target" />
              </Panel>
            </Group>
          </div>

          {/* Collapsed Terminal Bar */}
          <div className="shrink-0">
            <TerminalPanel />
          </div>
        </div>
      )}
    </div>
  );
}
