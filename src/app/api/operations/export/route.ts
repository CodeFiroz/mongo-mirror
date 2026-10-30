import { NextRequest, NextResponse } from 'next/server';
import { ExportService } from '@/server/operations/export-service';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import { Readable } from 'stream';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let connectionId = searchParams.get('connectionId');
    const slot = searchParams.get('slot') as 'source' | 'target' | null;
    const database = searchParams.get('db') || searchParams.get('database');
    const collection = searchParams.get('collection') || searchParams.get('coll');
    const format = (searchParams.get('format') || 'json') as 'json' | 'ejson' | 'csv';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    if (!connectionId && slot) {
      const conn = ConnectionPoolManager.getConnectionBySlot(slot);
      if (conn) connectionId = conn.id;
    }

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId or valid slot is required' }, { status: 400 });
    }

    if (!database || !collection) {
      return NextResponse.json({ error: 'database and collection parameters are required' }, { status: 400 });
    }

    const { stream, filename, contentType } = await ExportService.exportCollection({
      connectionId,
      database,
      collection,
      format,
      limit,
    });

    // Convert Node Readable to Web ReadableStream
    const webStream = Readable.toWeb(stream);

    return new Response(webStream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err: any) {
    console.error('Export error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to export collection' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { connectionId, slot, database, collection, format, limit } = body;

    if (!connectionId && slot) {
      const conn = ConnectionPoolManager.getConnectionBySlot(slot);
      if (conn) connectionId = conn.id;
    }

    if (!connectionId || !database || !collection) {
      return NextResponse.json(
        { error: 'connectionId (or slot), database, and collection are required' },
        { status: 400 }
      );
    }

    const { stream, filename, contentType } = await ExportService.exportCollection({
      connectionId,
      database,
      collection,
      format: format || 'json',
      limit,
    });

    const webStream = Readable.toWeb(stream);

    return new Response(webStream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err: any) {
    console.error('Export POST error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to export collection' },
      { status: 500 }
    );
  }
}
