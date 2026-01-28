declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface EventRecord {
  id: number
  timestamp: number
  sourceApp: string
  sessionId: string
  eventType: string
  toolName?: string
  toolInput?: any
  toolOutput?: any
  summary?: string
  chatTranscript?: any
  payload?: any
}

interface FilterOptions {
  sourceApps?: string[]
  sessionIds?: string[]
  eventTypes?: string[]
}