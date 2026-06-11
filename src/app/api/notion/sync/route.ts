/**
 * POST /api/notion/sync
 * 将选中的知识节点同步到 Notion Database
 */
import { NextRequest } from 'next/server';

type SyncNode = {
  id: string;
  title: string;
  domainName: string;
  level: number;
  estimatedHours: number;
  status: string;
  startDate?: string;
  content?: string;
};

type NotionRichText = {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
};

type NotionBlock = {
  object: 'block';
  type: string;
  [key: string]: unknown;
};

function parseInlineMarkdown(text: string): NotionRichText[] {
  if (!text) return [];

  const richText: NotionRichText[] = [];
  let index = 0;

  while (index < text.length) {
    const rest = text.substring(index);
    
    // 1. Code: `code`
    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      richText.push({
        type: 'text',
        text: { content: codeMatch[1] },
        annotations: { code: true }
      });
      index += codeMatch[0].length;
      continue;
    }
    
    // 2. Bold: **bold** or __bold__
    const boldMatch = rest.match(/^\*\*([^*]+)\*\*/) || rest.match(/^__([^_]+)__/);
    if (boldMatch) {
      richText.push({
        type: 'text',
        text: { content: boldMatch[1] },
        annotations: { bold: true }
      });
      index += boldMatch[0].length;
      continue;
    }
    
    // 3. Italic: *italic* or _italic_
    const italicMatch = rest.match(/^\*([^*]+)\*/) || rest.match(/^_([^_]+)_/);
    if (italicMatch) {
      richText.push({
        type: 'text',
        text: { content: italicMatch[1] },
        annotations: { italic: true }
      });
      index += italicMatch[0].length;
      continue;
    }

    // 4. Link: [text](url)
    const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      richText.push({
        type: 'text',
        text: {
          content: linkMatch[1],
          link: { url: linkMatch[2] }
        }
      });
      index += linkMatch[0].length;
      continue;
    }

    // 5. Plain text
    const nextSpecial = rest.search(/[\*_`\[]/);
    if (nextSpecial === -1) {
      richText.push({
        type: 'text',
        text: { content: rest }
      });
      break;
    } else if (nextSpecial === 0) {
      richText.push({
        type: 'text',
        text: { content: rest[0] }
      });
      index += 1;
    } else {
      richText.push({
        type: 'text',
        text: { content: rest.substring(0, nextSpecial) }
      });
      index += nextSpecial;
    }
  }

  return richText.map(t => {
    if (t.text && t.text.content.length > 2000) {
      t.text.content = t.text.content.substring(0, 2000);
    }
    return t;
  });
}

function markdownToNotionBlocks(md: string): NotionBlock[] {
  if (!md) return [];

  const lines = md.split(/\r?\n/);
  const blocks: NotionBlock[] = [];
  
  let inCodeBlock = false;
  const codeContent: string[] = [];
  let codeLanguage = 'plain text';
  let listStack: { indent: number; block: NotionBlock; type: string }[] = [];

  const addBlock = (block: NotionBlock) => {
    listStack = [];
    blocks.push(block);
  };

  const getNotionLanguage = (lang: string): string => {
    const l = lang.toLowerCase().trim();
    if (!l) return 'plain text';
    if (l === 'js') return 'javascript';
    if (l === 'ts') return 'typescript';
    if (l === 'py') return 'python';
    if (l === 'sh') return 'shell';
    const validLanguages = [
      'abap', 'arduino', 'bash', 'basic', 'c', 'clojure', 'coffeescript', 'c++', 'c#', 'css', 'dart', 'diff',
      'docker', 'elixir', 'elm', 'erlang', 'flow', 'fortran', 'f#', 'gherkin', 'glsl', 'go', 'graphql', 'groovy',
      'haskell', 'html', 'java', 'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript',
      'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mermaid', 'nix', 'objective-c', 'ocaml', 'pascal',
      'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf', 'python', 'r', 'reason', 'ruby', 'rust',
      'sass', 'scala', 'scheme', 'scss', 'shell', 'sql', 'swift', 'typescript', 'vb.net', 'verilog', 'vhdl',
      'visual basic', 'webassembly', 'xml', 'yaml'
    ];
    return validLanguages.includes(l) ? l : 'plain text';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        const codeText = codeContent.join('\n');
        addBlock({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: codeText } }],
            language: codeLanguage
          }
        });
        inCodeBlock = false;
        codeContent.length = 0;
      } else {
        inCodeBlock = true;
        const langMatch = line.trim().match(/^```(\w+)/);
        codeLanguage = langMatch ? getNotionLanguage(langMatch[1]) : 'plain text';
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    if (line.trim() === '') {
      listStack = [];
      continue;
    }

    const indentMatch = line.match(/^([ \t]*)/);
    const indent = indentMatch ? indentMatch[1].replace(/\t/g, '    ').length : 0;
    const trimmedLine = line.trim();

    // Headings
    const h3Match = trimmedLine.match(/^###\s+(.*)/);
    if (h3Match) {
      addBlock({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: parseInlineMarkdown(h3Match[1])
        }
      });
      continue;
    }

    const h2Match = trimmedLine.match(/^##\s+(.*)/);
    if (h2Match) {
      addBlock({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: parseInlineMarkdown(h2Match[1])
        }
      });
      continue;
    }

    const h1Match = trimmedLine.match(/^#\s+(.*)/);
    if (h1Match) {
      addBlock({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: parseInlineMarkdown(h1Match[1])
        }
      });
      continue;
    }

    // Quote
    const quoteMatch = trimmedLine.match(/^>\s*(.*)/);
    if (quoteMatch) {
      addBlock({
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: parseInlineMarkdown(quoteMatch[1])
        }
      });
      continue;
    }

    // Divider
    if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
      addBlock({
        object: 'block',
        type: 'divider',
        divider: {}
      });
      continue;
    }

    // Bullet list
    const bulletMatch = trimmedLine.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      const contentText = bulletMatch[1];
      const newBlock: NotionBlock = {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: parseInlineMarkdown(contentText)
        }
      };
      processListNesting(newBlock, indent, 'bulleted_list_item');
      continue;
    }

    // Numbered list
    const numberMatch = trimmedLine.match(/^\d+\.\s+(.*)/);
    if (numberMatch) {
      const contentText = numberMatch[1];
      const newBlock: NotionBlock = {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: parseInlineMarkdown(contentText)
        }
      };
      processListNesting(newBlock, indent, 'numbered_list_item');
      continue;
    }

    // Paragraph
    const newBlock: NotionBlock = {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: parseInlineMarkdown(trimmedLine)
      }
    };
    addBlock(newBlock);
  }

  function processListNesting(newBlock: NotionBlock, indent: number, type: string) {
    while (listStack.length > 0 && listStack[listStack.length - 1].indent >= indent) {
      listStack.pop();
    }

    if (listStack.length > 0) {
      const parent = listStack[listStack.length - 1];
      const parentType = parent.type;
      const parentItem = parent.block[parentType] as { children?: NotionBlock[] } | undefined;
      
      if (parentItem) {
        if (!parentItem.children) {
          parentItem.children = [];
        }
        parentItem.children.push(newBlock);
      }
      listStack.push({ indent, block: newBlock, type });
    } else {
      blocks.push(newBlock);
      listStack.push({ indent, block: newBlock, type });
    }
  }

  return blocks;
}

