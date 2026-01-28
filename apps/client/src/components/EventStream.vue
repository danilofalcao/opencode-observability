<template>
  <div class="event-stream">
    <div class="stream-header">
      <span class="header-title">Agent Event Stream</span>
    </div>

    <div v-if="events.length === 0" class="empty-state">
      <p>No events to display</p>
    </div>

    <div v-else class="stream-list">
      <div
        v-for="event in events"
        :key="event.id"
        class="event-row"
        :class="{ selected: selectedEvent?.id === event.id }"
        :style="{ borderLeftColor: getSessionColor(event.sessionId) }"
        @click="selectEvent(event)"
      >
        <!-- Main Row Content -->
        <div class="row-content">
          <!-- Left: App Badge + Session + Event Type -->
          <div class="row-left">
            <div class="app-badge" :style="{ 
              borderColor: getSessionColor(event.sessionId),
              backgroundColor: getSessionColor(event.sessionId) + '15'
            }">
              {{ event.sourceApp }}
            </div>
            <span class="session-id">{{ formatSessionId(event.sessionId) }}</span>
            
            <div class="event-badge" :class="getEventBadgeClass(event.eventType)">
              {{ formatEventType(event.eventType) }}
            </div>
          </div>

          <!-- Center: Description -->
          <div class="row-center">
            <div v-if="event.toolName" class="description">
              <span class="tool-name">{{ event.toolName }}</span>
            </div>
            <div v-else-if="event.eventType === 'message.updated'" class="description">
              <span>{{ truncate(getMessageContent(event), 70) }}</span>
            </div>
            <div v-else class="description">
              <span>{{ formatEventType(event.eventType) }}</span>
            </div>
          </div>

          <!-- Right: Timestamp -->
          <div class="row-right">
            <span class="timestamp">{{ formatTime(event.timestamp) }}</span>
          </div>
        </div>

        <!-- Summary Box (if available) -->
        <div v-if="event.summary || event.toolInput || event.toolOutput" class="row-summary">
          <div class="summary-content">
            <svg class="summary-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span class="summary-text">
              <template v-if="event.summary">{{ event.summary }}</template>
              <template v-else-if="event.toolInput">
                {{ formatToolInputSummary(event.toolInput) }}
              </template>
              <template v-else-if="event.toolOutput">
                {{ getOutputSummary(event) }}
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { EventRecord } from '../types'

interface Props {
  events: EventRecord[]
  selectedEvent: EventRecord | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'select', event: EventRecord): void
}>()

const sessionColors = new Map<string, string>()
const colorPalette = [
  '#ff7b72', '#79c0ff', '#56d364', '#e3b341', '#d2a8ff',
  '#ffa657', '#7ee787', '#a5d6ff', '#ffdcd7', '#f778ba',
]
let colorIndex = 0

const getSessionColor = (sessionId: string) => {
  if (!sessionColors.has(sessionId)) {
    sessionColors.set(sessionId, colorPalette[colorIndex % colorPalette.length])
    colorIndex++
  }
  return sessionColors.get(sessionId)!
}

const formatSessionId = (id: string) => {
  if (!id) return 'unknown'
  const cleaned = id.replace(/^session-/, '').replace(/^sess-/, '')
  if (cleaned.length <= 12) return cleaned
  return cleaned.substring(0, 6) + '...' + cleaned.substring(cleaned.length - 4)
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

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

const getMessageContent = (event: EventRecord) => {
  return event.payload?.message?.content || event.payload?.content || ''
}

const formatToolInputSummary = (input: any) => {
  if (!input) return ''
  if (typeof input === 'string') return truncate(input, 100)
  if (input.file_path) return input.file_path
  if (input.path) return input.path
  if (input.query) return input.query
  return truncate(JSON.stringify(input), 100)
}

const getOutputSummary = (event: EventRecord) => {
  if (!event.toolOutput) return 'Completed'
  if (typeof event.toolOutput === 'string') return truncate(event.toolOutput, 100)
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

const selectEvent = (event: EventRecord) => {
  emit('select', event)
}
</script>

<style scoped>
.event-stream {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  overflow: hidden;
}

.stream-header {
  padding: 0.75rem 1.25rem;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  text-align: center;
}

.header-title {
  font-size: 1rem;
  font-weight: 600;
  color: #c9d1d9;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #6e7681;
  font-size: 0.9375rem;
}

.stream-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.event-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.375rem;
  background: #161b22;
  border-radius: 8px;
  border-left: 3px solid;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
}

.event-row:hover {
  background: #21262d;
}

.event-row.selected {
  background: rgba(31, 111, 235, 0.1);
  box-shadow: 0 0 0 1px rgba(31, 111, 235, 0.3);
}

.row-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  min-height: 44px;
}

/* Left Section */
.row-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.app-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #c9d1d9;
  border: 1.5px solid;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  color: #8b949e;
  background: #21262d;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

.event-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 20px;
  font-size: 0.625rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-pretool {
  background: rgba(31, 111, 235, 0.15);
  color: #58a6ff;
  border: 1px solid rgba(31, 111, 235, 0.3);
}

.badge-posttool {
  background: rgba(35, 134, 54, 0.15);
  color: #7ee787;
  border: 1px solid rgba(35, 134, 54, 0.3);
}

.badge-session {
  background: rgba(139, 148, 158, 0.15);
  color: #8b949e;
  border: 1px solid rgba(139, 148, 158, 0.3);
}

.badge-idle {
  background: rgba(227, 179, 65, 0.15);
  color: #e3b341;
  border: 1px solid rgba(227, 179, 65, 0.3);
}

.badge-error {
  background: rgba(218, 54, 51, 0.15);
  color: #ff7b72;
  border: 1px solid rgba(218, 54, 51, 0.3);
}

.badge-message {
  background: rgba(210, 168, 255, 0.15);
  color: #d2a8ff;
  border: 1px solid rgba(210, 168, 255, 0.3);
}

.badge-stop {
  background: rgba(218, 54, 51, 0.15);
  color: #ff7b72;
  border: 1px solid rgba(218, 54, 51, 0.3);
}

.badge-notification {
  background: rgba(227, 179, 65, 0.15);
  color: #e3b341;
  border: 1px solid rgba(227, 179, 65, 0.3);
}

.badge-default {
  background: rgba(110, 118, 129, 0.15);
  color: #6e7681;
  border: 1px solid rgba(110, 118, 129, 0.3);
}

/* Center Section */
.row-center {
  flex: 1;
  min-width: 0;
}

.description {
  font-size: 0.875rem;
  color: #c9d1d9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-name {
  font-family: 'JetBrains Mono', monospace;
  color: #79c0ff;
  font-weight: 500;
}

/* Right Section */
.row-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.timestamp {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #6e7681;
  white-space: nowrap;
}

/* Summary Box */
.row-summary {
  padding: 0.5rem 1rem;
  padding-left: 180px;
  background: rgba(13, 17, 23, 0.5);
  border-top: 1px solid #21262d;
}

.summary-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #21262d;
  border-radius: 6px;
  border-left: 2px solid #e3b341;
}

.summary-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #e3b341;
}

.summary-text {
  font-size: 0.8125rem;
  color: #c9d1d9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
