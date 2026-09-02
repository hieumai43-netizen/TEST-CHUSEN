const OPENAI_URL = 'https://api.openai.com/v1/responses';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const OFFICIAL_DOMAINS = [
  'biccamera.com','joshinweb.jp','joshin.co.jp','yodobashi.com','geo-online.co.jp',
  'aeonretail.jp','pokemoncenter-online.com','pokemon-card.com','bandai.co.jp',
  'carddass.com','takaratomymall.jp','toysrus.co.jp','yamada-denkiweb.com',
  'donki.com','rakuten.co.jp','7net.omni7.jp','lawson.co.jp','family.co.jp'
];

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      authorize(request, env);
      const url = new URL(request.url);
      if (url.pathname === '/health' && request.method === 'GET') {
        return json({ ok: true, service: 'Chusen Scanner', openaiConfigured: Boolean(env.OPENAI_API_KEY), cacheConfigured: Boolean(env.CHUSEN_CACHE) }, 200, cors);
      }
      if (url.pathname === '/feed' && request.method === 'GET') {
        const feed = await readFeed(env);
        return json({ results: feed, updatedAt: await readUpdatedAt(env) }, 200, cors);
      }
      if ((url.pathname === '/scan' || url.pathname === '/') && request.method === 'POST') {
        if (!env.OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY chưa được cấu hình trong Worker.' }, 503, cors);
        const input = await request.json();
        const query = validateScan(input);
        const results = await scanWeb(query, env);
        await mergeFeed(results, env);
        return json({ results, mode: 'live', searchedAt: new Date().toISOString() }, 200, cors);
      }
      return json({ error: 'Không tìm thấy đường dẫn.' }, 404, cors);
    } catch (error) {
      const status = error.status || 500;
      return json({ error: status === 500 ? 'Máy chủ quét gặp lỗi.' : error.message }, status, cors);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScheduledScan(env));
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '*').split(',').map(x => x.trim()).filter(Boolean);
  const value = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0] || 'null';
  return {
    'Access-Control-Allow-Origin': value,
    'Access-Control-Allow-Headers': 'Content-Type, X-Scan-Token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
}

function authorize(request, env) {
  if (!env.SCAN_TOKEN) return;
  if (request.headers.get('X-Scan-Token') !== env.SCAN_TOKEN) {
    const error = new Error('Mã bảo vệ máy chủ không đúng.');
    error.status = 401;
    throw error;
  }
}

function validateScan(input = {}) {
  const date = String(input.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error('Ngày quét không hợp lệ.'); error.status = 400; throw error;
  }
  return {
    date,
    keyword: String(input.keyword || '').trim().slice(0, 120),
    area: String(input.area || '').trim().slice(0, 100),
    source: ['all', 'official', 'x'].includes(input.source) ? input.source : 'all'
  };
}

async function scanWeb(query, env) {
  const sourceInstruction = query.source === 'official'
    ? 'Only use official store/manufacturer websites and official store X accounts.'
    : query.source === 'x'
      ? 'Prioritize current posts on x.com, then verify against an official source when possible.'
      : 'Search both official websites and x.com. Prefer official primary sources.';
  const dateScope = query.window === 'next-7-days' ? `${query.date} through the following 7 days` : query.date;
  const prompt = `Search the live public web for Japanese 抽選 (Chusen/lottery sale) information.
Target date scope in Japan: ${dateScope}
Product/store keyword: ${query.keyword || 'Pokémon cards, ONE PIECE cards, Dragon Ball cards, Beyblade'}
Area: ${query.area || 'Japan; include online lotteries'}
Source preference: ${sourceInstruction}

Search Japanese terms including 抽選, 抽選販売, 応募期間, 当選発表, 予約, 店舗, and the supplied keyword. Search x.com when requested. Return only announcements whose source page directly supports the store, product and relevant date. Do not infer dates from old campaigns. If evidence is missing, return no item. For each result, sourceUrl must be the exact supporting page/post URL and link must be the direct application/result page when available. All dates use YYYY-MM-DD in Japan time. Output must follow the JSON schema.`;

  const schema = {
    type: 'object', additionalProperties: false, required: ['results'],
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['date','storeName','productName','time','area','link','sourceUrl','sourceType','confidence','method'],
          properties: {
            date: { type: 'string' }, storeName: { type: 'string' }, productName: { type: 'string' },
            time: { type: 'string' }, area: { type: 'string' }, link: { type: 'string' },
            sourceUrl: { type: 'string' }, sourceType: { type: 'string', enum: ['official-web','official-x','community','unknown'] },
            confidence: { type: 'number' }, method: { type: 'string' }
          }
        }
      }
    }
  };
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-5.6',
      reasoning: { effort: 'low' },
      tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'JP', region: query.area || 'Japan' } }],
      input: prompt,
      text: { format: { type: 'json_schema', name: 'chusen_results', strict: true, schema } },
      max_output_tokens: 5000
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'OpenAI web search failed'); error.status = 502; throw error;
  }
  const text = outputText(payload);
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { const error = new Error('Kết quả tìm kiếm không đúng định dạng.'); error.status = 502; throw error; }
  return normalizeResults(parsed.results || [], query);
}

function outputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  for (const item of payload.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) if (content.type === 'output_text' && content.text) return content.text;
  }
  return '{"results":[]}';
}

function normalizeResults(rows, query) {
  const seen = new Set();
  return rows.slice(0, 20).flatMap((row, index) => {
    const sourceUrl = safeHttp(row.sourceUrl);
    if (!sourceUrl || !/^\d{4}-\d{2}-\d{2}$/.test(row.date || '')) return [];
    const source = classifySource(sourceUrl, row.sourceType);
    const link = safeHttp(row.link) || sourceUrl;
    const key = `${row.date}|${row.storeName}|${row.productName}|${sourceUrl}`.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: `live-${row.date}-${index}-${simpleHash(key)}`, date: row.date, storeName: clean(row.storeName, 100),
      productName: clean(row.productName, 150), time: clean(row.time, 80), area: clean(row.area || query.area, 100),
      link, sourceUrl, sourceType: source.type, confidence: source.confidence,
      method: clean(row.method || 'Mở nguồn để kiểm tra', 240), verified: source.type === 'official-web', active: true, demo: false
    }];
  });
}

function classifySource(rawUrl, claimed) {
  const host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  if (OFFICIAL_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))) return { type: 'official-web', confidence: 95 };
  if (host === 'x.com' || host === 'twitter.com') return claimed === 'official-x' ? { type: 'official-x', confidence: 85 } : { type: 'community', confidence: 65 };
  return { type: 'community', confidence: 55 };
}

function safeHttp(value) { try { const url = new URL(String(value || '')); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function clean(value, max) { return String(value || '').replace(/[<>]/g, '').trim().slice(0, max); }
function simpleHash(value) { let hash = 0; for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0; return Math.abs(hash).toString(36); }

async function runScheduledScan(env) {
  if (!env.OPENAI_API_KEY) return;
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const date = now.toISOString().slice(0, 10);
  const keywords = ['ポケモンカード 抽選', 'ONE PIECEカード 抽選', 'ドラゴンボールカード 抽選', 'ベイブレード 抽選'];
  const batches = [];
  for (const keyword of keywords) {
    try { batches.push(...await scanWeb({ date, window: 'next-7-days', keyword, area: 'Japan オンライン 神奈川 静岡', source: 'all' }, env)); }
    catch {}
  }
  await mergeFeed(batches, env);
}

async function readFeed(env) {
  if (!env.CHUSEN_CACHE) return [];
  try { return JSON.parse(await env.CHUSEN_CACHE.get('latest_feed') || '[]'); } catch { return []; }
}
async function readUpdatedAt(env) { return env.CHUSEN_CACHE ? env.CHUSEN_CACHE.get('latest_feed_updated_at') : null; }
async function mergeFeed(incoming, env) {
  if (!env.CHUSEN_CACHE) return;
  const old = await readFeed(env);
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString().slice(0, 10);
  const map = new Map();
  for (const item of [...incoming, ...old]) {
    if (!item.date || item.date < cutoff || !item.sourceUrl) continue;
    const key = `${item.date}|${item.storeName}|${item.productName}|${item.sourceUrl}`.toLowerCase();
    if (!map.has(key)) map.set(key, item);
  }
  await env.CHUSEN_CACHE.put('latest_feed', JSON.stringify([...map.values()].slice(0, 300)));
  await env.CHUSEN_CACHE.put('latest_feed_updated_at', new Date().toISOString());
}

function json(body, status, headers) { return new Response(JSON.stringify(body), { status, headers }); }
