import { NextRequest, NextResponse } from 'next/server';
import { ImportService, ConflictPolicy } from '@/server/operations/import-service';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    let connectionId = formData.get('connectionId') as string | null;
    const slot = formData.get('slot') as 'source' | 'target' | null;
    const database = formData.get('database') as string | null;
    const collection = formData.get('collection') as string | null;
    const conflictPolicy = (formData.get('conflictPolicy') as ConflictPolicy) || 'skip';
    const dropFirst = formData.get('dropFirst') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!connectionId && slot) {
      const conn = ConnectionPoolManager.getConnectionBySlot(slot);
      if (conn) connectionId = conn.id;
    }

    if (!connectionId) {
      return NextResponse.json({ error: 'Active connection ID or slot is required' }, { status: 400 });
    }

    if (!database || !collection) {
      return NextResponse.json({ error: 'Database and collection names are required' }, { status: 400 });
    }

    const fileContent = await file.text();
    const filename = file.name || 'import.json';

    const stats = await ImportService.importData({
      connectionId,
      database,
      collection,
      fileContent,
      filename,
      conflictPolicy,
      dropFirst,
    });

    return NextResponse.json({
      success: true,
      database,
      collection,
      filename,
      stats,
    });
  } catch (err: any) {
    console.error('Import error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to import data' },
      { status: 500 }
    );
  }
}
