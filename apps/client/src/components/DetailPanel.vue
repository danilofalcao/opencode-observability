<template>
  <div class="detail-panel" v-if="event">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="header-title">
        <span class="title-text">{{ getEventName(event) }}</span>
        <span class="status-dot" :class="getStatusClass(event)"></span>
        <span class="type-badge" :class="getBadgeClass(event)">{{ getBadgeLabel(event) }}</span>
        <span class="latency">LATENCY: {{ formatLatency(event) }}</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="panel-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span v-if="tab.icon" class="tab-icon" v-html="tab.icon"></span>
        {{ tab.label }}
      </button>
    </div>

    <!-- Panel Content -->
    <div class="panel-content">
      
      <!-- In/Out Tab -->
      <div v-if="activeTab === 'inout'" class="tab-content">
        <div v-if="hasInputOrOutput" class="inout-sections">
          <!-- Input Section -->
          <div v-if="event.toolInput" class="data-section">
            <div class="section-header">
              <span class="section-label">Input</span>
              <button class="copy-btn" @click="copyToClipboard(event.toolInput)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>
            <pre class="code-block"><code>{{ formatJson(event.toolInput) }}</code></pre>
          </div>

          <!-- Output Section -->
          <div v-if="event.toolOutput" class="data-section">
            <div class="section-header">
              <span class="section-label">Output</span>
              <button class="copy-btn" @click="copyToClipboard(event.toolOutput)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>
            <pre class="code-block"><code>{{ formatJson(event.toolOutput) }}</code></pre>
          </div>

          <!-- Message Content -->
          <div v-if="event.payload?.message" class="data-section">
            <div class="section-header">
              <span class="section-label">Message</span>
            </div>
            <div class="message-box">
              <div class="message-meta">
                <span class="message-role">{{ event.payload.message.role || 'assistant' }}</span>
              </div>
              <div class="message-content">{{ event.payload.message.content }}</div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <p>No input or output data available for this span</p>
        </div>
      </div>

      <!-- Attributes Tab -->
      <div v-if="activeTab === 'attributes'" class="tab-content">
        <div class="attributes-grid">
          <div class="attribute-item">
            <span class="attr-key">Event Type</span>
            <span class="attr-value">{{ event.eventType }}</span>
          </div>
          <div class="attribute-item">
            <span class="attr-key">Session ID</span>
            <span class="attr-value mono">{{ event.sessionId }}</span>
          </div>
          <div class="attribute-item">
            <span class="attr-key">Timestamp</span>
            <span class="attr-value">{{ formatTime(event.timestamp) }}</span>
          </div>
          <div v-if="event.toolName" class="attribute-item">
            <span class="attr-key">Tool Name</span>
            <span class="attr-value">{{ event.toolName }}</span>
          </div>
          <div v-if="event.summary" class="attribute-item">
            <span class="attr-key">Summary</span>
            <span class="attr-value">{{ event.summary }}</span>
          </div>
          
          <!-- Payload Attributes -->
          <template v-if="event.payload">
            <div v-for="(value, key) in flattenPayload(event.payload)" :key="key" class="attribute-item">
              <span class="attr-key">{{ key }}</span>
              <span class="attr-value" :class="{ mono: typeof value === 'string' && value.length > 20 }">
                {{ formatAttributeValue(value) }}
              </span>
            </div>
          </template>
        </div>
      </div>

      <!-- RAW Tab -->
      <div v-if="activeTab === 'raw'" class="tab-content">
        <div class="raw-section">
          <div class="section-header">
            <span class="section-label">Full Event JSON</span>
            <button class="copy-btn" @click="copyToClipboard(event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
          </div>
          <pre class="code-block raw"><code>{{ formatJson(event) }}</code></pre>
        </div>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-else class="detail-panel empty">
    <div class="empty-message">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      <p>Select an event to view details</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { EventRecord } from '../types'

interface Props {
  event: EventRecord | null
}

const props = defineProps<Props>()

const activeTab = ref('inout')

const tabs = [
  { id: 'inout', label: 'In/Out', icon: '⇄' },
  { id: 'attributes', label: 'Attributes', icon: '◈' },
  { id: 'raw', label: 'RAW', icon: '📄' },
]

const hasInputOrOutput = computed(() => {
  if (!props.event) return false
  return props.event.toolInput || props.event.toolOutput || props.event.payload?.message
})

