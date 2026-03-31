export { CopilotCore } from './core'
export { default as CopilotPanel } from './components/CopilotPanel.vue'
export { default as MessageBubble } from './components/MessageBubble.vue'
export { default as CopilotInput } from './components/CopilotInput.vue'
export { default as SiriOrb } from './components/SiriOrb.vue'

export type {
  Message,
  MessageRole,
  MessageStatus,
  CopilotStatus,
  CopilotConfig,
  LLMConfig,
  StreamChunk,
  CopilotEventMap,
} from './types'

// Vue 插件
import type { App } from 'vue'
import CopilotPanel from './components/CopilotPanel.vue'

export const CopilotPlugin = {
  install(app: App) {
    app.component('CopilotPanel', CopilotPanel)
  },
}

export default CopilotPlugin
