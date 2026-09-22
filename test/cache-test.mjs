// The validated-state cache against a live mirror (default: the local melchain producer):
//   node test/cache-test.mjs [mirror]
import { Explorer } from '../explorer.mjs';
const H = process.env.HOME, mirror = process.argv[2] ?? 'http://127.0.0.1:3451';
const opts = { cdn: process.env.SCHEMA ?? `${H}/bitcoin-desktop/schema`, sidestr: `${H}/remote/github.com/sidestr/spec/siding/lib`, loadJson: async (u) => JSON.parse(await (await import('node:fs/promises')).readFile(u, 'utf8')) };
let ok = 0, bad = 0; const t = (name, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); cond ? ok++ : bad++; };
const mem = new Map(), store = { get: (k) => mem.get(k) ?? null, set: (k, v) => mem.set(k, v), delete: (k) => mem.delete(k) };
const open = async (o) => { const ex = new Explorer(mirror, { ...opts, ...o }); const t0 = Date.now(); await ex.open(); return { ex, ms: Date.now() - t0 }; };
const a = await open({ store }); const tipA = a.ex.tip();
t('first open validates from genesis and writes the cache', a.ex.fromCache === null && mem.has(`sidestr:state:${a.ex.chain.id}`));
const saved = JSON.parse(mem.get(a.ex.cacheKey)); t('the cache is at the tip with 11 headers', saved.height === tipA.height && saved.hash === tipA.hash && saved.headers.length === Math.min(11, tipA.height + 1));
const b = await open({ store });
t('second open resumes from the cached tip', b.ex.fromCache === tipA.height && b.ex.tip().height >= tipA.height);
t('same coins, same supply, same per-script history', b.ex.supply() === a.ex.supply() && b.ex.utxo.size === a.ex.utxo.size && [...a.ex.utxo.keys()].every((k) => b.ex.utxo.has(k)) && b.ex.byScript.size === a.ex.byScript.size);
t('the resumed open is faster', b.ms < a.ms);
t('the tip header is available for the mirror judgement', !!b.ex.headerHex(b.ex.tip().height));
mem.set(a.ex.cacheKey, JSON.stringify({ ...saved, hash: 'ff'.repeat(32) }));
const c = await open({ store });
t('a cache whose hash the mirror does not have is dropped and the chain replays from genesis', c.ex.fromCache === null && c.ex.supply() === a.ex.supply() && JSON.parse(mem.get(a.ex.cacheKey)).hash === c.ex.tip().hash);
// a cache older than the mirror: open with the index truncated 5 blocks short, save, then open normally and validate the rest
const realFetch = globalThis.fetch; const short = tipA.height - 5;
globalThis.fetch = async (u, o) => { const r = await realFetch(u, o); if (!String(u).endsWith('/blocks.json')) return r; const j = await r.json(); return new Response(JSON.stringify({ ...j, to: short, blocks: j.blocks.filter((b) => b.height <= short) }), { headers: { 'content-type': 'application/json' } }); };
const e = await open({ store }); globalThis.fetch = realFetch;
t('a cache can be written short of the tip', e.ex.tip().height === short && JSON.parse(mem.get(a.ex.cacheKey)).height === short);
const f = await open({ store });
t('an open resumes from the older cache and validates the blocks since, with verdicts', f.ex.fromCache === short && f.ex.tip().height === tipA.height && f.ex.blocks.slice(short + 1).every((b) => b && b.verdict.ok && !b.verdict.cached));
t('the state after catching up equals a full validation', f.ex.supply() === a.ex.supply() && f.ex.utxo.size === a.ex.utxo.size && f.ex.tip().hash === tipA.hash);
const d = await open({}); t('without a store nothing is cached and nothing changes', d.ex.fromCache === null && d.ex.supply() === a.ex.supply());
console.log(`${ok} passed, ${bad} failed (full open ${a.ms} ms, resumed ${b.ms} ms)`); process.exit(bad ? 1 : 0);
