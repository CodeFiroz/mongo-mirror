'use client';

import { useEffect } from 'react';
import { useTerminalStore } from '@/stores/terminal-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function useKeyboardShortcuts() {
  const { toggleExpanded } = useTerminalStore();
  const { closeModal, activeModal } = useWorkspaceStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle operation terminal with Ctrl + `
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleExpanded();
      }

      // Close open modals with Escape
      if (e.key === 'Escape' && activeModal) {
        e.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleExpanded, closeModal, activeModal]);
}
