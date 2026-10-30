export type ConnectionSlot = 'source' | 'target';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionInfo {
  id: string;
  slot: ConnectionSlot;
  label?: string;
  status: ConnectionStatus;
  serverVersion?: string;
  hosts?: string[];
  isAtlas?: boolean;
  pingMs?: number;
  databaseCount?: number;
  totalSize?: number;
  errorMessage?: string;
  connectedAt?: string;
  sanitizedUri?: string;
}

export interface ConnectPayload {
  slot: ConnectionSlot;
  uri: string;
  label?: string;
}
