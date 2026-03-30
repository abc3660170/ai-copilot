<script setup lang="ts">
import type { Message } from '../types'

defineProps<{
  message: Message
}>()
</script>

<template>
  <div
    class="copilot-bubble"
    :class="[message.role, message.status]"
  >
    <!-- 头像 -->
    <div class="copilot-avatar" :class="message.role">
      <template v-if="message.role === 'user'">👤</template>
      <template v-else>🤖</template>
    </div>

    <!-- 内容 -->
    <div class="copilot-bubble-content">
      <div class="copilot-bubble-text" v-text="message.content" />
      <div v-if="message.status === 'streaming'" class="copilot-cursor" />
    </div>
  </div>
</template>

<style scoped>
.copilot-bubble {
  display: flex;
  gap: 8px;
  max-width: 100%;
}

.copilot-bubble.user {
  flex-direction: row-reverse;
}

.copilot-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.copilot-avatar.user {
  background: #ede9fe;
}

.copilot-avatar.assistant {
  background: #e0f2fe;
}

.copilot-bubble-content {
  max-width: calc(100% - 44px);
  position: relative;
}

.copilot-bubble-text {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.copilot-bubble.user .copilot-bubble-text {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border-bottom-right-radius: 4px;
}

.copilot-bubble.assistant .copilot-bubble-text {
  background: #f3f4f6;
  color: #1f2937;
  border-bottom-left-radius: 4px;
}

.copilot-bubble.error .copilot-bubble-text {
  background: #fef2f2;
  color: #dc2626;
}

/* 打字光标 */
.copilot-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: #6366f1;
  animation: blink-cursor 0.8s step-end infinite;
  position: absolute;
  bottom: 12px;
  margin-left: 2px;
}

@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
