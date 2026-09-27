// The validated-state cache on a chain with the assets and pool rules (default: the local tally producer):
// a resumed open must give the same coins, carried assets, issued assets, pools and pool journal as a full one.
//   node test/cache-rules-test.mjs [mirror]
import { Explorer } from '../explorer.mjs';
const H = process.env.HOME, mirror = process.argv[2] ?? 'http://127.0.0.1:3453';
const opts = { cdn: process.env.SCHEMA ?? `${H}/bitcoin-desktop/schema`, sidestr: `${H}/remote/github.com/sidestr/spec/siding/lib`, loadJson: async (u) => JSON.parse(await (await import('node:fs/promises')).readFile(u, 'utf8')) };
let ok = 0, bad = 0; const t = (name, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); cond ? ok++ : bad++; };
const mem = new Map(), store = { get: (k) => mem.get(k) ?? null, set: (k, v) => mem.set(k, v), delete: (k) => mem.delete(k) };
const open = async (o) => { const ex = new Explorer(mirror, { ...opts, ...o }); const t0 = Date.now(); await ex.open(); return { ex, ms: Date.now() - t0 }; };
const dump = (ex) => JSON.stringify({ utxo: [...ex.utxo], carried: [...ex.rules.assets.carried].map(([k, m]) => [k, [...m]]), issued: [...ex.rules.assets.issued], pools: [...ex.rules.pool.pools], by: [...ex.rules.pool.byOutpoint], journal: [...ex.rules.pool.journal] });
const a = await open({ store }); const tip = a.ex.tip();
t(`the chain names the rules under test (${(a.ex.chain.rules ?? []).join(', ')})`, !!a.ex.rules.assets && !!a.ex.rules.pool);
t('a chain with rules is cacheable now, and the first open wrote the cache', a.ex.cacheable && a.ex.fromCache === null && mem.has(a.ex.cacheKey));
const saved = JSON.parse(mem.get(a.ex.cacheKey)); t('the cache carries the rules\' state', saved.rules && saved.rules.carried.length === a.ex.rules.assets.carried.size && saved.rules.pools.length === a.ex.rules.pool.pools.size && saved.rules.journal.length === a.ex.rules.pool.journal.size);
const b = await open({ store });
t('every cached height has its hash and time (history keeps its dates)', b.ex.blocks.every((x) => x && x.hash && x.time) && b.ex.blocks[Math.floor(tip.height / 2)].time === a.ex.blocks[Math.floor(tip.height / 2)].time && b.ex.block(a.ex.blocks[3].hash)?.height === 3);
t('the second open resumed from the cached tip', b.ex.fromCache === tip.height);
t('same coins, carried assets, issued assets, pools, pool coins and journal', dump(b.ex) === dump(a.ex));
t(`the resumed open is faster (${a.ms} ms full, ${b.ms} ms resumed)`, b.ms < a.ms / 4);
mem.set(a.ex.cacheKey, JSON.stringify({ ...saved, rules: null })); const c = await open({ store });
t('a cache without the rules\' state is dropped and the chain replays from genesis', c.ex.fromCache === null && dump(c.ex) === dump(a.ex));
// the shared maps are refilled in place: the pool overlay and the assets overlay still see one `pools` map
const d = await open({ store }); const pid = [...d.ex.rules.pool.pools.keys()][0];
t('after a resume the assets rule still exempts share assets (the pools map is the same object)', !pid || d.ex.rules.assets.issued.has(pid) === a.ex.rules.assets.issued.has(pid));
console.log(`\n${ok} passed, ${bad} failed`); process.exit(bad ? 1 : 0);
