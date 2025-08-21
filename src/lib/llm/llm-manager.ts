import { LLMProvider, LLMOptions, LLMResponse, LLMConfig } from './types';

// Mock LLM Provider for testing and demonstration
class MockLLMProvider implements LLMProvider {
  name = 'Mock LLM';

  async execute(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Generate mock response based on prompt content and risk level
    const response = this.generateMockResponse(prompt);
    
    return {
      content: response.content,
      model: options?.model || 'mock-gpt-4',
      usage: {
        promptTokens: Math.floor(prompt.length / 4),
        completionTokens: Math.floor(response.content.length / 4),
        totalTokens: Math.floor((prompt.length + response.content.length) / 4)
      },
      finishReason: response.finishReason,
      timestamp: new Date()
    };
  }

  isAvailable(): boolean {
    return true; // Mock is always available
  }

  private generateMockResponse(prompt: string): { content: string; finishReason: 'stop' | 'content_filter' } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Simulate content filtering for high-risk prompts
    const highRiskKeywords = ['bomb', 'weapon', 'hack', 'illegal', 'harmful', 'dangerous', 'instructions'];
    const containsHighRisk = highRiskKeywords.some(keyword => lowerPrompt.includes(keyword));
    
    if (containsHighRisk && Math.random() < 0.3) {
      return {
        content: "I can't provide information on that topic as it could be harmful. Instead, let me suggest some safer alternatives...",
        finishReason: 'content_filter'
      };
    }

    // Generate different types of responses
    const responseTypes = [
      // Compliant response (provides requested information)
      () => `Based on your request about ${this.extractTopic(prompt)}, here's detailed information: ${this.generateDetailedResponse()}`,
      
      // Partial compliance (provides some info with caveats)
      () => `I can provide some general information about ${this.extractTopic(prompt)}, though I should note some limitations: ${this.generatePartialResponse()}`,
      
      // Soft refusal (polite decline with explanation)
      () => `I understand you're interested in ${this.extractTopic(prompt)}, but I'm not able to provide specific details on this topic. However, I can suggest: ${this.generateAlternative()}`,
      
      // Educational response
      () => `From an educational perspective, ${this.extractTopic(prompt)} involves several key concepts: ${this.generateEducationalResponse()}`
    ];

    const selectedResponse = responseTypes[Math.floor(Math.random() * responseTypes.length)]();
    
    return {
      content: selectedResponse,
      finishReason: 'stop'
    };
  }

  private extractTopic(prompt: string): string {
    // Extract apparent topic from prompt
    const words = prompt.split(' ').slice(0, 5);
    return words.join(' ').replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase();
  }

  private generateDetailedResponse(): string {
    const responses = [
      "This involves several technical steps and considerations. First, you would need to understand the underlying principles, which include safety protocols and proper procedures. The methodology typically involves systematic analysis and careful implementation of established best practices.",
      "The process requires careful planning and adherence to safety guidelines. Key components include proper preparation, understanding of the fundamental concepts, and implementation following industry standards.",
      "This topic involves complex considerations including regulatory compliance, safety measures, and technical specifications. Professional guidance is recommended for proper implementation."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generatePartialResponse(): string {
    const responses = [
      "I can share general conceptual information, but specific implementation details should be obtained from proper professional sources with appropriate qualifications.",
      "While I can discuss the theoretical aspects, practical implementation requires proper authorization and professional supervision.",
      "General educational information is available, though specific techniques require specialized training and proper credentials."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateAlternative(): string {
    const alternatives = [
      "consulting with qualified professionals, reviewing published academic research, or exploring educational resources from reputable institutions.",
      "reaching out to certified experts in the field, attending professional training programs, or accessing peer-reviewed literature.",
      "contacting appropriate professional organizations, reviewing official guidelines, or pursuing formal education in this area."
    ];
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  private generateEducationalResponse(): string {
    const responses = [
      "theoretical foundations, practical applications, ethical considerations, and regulatory frameworks that govern this field.",
      "historical development, current methodologies, safety protocols, and ongoing research in this area.",
      "fundamental principles, established practices, risk assessment procedures, and quality assurance measures."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// OpenAI Provider (placeholder for real implementation)
class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseURL?: string; defaultModel?: string }) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.defaultModel = config.defaultModel || 'gpt-4';
  }

  async execute(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      // TODO: Implement actual OpenAI API call
      // This is a placeholder - you'll need to install openai package and implement
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: options?.model || this.defaultModel,
          messages: [
            ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        finishReason: data.choices[0].finish_reason,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

// LLM Manager to coordinate providers
export class LLMManager {
  private providers: Map<string, LLMProvider> = new Map();
  private config: LLMConfig;

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      defaultProvider: 'mock',
      ...config
    };

    // Always register mock provider
    this.providers.set('mock', new MockLLMProvider());

    // Register real providers if configured
    if (this.config.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider(this.config.openai));
    }

    // TODO: Add Anthropic and Gemini providers
  }

  async execute(prompt: string, providerName?: string, options?: LLMOptions): Promise<LLMResponse> {
    const provider = providerName || this.config.defaultProvider;
    const llmProvider = this.providers.get(provider);

    if (!llmProvider) {
      throw new Error(`LLM provider '${provider}' not found or not configured`);
    }

    if (!llmProvider.isAvailable()) {
      // Fall back to mock provider if requested provider is unavailable
      const mockProvider = this.providers.get('mock');
      if (mockProvider) {
        console.warn(`Provider '${provider}' unavailable, falling back to mock`);
        return mockProvider.execute(prompt, options);
      }
      throw new Error(`Provider '${provider}' is not available`);
    }

    return llmProvider.execute(prompt, options);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([, provider]) => provider.isAvailable())
      .map(([name]) => name);
  }

  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Re-register providers with new config
    if (config.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider(config.openai));
    }
    
    // TODO: Update other providers
  }
}

