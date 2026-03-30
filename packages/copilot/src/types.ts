/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 消息状态 */
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error'

/** 单条消息 */
export interface Message {
  id: string
  role: MessageRole
  content: string
  status: MessageStatus
  timestamp: number
}

/** Copilot 运行状态 */
export type CopilotStatus = 'idle' | 'thinking' | 'streaming' | 'error'

/** LLM 提供者配置 */
export interface LLMConfig {
  /** API 地址 (OpenAI 兼容) */
  baseURL: string
  /** API Key */
  apiKey: string
  /** 模型名称 */
  model: string
  /** 温度 */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
}

/** Copilot 配置 */
export interface CopilotConfig {
  /** LLM 配置 */
  llm: LLMConfig
  /** 系统提示词 */
  systemPrompt?: string
  /** 面板标题 */
  title?: string
  /** 占位文字 */
  placeholder?: string
}

/** 流式响应的增量块 */
export interface StreamChunk {
  content: string
  done: boolean
}

/** Copilot 事件映射 */
export interface CopilotEventMap {
  'status-change': CopilotStatus
  'message-add': Message
  'message-update': Message
  'error': Error
}