const getEventName = (event: EventRecord) => {
  if (event.toolName) return event.toolName
  if (event.eventType.includes('message')) return 'Message'
  return event.eventType.split('.').pop() || 'Event'
}

const getStatusClass = (event: EventRecord) => {
  if (event.eventType.includes('error')) return 'status-error'
  if (event.eventType.includes('stop')) return 'status-warning'
  return 'status-success'
}

const getBadgeClass = (event: EventRecord) => {
  const type = event.eventType
  if (type.includes('llm') || type.includes('chat')) return 'badge-llm'
  if (type.includes('chain')) return 'badge-chain'
  if (type.includes('agent')) return 'badge-agent'
  if (type.includes('tool')) return 'badge-tool'
  if (type.includes('message')) return 'badge-message'
  return 'badge-unknown'
}

const getBadgeLabel = (event: EventRecord) => {
  const type = event.eventType
  if (type.includes('llm') || type.includes('chat')) return 'LLM'
  if (type.includes('chain')) return 'CHAIN'
  if (type.includes('agent')) return 'AGENT'
  if (type.includes('tool')) return 'TOOL'
  if (type.includes('message')) return 'MSG'
  return 'EVENT'
}

const formatLatency = (event: EventRecord) => {
  const payload = event.payload || {}
  const duration = payload.duration || payload.latency || 0
  if (duration === 0) return 'N/A'
  if (duration < 1000) return `${Math.round(duration)}ms`
  return `${(duration / 1000).toFixed(0)}s`
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

const formatJson = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

const flattenPayload = (obj: any, prefix = ''): Record<string, any> => {
  const result: Record<string, any> = {}
  
  for (const key in obj) {
    if (key === 'message' || key === 'toolInput' || key === 'toolOutput') continue
    
    const value = obj[key]
    const newKey = prefix ? `${prefix}.${key}` : key
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenPayload(value, newKey))
    } else {
      result[newKey] = value
    }
  }
  
  return result
}

const formatAttributeValue = (value: any): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') {
    if (value.length > 50) return value.substring(0, 50) + '...'
    return value
  }
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') return '{...}'
  return String(value)
}

const copyToClipboard = async (data: any) => {
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    await navigator.clipboard.writeText(text)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<style scoped>
.detail-panel {
  width: 450px;
  min-width: 350px;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
}

.detail-panel.empty {
  align-items: center;
  justify-content: center;
}

.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: 2rem;
}

.empty-message svg {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

.empty-message p {
  font-size: 0.875rem;
}

/* Panel Header */
.panel-header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.title-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.status-success {
  background: #10b981;
}

.status-dot.status-warning {
  background: #f59e0b;
}

.status-dot.status-error {
  background: #ef4444;
}

.type-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.badge-llm {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.badge-chain {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.badge-agent {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.badge-tool {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.badge-message {
  background: rgba(236, 72, 153, 0.15);
  color: #f472b6;
}

.badge-unknown {
  background: rgba(107, 114, 128, 0.15);
  color: #9ca3af;
}

.latency {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-family: 'JetBrains Mono', monospace;
}

/* Tabs */
.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  padding: 0 1rem;
  gap: 0.25rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--color-text-primary);
}

.tab-btn.active {
  color: var(--color-accent-light);
  border-bottom-color: var(--color-accent);
}

.tab-icon {
  font-size: 0.875rem;
}

/* Panel Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.tab-content {
  height: 100%;
}

/* Empty State */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
}

.empty-state p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

/* Data Sections */
.inout-sections {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.data-section {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.875rem;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--color-border);
}

.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.copy-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: var(--color-border);
  color: var(--color-text-primary);
}

.copy-btn svg {
  width: 14px;
  height: 14px;
}

.code-block {
  padding: 0.875rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: var(--color-text-primary);
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.code-block code {
  white-space: pre;
}

.code-block.raw {
  max-height: 400px;
}

/* Message Box */
.message-box {
  padding: 0.875rem;
}

.message-meta {
  margin-bottom: 0.5rem;
}

.message-role {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-accent-light);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.message-content {
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Attributes Grid */
.attributes-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attribute-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.625rem 0.875rem;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.attr-key {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.attr-value {
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  text-align: right;
  word-break: break-word;
}

.attr-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}

/* Raw Section */
.raw-section {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}
</style>
