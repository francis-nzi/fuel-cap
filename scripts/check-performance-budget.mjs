import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const roots = ["apps/admin/.next/static/chunks"];
const maximumBytes = 3_000_000;
async function sizeOf(path) { const entry = await stat(path); if (entry.isFile()) return entry.size; const names = await readdir(path); return (await Promise.all(names.map((name) => sizeOf(join(path, name))))).reduce((a,b)=>a+b,0); }
let total = 0;
for (const root of roots) total += await sizeOf(root);
if (total > maximumBytes) throw new Error(`Admin client chunks ${total} bytes exceed ${maximumBytes}-byte budget.`);
console.log(JSON.stringify({ status: "PASS", adminClientChunkBytes: total, maximumBytes }));
