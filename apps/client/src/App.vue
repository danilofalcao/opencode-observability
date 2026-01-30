<template>
  <div class="observability-dashboard">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="header-left">
        <div class="logo">
          <img src="/logo.svg" alt="OpenCode Observability" class="logo-icon" />
          <span>OpenCode Observability</span>
        </div>
      </div>
      
      <div class="header-center">
        <div class="connection-pill" :class="{ connected: isConnected }">
          <span class="pulse-dot"></span>
          <span class="connection-text">{{ isConnected ? 'Live' : 'Offline' }}</span>
        </div>
      </div>
      
      <div class="header-right">
        <div class="stat-pill">
          <span class="stat-value">{{ filteredEvents.length }}</span>
          <span class="stat-label">events</span>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="dashboard-main">
      <!-- Filters Sidebar -->
      <aside class="filters-sidebar">
        <div class="filter-section">
          <h3>Filters</h3>
          
          <!-- Session filter removed due to duplicate ID issues -->
          
          <div class="filter-group">
            <label>Event Type</label>
            <div class="select-wrapper">
              <select v-model="selectedFilters.eventType" @change="handleFilterChange">
                <option value="">All Types</option>
                <option v-for="type in eventTypes" :key="type" :value="type">{{ formatEventType(type) }}</option>
              </select>
              <svg class="select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          
          <div class="filter-group">
            <label>Tool</label>
            <div class="select-wrapper">
              <select v-model="selectedFilters.toolName" @change="handleFilterChange">
                <option value="">All Tools</option>
                <option v-for="tool in toolNames" :key="tool" :value="tool">{{ tool }}</option>
              </select>
              <svg class="select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
        </div>

        <div class="quick-stats">
          <div class="stat-item">
            <span class="stat-dot success"></span>
            <span class="stat-name">Success</span>
            <span class="stat-count">{{ successCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot warning"></span>
            <span class="stat-name">Warnings</span>
            <span class="stat-count">{{ warningCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot error"></span>
            <span class="stat-name">Errors</span>
            <span class="stat-count">{{ errorCount }}</span>
          </div>
        </div>
      </aside>

      <!-- Event Feed -->
      <section class="event-feed">
        <!-- Live Pulse Chart -->
        <div class="pulse-chart-section">
          <LivePulseChart :events="filteredEvents" />
        </div>

        <div class="feed-header">
          <h2>Event Stream</h2>
          <div class="feed-actions">
            <button class="action-btn" title="Clear" @click="clearEvents">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="filteredEvents.length === 0" class="empty-state">
          <div class="empty-illustration">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <p>No events yet</p>
          <span>Waiting for observability data... </span>
        </div>

        <div v-else ref="eventsListRef" class="events-list">
          <transition-group name="event">
            <div
              v-for="event in filteredEvents.slice(0, 100)"
              :key="event.id"
              class="event-card"
              :class="{ selected: selectedEvent?.id === event.id }"
              @click="toggleEventExpand(event)"
            >
              <!-- Card Header -->
              <div class="card-header">
                <div class="header-badges">
                  <span class="app-badge" :style="{ 
                    backgroundColor: getSessionColor(event.sessionId) + '15',
                    color: getSessionColor(event.sessionId),
                    borderColor: getSessionColor(event.sessionId) + '30'
                  }">
                    {{ truncate(event.sourceApp, 12) }}
                  </span>
                  
                  <span class="session-badge">
                    {{ formatSessionId(event.sessionId) }}
                  </span>
                  
                  <span class="type-badge" :class="getEventBadgeClass(event.eventType)">
                    {{ formatEventType(event.eventType) }}
                  </span>
                </div>
                
                <div class="header-meta">
                  <span v-if="event.payload?.duration" class="duration-badge">
                    {{ formatDuration(event.payload.duration) }}
                  </span>
                  <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                  <span class="status-indicator" :class="getStatusClass(event)"></span>
                </div>
              </div>

              <!-- Card Body -->
              <div class="card-body">
                <!-- Tool Execution -->
                <div v-if="event.toolName" class="operation-detail">
                  <div class="operation-main">
                    <svg class="operation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                    <span class="operation-name">{{ event.toolName }}</span>
                  </div>
                  <div v-if="event.toolInput" class="operation-params">
                    {{ formatToolInputSummary(event.toolInput) }}
                  </div>
                </div>

                <!-- Message Update -->
                <div v-else-if="event.eventType === 'message.updated'" class="message-detail">
                  <div class="message-content">{{ truncate(event.payload?.message?.content || '', 200) }}</div>
                </div>

                <!-- Session Events -->
                <div v-else-if="event.eventType.includes('session')" class="session-detail">
                  <span class="session-action">{{ formatEventType(event.eventType) }}</span>
                  <span v-if="event.summary" class="session-info">{{ event.summary }}</span>
                </div>

                <!-- Other Events -->
                <div v-else class="operation-line">
                  <span>{{ formatEventType(event.eventType) }}</span>
                </div>
              </div>

              <!-- Card Footer - Always show details if available -->
              <div v-if="event.summary || event.toolOutput || event.toolInput || event.payload?.message?.role" class="card-footer">
                <div class="footer-content">
                  <svg class="detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                  </svg>
                  <span class="detail-text">
                    <template v-if="event.summary">{{ truncate(event.summary, 100) }}</template>
                    <template v-else-if="event.toolOutput">{{ truncate(getOutputSummary(event), 100) }}</template>
                    <template v-else-if="event.toolInput">{{ truncate(formatToolInputSummary(event.toolInput), 100) }}</template>
                    <template v-else-if="event.payload?.message?.role">Role: {{ event.payload.message.role }}</template>
                  </span>
                </div>
              </div>

              <!-- Expanded Detail View -->
              <div v-if="expandedEvents.has(event.id)" class="expanded-details" @click.stop>
                <div class="details-header">
                  <span>Full Details</span>
                  <button class="copy-btn" @click="copyEventJson(event)" title="Copy JSON">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
                <div class="details-content">
                  <div class="detail-row">
                    <span class="detail-label">Event ID</span>
                    <span class="detail-value mono">{{ event.id }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Timestamp</span>
                    <span class="detail-value">{{ new Date(event.timestamp).toLocaleString() }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Session</span>
                    <span class="detail-value mono">{{ event.sessionId }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Source App</span>
                    <span class="detail-value">{{ event.sourceApp }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Event Type</span>
                    <span class="detail-value">{{ event.eventType }}</span>
                  </div>
                  <div v-if="event.toolName" class="detail-row">
                    <span class="detail-label">Tool</span>
                    <span class="detail-value">{{ event.toolName }}</span>
                  </div>
                  <div v-if="event.toolInput" class="detail-section">
                    <span class="detail-label">Tool Input</span>
                    <pre class="json-block">{{ formatJson(event.toolInput) }}</pre>
                  </div>
                  <div v-if="event.toolOutput" class="detail-section">
                    <span class="detail-label">Tool Output</span>
                    <pre class="json-block">{{ formatJson(event.toolOutput) }}</pre>
                  </div>
                  <div v-if="event.payload" class="detail-section">
                    <span class="detail-label">Payload</span>
                    <pre class="json-block">{{ formatJson(event.payload) }}</pre>
                  </div>
                </div>
              </div>

              <!-- Expand/Collapse Indicator -->
              <div class="expand-indicator" :class="{ expanded: expandedEvents.has(event.id) }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
          </transition-group>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { EventRecord } from './types'
import LivePulseChart from './components/LivePulseChart.vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/stream'

const events = ref<EventRecord[]>([])
const selectedFilters = ref({
  sessionId: '',
  eventType: '',
  toolName: '',
})
const isConnected = ref(false)
const ws = ref<WebSocket | null>(null)
const selectedEvent = ref<EventRecord | null>(null)
const autoScroll = ref(true)
const expandedEvents = ref<Set<string>>(new Set())
const eventsListRef = ref<HTMLDivElement | null>(null)

const filteredEvents = computed(() => {
  return events.value.filter(event => {
    if (selectedFilters.value.sessionId && event.sessionId !== selectedFilters.value.sessionId) return false
    if (selectedFilters.value.eventType && event.eventType !== selectedFilters.value.eventType) return false
    if (selectedFilters.value.toolName && event.toolName !== selectedFilters.value.toolName) return false
    return true
  })
})

const sessionIds = computed(() => {
  const sessions = new Set(events.value.map(e => e.sessionId).filter(Boolean))
  return Array.from(sessions).sort()
})

const eventTypes = computed(() => {
  const types = new Set(events.value.map(e => e.eventType).filter(Boolean))
  return Array.from(types).sort()
})

const toolNames = computed(() => {
  const tools = new Set(events.value.map(e => e.toolName).filter(Boolean))
  return Array.from(tools).sort()
})

const successCount = computed(() => 
  filteredEvents.value.filter(e => !e.eventType.includes('error') && !e.eventType.includes('stop')).length
)
const warningCount = computed(() => 
  filteredEvents.value.filter(e => e.eventType.includes('stop')).length
)
const errorCount = computed(() => 
  filteredEvents.value.filter(e => e.eventType.includes('error')).length
)

const sessionColors = new Map<string, string>()
const colorPalette = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'
]
let colorIndex = 0

const getSessionColor = (sessionId: string) => {
  if (!sessionColors.has(sessionId)) {
    sessionColors.set(sessionId, colorPalette[colorIndex % colorPalette.length])
    colorIndex++
  }
  return sessionColors.get(sessionId)!
}

const connectWebSocket = () => {
  console.log('Connecting to WebSocket:', WS_URL)
  ws.value = new WebSocket(WS_URL)
  ws.value.onopen = () => { 
    console.log('WebSocket connected')
    isConnected.value = true 
  }
  ws.value.onmessage = (message) => {
    try {
      const data = JSON.parse(message.data)
      if (data.type === 'event') {
        events.value.unshift(data.data)
        if (events.value.length > 500) events.value.pop()
      }
    } catch (error) { console.error('Failed to parse message:', error) }
  }
  ws.value.onerror = (error) => {
    console.error('WebSocket error:', error)
  }
  ws.value.onclose = (event) => { 
    console.log('WebSocket closed:', event.code, event.reason)
    isConnected.value = false
    setTimeout(connectWebSocket, 3000)
  }
}

const loadInitialEvents = async () => {
  try {
    const response = await fetch(`${API_URL}/events/recent?limit=100`)
    const data = await response.json()
    events.value = data.events.reverse()
  } catch (error) { console.error('Failed to load events:', error) }
}

const handleFilterChange = () => {}
const selectEvent = (event: EventRecord) => { selectedEvent.value = event }
const clearEvents = () => { events.value = [] }

const toggleEventExpand = (event: EventRecord) => {
  if (expandedEvents.value.has(event.id)) {
    expandedEvents.value.delete(event.id)
  } else {
    expandedEvents.value.add(event.id)
  }
  selectedEvent.value = event
}

const formatJson = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

const copyEventJson = async (event: EventRecord) => {
  try {
    await navigator.clipboard.writeText(formatJson(event))
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const formatSessionId = (id: string) => {
  if (!id) return 'unknown'
  const cleaned = id.replace(/^session-/, '').replace(/^sess-/, '')
  return cleaned.substring(0, 8)
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

const formatEventType = (type: string) => {
  const names: Record<string, string> = {
    'tool.execute.before': 'PreToolUse',
    'tool.execute.after': 'PostToolUse',
    'session.created': 'SessionCreated',
    'session.idle': 'SessionIdle',
    'session.error': 'SessionError',
    'message.updated': 'MessageUpdated',
    'stop': 'Stop',
    'notification': 'Notification',
  }
  return names[type] || type.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const getEventBadgeClass = (eventType: string) => {
  const classes: Record<string, string> = {
    'tool.execute.before': 'badge-pretool',
    'tool.execute.after': 'badge-posttool',
    'session.created': 'badge-session',
    'session.idle': 'badge-idle',
    'session.error': 'badge-error',
    'message.updated': 'badge-message',
    'stop': 'badge-stop',
    'notification': 'badge-notification',
  }
  return classes[eventType] || 'badge-default'
}

const getStatusClass = (event: EventRecord) => {
  if (event.eventType.includes('error')) return 'status-error'
  if (event.eventType.includes('stop')) return 'status-warning'
  return 'status-success'
}

const formatToolInputSummary = (input: any) => {
  if (!input) return ''
  if (typeof input === 'string') return truncate(input, 80)
  if (input.file_path) return input.file_path
  if (input.path) return input.path
  return truncate(JSON.stringify(input), 80)
}

const getOutputSummary = (event: EventRecord) => {
  if (!event.toolOutput) return 'Completed'
  if (typeof event.toolOutput === 'string') return truncate(event.toolOutput, 80)
  if (event.toolOutput.success !== undefined) {
    return event.toolOutput.success ? 'Success' : 'Failed'
  }
  return 'Completed'
}

const truncate = (str: string, len: number) => {
  if (!str) return ''
  if (str.length <= len) return str
  return str.substring(0, len) + '...'
}

onMounted(() => { loadInitialEvents(); connectWebSocket() })
onUnmounted(() => ws.value?.close())
</script>

<style>
/* Design System */
:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-tertiary: #1a1a25;
  --bg-card: #161620;
  --border-color: #2a2a3a;
  --border-hover: #3a3a50;
  --text-primary: #f1f1f4;
  --text-secondary: #a1a1b0;
  --text-muted: #6b6b7b;
  --accent-indigo: #6366f1;
  --accent-violet: #8b5cf6;
  --accent-pink: #ec4899;
  --accent-rose: #f43f5e;
  --accent-orange: #f97316;
  --accent-amber: #eab308;
  --accent-green: #22c55e;
  --accent-cyan: #06b6d4;
  --accent-blue: #3b82f6;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4);
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  height: 100vh;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Dashboard Layout */
.observability-dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

/* Header */
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.logo svg {
  width: 28px;
  height: 28px;
  color: var(--accent-indigo);
}

.logo-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  vertical-align: middle;
  display: inline-block;
}

.header-center {
  display: flex;
  align-items: center;
}

.connection-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 100px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-muted);
  transition: all 0.2s;
}

.connection-pill.connected {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: var(--accent-green);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}

.connection-text {
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 100px;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Main Content */
.dashboard-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Sidebar */
.filters-sidebar {
  width: 260px;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.filter-section h3 {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
}

.filter-group {
  margin-bottom: 1.25rem;
}

.filter-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.select-wrapper {
  position: relative;
}

.select-wrapper select {
  width: 100%;
  padding: 0.625rem 2.5rem 0.625rem 0.875rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  appearance: none;
  transition: all 0.2s;
}

.select-wrapper select:hover {
  border-color: var(--border-hover);
}

.select-wrapper select:focus {
  outline: none;
  border-color: var(--accent-indigo);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.select-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}

/* Quick Stats */
.quick-stats {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0;
}

.stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.stat-dot.success { background: var(--accent-green); }
.stat-dot.warning { background: var(--accent-amber); }
.stat-dot.error { background: var(--accent-rose); }

.stat-name {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.stat-count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

/* Event Feed */
.event-feed {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.feed-header h2 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.feed-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.action-btn.active {
  background: var(--accent-indigo);
  border-color: var(--accent-indigo);
  color: white;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

/* Events List */
.events-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Event Card */
.event-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.event-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.event-card.selected {
  border-color: var(--accent-indigo);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15), var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 100px;
  font-size: 0.6875rem;
  font-weight: 600;
  border: 1px solid;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 100px;
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.duration-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 100px;
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(6, 182, 212, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.type-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 100px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.badge-pretool {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.badge-posttool {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.badge-session {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.badge-idle {
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.25);
}

.badge-error {
  background: rgba(244, 63, 94, 0.15);
  color: #fb7185;
  border: 1px solid rgba(244, 63, 94, 0.25);
}

.badge-message {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.25);
}

.badge-stop {
  background: rgba(244, 63, 94, 0.15);
  color: #fb7185;
  border: 1px solid rgba(244, 63, 94, 0.25);
}

.badge-notification {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.25);
}

.badge-default {
  background: rgba(107, 107, 123, 0.15);
  color: #6b6b7b;
  border: 1px solid rgba(107, 107, 123, 0.25);
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.event-time {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.status-success {
  background: var(--accent-green);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
}

.status-indicator.status-warning {
  background: var(--accent-amber);
  box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.2);
}

.status-indicator.status-error {
  background: var(--accent-rose);
  box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.2);
}

.card-body {
  margin-bottom: 0.75rem;
}

.operation-detail {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.operation-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.operation-icon {
  width: 16px;
  height: 16px;
  color: var(--accent-cyan);
  flex-shrink: 0;
}

.operation-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9375rem;
  color: var(--text-primary);
  font-weight: 500;
}

.operation-params {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
  padding-left: 1.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-detail {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.message-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.message-content {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.session-detail {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.session-action {
  font-size: 0.9375rem;
  color: var(--text-primary);
  font-weight: 500;
}

.session-info {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.operation-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.footer-content {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.detail-icon {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.detail-text {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* Expanded Details */
.expanded-details {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  animation: expandIn 0.2s ease;
}

@keyframes expandIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.details-header span {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.copy-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.copy-btn svg {
  width: 14px;
  height: 14px;
}

.details-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.detail-value {
  font-size: 0.8125rem;
  color: var(--text-primary);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
}

.detail-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.detail-section .detail-label {
  margin-bottom: 0.25rem;
}

.json-block {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: var(--text-secondary);
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.expand-indicator {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
  color: var(--text-muted);
  transition: all 0.2s;
}

.expand-indicator svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.expand-indicator.expanded svg {
  transform: rotate(180deg);
}

.event-card:hover .expand-indicator {
  color: var(--text-secondary);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  text-align: center;
}

.empty-illustration {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: 1rem;
}

.empty-illustration svg {
  width: 32px;
  height: 32px;
  color: var(--text-muted);
}

.empty-state p {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.empty-state span {
  font-size: 0.875rem;
  color: var(--text-muted);
}

/* Animations */
.event-enter-active,
.event-leave-active {
  transition: all 0.3s ease;
}

.event-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.event-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

/* Selection */
::selection {
  background: rgba(99, 102, 241, 0.3);
  color: var(--text-primary);
}

/* Pulse Chart Section */
.pulse-chart-section {
  margin: 1.5rem;
  background: transparent;
}
</style>
