/**
 * AI 配置解析工具
 * 优先级：前端 Token 配置页 > 系统环境变量
 */

export interface ResolvedAiConfig {
  apiKey: string;
  provider: string;
  modelName: string;
  baseUrl: string;
}

/**
 * 解析 AI 配置，按优先级回退：
 * 1. 前端 Token 配置页传入的值
 * 2. 系统环境变量（AI_API_KEY, AI_PROVIDER, AI_MODEL, AI_BASE_URL）
 *
 * 如果最终无法获取到 apiKey，返回 null 并在 error 中说明原因。
 */
export function resolveAiConfig(body: {
  apiKey?: string;
  provider?: string;
  modelName?: string;
  baseUrl?: string;
}): ResolvedAiConfig {
  const apiKey = (body.apiKey || process.env.AI_API_KEY || '').trim();
  const provider = (body.provider || process.env.AI_PROVIDER || 'openai').trim();
  const modelName = (body.modelName || process.env.AI_MODEL || '').trim();
  const baseUrl = (body.baseUrl || process.env.AI_BASE_URL || '').trim();

  return { apiKey, provider, modelName, baseUrl };
}

/**
 * 根据 provider 返回默认 model 名称
 */
export function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'deepseek':
      return 'deepseek-chat';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'openai':
    default:
      return 'gpt-4o-mini';
  }
}
