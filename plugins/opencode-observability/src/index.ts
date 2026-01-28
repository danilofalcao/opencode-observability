import type { Plugin } from '@opencode-ai/plugin';
import { sendEvent, generateSessionId } from './sender';

interface SessionState {
  sessionId: string;
  startTime: number;
  eventCount: number;
}

const sessions = new Map<string, SessionState>();

function getOrCreateSessionId(input: any): string {
  const sessionId = input.sessionID || input.session_id || input.sessionId;
  
  if (sessionId) {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        sessionId,
        startTime: Date.now(),
        eventCount: 0,
      });
    }
    return sessionId;
  }
  
  const newSessionId = generateSessionId();
  sessions.set(newSessionId, {
    sessionId: newSessionId,
    startTime: Date.now(),
    eventCount: 0,
  });
  return newSessionId;
}

function incrementEventCount(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    session.eventCount++;
  }
}

export const ObservabilityPlugin: Plugin = async ({ client, project }) => {
  const sourceApp = project?.name || 'opencode-project';

  return {
    'tool.execute.before': async (input, output) => {
      const sessionId = getOrCreateSessionId(input);
      incrementEventCount(sessionId);

      await sendEvent({
        source_app: sourceApp,
        session_id: sessionId,
        event_type: 'tool.execute.before',
        tool_name: input.tool,
        tool_input: output.args,
        payload: {
          tool: input.tool,
          args: output.args,
          worktree: input.worktree,
        },
      });
    },

    'tool.execute.after': async (input, result) => {
      const sessionId = getOrCreateSessionId(input);
      incrementEventCount(sessionId);

      await sendEvent({
        source_app: sourceApp,
        session_id: sessionId,
        event_type: 'tool.execute.after',
        tool_name: input.tool,
        tool_input: input.args,
        tool_output: result,
        payload: {
          tool: input.tool,
          args: input.args,
          result,
          duration: result?.duration,
        },
      });
    },

    'event': async ({ event }) => {
      const sessionId = (event as any).session_id || (event as any).sessionID || generateSessionId();

      switch (event.type) {
        case 'session.created':
          sessions.set(sessionId, {
            sessionId,
            startTime: Date.now(),
            eventCount: 0,
          });
          await sendEvent({
            source_app: sourceApp,
            session_id: sessionId,
            event_type: 'session.created',
            payload: event.properties,
          });
          break;

        case 'session.deleted':
          await sendEvent({
            source_app: sourceApp,
            session_id: sessionId,
            event_type: 'session.deleted',
            payload: event.properties,
          });
          sessions.delete(sessionId);
          break;

        case 'session.idle':
          await sendEvent({
            source_app: sourceApp,
            session_id: sessionId,
            event_type: 'session.idle',
            payload: event.properties,
          });
          break;

        case 'session.error':
          await sendEvent({
            source_app: sourceApp,
            session_id: sessionId,
            event_type: 'session.error',
            payload: event.properties,
          });
          break;

        case 'session.compacted':
          await sendEvent({
            source_app: sourceApp,
            session_id: sessionId,
            event_type: 'session.compacted',
            payload: event.properties,
          });
          break;

        case 'message.updated':
          await sendEvent({
            source_app: sourceApp,
            session_id: sessionId,
            event_type: 'message.updated',
            payload: event.properties,
          });
          break;

        case 'permission.replied':
          await sendEvent({
            source_app: sourceApp,
            session_id: sessionId,
            event_type: 'permission.replied',
            payload: event.properties,
          });
          break;
      }
    },

    'stop': async (input) => {
      const sessionId = getOrCreateSessionId(input);
      const session = sessions.get(sessionId);
      
      await sendEvent({
        source_app: sourceApp,
        session_id: sessionId,
        event_type: 'stop',
        payload: {
          reason: input.reason,
          eventCount: session?.eventCount || 0,
          duration: session ? Date.now() - session.startTime : 0,
        },
      });
    },
  };
};

export default ObservabilityPlugin;