const SERVER_URL = process.env.OPENCODE_OBSERVABILITY_URL || 'http://localhost:4000';
const SOURCE_APP = process.env.OPENCODE_OBSERVABILITY_APP || 'opencode-project';

interface EventPayload {
  source_app: string;
  session_id: string;
  event_type: string;
  tool_name?: string;
  tool_input?: any;
  tool_output?: any;
  payload?: any;
}

export async function sendEvent(payload: EventPayload): Promise<void> {
  try {
    const response = await fetch(`${SERVER_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      console.error(`[Observability] Failed to send event: ${response.status}`);
    }
  } catch (error) {
    console.error('[Observability] Error sending event:', error);
  }
}

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}