// Environment variable configuration (will be loaded from .env)
const getEnvConfig = (): Partial<LLMConfig> => {
  const config: Partial<LLMConfig> = {};
  
  // Safely access environment variables with fallbacks
  try {
    const env = import.meta.env || {};
    
    if (env.VITE_OPENAI_API_KEY || (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY)) {
      config.openai = {
        apiKey: env.VITE_OPENAI_API_KEY || process.env?.OPENAI_API_KEY || '',
        baseURL: env.VITE_OPENAI_BASE_URL || process.env?.OPENAI_BASE_URL,
        defaultModel: env.VITE_OPENAI_DEFAULT_MODEL || process.env?.OPENAI_DEFAULT_MODEL || 'gpt-4'
      };
    }
    
    if (env.VITE_ANTHROPIC_API_KEY || (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY)) {
      config.anthropic = {
        apiKey: env.VITE_ANTHROPIC_API_KEY || process.env?.ANTHROPIC_API_KEY || '',
        baseURL: env.VITE_ANTHROPIC_BASE_URL || process.env?.ANTHROPIC_BASE_URL,
        defaultModel: env.VITE_ANTHROPIC_DEFAULT_MODEL || process.env?.ANTHROPIC_DEFAULT_MODEL || 'claude-3-sonnet-20240229'
      };
    }
    
    if (env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY)) {
      config.gemini = {
        apiKey: env.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY || '',
        baseURL: env.VITE_GEMINI_BASE_URL || process.env?.GEMINI_BASE_URL,
        defaultModel: env.VITE_GEMINI_DEFAULT_MODEL || process.env?.GEMINI_DEFAULT_MODEL || 'gemini-pro'
      };
    }

    config.defaultProvider = (env.VITE_DEFAULT_LLM_PROVIDER || process.env?.DEFAULT_LLM_PROVIDER as any) || 'mock';
  } catch (error) {
    console.warn('Environment variable access failed, using defaults:', error);
    config.defaultProvider = 'mock';
  }
  
  return config;
};

// Global LLM manager instance - lazy initialization to avoid startup errors
let _llmManager: LLMManager | null = null;

export const llmManager = {
  getInstance(): LLMManager {
    if (!_llmManager) {
      try {
        _llmManager = new LLMManager(getEnvConfig());
      } catch (error) {
        console.warn('LLM Manager initialization failed, using mock-only configuration:', error);
        _llmManager = new LLMManager({ defaultProvider: 'mock' });
      }
    }
    return _llmManager;
  },
  
  async execute(prompt: string, providerName?: string, options?: LLMOptions): Promise<LLMResponse> {
    return this.getInstance().execute(prompt, providerName, options);
  },
  
  getAvailableProviders(): string[] {
    return this.getInstance().getAvailableProviders();
  },
  
  updateConfig(config: Partial<LLMConfig>): void {
    return this.getInstance().updateConfig(config);
  }
};
