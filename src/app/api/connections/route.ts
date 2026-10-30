import { NextRequest, NextResponse } from 'next/server';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import { z } from 'zod';

const ConnectSchema = z.object({
  slot: z.enum(['source', 'target']),
  uri: z.string().min(1, 'Connection URI is required'),
  label: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ConnectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const { slot, uri, label } = parsed.data;
    const record = await ConnectionPoolManager.connect(slot, uri, label);

    return NextResponse.json({
      success: true,
      connectionId: record.id,
      slot: record.slot,
      label: record.label,
      sanitizedUri: record.sanitizedUri,
      serverVersion: record.serverVersion,
      hosts: record.hosts,
      isAtlas: record.isAtlas,
      pingMs: record.pingMs,
    });
  } catch (err: any) {
    console.error('Connection error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to connect to MongoDB instance' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const connections = ConnectionPoolManager.getAllSanitized();
    return NextResponse.json({ connections });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to list connections' },
      { status: 500 }
    );
  }
}
