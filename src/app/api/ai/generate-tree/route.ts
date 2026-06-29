/**
 * POST /api/ai/generate-tree
 * 调用用户配置的 AI API，流式生成知识树
 */
import { NextRequest } from 'next/server';
import { sanitizeBaseUrl } from '@/utils/utils';
import { resolveAiConfig, missingApiKeyResponse } from '@/lib/server/resolve-ai-config';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const { domain, dailyHours, apiKey, provider, modelName, baseUrl, goal, scope, industry } = await req.json();

  const resolved = resolveAiConfig({ apiKey, provider, modelName, baseUrl });
  if (!resolved) return missingApiKeyResponse();
  const { apiKey: finalKey, provider: finalProvider, modelName: finalModel, baseUrl: finalBaseUrl } = resolved;

  const systemPrompt = `你是一个专业的学习路径规划师。用户给出一个学习领域，你需要生成一个完整的分层知识树，用于规划学习路径。

输出格式要求：
- 使用严格的 JSON 格式
- 结构：顶层为 2-3 个大模块，每个大模块下有 2-3 个子模块，每个子模块下有 2-3 个具体知识点（请严格控制总节点数在 20-30 个以内，以防生成文本过长被系统截断）
- 每个节点包含：title（标题）、description（极简描述，15字以内）、estimatedHours（预计学习小时数，整数）、children（子节点数组）
- 叶子节点 children 为空数组
- **重要：每个叶子节点的 estimatedHours 不能超过学习者每日可投入的时间，如果某个知识点需要较长时间学习，请将其拆分为多个子知识点**
- 预计时间要合理，总计不超过 200 小时
- 用中文输出所有标题和描述
- 如果用户提供了学习目的、范围约束或行业背景，请据此定制知识树的内容侧重：
  - 优先安排与用户需求直接相关的知识模块
  - 即使用户提供了范围约束，也应包含该领域不可或缺的基础知识
  - 结合行业背景安排实践应用相关的知识点
  - 根据学习目的调整理论深度（概念了解 vs 实践应用 vs 深入研究）

示例格式：
{
  "title": "域名",
  "nodes": [
    {
      "title": "模块一",
      "description": "简短描述",
      "estimatedHours": 20,
      "children": [
        {
          "title": "子模块",
          "description": "描述",
          "estimatedHours": 10,
          "children": [
            {
              "title": "具体知识点",
              "description": "描述",
              "estimatedHours": 3,
              "children": []
            }
          ]
        }
      ]
    }
  ]
}

只输出 JSON，不要有任何其他文字。`;

  let userPrompt = `请为「${domain}」生成完整的学习知识树。`;
  if (goal) userPrompt += `\n学习目的：${goal}`;
  if (scope) userPrompt += `\n范围/方向约束：${scope}`;
  if (industry) userPrompt += `\n行业/应用场景：${industry}`;
  userPrompt += `\n学习者每天可投入 ${dailyHours} 小时，请确保每个叶子节点的预估时间不超过 ${dailyHours} 小时。`;

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
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: userPrompt }],
          system: systemPrompt,
        }),
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
      return new Response(JSON.stringify({ result: text }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // OpenAI-compatible (openai, deepseek)
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalKey}`,
          'User-Agent': 'LearnFlow/1.0',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 4096,
          stream: false,
        }),
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
      return new Response(JSON.stringify({ result: text }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (e) {
    console.error('AI call exception:', e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `AI 调用异常: ${errMsg}` }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
