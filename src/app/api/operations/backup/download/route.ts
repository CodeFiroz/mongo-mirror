import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/server/operations/backup-service';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const backupId = searchParams.get('id');
    const filename = searchParams.get('file');

    let safeFilename: string | null = null;
    let contentType = 'application/gzip';

    // 1. Check in-memory registry
    if (backupId) {
      const record = BackupService.getBackup(backupId);
      if (record) {
        safeFilename = path.basename(record.filename);
        contentType = record.contentType;
      }
    }

    // 2. Check query filename
    if (!safeFilename && filename) {
      safeFilename = path.basename(filename);
      contentType = safeFilename.endsWith('.json') ? 'application/json' : 'application/gzip';
    }

    if (!safeFilename) {
      return NextResponse.json({ error: 'Valid backup ID or filename required' }, { status: 400 });
    }

    const backupsDir = path.join(process.cwd(), 'data', 'backups');
    const resolvedPath = path.join(backupsDir, safeFilename);

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'Backup file not found or expired' }, { status: 404 });
    }

    const fileStream = fs.createReadStream(resolvedPath);
    const stat = fs.statSync(resolvedPath);

    return new Response(fileStream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Download failed' }, { status: 500 });
  }
}
