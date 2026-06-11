/**
 * POST /api/ai/organize-note
 * AI 笔记整理服务
 */
import { NextRequest } from 'next/server';
import { sanitizeBaseUrl } from '@/utils/utils';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const { content, nodeTitle, apiKey, provider, modelName, baseUrl } = await req.json();

  if (!apiKey) {
    return new Response(JSON.stringify({ error: '请先配置 API Key' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!content || !content.trim()) {
    return new Response(JSON.stringify({ error: '内容不能为空' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const systemPrompt = `你是一个高级笔记整理与知识结构优化专家。请对用户的草稿笔记进行深度整理。`;
  const userPrompt = `当前知识点标题：${nodeTitle}
  
当前笔记草稿：
${content}

请按以下规范，生成一份整理优化后的完整 Markdown 格式笔记：
1. **内容摘要**：在笔记顶部，插入一段简明扼要的「## 笔记摘要」（30字以内）。
2. **逻辑与排版**：梳理文本的段落逻辑，使用规范的 Markdown 标题（##, ###）及列表（-）进行分层重排，使结构一目了然。
3. **纠错与精炼**：纠正所有的拼写与语法错漏，消除口语化或重复性表达。
4. **技术细节**：对于涉及代码、算法或公式的术语，用行内代码块 \`术语\` 或多行代码块进行排版。

请直接输出整理后的完整 Markdown 文本。不要添加任何开头说明、包裹符号（如 \`\`\`markdown 符号），只输出最终用于替换的笔记内容。`;

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
        body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content: userPrompt }], system: systemPrompt }),
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
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 4096 }),
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
