/**
 * 统一LLM适配层
 * 
 * 支持多种部署方式：
 * - Coze云端API（默认）
 * - Ollama本地部署
 * - OpenAI兼容服务（vLLM、LocalAI、LM Studio等）
 * 
 * 使用方式：
 * 
 * 1. 使用默认适配器：
 * ```typescript
 * import { getLLM } from '@/lib/llm';
 * 
 * const llm = getLLM();
 * const result = await llm.generate([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 * 
 * 2. 流式生成：
 * ```typescript
 * for await (const chunk of llm.generateStream(messages)) {
 *   if (!chunk.done) {
 *     process.stdout.write(chunk.content);
 *   }
 * }
 * ```
 * 
 * 3. 切换提供商（通过环境变量）：
 * ```
 * LLM_PROVIDER=ollama
 * OLLAMA_BASE_URL=http://localhost:11434
 * OLLAMA_MODEL=llama3
 * ```
 * 
 * 4. 自动选择最佳适配器：
 * ```typescript
 * const llm = await getBestLLM();
 * ```
 */

// 类型导出
export * from './types';

// 适配器导出
export * from './adapters';

// 工厂和便捷函数导出
export {
  LLMFactory,
  getLLM,
  getLLMByProvider,
  getBestLLM,
  isLLMAvailable,
  extractForwardHeaders,
  createCozeAdapterWithHeaders,
} from './factory';
