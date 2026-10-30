export type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';

export interface OperationLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  operationId?: string;
  connectionId?: string;
  message: string;
  details?: Record<string, unknown>;
}

export type LogFilter = 'ALL' | 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
