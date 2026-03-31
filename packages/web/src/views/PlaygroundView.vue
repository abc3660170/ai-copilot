<script setup lang="ts">
import { ref, reactive } from 'vue'
import { CopilotCore, CopilotPanel, SiriOrb } from 'copilot'
import type { CopilotConfig, CopilotStatus } from 'copilot'

const config = reactive<CopilotConfig>({
  llm: {
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-3.5-turbo',
  },
  systemPrompt: '你是一个友好的 AI 助手，简洁明了地回答问题。',
  title: 'AI Copilot',
  placeholder: '输入你的问题...',
})

const copilot = new CopilotCore(config)
const panelOpen = ref(true)
const debugStatus = ref<CopilotStatus>('idle')

function handleConfigSave() {
  copilot.updateConfig(config)
}
</script>

<template>
  <div class="playground-page">
    <h1>🚀 Copilot Playground</h1>
    <p class="subtitle">在这里配置并测试你的 AI Copilot 组件</p>

    <div class="config-card">
      <h2>⚙️ LLM 配置</h2>
      <div class="form-group">
        <label>API Base URL</label>
        <input v-model="config.llm.baseURL" type="text" placeholder="https://api.openai.com/v1" @change="handleConfigSave" />
      </div>
      <div class="form-group">
        <label>API Key</label>
        <input v-model="config.llm.apiKey" type="password" placeholder="sk-..." @change="handleConfigSave" />
      </div>
      <div class="form-group">
        <label>Model</label>
        <input v-model="config.llm.model" type="text" placeholder="gpt-3.5-turbo" @change="handleConfigSave" />
      </div>
      <div class="form-group">
        <label>System Prompt</label>
        <textarea v-model="config.systemPrompt" rows="3" placeholder="你是一个友好的 AI 助手..." @change="handleConfigSave" />
      </div>
    </div>

    <div class="config-card">
      <h2>🎨 面板配置</h2>
      <div class="form-group">
        <label>标题</label>
        <input v-model="config.title" type="text" placeholder="AI Copilot" />
      </div>
      <div class="form-group">
        <label>占位文字</label>
        <input v-model="config.placeholder" type="text" placeholder="输入你的问题..." />
      </div>
      <div class="form-row">
        <label>面板状态</label>
        <button class="toggle-btn" @click="panelOpen = !panelOpen">
          {{ panelOpen ? '关闭面板' : '打开面板' }}
        </button>
      </div>
    </div>

    <div class="tips-card">
      <h3>💡 使用说明</h3>
      <ul>
        <li>填入你的 LLM API 配置（支持 OpenAI 兼容接口）</li>
        <li>右下角的浮动面板就是 <code>CopilotPanel</code> 组件</li>
        <li>支持流式响应（SSE）</li>
        <li>可以通过 <code>Shift+Enter</code> 换行</li>
      </ul>
    </div>

    <div class="config-card debug-orb-card">
      <h2>🔮 SiriOrb 动画调试</h2>
      <div class="debug-orb-area">
        <SiriOrb :status="debugStatus" :size="100" />
      </div>
      <div class="debug-status-label">
        当前状态: <strong>{{ debugStatus }}</strong>
      </div>
      <div class="debug-btn-group">
        <button class="debug-btn idle" :class="{ active: debugStatus === 'idle' }" @click="debugStatus = 'idle'">💤 Idle</button>
        <button class="debug-btn thinking" :class="{ active: debugStatus === 'thinking' }" @click="debugStatus = 'thinking'">🤔 Thinking</button>
        <button class="debug-btn streaming" :class="{ active: debugStatus === 'streaming' }" @click="debugStatus = 'streaming'">⚡ Streaming</button>
        <button class="debug-btn error" :class="{ active: debugStatus === 'error' }" @click="debugStatus = 'error'">❌ Error</button>
      </div>
    </div>

    <!-- Copilot 面板 -->
    <CopilotPanel
      :core="copilot"
      :title="config.title"
      :placeholder="config.placeholder"
      v-model:open="panelOpen"
    />
  </div>
</template>

<style scoped>
.playground-page {
  max-width: 427px;
}

h1 {
  color: white;
  font-size: 2rem;
  margin: 0 0 8px;
}

.subtitle {
  color: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  margin: 0 0 32px;
}

.config-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.config-card h2 {
  font-size: 1.1rem;
  margin: 0 0 20px;
  color: #1f2937;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  color: #1f2937;
  background: #f9fafb;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  background: white;
}

.form-group textarea {
  resize: vertical;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-row label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}

.toggle-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.toggle-btn:hover {
  opacity: 0.9;
}

.tips-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  color: white;
  margin-bottom: 20px;
}

.tips-card h3 {
  margin: 0 0 12px;
  font-size: 1rem;
}

.tips-card ul {
  margin: 0;
  padding-left: 20px;
}

.tips-card li {
  margin-bottom: 6px;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
}

.tips-card code {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

/* SiriOrb 调试区域 */
.debug-orb-card {
  text-align: center;
}

.debug-orb-area {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 0;
  background: radial-gradient(circle, #1a1228 0%, #0d0a15 100%);
  border-radius: 12px;
  margin-bottom: 16px;
}

.debug-status-label {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 16px;
}

.debug-status-label strong {
  color: #8b5cf6;
  text-transform: uppercase;
}

.debug-btn-group {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.debug-btn {
  padding: 10px 20px;
  border-radius: 10px;
  border: 2px solid transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.debug-btn.idle { background: #f0f1ff; color: #6366f1; }
.debug-btn.idle.active, .debug-btn.idle:hover { background: #6366f1; color: white; border-color: #4f46e5; }
.debug-btn.thinking { background: #fff7ed; color: #f59e0b; }
.debug-btn.thinking.active, .debug-btn.thinking:hover { background: #f59e0b; color: white; border-color: #d97706; }
.debug-btn.streaming { background: #f0fdf4; color: #10b981; }
.debug-btn.streaming.active, .debug-btn.streaming:hover { background: #10b981; color: white; border-color: #059669; }
.debug-btn.error { background: #fef2f2; color: #ef4444; }
.debug-btn.error.active, .debug-btn.error:hover { background: #ef4444; color: white; border-color: #dc2626; }
</style>
