/**
 * POST /api/ai/weekly-summary
 * 根据本周笔记生成学习总结
 */
import { NextRequest } from 'next/server';
import { sanitizeBaseUrl } from '@/utils/utils';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const { notes, apiKey, provider, modelName, baseUrl } = await req.json();

  if (!apiKey) {
    return new Response(JSON.stringify({ error: '请先配置 API Key' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const systemPrompt = `你是一个学习进度分析助手，帮助学习者总结本周学习情况。`;
  const notesText = notes.map((n: { title: string; content: string; status: string }) =>
    `知识点：${n.title}\n状态：${n.status}\n笔记：${n.content || '（无笔记）'}`
  ).join('\n\n---\n\n');

  const userPrompt = `以下是本周的学习记录，请生成一份简洁的总结报告：

${notesText}

输出格式 JSON：
{
  "completed": ["已完成的知识点列表"],
  "inProgress": ["进行中的知识点列表"],
  "pending": ["未开始的知识点列表"],
  "highlights": "本周最大收获，2-3句话",
  "suggestion": "下周学习建议，2-3句话"
}

只输出 JSON。`;

  const endpoint = sanitizeBaseUrl(baseUrl, provider);
  const model = modelName || (provider === 'openai' ? 'gpt-4o-mini' : provider === 'deepseek' ? 'deepseek-chat' : 'claude-3-5-sonnet-20241022');

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
          'Authorization': `Bearer ${apiKey}`,
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
