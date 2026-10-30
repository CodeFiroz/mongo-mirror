import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/server/operations/backup-service';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { connectionId, slot, database, collection, gzip } = body;

    if (!connectionId && slot) {
      const conn = ConnectionPoolManager.getConnectionBySlot(slot);
      if (conn) connectionId = conn.id;
    }

    if (!connectionId || !database) {
      return NextResponse.json(
        { error: 'connectionId (or valid slot) and database name are required' },
        { status: 400 }
      );
    }

    const result = await BackupService.createBackup({
      connectionId,
      database,
      collection: collection || undefined,
      gzip: gzip !== false,
    });

    return NextResponse.json({
      success: true,
      ...result,
      downloadUrl: `/api/operations/backup/download?id=${result.backupId}&file=${encodeURIComponent(result.filename)}`,
    });
  } catch (err: any) {
    console.error('Backup error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create database backup' },
      { status: 500 }
    );
  }
}
