import {
  DeepSeekAdapter,
  OpenAICompatibleAdapter,
  QwenAdapter,
} from '@/lib/llm/adapters';
import type { ChatMessage, GenerateOptions, LLMAdapter, ProviderConfig } from '@/lib/llm/types';
import { getDefaultConfig } from '@/lib/llm/service';

function mapProvider(provider?: string): ProviderConfig['provider'] {
  switch (provider) {
    case 'deepseek':
      return 'deepseek';
    case 'qwen':
      return 'qwen';
    default:
      return 'openai-compatible';
  }
}

export async function getDefaultLLMFromDb(): Promise<{
  adapter: LLMAdapter;
  model: string;
  options: GenerateOptions;
}> {
  const config = await getDefaultConfig();
  if (!config) {
    throw new Error('LLM 未配置：请在系统「LLM配置」中设置默认配置');
  }

  if (!config.apiKey) {
    throw new Error('LLM 未配置：默认配置缺少 API Key');
  }

  const provider = mapProvider(config.provider);
  const model = config.modelId || 'default';
  const temperature = config.defaultTemperature ? Number(config.defaultTemperature) : 0.3;
  const maxTokens = typeof config.maxTokens === 'number' ? config.maxTokens : 4096;

  if (provider === 'deepseek') {
    const adapter = new DeepSeekAdapter({
      provider: 'deepseek',
      apiKey: config.apiKey,
      baseUrl: config.apiEndpoint || undefined,
      defaultModel: model,
    });
    return { adapter, model, options: { temperature, maxTokens } };
  }

  if (provider === 'qwen') {
    const adapter = new QwenAdapter({
      provider: 'qwen',
      apiKey: config.apiKey,
      baseUrl: config.apiEndpoint || undefined,
      useOpenAICompatible: true,
      defaultModel: model,
    });
    return { adapter, model, options: { temperature, maxTokens } };
  }

  if (!config.apiEndpoint) {
    throw new Error('LLM 未配置：默认配置缺少 API Endpoint');
  }

  const adapter = new OpenAICompatibleAdapter({
    provider: 'openai-compatible',
    apiKey: config.apiKey,
    baseUrl: config.apiEndpoint,
    defaultModel: model,
  });

  return { adapter, model, options: { temperature, maxTokens } };
}

export async function generateWithDefaultLLM(
  messages: ChatMessage[],
  options?: GenerateOptions
) {
  const { adapter, model, options: baseOptions } = await getDefaultLLMFromDb();
  const result = await adapter.generate(messages, { model, ...baseOptions, ...(options || {}) });
  if (result.finishReason === 'error' || !result.content) {
    const extra = result.extra ? JSON.stringify(result.extra).slice(0, 800) : '';
    throw new Error(extra ? `LLM 调用失败: ${extra}` : 'LLM 调用失败');
  }
  return result;
}
