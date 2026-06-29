/**
 * 服务端 AI 配置解析工具
 * 优先级：页面配置 > 环境变量 > 友好错误提示
 */

export type ResolvedAiConfig = {
  apiKey: string;
  provider: 'openai' | 'deepseek' | 'anthropic';
  modelName: string;
  baseUrl: string;
};

/**
 * 解析 AI 调用配置
 * 1. 如果页面传了 apiKey，直接使用页面配置
 * 2. 否则尝试从环境变量读取（AI_API_KEY / AI_BASE_URL / AI_MODEL / AI_PROVIDER）
 * 3. 都没有则返回 null，调用方应返回错误响应
 */
export function resolveAiConfig(params: {
  apiKey?: string;
  provider?: string;
  modelName?: string;
  baseUrl?: string;
}): ResolvedAiConfig | null {
  const { apiKey, provider, modelName, baseUrl } = params;

  // 页面配置优先
  if (apiKey) {
    return {
      apiKey,
      provider: (provider as ResolvedAiConfig['provider']) || 'openai',
      modelName: modelName || '',
      baseUrl: baseUrl || '',
    };
  }

  // 环境变量回退
  const envApiKey = process.env.AI_API_KEY;
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      provider: (process.env.AI_PROVIDER as ResolvedAiConfig['provider']) || (provider as ResolvedAiConfig['provider']) || 'openai',
      modelName: process.env.AI_MODEL || modelName || '',
      baseUrl: process.env.AI_BASE_URL || baseUrl || '',
    };
  }

  // 都没有
  return null;
}

/**
 * 生成统一的「未配置 API Key」错误响应
 */
export function missingApiKeyResponse() {
  return new Response(
    JSON.stringify({
      error: '未配置 API Key。请在 Token 配置页（/token）填写 API Key，或在 .env 中设置 AI_API_KEY 环境变量。',
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * 解析 Notion 配置（页面优先，环境变量回退）
 */
export function resolveNotionConfig(params: {
  notionToken?: string;
  databaseId?: string;
}): { notionToken: string; databaseId?: string } | null {
  const { notionToken, databaseId } = params;

  if (notionToken) {
    return { notionToken, databaseId };
  }

  const envToken = process.env.NOTION_TOKEN;
  if (envToken) {
    return {
      notionToken: envToken,
      databaseId: databaseId || process.env.NOTION_DATABASE_ID,
    };
  }

  return null;
}

/**
 * 生成统一的「未配置 Notion Token」错误响应
 */
export function missingNotionTokenResponse() {
  return new Response(
    JSON.stringify({
      error: '未配置 Notion Token。请在 Token 配置页（/token）填写 Notion Integration Token，或在 .env 中设置 NOTION_TOKEN 环境变量。',
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
