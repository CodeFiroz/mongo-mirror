'use client';

import React from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { WorkspaceLayout } from '@/components/layout/workspace-layout';
import { ConnectionDialog } from '@/components/connection/connection-dialog';
import { ExportDialog } from '@/components/operations/export-dialog';
import { ImportDialog } from '@/components/operations/import-dialog';
import { BackupDialog } from '@/components/operations/backup-dialog';
import { MigrateDialog } from '@/components/operations/migrate-dialog';
import { RestoreDialog } from '@/components/operations/restore-dialog';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

export default function Home() {
  useKeyboardShortcuts();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0f17] overflow-hidden">
      <AppHeader />
      <WorkspaceLayout />
      <ConnectionDialog />
      <ExportDialog />
      <ImportDialog />
      <BackupDialog />
      <RestoreDialog />
      <MigrateDialog />
    </div>
  );
}
