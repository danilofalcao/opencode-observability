#!/bin/bash

set -e

echo "🌍 Setting up GLOBAL OpenCode Observability plugin..."
echo "   This will track ALL OpenCode sessions across ALL projects"
echo ""

# Determine OS and config directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_DIR="$HOME/Library/Application Support/opencode"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
else
    # Default to ~/.config
    CONFIG_DIR="$HOME/.config/opencode"
fi

PLUGIN_DIR="$CONFIG_DIR/plugins"
mkdir -p "$PLUGIN_DIR"

echo "📁 Installing global plugin to: $PLUGIN_DIR"

cat > "$PLUGIN_DIR/opencode-observability.ts" << 'EOF'
import type { Plugin } from '@opencode-ai/plugin';

const SERVER_URL = process.env.OPENCODE_OBSERVABILITY_URL || 'http://localhost:4000';

interface EventPayload {
  source_app: string;
  session_id: string;
  event_type: string;
  tool_name?: string;
  tool_input?: any;
  tool_output?: any;
  payload?: any;
}

// Detect project name from directory
function detectProjectName(project: any): string {
  // Try to get from project object
  if (project?.name && project.name !== 'unknown') {
    return project.name;
  }
  
  // Try to get from directory
  if (project?.directory) {
    const parts = project.directory.split(/[\/\\]/);
    return parts[parts.length - 1] || 'unknown-project';
  }
  
  // Fallback to current working directory
  try {
    const cwd = process.cwd();
    const parts = cwd.split(/[\/\\]/);
    return parts[parts.length - 1] || 'unknown-project';
  } catch {
    return 'unknown-project';
  }
}

async function sendEvent(payload: EventPayload): Promise<void> {
  try {
    const response = await fetch(`${SERVER_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timestamp: Date.now() }),
    });

    if (!response.ok) {
      console.error(`[Observability] Failed to send event: ${response.status}`);
    }
  } catch (error) {
    // Silently fail - don't interrupt workflow
    // console.error('[Observability] Error:', error);
  }
}

function getSessionId(input: any): string {
  return input.sessionID || input.session_id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

export const ObservabilityPlugin: Plugin = async ({ project, client }) => {
  const sourceApp = detectProjectName(project);
  
  console.log(`[Observability] Plugin loaded for project: ${sourceApp}`);
  console.log(`[Observability] Sending events to: ${SERVER_URL}`);

  return {
    'tool.execute.before': async (input, output) => {
      await sendEvent({
        source_app: sourceApp,
        session_id: getSessionId(input),
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
      await sendEvent({
        source_app: sourceApp,
        session_id: getSessionId(input),
        event_type: 'tool.execute.after',
        tool_name: input.tool,
        tool_input: input.args,
        tool_output: result,
        payload: {
          tool: input.tool,
          args: input.args,
          result,
        },
      });
    },

    'event': async ({ event }) => {
      const sessionId = (event as any).session_id || (event as any).sessionID || getSessionId({});
      
      if (['session.created', 'session.idle', 'session.error', 'session.compacted', 'message.updated', 'permission.replied'].includes(event.type)) {
        await sendEvent({
          source_app: sourceApp,
          session_id: sessionId,
          event_type: event.type,
          payload: event.properties,
        });
      }
    },

    'stop': async (input) => {
      await sendEvent({
        source_app: sourceApp,
        session_id: getSessionId(input),
        event_type: 'stop',
        payload: {
          reason: input.reason,
        },
      });
    },
  };
};

export default ObservabilityPlugin;
EOF

echo "⚙️  Creating global package.json..."
mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_DIR/package.json" ]; then
cat > "$CONFIG_DIR/package.json" << 'EOF'
{
  "dependencies": {
    "@opencode-ai/plugin": "latest"
  }
}
EOF
fi

echo ""
echo "✅ Global plugin installed successfully!"
echo ""
echo "📍 Location: $PLUGIN_DIR/observability.ts"
echo ""
echo "📝 Important:"
echo "   1. Make sure the observability server is running:"
echo "      cd $(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd) && ./scripts/start-system.sh"
echo ""
echo "   2. OpenCode will now automatically load this plugin for ALL projects"
echo ""
echo "   3. Restart any running OpenCode sessions"
echo ""
echo "   4. Open dashboard: http://localhost:5173"
echo ""
echo "🔧 Environment variables (optional):"
echo "   OPENCODE_OBSERVABILITY_URL=http://localhost:4000"
echo ""
echo "🐛 Troubleshooting:"
echo "   - Check server is running: curl http://localhost:4000/health"
echo "   - Check plugin loaded: Look for '[Observability] Plugin loaded' in OpenCode output"
echo "   - Check events arriving: curl http://localhost:4000/events/recent"
echo "   - Check browser console for WebSocket errors"