import type {
  CopilotConfig,
  CopilotEventMap,
  CopilotStatus,
  Message,
  StreamChunk,
} from './types'

type EventHandler<T> = (payload: T) => void

/**
 * Copilot 核心类
 * 管理对话、流式响应和事件
 */
export class CopilotCore {
  private config: CopilotConfig
  private _messages: Message[] = []
  private _status: CopilotStatus = 'idle'
  private abortController: AbortController | null = null
  private listeners = new Map<string, Set<EventHandler<unknown>>>()

  constructor(config: CopilotConfig) {
    this.config = config
  }

  /** 当前消息列表 */
  get messages(): readonly Message[] {
    return this._messages
  }

  /** 当前状态 */
  get status(): CopilotStatus {
    return this._status
  }

  /** 更新配置 */
  updateConfig(config: Partial<CopilotConfig>) {
    this.config = { ...this.config, ...config }
  }

  /** 监听事件 */
  on<K extends keyof CopilotEventMap>(
    event: K,
    handler: EventHandler<CopilotEventMap[K]>,
  ) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>)
    return () => this.off(event, handler)
  }

  /** 取消监听 */
  off<K extends keyof CopilotEventMap>(
    event: K,
    handler: EventHandler<CopilotEventMap[K]>,
  ) {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>)
  }

  private emit<K extends keyof CopilotEventMap>(
    event: K,
    payload: CopilotEventMap[K],
  ) {
    this.listeners.get(event)?.forEach((handler) => handler(payload))
  }

  private setStatus(status: CopilotStatus) {
    this._status = status
    this.emit('status-change', status)
  }

  private createId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /** 发送消息并获取 AI 回复 */
  async send(content: string): Promise<void> {
    if (this._status === 'thinking' || this._status === 'streaming') {
      return
    }

    // 添加用户消息
    const userMessage: Message = {
      id: this.createId(),
      role: 'user',
      content,
      status: 'done',
      timestamp: Date.now(),
    }
    this._messages = [...this._messages, userMessage]
    this.emit('message-add', userMessage)

    // 创建 assistant 消息占位
    const assistantMessage: Message = {
      id: this.createId(),
      role: 'assistant',
      content: '',
      status: 'pending',
      timestamp: Date.now(),
    }
    this._messages = [...this._messages, assistantMessage]
    this.emit('message-add', assistantMessage)

    // 开始请求
    this.setStatus('thinking')
    this.abortController = new AbortController()

    try {
      const stream = this.requestStream(this.abortController.signal)

      this.setStatus('streaming')
      assistantMessage.status = 'streaming'

      for await (const chunk of stream) {
        assistantMessage.content += chunk.content
        // 更新引用让 Vue 响应式生效
        this._messages = [...this._messages]
        this.emit('message-update', { ...assistantMessage })

        if (chunk.done) break
      }

      assistantMessage.status = 'done'
      this._messages = [...this._messages]
      this.emit('message-update', { ...assistantMessage })
      this.setStatus('idle')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        assistantMessage.status = 'done'
        assistantMessage.content += '\n\n[已停止]'
      } else {
        assistantMessage.status = 'error'
        assistantMessage.content = `请求失败: ${(err as Error).message}`
        this.emit('error', err as Error)
      }
      this._messages = [...this._messages]
      this.emit('message-update', { ...assistantMessage })
      this.setStatus('idle')
    } finally {
      this.abortController = null
    }
  }

  /** 停止当前生成 */
  stop() {
    this.abortController?.abort()
  }

  /** 清空对话 */
  clear() {
    this._messages = []
    this.setStatus('idle')
  }

  /** 调用 LLM API (OpenAI 兼容，流式) */
  private async *requestStream(
    signal: AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    const { baseURL, apiKey, model, temperature, maxTokens } = this.config.llm

    const messages = [
      ...(this.config.systemPrompt
        ? [{ role: 'system' as const, content: this.config.systemPrompt }]
        : []),
      ...this._messages
        .filter((m) => m.role !== 'system' && m.status !== 'error')
        .map((m) => ({ role: m.role, content: m.content })),
    ]

    // 去掉最后一条空的 assistant 消息
    if (
      messages.length > 0 &&
      messages[messages.length - 1].role === 'assistant' &&
      messages[messages.length - 1].content === ''
    ) {
      messages.pop()
    }

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { max_tokens: maxTokens }),
      }),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 错误 (${response.status}): ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        yield { content: '', done: true }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          yield { content: '', done: true }
          return
        }

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            yield { content: delta, done: false }
          }
        } catch {
          // 忽略解析失败的行
        }
      }
    }
  }
}
