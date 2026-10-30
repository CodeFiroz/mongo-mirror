import { create } from 'zustand';
import { OperationLog, LogFilter, LogLevel } from '@/types/terminal';

interface TerminalState {
  logs: OperationLog[];
  isExpanded: boolean;
  heightPercent: number;
  filter: LogFilter;
  searchQuery: string;
  autoScroll: boolean;
  addLog: (log: Omit<OperationLog, 'id' | 'timestamp'> & { timestamp?: string; id?: string }) => void;
  clearLogs: () => void;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  setHeightPercent: (percent: number) => void;
  setFilter: (filter: LogFilter) => void;
  setSearchQuery: (query: string) => void;
  setAutoScroll: (autoScroll: boolean) => void;
}

const INITIAL_LOGS: OperationLog[] = [
  {
    id: 'log-init-1',
    timestamp: new Date().toLocaleTimeString(),
    level: 'info',
    message: 'MongoMirror workspace initialized',
    details: { version: '1.0.0-beta' },
  },
  {
    id: 'log-init-2',
    timestamp: new Date().toLocaleTimeString(),
    level: 'info',
    message: 'Operation console ready. Awaiting connection to Source and Target MongoDB instances.',
  },
];

export const useTerminalStore = create<TerminalState>((set) => ({
  logs: INITIAL_LOGS,
  isExpanded: true,
  heightPercent: 35,
  filter: 'ALL',
  searchQuery: '',
  autoScroll: true,

  addLog: (log) =>
    set((state) => {
      const newEntry: OperationLog = {
        id: log.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: log.timestamp || new Date().toLocaleTimeString(),
        level: log.level,
        message: log.message,
        operationId: log.operationId,
        connectionId: log.connectionId,
        details: log.details,
      };
      // Keep up to 1000 logs in memory
      const updated = [...state.logs, newEntry];
      if (updated.length > 1000) updated.shift();
      return { logs: updated };
    }),

  clearLogs: () => set({ logs: [] }),

  setExpanded: (isExpanded) =>
    set((state) => ({
      isExpanded,
      heightPercent: isExpanded ? Math.max(35, state.heightPercent) : state.heightPercent,
    })),

  toggleExpanded: () =>
    set((state) => {
      const willExpand = !state.isExpanded;
      return {
        isExpanded: willExpand,
        heightPercent: willExpand ? Math.max(35, state.heightPercent) : state.heightPercent,
      };
    }),

  setHeightPercent: (heightPercent) => set({ heightPercent }),

  setFilter: (filter) => set({ filter }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setAutoScroll: (autoScroll) => set({ autoScroll }),
}));
