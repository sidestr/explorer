// Sync cost against a live mirror (default: the local tally producer, a chain with rules so nothing is cached):
// one Range request per sync, a mirror that ignores Range still works, an unchanged index costs a 304 when the
// mirror gives an ETag.   node test/sync-test.mjs [mirror]
import { Explorer, RANGE_BYTES } from '../explorer.mjs';
const H = process.env.HOME, mirror = process.argv[2] ?? 'http://127.0.0.1:3453';
const opts = { cdn: process.env.SCHEMA ?? `${H}/bitcoin-desktop/schema`, sidestr: `${H}/remote/github.com/sidestr/spec/siding/lib`, loadJson: async (u) => JSON.parse(await (await import('node:fs/promises')).readFile(u, 'utf8')) };
let ok = 0, bad = 0; const t = (name, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); cond ? ok++ : bad++; };
const realFetch = globalThis.fetch; const calls = []; globalThis.fetch = async (u, o) => { calls.push({ u: String(u), o }); return realFetch(u, o); };
const a = new Explorer(mirror, opts); const t0 = Date.now(); await a.open(); const msA = Date.now() - t0;
const dat = calls.filter((c) => c.u.endsWith('/blocks.dat'));
t(`a cold open of ${a.blocks.length} blocks made ${dat.length} block-file request(s), not one per block`, dat.length === Math.max(1, Math.ceil(a.index.blocks.at(-1).offset / RANGE_BYTES)) && a.stats.fetches === dat.length + 1);
t('every block validated', a.blocks.every((b) => b.verdict.ok));
// a second explorer, same mirror, through a fetch that drops the Range header (a static host without Range support)
calls.length = 0; globalThis.fetch = async (u, o) => { calls.push({ u: String(u) }); const o2 = { ...o, headers: { ...(o?.headers ?? {}) } }; delete o2.headers.range; return realFetch(u, o2); };
const b = new Explorer(mirror, opts); await b.open();
t('a mirror that answers 200 with the whole file is sliced by offset: same tip, same supply', b.tip().hash === a.tip().hash && b.supply() === a.supply() && b.utxo.size === a.utxo.size);
// a refresh with nothing new: a 304 from the index when the mirror gives an ETag, no block-file request
globalThis.fetch = async (u, o) => { calls.push({ u: String(u), o }); return realFetch(u, o); }; calls.length = 0; const before = a.stats.fetches;
const r = await a.refresh(); const idx = calls.filter((c) => c.u.endsWith('/blocks.json'));
t('a refresh with nothing new fetches the index only', r === a && calls.length === 1 && idx.length === 1 && a.stats.fetches === before + 1);
t(a.indexEtag ? 'and sent If-None-Match with the mirror\'s ETag' : 'the mirror gives no ETag, so the index was re-read (no 304 possible)', !a.indexEtag || idx[0].o.headers['if-none-match'] === a.indexEtag);
globalThis.fetch = realFetch; console.log(`  cold open ${msA} ms, ${a.blocks.length} blocks`);
console.log(`\n${ok} passed, ${bad} failed`); process.exit(bad ? 1 : 0);
