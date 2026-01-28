export interface EventRecord {
  id?: number;
  timestamp: number;
  sourceApp: string;
  sessionId: string;
  eventType: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  summary?: string;
  chatTranscript?: any;
  payload?: any;
}

export interface FilterOptions {
  sourceApp?: string;
  sessionId?: string;
  eventTypes?: string[];
  sourceApps?: string[];
  sessionIds?: string[];
}

export interface WebSocketMessage {
  type: 'event' | 'filterOptions' | 'ping' | 'pong';
  data?: any;
}

export type EventType = 
  | 'tool.execute.before'
  | 'tool.execute.after'
  | 'session.created'
  | 'session.deleted'
  | 'session.idle'
  | 'session.error'
  | 'session.compacted'
  | 'message.updated'
  | 'stop'
  | 'permission.replied'
  | 'notification';