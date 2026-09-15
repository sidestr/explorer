# sidestr explorer

A read-only explorer for sidestr chains, at https://sidestr.com/explorer/?mirror=<base URL>. The mirror serves chain.json, blocks.json and blocks.dat with Range and CORS, as a siding producer or any static host does. The page validates every block in the browser with the engine (bitcoin-desktop/schema) and the sidestr overlay, then shows blocks, transactions and addresses. No key, nothing to submit.

explorer.mjs is the data model with no DOM; it runs in Node with local checkouts for tests.
