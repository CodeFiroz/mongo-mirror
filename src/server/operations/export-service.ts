import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import { EJSON } from 'bson';
import { Readable } from 'stream';

export interface ExportOptions {
  connectionId: string;
  database: string;
  collection: string;
  format: 'json' | 'ejson' | 'csv';
  limit?: number;
}

export class ExportService {
  /**
   * Stream collection data as JSON or CSV
   */
  static async exportCollection(options: ExportOptions): Promise<{ stream: Readable; filename: string; contentType: string }> {
    const { connectionId, database, collection, format, limit } = options;
    const client = ConnectionPoolManager.getClient(connectionId);
    const db = client.db(database);
    const coll = db.collection(collection);

    let cursor = coll.find({});
    if (limit && limit > 0) {
      cursor = cursor.limit(limit);
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const ext = format === 'csv' ? 'csv' : 'json';
    const filename = `${database}_${collection}_${timestamp}.${ext}`;
    const contentType = format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';

    if (format === 'csv') {
      const stream = this.createCsvStream(cursor);
      return { stream, filename, contentType };
    }

    const isEjson = format === 'ejson';
    const stream = this.createJsonStream(cursor, isEjson);
    return { stream, filename, contentType };
  }

  private static createJsonStream(cursor: any, isEjson: boolean): Readable {
    let isFirst = true;

    return new Readable({
      async read() {
        try {
          if (isFirst) {
            this.push('[\n');
            isFirst = false;
          }

          const doc = await cursor.next();
          if (doc === null) {
            this.push('\n]\n');
            this.push(null); // End of stream
            return;
          }

          const serialized = isEjson ? EJSON.stringify(doc, undefined, 2) : JSON.stringify(doc, undefined, 2);
          const chunk = (isFirst ? '' : ',\n') + '  ' + serialized.replace(/\n/g, '\n  ');
          this.push(chunk);
        } catch (err) {
          this.destroy(err as Error);
        }
      },
    });
  }

  private static createCsvStream(cursor: any): Readable {
    let headerSent = false;
    let headers: string[] = [];

    return new Readable({
      async read() {
        try {
          const doc = await cursor.next();
          if (doc === null) {
            if (!headerSent) {
              this.push('_id\n'); // Empty collection fallback
            }
            this.push(null);
            return;
          }

          if (!headerSent) {
            headers = Object.keys(doc);
            this.push(headers.map(ExportService.escapeCsv).join(',') + '\n');
            headerSent = true;
          }

          const row = headers.map((key) => {
            const val = doc[key];
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') {
              return ExportService.escapeCsv(JSON.stringify(val));
            }
            return ExportService.escapeCsv(String(val));
          });

          this.push(row.join(',') + '\n');
        } catch (err) {
          this.destroy(err as Error);
        }
      },
    });
  }

  private static escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
