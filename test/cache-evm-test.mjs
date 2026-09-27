// The validated-state cache on a chain with the evm rule (default: the local txbt4-evm producer): a resumed open
// rebuilds the VM from the snapshot and answers the same as a full validation.   node test/cache-evm-test.mjs [mirror]
import { Explorer } from '../explorer.mjs';
const H = process.env.HOME, mirror = process.argv[2] ?? 'http://127.0.0.1:3459';
const opts = { cdn: process.env.SCHEMA ?? `${H}/bitcoin-desktop/schema`, sidestr: `${H}/remote/github.com/sidestr/spec/siding/lib`, loadJson: async (u) => JSON.parse(await (await import('node:fs/promises')).readFile(u, 'utf8')) };
let ok = 0, bad = 0; const t = (name, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); cond ? ok++ : bad++; };
const mem = new Map(), store = { get: (k) => mem.get(k) ?? null, set: (k, v) => mem.set(k, v), delete: (k) => mem.delete(k) };
const open = async (o) => { const ex = new Explorer(mirror, { ...opts, ...o }); const t0 = Date.now(); await ex.open(); return { ex, ms: Date.now() - t0 }; };
const a = await open({ store }); const tip = a.ex.tip(); const evmA = a.ex.rules.evm;
t('the chain names the evm rule', !!evmA);
t('a chain with the evm rule is cacheable now, and the first open wrote the cache', a.ex.cacheable && a.ex.fromCache === null && mem.has(a.ex.cacheKey));
const saved = JSON.parse(mem.get(a.ex.cacheKey)); console.log(`  cache ${mem.get(a.ex.cacheKey).length} bytes: ${saved.rules.evm.db.length} trie entries, ${saved.rules.evm.receipts.length} receipts, ${saved.rules.evm.roots.length} roots`);
const b = await open({ store }); const evmB = b.ex.rules.evm;
t('the second open resumed from the cached tip', b.ex.fromCache === tip.height);
t(`the resumed open is faster (${a.ms} ms full, ${b.ms} ms resumed)`, b.ms < a.ms / 2);
t('same coins and supply', b.ex.supply() === a.ex.supply() && b.ex.utxo.size === a.ex.utxo.size);
t('same state root at the tip', (await evmA.rootHex()) === (await evmB.rootHex()) && evmB.roots.get(tip.height) === evmA.roots.get(tip.height));
t('same receipts and carried transactions', evmB.receipts.size === evmA.receipts.size && evmB.txs.size === evmA.txs.size && [...evmA.receipts.keys()].every((h) => evmB.receipts.has(h)));
const addrs = [...new Set([...evmA.receipts.values()].flatMap((r) => [r.from, r.to]).filter(Boolean))].slice(0, 5); const { util } = evmA.lib;
const bal = async (e, s) => (await e.vm.stateManager.getAccount(util.createAddressFromString(s)))?.balance ?? 0n;
let same = true; for (const s of addrs) if ((await bal(evmA, s)) !== (await bal(evmB, s))) same = false;
t(`the rebuilt VM answers the same balances for ${addrs.length} address(es) seen in receipts`, same);
if (addrs[0]) { const r = [...evmA.receipts.values()][0]; t('a receipt survives the round trip with its gas as BigInt', typeof evmB.receipts.get(r.transactionHash).gasUsed === 'bigint' && evmB.receipts.get(r.transactionHash).gasUsed === r.gasUsed); }
mem.set(a.ex.cacheKey, JSON.stringify({ ...saved, rules: { ...saved.rules, evm: null } })); const c = await open({ store });
t('a cache without the evm snapshot is dropped and the chain replays from genesis', c.ex.fromCache === null && (await c.ex.rules.evm.rootHex()) === (await evmA.rootHex()));
console.log(`\n${ok} passed, ${bad} failed`); process.exit(bad ? 1 : 0);
