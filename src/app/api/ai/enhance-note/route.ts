/**
 * POST /api/ai/enhance-note
 * AI 强化笔记：修正逻辑 + 衍生知识点建议
 */
import { NextRequest } from 'next/server';
import { sanitizeBaseUrl } from '@/utils/utils';
import { resolveAiConfig, missingApiKeyResponse } from '@/lib/server/resolve-ai-config';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const { content, nodeTitle, apiKey, provider, modelName, baseUrl } = await req.json();

  const resolved = resolveAiConfig({ apiKey, provider, modelName, baseUrl });
  if (!resolved) return missingApiKeyResponse();
  const { apiKey: finalKey, provider: finalProvider, modelName: finalModel, baseUrl: finalBaseUrl } = resolved;

  const systemPrompt = `你是一个专业的知识整理助手，帮助学习者优化和完善学习笔记。`;
  const userPrompt = `当前知识点：「${nodeTitle}」

笔记内容：
${content}

请做以下两件事：
1. 找出笔记中逻辑不清晰或描述不准确的地方，给出修正建议（如果没有问题则说明）
2. 基于这个知识点，推荐 3-5 个值得深入了解的衍生知识点

输出 JSON 格式：
{
  "corrections": [{"issue": "问题描述", "suggestion": "修正建议"}],
  "derivedTopics": [{"title": "知识点名", "reason": "为什么推荐，20字以内"}]
}

只输出 JSON，不要其他文字。`;

  const endpoint = sanitizeBaseUrl(finalBaseUrl, finalProvider);
  const model = finalModel || (finalProvider === 'openai' ? 'gpt-4o-mini' : finalProvider === 'deepseek' ? 'deepseek-chat' : 'claude-3-5-sonnet-20241022');

  try {
    if (finalProvider === 'anthropic') {
      const res = await fetch(`${endpoint}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': finalKey,
          'Authorization': `Bearer ${finalKey}`,
          'anthropic-version': '2023-06-01',
          'User-Agent': 'LearnFlow/1.0',
        },
        body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: 'user', content: userPrompt }], system: systemPrompt }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`Anthropic API error (${res.status}):`, errText);
        return new Response(JSON.stringify({ error: `Anthropic API 错误 (${res.status}): ${errText.slice(0, 300)}` }), {
          status: res.status, headers: { 'Content-Type': 'application/json' }
        });
      }

      const data = await res.json();
      try {
        fs.writeFileSync('ai-response-log.json', JSON.stringify(data, null, 2));
      } catch {}
      let text = '';
      if (Array.isArray(data.content)) {
        const textBlock = data.content.find((block: any) => block.type === 'text');
        text = textBlock ? (textBlock.text || '') : (data.content[0]?.text || '');
      } else {
        text = data.choices?.[0]?.message?.content || '';
      }
      text = text.trim();
      if (!text) {
        const possibleError = data.error?.message || data.error || data.message || data.msg || data.error_msg || JSON.stringify(data);
        return new Response(JSON.stringify({ error: `AI 返回内容为空。接口响应: ${String(possibleError).slice(0, 200)}` }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ result: text }), { headers: { 'Content-Type': 'application/json' } });
    } else {
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalKey}`,
          'User-Agent': 'LearnFlow/1.0',
        },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 2048 }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`OpenAI API error (${res.status}):`, errText);
        return new Response(JSON.stringify({ error: `AI API 错误 (${res.status}): ${errText.slice(0, 300)}` }), {
          status: res.status, headers: { 'Content-Type': 'application/json' }
        });
      }

      const data = await res.json();
      try {
        fs.writeFileSync('ai-response-log.json', JSON.stringify(data, null, 2));
      } catch {}
      let text = '';
      if (Array.isArray(data.content)) {
        const textBlock = data.content.find((block: any) => block.type === 'text');
        text = textBlock ? (textBlock.text || '') : (data.content[0]?.text || '');
      } else {
        text = data.choices?.[0]?.message?.content || '';
      }
      text = text.trim();
      if (!text) {
        const possibleError = data.error?.message || data.error || data.message || data.msg || data.error_msg || JSON.stringify(data);
        return new Response(JSON.stringify({ error: `AI 返回内容为空。接口响应: ${String(possibleError).slice(0, 200)}` }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ result: text }), { headers: { 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    console.error('AI call exception:', e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `AI 调用异常: ${errMsg}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
