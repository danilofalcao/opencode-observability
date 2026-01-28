import { DatabaseManager } from "./db";
import type { EventRecord, WebSocketMessage } from "./types";

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const db = new DatabaseManager();

const server = Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === "/health") {
      return jsonResponse({ status: "ok", timestamp: Date.now() });
    }

    if (pathname === "/events" && req.method === "POST") {
      return handlePostEvent(req);
    }

    if (pathname === "/events/recent" && req.method === "GET") {
      return handleGetRecentEvents(url);
    }

    if (pathname === "/events/filter-options" && req.method === "GET") {
      return handleGetFilterOptions();
    }

    if (pathname === "/events/summarize" && req.method === "POST") {
      return handleSummarize(req);
    }

    if (pathname === "/sessions/active" && req.method === "GET") {
      return handleGetActiveSessions();
    }

    if (pathname === "/stream") {
      const success = server.upgrade(req);
      if (success) {
        return undefined;
      }
      return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },

  websocket: {
    open(ws) {
      ws.subscribe("events");
      ws.send(JSON.stringify({ type: "connected" }));
    },
    message(ws, message) {
      try {
        const data = JSON.parse(message as string) as WebSocketMessage;
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        ws.send(JSON.stringify({ error: "Invalid message format" }));
      }
    },
    close(ws) {
      ws.unsubscribe("events");
    },
  },
});

async function handlePostEvent(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const event: EventRecord = {
      timestamp: Date.now(),
      sourceApp: body.source_app || body.sourceApp || "unknown",
      sessionId: body.session_id || body.sessionId || "default",
      eventType: body.event_type || body.eventType || "unknown",
      toolName: body.tool_name || body.toolName,
      toolInput: body.tool_input || body.toolInput,
      toolOutput: body.tool_output || body.toolOutput,
      summary: body.summary,
      chatTranscript: body.chat_transcript || body.chatTranscript,
      payload: body.payload,
    };

    const eventId = db.insertEvent(event);

    const message = JSON.stringify({
      type: "event",
      data: { ...event, id: eventId },
    });

    server.publish("events", message);

    return jsonResponse({ success: true, id: eventId }, 201);
  } catch (error) {
    console.error("Error handling event:", error);
    return jsonResponse({ error: "Invalid event data" }, 400);
  }
}

function handleGetRecentEvents(url: URL): Response {
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const sourceApp = url.searchParams.get("source_app") || undefined;
  const sessionId = url.searchParams.get("session_id") || undefined;
  const eventTypes = url.searchParams.get("event_types")?.split(",") || undefined;

  const events = db.getRecentEvents(limit, offset, {
    sourceApp,
    sessionId,
    eventTypes,
  });

  return jsonResponse({ events });
}

function handleGetFilterOptions(): Response {
  const options = db.getFilterOptions();
  return jsonResponse(options);
}

async function handleSummarize(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { eventId, summary } = body;

    if (!eventId || !summary) {
      return jsonResponse({ error: "Missing eventId or summary" }, 400);
    }

    db.updateSummary(eventId, summary);
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Error updating summary:", error);
    return jsonResponse({ error: "Failed to update summary" }, 500);
  }
}

function handleGetActiveSessions(): Response {
  const sessions = db.getActiveSessions();
  return jsonResponse({ sessions });
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

console.log(`🚀 Server running on http://localhost:${PORT}`);
console.log(`📊 WebSocket stream available at ws://localhost:${PORT}/stream`);

process.on("SIGINT", () => {
  console.log("\n👋 Shutting down server...");
  db.close();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  db.close();
  server.stop();
  process.exit(0);
});