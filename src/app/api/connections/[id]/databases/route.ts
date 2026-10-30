import { NextRequest, NextResponse } from 'next/server';
import { ExplorerService } from '@/server/mongodb/explorer-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { databases, totalSize } = await ExplorerService.listDatabases(id);

    return NextResponse.json({
      success: true,
      databases,
      totalSize,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to list databases' },
      { status: 500 }
    );
  }
}
