import { NextRequest, NextResponse } from 'next/server';
import { MigrationService } from '@/server/operations/migration-service';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import { ConflictPolicy } from '@/server/operations/import-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let {
      mode = 'collection', // 'collection' | 'database'
      sourceConnectionId,
      sourceSlot,
      sourceDatabase,
      sourceCollection,
      targetConnectionId,
      targetSlot,
      targetDatabase,
      targetCollection,
      collections, // optional array of collections for database mode
      conflictPolicy = 'skip',
      dropFirst = false,
    } = body;

    // Resolve source connection ID
    if (!sourceConnectionId && sourceSlot) {
      const conn = ConnectionPoolManager.getConnectionBySlot(sourceSlot);
      if (conn) sourceConnectionId = conn.id;
    }

    // Resolve target connection ID
    if (!targetConnectionId && targetSlot) {
      const conn = ConnectionPoolManager.getConnectionBySlot(targetSlot);
      if (conn) targetConnectionId = conn.id;
    }

    if (!sourceConnectionId || !targetConnectionId) {
      return NextResponse.json(
        { error: 'Both Source and Target MongoDB instances must be connected for direct migration' },
        { status: 400 }
      );
    }

    if (!sourceDatabase || !targetDatabase) {
      return NextResponse.json(
        { error: 'Source and target database names are required' },
        { status: 400 }
      );
    }

    if (mode === 'database') {
      const stats = await MigrationService.migrateDatabase({
        sourceConnectionId,
        sourceDatabase,
        targetConnectionId,
        targetDatabase,
        collections,
        conflictPolicy: conflictPolicy as ConflictPolicy,
        dropFirst: Boolean(dropFirst),
      });

      return NextResponse.json({
        success: true,
        mode: 'database',
        stats,
      });
    }

    if (!sourceCollection || !targetCollection) {
      return NextResponse.json(
        { error: 'Source and target collection names are required for collection migration' },
        { status: 400 }
      );
    }

    const stats = await MigrationService.migrateCollection({
      sourceConnectionId,
      sourceDatabase,
      sourceCollection,
      targetConnectionId,
      targetDatabase,
      targetCollection,
      conflictPolicy: conflictPolicy as ConflictPolicy,
      dropFirst: Boolean(dropFirst),
    });

    return NextResponse.json({
      success: true,
      mode: 'collection',
      stats,
    });
  } catch (err: any) {
    console.error('Migration error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to migrate' },
      { status: 500 }
    );
  }
}
