/**
 * POST /api/ai/daily-plan
 * AI 生成今日计划简短激励文案
 */
import { NextRequest } from 'next/server';
import { sanitizeBaseUrl } from '@/utils/utils';
import { resolveAiConfig, getDefaultModel } from '@/lib/ai/resolve-config';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { apiKey, provider, modelName, baseUrl } = resolveAiConfig(body);
  const { tasks } = body;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: '请先在 Token 配置页填写 API Key，或在系统环境变量中设置 AI_API_KEY' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const systemPrompt = `你是一个贴心、温暖的学习导师，帮助学习者开启高效的一天。`;
  const tasksText = tasks.map((t: { title: string; type: string }) => 
    `- [${t.type === 'study' ? '学习' : '复习'}] ${t.title}`
  ).join('\n');

  const userPrompt = `今天我计划完成以下任务：
${tasksText}

请为我生成一段简短、温暖、有感染力且能鼓励我开始学习的计划摘要文案（包含一句简短行动倡议）。字数控制在 80 字以内。用中文输出。只输出文案，不要有其他包围字符或前缀。`;

  const endpoint = sanitizeBaseUrl(baseUrl, provider);
  const model = modelName || getDefaultModel(provider);

  try {
    if (provider === 'anthropic') {
      const res = await fetch(`${endpoint}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'anthropic-version': '2023-06-01',
          'User-Agent': 'LearnFlow/1.0',
        },
        body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: userPrompt }], system: systemPrompt }),
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
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'LearnFlow/1.0',
        },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 1024 }),
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
