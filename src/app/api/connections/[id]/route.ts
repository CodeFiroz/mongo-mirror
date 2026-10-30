import { NextRequest, NextResponse } from 'next/server';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const closed = await ConnectionPoolManager.disconnect(id);

    if (!closed) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Connection closed successfully' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
