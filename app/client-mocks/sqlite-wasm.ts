/**
 * Lightweight client-side mock for @sqlite.org/sqlite-wasm.
 *
 * In APay production, all SQLite and D1 operations execute exclusively on the
 * Nitro server environment (Node.js or Cloudflare Pages D1). The browser client
 * never needs in-memory SQLite WASM binaries.
 *
 * Aliasing this module in client build prevents Vite from bundling sqlite3.wasm (848KB)
 * and sqlite3-worker1.js (212KB) into frontend static assets.
 */

export default async function sqlite3InitModule() {
  return {
    capi: {},
    wasm: {},
    OpfsDb: class OpfsDb {},
    oo1: {
      DB: class DB {
        exec() {
          return []
        }
        close() {}
      },
      OpfsDb: class OpfsDb {},
    },
  }
}
