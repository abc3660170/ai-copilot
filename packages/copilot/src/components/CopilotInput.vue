<script setup lang="ts">
import { ref } from 'vue'
import type { CopilotStatus } from '../types'

const props = defineProps<{
  status: CopilotStatus
  placeholder?: string
}>()

const emit = defineEmits<{
  send: [content: string]
  stop: []
}>()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const isLoading = props.status === 'thinking' || props.status === 'streaming'

function handleSend() {
  const text = inputText.value.trim()
  if (!text || props.status === 'thinking' || props.status === 'streaming') return
  emit('send', text)
  inputText.value = ''
  // 重置 textarea 高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
}
</script>

<template>
  <div class="copilot-input-area">
    <div class="copilot-input-wrapper">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        :placeholder="placeholder || '输入你的问题...'"
        rows="1"
        class="copilot-textarea"
        @keydown="handleKeydown"
        @input="handleInput"
      />
      <button
        v-if="status === 'thinking' || status === 'streaming'"
        class="copilot-send-btn stop"
        @click="$emit('stop')"
        title="停止生成"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
      </button>
      <button
        v-else
        class="copilot-send-btn"
        :disabled="!inputText.trim()"
        @click="handleSend"
        title="发送"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.copilot-input-area {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.copilot-input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 8px 8px 8px 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.copilot-input-wrapper:focus-within {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.copilot-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-size: 13px;
  line-height: 1.5;
  font-family: inherit;
  color: #1f2937;
  background: transparent;
  max-height: 120px;
}

.copilot-textarea::placeholder {
  color: #9ca3af;
}

.copilot-send-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.2s, transform 0.1s;
}

.copilot-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.copilot-send-btn:not(:disabled):hover {
  transform: scale(1.05);
}

.copilot-send-btn:not(:disabled):active {
  transform: scale(0.95);
}

.copilot-send-btn.stop {
  background: #ef4444;
}
</style>
