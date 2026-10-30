import { MongoClient } from 'mongodb';
import { sanitizeMongoUri } from './uri-sanitizer';
import { ConnectionSlot } from '@/types/connection';
import crypto from 'crypto';

export interface ServerConnectionRecord {
  id: string;
  slot: ConnectionSlot;
  label: string;
  client: MongoClient;
  rawUri: string;
  sanitizedUri: string;
  createdAt: Date;
  lastUsedAt: Date;
  serverVersion: string;
  hosts: string[];
  isAtlas: boolean;
  pingMs: number;
}

// Preserve connection map across Next.js dev server hot reloads
const globalForMongo = globalThis as unknown as {
  mongoConnectionPool?: Map<string, ServerConnectionRecord>;
};

const connectionPool =
  globalForMongo.mongoConnectionPool || new Map<string, ServerConnectionRecord>();

if (process.env.NODE_ENV !== 'production') {
  globalForMongo.mongoConnectionPool = connectionPool;
}

export class ConnectionPoolManager {
  /**
   * Connect to a MongoDB instance for a specific slot (source or target)
   */
  static async connect(slot: ConnectionSlot, uri: string, label?: string): Promise<ServerConnectionRecord> {
    // If there is an existing connection for this slot, disconnect it cleanly first
    for (const [id, conn] of connectionPool.entries()) {
      if (conn.slot === slot) {
        await this.disconnect(id);
      }
    }

    const client = new MongoClient(uri, {
      connectTimeoutMS: 6000,
      serverSelectionTimeoutMS: 6000,
    });

    const startTime = Date.now();
    await client.connect();

    // Verify connectivity and measure round-trip latency
    const pingStart = Date.now();
    const adminDb = client.db('admin');
    await adminDb.command({ ping: 1 });
    const pingMs = Date.now() - pingStart;

    // Fetch build info and topology
    let serverVersion = 'unknown';
    let hosts: string[] = [];
    try {
      const buildInfo = await adminDb.command({ buildInfo: 1 });
      serverVersion = buildInfo.version || 'unknown';
    } catch {
      // Fallback if buildInfo is restricted by user roles
    }

    const isAtlas = uri.includes('.mongodb.net') || uri.startsWith('mongodb+srv://');

    try {
      const isMaster = await adminDb.command({ isMaster: 1 });
      if (isMaster.hosts && Array.isArray(isMaster.hosts)) {
        hosts = isMaster.hosts;
      } else if (isMaster.me) {
        hosts = [isMaster.me];
      }
    } catch {
      // Ignore
    }

    const connectionId = crypto.randomUUID();
    const sanitizedUri = sanitizeMongoUri(uri);

    const record: ServerConnectionRecord = {
      id: connectionId,
      slot,
      label: label || (slot === 'source' ? 'Source MongoDB' : 'Target MongoDB'),
      client,
      rawUri: uri,
      sanitizedUri,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      serverVersion,
      hosts,
      isAtlas,
      pingMs,
    };

    connectionPool.set(connectionId, record);
    return record;
  }

  static getClient(connectionId: string): MongoClient {
    const record = connectionPool.get(connectionId);
    if (!record) {
      throw new Error(`Connection "${connectionId}" not found or has been closed.`);
    }
    record.lastUsedAt = new Date();
    return record.client;
  }

  static getConnection(connectionId: string): ServerConnectionRecord | undefined {
    const record = connectionPool.get(connectionId);
    if (record) {
      record.lastUsedAt = new Date();
    }
    return record;
  }

  static getConnectionBySlot(slot: ConnectionSlot): ServerConnectionRecord | undefined {
    for (const record of connectionPool.values()) {
      if (record.slot === slot) {
        record.lastUsedAt = new Date();
        return record;
      }
    }
    return undefined;
  }

  static getAllSanitized(): Array<Omit<ServerConnectionRecord, 'client' | 'rawUri'>> {
    return Array.from(connectionPool.values()).map(
      ({ id, slot, label, sanitizedUri, createdAt, lastUsedAt, serverVersion, hosts, isAtlas, pingMs }) => ({
        id,
        slot,
        label,
        sanitizedUri,
        createdAt,
        lastUsedAt,
        serverVersion,
        hosts,
        isAtlas,
        pingMs,
      })
    );
  }

  static async disconnect(connectionId: string): Promise<boolean> {
    const record = connectionPool.get(connectionId);
    if (record) {
      try {
        await record.client.close(true);
      } catch (err) {
        console.error(`Error closing MongoClient for connection ${connectionId}:`, err);
      }
      connectionPool.delete(connectionId);
      return true;
    }
    return false;
  }

  static async disconnectSlot(slot: ConnectionSlot): Promise<boolean> {
    for (const [id, conn] of connectionPool.entries()) {
      if (conn.slot === slot) {
        return await this.disconnect(id);
      }
    }
    return false;
  }
}
