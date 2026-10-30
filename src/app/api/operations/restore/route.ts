import { NextRequest, NextResponse } from 'next/server';
import { RestoreService } from '@/server/operations/restore-service';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const backups = RestoreService.listAvailableBackups();
    return NextResponse.json({ success: true, backups });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list backups' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let connectionId = '';
    let slot: any = 'source';
    let targetDatabase = '';
    let sourceDatabase = '';
    let drop = false;
    let gzip = true;
    let stopOnError = false;
    let noIndexRestore = false;
    let archiveFilePath = '';
    let uploadedFileToDelete: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      slot = (formData.get('slot') as string) || 'source';
      connectionId = formData.get('connectionId') as string;
      targetDatabase = (formData.get('targetDatabase') as string) || '';
      sourceDatabase = (formData.get('sourceDatabase') as string) || '';
      drop = formData.get('drop') === 'true';
      gzip = formData.get('gzip') !== 'false';
      stopOnError = formData.get('stopOnError') === 'true';
      noIndexRestore = formData.get('noIndexRestore') === 'true';

      const existingFile = formData.get('existingFile') as string | null;

      if (file && file.size > 0) {
        // Save uploaded archive to uploads folder
        const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const safeFilename = `upload_${Date.now()}_${path.basename(file.name)}`;
        archiveFilePath = path.join(uploadsDir, safeFilename);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(archiveFilePath, buffer);
        uploadedFileToDelete = archiveFilePath;
      } else if (existingFile) {
        // Use an existing backup file from data/backups/
        const safeName = path.basename(existingFile);
        const candidate = path.join(process.cwd(), 'data', 'backups', safeName);
        if (!fs.existsSync(candidate)) {
          return NextResponse.json({ error: `Selected backup "${safeName}" not found` }, { status: 404 });
        }
        archiveFilePath = candidate;
      } else {
        return NextResponse.json(
          { error: 'Please upload a mongodump archive (.archive or .archive.gz) or select an existing backup' },
          { status: 400 }
        );
      }
    } else {
      // JSON body
      const body = await req.json();
      slot = body.slot || 'source';
      connectionId = body.connectionId;
      targetDatabase = body.targetDatabase || '';
      sourceDatabase = body.sourceDatabase || '';
      drop = Boolean(body.drop);
      gzip = body.gzip !== false;
      stopOnError = Boolean(body.stopOnError);
      noIndexRestore = Boolean(body.noIndexRestore);

      if (body.filePath) {
        archiveFilePath = body.filePath;
      } else if (body.existingFile) {
        archiveFilePath = path.join(process.cwd(), 'data', 'backups', path.basename(body.existingFile));
      } else {
        return NextResponse.json({ error: 'archiveFilePath or existingFile is required' }, { status: 400 });
      }
    }

    // Resolve connection ID if slot was passed
    if (!connectionId && slot) {
      const conn = ConnectionPoolManager.getConnectionBySlot(slot);
      if (conn) connectionId = conn.id;
    }

    if (!connectionId) {
      return NextResponse.json(
        { error: 'No active MongoDB connection found for this slot' },
        { status: 400 }
      );
    }

    try {
      const result = await RestoreService.restoreBackup({
        connectionId,
        archiveFilePath,
        targetDatabase: targetDatabase.trim() || undefined,
        sourceDatabase: sourceDatabase.trim() || undefined,
        drop,
        gzip,
        stopOnError,
        noIndexRestore,
      });

      return NextResponse.json({
        ...result,
      });
    } finally {
      // Clean up temporary uploaded file if needed
      if (uploadedFileToDelete) {
        const safeCleanupPath = path.join(process.cwd(), 'data', 'uploads', path.basename(uploadedFileToDelete));
        if (fs.existsSync(safeCleanupPath)) {
          try {
            fs.unlinkSync(safeCleanupPath);
          } catch {
            // ignore cleanup error
          }
        }
      }
    }
  } catch (err: any) {
    console.error('Restore error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to restore backup' },
      { status: 500 }
    );
  }
}
