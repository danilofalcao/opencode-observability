<template>
  <div class="live-pulse-chart">
    <div class="chart-header">
      <div class="header-left">
        <span class="header-label">Live Activity</span>
        <span class="event-count">{{ eventsInRange.length }} events</span>
        <span class="active-sessions">{{ uniqueSessions.length }} active</span>
      </div>
      
      <div class="time-range">
        <button
          v-for="range in timeRanges"
          :key="range.value"
          type="button"
          :class="{ active: selectedRange === range.value }"
          @click="handleRangeClick(range.value)"
        >
          {{ range.label }}
        </button>
      </div>
    </div>
    
    <div class="timeline-container">
      <!-- Timeline track with bars -->
      <div class="timeline-track">
        <!-- Time range indicator -->
        <div class="time-range-display">
          <span class="range-label">{{ timeLabels.start }}</span>
          <span class="range-to">to</span>
          <span class="range-label now">Now</span>
        </div>
        
        <!-- Time axis line -->
        <div class="time-axis"></div>
        
        <!-- Session bars -->
        <div class="bars-container">
          <div
            v-for="(bar, index) in sessionBars"
            :key="bar.sessionId"
            class="session-bar"
            :style="bar.style"
            :title="bar.tooltip"
            @mouseenter="hoveredBar = bar"
            @mouseleave="hoveredBar = null"
          >
            <div class="bar-content" :style="{ backgroundColor: bar.color }"></div>
          </div>
        </div>
        
      </div>
      
      <!-- Tooltip -->
      <div 
        v-if="hoveredBar" 
        class="bar-tooltip"
        :style="tooltipPosition"
      >
        <div class="tooltip-content">
          <div class="tooltip-header">
            <span class="session-dot" :style="{ backgroundColor: hoveredBar.color }"></span>
            <span class="session-name">{{ formatSessionId(hoveredBar.sessionId) }}</span>
          </div>
          <div class="tooltip-stats">
            <span class="stat">{{ hoveredBar.eventCount }} events</span>
            <span class="duration">{{ formatDuration(hoveredBar.duration) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { EventRecord } from '../types'

interface Props {
  events: EventRecord[]
}

const props = defineProps<Props>()

const timeRanges = [
  { label: '1m', value: 60 * 1000 },
  { label: '3m', value: 3 * 60 * 1000 },
  { label: '5m', value: 5 * 60 * 1000 },
]
const selectedRange = ref(timeRanges[1].value)
const hoveredBar = ref<any>(null)

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

const formatSessionId = (id: string) => {
  if (!id) return 'unknown'
  return id.length > 8 ? id.substring(0, 8) + '...' : id
}

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m`
}

const now = ref(Date.now())
setInterval(() => { now.value = Date.now() }, 1000)

const handleRangeClick = (value: number) => {
  console.log('Button clicked with value:', value)
  selectedRange.value = value
  now.value = Date.now()
  console.log('Range set to:', selectedRange.value)
}

const timeLabels = computed(() => {
  const minutes = Math.round(selectedRange.value / 60000)
  return {
    start: `-${minutes}m`,
    end: 'now'
  }
})

const eventsInRange = computed(() => {
  const cutoff = now.value - selectedRange.value
  return props.events.filter(e => e.timestamp >= cutoff)
})

const uniqueSessions = computed(() => {
  const sessions = new Set(eventsInRange.value.map(e => e.sessionId))
  return Array.from(sessions).filter(Boolean)
})

const tooltipPosition = computed(() => {
  if (!hoveredBar.value) return {}
  const bar = hoveredBar.value
  const barRight = parseFloat(bar.style.left) + parseFloat(bar.style.width)
  
  // If bar is on the right side, show tooltip to the left
  if (barRight > 70) {
    return { right: `${100 - parseFloat(bar.style.left)}%`, top: '0' }
  }
  // Otherwise show to the right
  return { left: bar.style.left, top: '0' }
})

const sessionBars = computed(() => {
  const cutoff = now.value - selectedRange.value
  const sessionMap = new Map<string, { 
    events: EventRecord[]; 
    minTime: number; 
    maxTime: number;
  }>()
  
  // Group events by session
  eventsInRange.value.forEach(event => {
    if (!sessionMap.has(event.sessionId)) {
      sessionMap.set(event.sessionId, { 
        events: [], 
        minTime: event.timestamp, 
        maxTime: event.timestamp 
      })
    }
    const session = sessionMap.get(event.sessionId)!
    session.events.push(event)
    session.minTime = Math.min(session.minTime, event.timestamp)
    session.maxTime = Math.max(session.maxTime, event.timestamp)
  })
  
  // Convert to bars with positions - VERTICAL BARS
  return Array.from(sessionMap.entries())
    .sort((a, b) => a[1].minTime - b[1].minTime)
    .map(([sessionId, data], index) => {
      const startPos = ((data.minTime - cutoff) / selectedRange.value) * 100
      const endPos = ((data.maxTime - cutoff) / selectedRange.value) * 100
      const widthPx = Math.max(4, (endPos - startPos) * 0.6) // Minimum 4px width
      const heightPx = Math.min(48, 16 + data.events.length * 4) // Height based on event count
      
      return {
        sessionId,
        startTime: data.minTime,
        endTime: data.maxTime,
        eventCount: data.events.length,
        duration: data.maxTime - data.minTime,
        color: getSessionColor(sessionId),
        style: {
          left: `${Math.max(0, startPos)}%`,
          width: `${widthPx}px`,
          height: `${heightPx}px`,
          zIndex: hoveredBar.value?.sessionId === sessionId ? 100 : 10 + index
        },
        tooltip: `${formatSessionId(sessionId)}: ${data.events.length} events`
      }
    })
})

watch(() => props.events, () => {
  now.value = Date.now()
}, { deep: true })
</script>

<style scoped>
.live-pulse-chart {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1rem;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.event-count,
.active-sessions {
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 0.25rem 0.5rem;
  background: var(--bg-card);
  border-radius: 100px;
  border: 1px solid var(--border-color);
}

.time-range {
  display: flex;
  gap: 0.5rem;
  pointer-events: auto;
  z-index: 10;
  position: relative;
}

.time-range button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 40px;
  min-height: 32px;
  pointer-events: auto;
}

.time-range button:hover {
  background: var(--border-color);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.time-range button.active {
  background: var(--accent-indigo);
  color: white;
  border-color: var(--accent-indigo);
}

/* Timeline Container */
.timeline-container {
  position: relative;
  padding: 2rem 1rem 2.5rem;
  height: 120px;
  background: var(--bg-card);
}

.timeline-track {
  position: relative;
  height: 100%;
  width: 100%;
}

/* Time axis line */
.time-axis {
  position: absolute;
  bottom: 32px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    var(--border-color) 0%,
    var(--border-hover) 50%,
    var(--text-muted) 100%
  );
  border-radius: 1px;
}

/* Time range display */
.time-range-display {
  position: absolute;
  bottom: -28px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0.5rem;
  font-size: 0.75rem;
}

.range-label {
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.range-label.now {
  color: var(--accent-green);
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.1);
}

.range-to {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

/* Bars container */
.bars-container {
  position: absolute;
  bottom: 34px;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  align-items: flex-end;
}

/* Session bars - VERTICAL */
.session-bar {
  position: absolute;
  bottom: 0;
  border-radius: 4px 4px 2px 2px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.session-bar:hover {
  transform: translateY(-4px) scaleY(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 20px currentColor;
  filter: brightness(1.2);
}

.bar-content {
  width: 100%;
  height: 100%;
  border-radius: 4px 4px 2px 2px;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.session-bar:hover .bar-content {
  opacity: 1;
}

/* Tooltip */
.bar-tooltip {
  position: absolute;
  bottom: 100%;
  margin-bottom: 8px;
  z-index: 1000;
  animation: tooltip-in 0.15s ease;
  pointer-events: none;
}

@keyframes tooltip-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tooltip-content {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.625rem 0.875rem;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 140px;
  backdrop-filter: blur(8px);
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.session-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.tooltip-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding-top: 0.25rem;
  border-top: 1px solid var(--border-color);
}

.stat {
  font-weight: 500;
}

.duration {
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-muted);
}
</style>