export async function POST(req: NextRequest) {
  const { notionToken, databaseId, nodes }: {
    notionToken: string;
    databaseId?: string;
    nodes: SyncNode[];
  } = await req.json();

  if (!notionToken) {
    return new Response(JSON.stringify({ error: '请先配置 Notion Token' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const notionHeaders = {
    'Authorization': `Bearer ${notionToken}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  };

  let targetDatabaseId = databaseId;

  // 如果没有 database ID，先创建一个
  if (!targetDatabaseId) {
    // 先获取用户可访问的页面
    const searchRes = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({ filter: { value: 'page', property: 'object' }, page_size: 1 }),
    });
    const searchData = await searchRes.json();
    const parentPageId = searchData.results?.[0]?.id;

    if (!parentPageId) {
      return new Response(JSON.stringify({ error: '未找到可访问的 Notion 页面，请确保 Integration 已共享到页面' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 创建 database
    const createRes = await fetch('https://api.notion.com/v1/databases', {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: 'LearnFlow 学习规划' } }],
        properties: {
          '知识点': { title: {} },
          '领域': { select: {} },
          '层级': { number: {} },
          '预计时长(h)': { number: {} },
          '状态': { select: { options: [
            { name: '未开始', color: 'gray' },
            { name: '进行中', color: 'yellow' },
            { name: '已完成', color: 'green' },
          ]}},
          '开始日期': { date: {} },
        },
      }),
    });
    const createData = await createRes.json();
    targetDatabaseId = createData.id;
  }

  // 同步每个节点
  const results = [];
  for (const node of nodes) {
    try {
      const statusMap: Record<string, string> = {
        pending: '未开始', in_progress: '进行中', done: '已完成'
      };

      const blocks = node.content ? markdownToNotionBlocks(node.content) : [];
      const firstChunk = blocks.slice(0, 100);

      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          parent: { database_id: targetDatabaseId },
          properties: {
            '知识点': { title: [{ text: { content: node.title } }] },
            '领域': { select: { name: node.domainName } },
            '层级': { number: node.level },
            '预计时长(h)': { number: node.estimatedHours },
            '状态': { select: { name: statusMap[node.status] || '未开始' } },
            ...(node.startDate ? { '开始日期': { date: { start: node.startDate } } } : {}),
          },
          ...(firstChunk.length > 0 ? { children: firstChunk } : {}),
        }),
      });

      let ok = res.ok;
      let pageId = '';

      if (res.ok) {
        const pageData = await res.json();
        pageId = pageData.id;

        // 如果块数量超过 100，使用 PATCH 分页追加剩下的块
        if (pageId && blocks.length > 100) {
          for (let j = 100; j < blocks.length; j += 100) {
            const nextChunk = blocks.slice(j, j + 100);
            const patchRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
              method: 'PATCH',
              headers: notionHeaders,
              body: JSON.stringify({ children: nextChunk }),
            });
            if (!patchRes.ok) {
              ok = false;
              console.error(`Failed to append chunk starting at ${j} for page ${pageId}:`, await patchRes.json().catch(() => ({})));
            }
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Notion Sync page creation error:', errData);
      }

      results.push({ id: node.id, ok });
    } catch (e) {
      console.error('Notion Sync error:', e);
      results.push({ id: node.id, ok: false });
    }
  }

  return new Response(JSON.stringify({ databaseId: targetDatabaseId, results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
