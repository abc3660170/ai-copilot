<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import type { Message, CopilotStatus } from '../types'
import { CopilotCore } from '../core'
import MessageBubble from './MessageBubble.vue'
import CopilotInput from './CopilotInput.vue'

const props = withDefaults(
  defineProps<{
    core: CopilotCore
    title?: string
    placeholder?: string
    open?: boolean
  }>(),
  {
    title: 'AI Copilot',
    placeholder: '输入你的问题...',
    open: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = ref(props.open)
const messages = ref<readonly Message[]>(props.core.messages)
const status = ref<CopilotStatus>(props.core.status)
const messagesContainer = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  (val) => (isOpen.value = val),
)

function togglePanel() {
  isOpen.value = !isOpen.value
  emit('update:open', isOpen.value)
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function handleSend(content: string) {
  await props.core.send(content)
}

function handleStop() {
  props.core.stop()
}

function handleClear() {
  props.core.clear()
  messages.value = props.core.messages
}

// 事件监听
let unsubStatus: (() => void) | null = null
let unsubAdd: (() => void) | null = null
let unsubUpdate: (() => void) | null = null

onMounted(() => {
  unsubStatus = props.core.on('status-change', (s) => {
    status.value = s
  })
  unsubAdd = props.core.on('message-add', () => {
    messages.value = props.core.messages
    scrollToBottom()
  })
  unsubUpdate = props.core.on('message-update', () => {
    messages.value = props.core.messages
    scrollToBottom()
  })
})

onUnmounted(() => {
  unsubStatus?.()
  unsubAdd?.()
  unsubUpdate?.()
})
</script>

<template>
  <div class="copilot-wrapper">
    <!-- 浮动按钮 -->
    <button
      v-if="!isOpen"
      class="copilot-fab"
      @click="togglePanel"
      aria-label="打开 AI 助手"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="currentColor" opacity="0.2"/>
        <path d="M12 6L12 18M18 12L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
        <path d="M9 9L15 9M9 12L13 12M9 15L11 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- 面板 -->
    <Transition name="copilot-slide">
      <div v-if="isOpen" class="copilot-panel">
        <!-- 头部 -->
        <div class="copilot-header">
          <div class="copilot-header-left">
            <div class="copilot-status-dot" :class="status" />
            <span class="copilot-title">{{ title }}</span>
          </div>
          <div class="copilot-header-actions">
            <button class="copilot-icon-btn" @click="handleClear" title="清空对话">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
            <button class="copilot-icon-btn" @click="togglePanel" title="关闭">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- 消息区域 -->
        <div ref="messagesContainer" class="copilot-messages">
          <div v-if="messages.length === 0" class="copilot-empty">
            <div class="copilot-empty-icon">✨</div>
            <p>Hi! 有什么可以帮你的吗？</p>
          </div>
          <MessageBubble
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
          />
          <div v-if="status === 'thinking'" class="copilot-thinking">
            <span class="copilot-dot-pulse" />
            <span>思考中...</span>
          </div>
        </div>

        <!-- 输入区域 -->
        <CopilotInput
          :status="status"
          :placeholder="placeholder"
          @send="handleSend"
          @stop="handleStop"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.copilot-wrapper {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 浮动按钮 */
.copilot-fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
}

.copilot-fab:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
}

/* 面板 */
.copilot-panel {
  width: 380px;
  height: 560px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 头部 */
.copilot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: linear-gradient(135deg, #f8f9ff, #f0f1ff);
}

.copilot-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copilot-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  transition: background 0.3s;
}

.copilot-status-dot.thinking,
.copilot-status-dot.streaming {
  background: #f59e0b;
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.copilot-status-dot.error {
  background: #ef4444;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.copilot-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.copilot-header-actions {
  display: flex;
  gap: 4px;
}

.copilot-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.copilot-icon-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

/* 消息区域 */
.copilot-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.copilot-messages::-webkit-scrollbar {
  width: 4px;
}

.copilot-messages::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}

/* 空状态 */
.copilot-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  gap: 8px;
}

.copilot-empty-icon {
  font-size: 32px;
}

.copilot-empty p {
  font-size: 14px;
  margin: 0;
}

/* 思考指示 */
.copilot-thinking {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 13px;
  padding: 4px 0;
}

.copilot-dot-pulse {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a78bfa;
  animation: dot-pulse 1.4s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
}

/* 过渡动画 */
.copilot-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.copilot-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.copilot-slide-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}

.copilot-slide-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}
</style>
