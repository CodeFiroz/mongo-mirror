import { create } from 'zustand';
import { ConnectionInfo, ConnectionSlot } from '@/types/connection';
import { ExplorerSelection } from '@/types/explorer';

export type ModalType = 
  | 'connect-source' 
  | 'connect-target' 
  | 'export' 
  | 'import' 
  | 'backup' 
  | 'restore' 
  | 'migrate'
  | null;

export interface ModalContext {
  slot: ConnectionSlot;
  type?: 'collection' | 'database';
  database?: string;
  collection?: string;
  targetSlot?: ConnectionSlot;
  targetDatabase?: string;
  targetCollection?: string;
  documentCount?: number;
  collectionsCount?: number;
}

interface WorkspaceState {
  sourceConnection: ConnectionInfo | null;
  targetConnection: ConnectionInfo | null;
  activeModal: ModalType;
  modalContext: ModalContext | null;
  sourceSelection: ExplorerSelection | null;
  targetSelection: ExplorerSelection | null;
  splitRatio: number;

  setConnection: (slot: ConnectionSlot, info: ConnectionInfo | null) => void;
  openModal: (modal: ModalType, context?: ModalContext | null) => void;
  closeModal: () => void;
  setSelection: (slot: ConnectionSlot, selection: ExplorerSelection | null) => void;
  setSplitRatio: (ratio: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  sourceConnection: null,
  targetConnection: null,
  activeModal: null,
  modalContext: null,
  sourceSelection: null,
  targetSelection: null,
  splitRatio: 50,

  setConnection: (slot, info) =>
    set((state) => ({
      sourceConnection: slot === 'source' ? info : state.sourceConnection,
      targetConnection: slot === 'target' ? info : state.targetConnection,
    })),

  openModal: (activeModal, modalContext = null) =>
    set({ activeModal, modalContext }),

  closeModal: () =>
    set({ activeModal: null, modalContext: null }),

  setSelection: (slot, selection) =>
    set((state) => ({
      sourceSelection: slot === 'source' ? selection : state.sourceSelection,
      targetSelection: slot === 'target' ? selection : state.targetSelection,
    })),

  setSplitRatio: (splitRatio) => set({ splitRatio }),
}));
