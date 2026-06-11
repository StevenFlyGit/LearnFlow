/**
 * POST /api/rss/fetch
 * 通过 CORS 代理获取 RSS 内容并解析
 */
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return new Response(JSON.stringify({ error: '缺少 URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // 尝试直接获取
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LearnFlow RSS Reader/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // 简单解析 RSS/Atom XML
    const items = parseRSS(xml);
    const title = xml.match(/<title>(.*?)<\/title>/s)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1')?.trim() || url;

    return new Response(JSON.stringify({ title, items }), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    // 使用 CORS 代理备用
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      const xml = data.contents;
      const items = parseRSS(xml);
      const title = xml.match(/<title>(.*?)<\/title>/s)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1')?.trim() || url;
      return new Response(JSON.stringify({ title, items }), { headers: { 'Content-Type': 'application/json' } });
    } catch {
      return new Response(JSON.stringify({ error: '无法获取 RSS，请检查 URL 是否正确' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
}

function cleanCDATA(str: string) {
  return str.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').trim();
}

function parseRSS(xml: string) {
  const items: { title: string; link: string; pubDate?: string; description?: string }[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;

  const processMatch = (content: string) => {
    const title = cleanCDATA(content.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || '');
    const link = cleanCDATA(content.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] || '') ||
                 content.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ||
                    content.match(/<published>([\s\S]*?)<\/published>/)?.[1] || '';
    const description = cleanCDATA(content.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] || '')
                         .replace(/<[^>]+>/g, '').slice(0, 200);
    if (title && link) items.push({ title, link, pubDate, description });
  };

  let m;
  while ((m = itemRegex.exec(xml)) !== null) processMatch(m[1]);
  while ((m = entryRegex.exec(xml)) !== null) processMatch(m[1]);

  return items.slice(0, 50);
}
