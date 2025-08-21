// LLM provider abstraction types

export interface LLMProvider {
  name: string;
  execute(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  isAvailable(): boolean;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  timestamp: Date;
}

export interface LLMConfig {
  openai?: {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
  };
  anthropic?: {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
  };
  gemini?: {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
  };
  defaultProvider: 'openai' | 'anthropic' | 'gemini' | 'mock';
}
