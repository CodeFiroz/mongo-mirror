import { NextRequest, NextResponse } from 'next/server';
import { ExplorerService } from '@/server/mongodb/explorer-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; db: string }> }
) {
  try {
    const { id, db } = await params;
    const dbName = decodeURIComponent(db);
    const collections = await ExplorerService.listCollections(id, dbName);

    return NextResponse.json({
      success: true,
      database: dbName,
      collections,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to list collections' },
      { status: 500 }
    );
  }
}
