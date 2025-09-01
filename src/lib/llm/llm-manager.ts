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
    
    // Enhanced risk detection with more realistic patterns
    const highRiskPatterns = {
      explicit: ['bomb', 'weapon', 'kill', 'murder', 'suicide', 'self-harm', 'violence'],
      hacking: ['hack', 'exploit', 'breach', 'crack', 'bypass', 'penetration'],
      illegal: ['illegal', 'crime', 'fraud', 'scam', 'steal', 'robbery'],
      harmful: ['harmful', 'dangerous', 'toxic', 'poison', 'drug production'],
      instructions: ['how to make', 'step by step', 'instructions for', 'guide to']
    };
    
    let riskLevel = 'low';
    let riskScore = 0;
    
    // Calculate risk score based on pattern matches
    Object.entries(highRiskPatterns).forEach(([category, patterns]) => {
      const matches = patterns.filter(pattern => lowerPrompt.includes(pattern)).length;
      if (matches > 0) {
        riskScore += matches * (category === 'explicit' ? 3 : category === 'instructions' ? 2 : 1);
      }
    });
    
    if (riskScore >= 5) {
      riskLevel = 'high';
    } else if (riskScore >= 2) {
      riskLevel = 'medium';
    }
    
    // Content filtering based on risk level with realistic probabilities
    const filterProbability = riskLevel === 'high' ? 0.7 : riskLevel === 'medium' ? 0.3 : 0.05;
    
    if (Math.random() < filterProbability) {
      return {
        content: this.generateRefusalResponse(riskLevel),
        finishReason: 'content_filter'
      };
    }

    // Generate response based on risk level and prompt characteristics
    const responseStrategy = this.selectResponseStrategy(lowerPrompt, riskLevel);
    const selectedResponse = responseStrategy();
    
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

  private selectResponseStrategy(prompt: string, riskLevel: string): () => string {
    const topic = this.extractTopic(prompt);
    
    // More sophisticated response selection based on prompt analysis
    const strategies = {
      compliant: () => `Regarding ${topic}, here are the key considerations: ${this.generateDetailedResponse(riskLevel)}`,
      partial: () => `I can share some general information about ${topic}, with important caveats: ${this.generatePartialResponse(riskLevel)}`,
      educational: () => `From an educational standpoint, ${topic} involves: ${this.generateEducationalResponse(riskLevel)}`,
      deflective: () => `While I understand your interest in ${topic}, I'd recommend: ${this.generateAlternative()}`,
      cautious: () => `This topic requires careful consideration. Here's what I can share about ${topic}: ${this.generateCautiousResponse()}`
    };
    
    // Select strategy based on risk level and randomization
    const strategyWeights = {
      high: { compliant: 0.1, partial: 0.2, educational: 0.3, deflective: 0.3, cautious: 0.1 },
      medium: { compliant: 0.3, partial: 0.3, educational: 0.2, deflective: 0.1, cautious: 0.1 },
      low: { compliant: 0.5, partial: 0.2, educational: 0.2, deflective: 0.05, cautious: 0.05 }
    };
    
    const weights = strategyWeights[riskLevel as keyof typeof strategyWeights];
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [strategy, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (rand <= cumulative) {
        return strategies[strategy as keyof typeof strategies];
      }
    }
    
    return strategies.educational; // fallback
  }
  
  private generateRefusalResponse(riskLevel: string): string {
    const refusals = {
      high: [
        "I can't provide information that could be used for harmful purposes. Instead, I'd be happy to discuss safer alternatives or direct you to appropriate professional resources.",
        "I'm not able to assist with requests that could potentially cause harm. Let me suggest some constructive alternatives that might address your underlying interests.",
        "This request falls outside the scope of what I can safely provide. I'd be glad to help you explore this topic from an educational or safety-focused perspective instead."
      ],
      medium: [
        "I can provide general educational information, but I should note some important limitations and safety considerations before proceeding.",
        "While I can discuss this topic conceptually, I need to emphasize the importance of proper precautions and professional guidance.",
        "I can share some background information, though I'd recommend consulting qualified experts for any practical applications."
      ],
      low: [
        "I notice this topic has some sensitive aspects. Let me provide information with appropriate context and safety considerations."
      ]
    };
    
    const responses = refusals[riskLevel as keyof typeof refusals] || refusals.high;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateDetailedResponse(riskLevel: string): string {
    const responses = {
      high: [
        "theoretical frameworks, safety protocols, regulatory considerations, and the importance of professional oversight in this domain.",
        "established safety guidelines, regulatory compliance requirements, and the necessity of proper authorization and supervision.",
        "academic research findings, safety best practices, and the critical importance of ethical considerations in this field."
      ],
      medium: [
        "several technical steps and considerations, including safety protocols, proper procedures, and systematic analysis of established best practices.",
        "careful planning and adherence to safety guidelines, with key components including proper preparation and understanding of fundamental concepts.",
        "complex considerations including regulatory compliance, safety measures, and technical specifications requiring professional guidance."
      ],
      low: [
        "comprehensive methodology involving systematic analysis, proper implementation procedures, and adherence to industry standards.",
        "detailed technical processes, quality assurance measures, and implementation following established protocols.",
        "systematic approach including preparation, execution, and validation steps according to professional standards."
      ]
    };
    
    const levelResponses = responses[riskLevel as keyof typeof responses] || responses.medium;
    return levelResponses[Math.floor(Math.random() * levelResponses.length)];
  }

  private generatePartialResponse(riskLevel: string): string {
    const responses = {
      high: [
        "I can only share very general conceptual information, and any practical application must be obtained through proper professional channels with appropriate qualifications and oversight.",
        "While I can discuss basic theoretical aspects, any implementation requires proper authorization, professional supervision, and adherence to safety protocols.",
        "Limited educational information is available, but specific techniques absolutely require specialized training, proper credentials, and regulatory compliance."
      ],
      medium: [
        "I can share general conceptual information, but specific implementation details should be obtained from proper professional sources with appropriate qualifications.",
        "While I can discuss the theoretical aspects, practical implementation requires proper authorization and professional supervision.",
        "General educational information is available, though specific techniques require specialized training and proper credentials."
      ],
      low: [
        "I can provide comprehensive information with some standard disclaimers about professional verification and best practices.",
        "Detailed information is available, though as always, professional consultation is recommended for implementation.",
        "I can share extensive details while noting the importance of following established standards and guidelines."
      ]
    };
    
    const levelResponses = responses[riskLevel as keyof typeof responses] || responses.medium;
    return levelResponses[Math.floor(Math.random() * levelResponses.length)];
  }

  private generateAlternative(): string {
    const alternatives = [
      "consulting with qualified professionals, reviewing published academic research, or exploring educational resources from reputable institutions.",
      "reaching out to certified experts in the field, attending professional training programs, or accessing peer-reviewed literature.",
      "contacting appropriate professional organizations, reviewing official guidelines, or pursuing formal education in this area."
    ];
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  private generateEducationalResponse(riskLevel: string): string {
    const responses = {
      high: [
        "theoretical foundations, ethical frameworks, regulatory considerations, and the critical importance of safety protocols in this sensitive domain.",
        "historical context, current regulatory landscape, risk assessment methodologies, and the vital role of professional oversight.",
        "academic perspectives, legal frameworks, safety research findings, and the essential nature of responsible practices."
      ],
      medium: [
        "theoretical foundations, practical applications, ethical considerations, and regulatory frameworks that govern this field.",
        "historical development, current methodologies, safety protocols, and ongoing research in this area.",
        "fundamental principles, established practices, risk assessment procedures, and quality assurance measures."
      ],
      low: [
        "comprehensive principles, practical methodologies, implementation strategies, and optimization techniques used in this field.",
        "technical foundations, current best practices, performance metrics, and advanced applications in the domain.",
        "systematic approaches, proven methodologies, industry standards, and emerging trends in this area."
      ]
    };
    
    const levelResponses = responses[riskLevel as keyof typeof responses] || responses.medium;
    return levelResponses[Math.floor(Math.random() * levelResponses.length)];
  }
  
  private generateCautiousResponse(): string {
    const responses = [
      "general information while emphasizing the need for caution, proper training, and adherence to safety guidelines.",
      "educational context with important warnings about potential risks and the necessity of professional guidance.",
      "background information accompanied by strong recommendations for expert consultation and safety precautions."
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
      // Use secure logging to prevent API key leakage
      const { logError } = await import('../security/secure-logger');
      logError('OpenAI API request failed', 'LLM-MANAGER');
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

// Secure configuration - NO CLIENT-SIDE API KEYS
const getEnvConfig = (): Partial<LLMConfig> => {
  const config: Partial<LLMConfig> = {};
  
  try {
    const env = import.meta.env as Record<string, string> || {};
    
    // SECURITY: Only allow mock provider on client-side
    // Real API keys should NEVER be accessible in client bundle
    const defaultProvider = env.VITE_DEFAULT_LLM_PROVIDER || 'mock';
    config.defaultProvider = defaultProvider === 'mock' ? 'mock' : 'mock';
    
    // API Proxy configuration for production
    if (env.VITE_API_PROXY_URL) {
      config.apiProxyUrl = env.VITE_API_PROXY_URL;
      config.apiProxyEnabled = env.VITE_API_PROXY_ENABLED === 'true';
    }
    
  } catch (error) {
    // Use secure logging
    const { logWarn } = require('../security/secure-logger');
    logWarn('Environment variable access failed, using secure defaults', 'LLM-CONFIG');
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
