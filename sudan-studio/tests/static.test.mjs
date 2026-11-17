import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url);
const html=await fs.readFile(new URL('index.html',root),'utf8');
const code=await fs.readFile(new URL('app.js',root),'utf8');
test('all application control IDs are present and HTML IDs are unique',()=>{
 const all=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),ids=new Set(all);
 assert.equal(ids.size,all.length);
 for(const m of code.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(m[1]),'Missing #'+m[1]);
 for(const m of code.matchAll(/bind\('([^']+)'/g))assert.ok(ids.has(m[1]),'Missing bound control #'+m[1]);
});
test('entrypoint assets use project-subpath-safe URLs',()=>{
 for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(!m[1].startsWith('/'),m[1]);
 assert.ok(!code.includes('127.0.0.1'));assert.ok(!code.includes('/api/'));
});
test('vendored binary checksums match distribution manifest',async()=>{
 const sources=JSON.parse(await fs.readFile(new URL('vendor/SOURCES.json',root),'utf8'));
 for(const source of sources){if(!source.path)continue;const bytes=await fs.readFile(new URL(source.path,root));assert.equal(bytes.length,source.bytes,source.path);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),source.sha256,source.path);}
 const parts=JSON.parse(await fs.readFile(new URL('vendor/ffmpeg/wasm-parts.json',root),'utf8'));
 const original=sources.find(s=>s.originalPath?.endsWith('ffmpeg-core.wasm'));
 const joined=Buffer.concat(await Promise.all(parts.map(p=>fs.readFile(new URL('vendor/ffmpeg/'+p,root)))));
 assert.equal(crypto.createHash('sha256').update(joined).digest('hex'),original.sha256);
});
test('all shipped files fit the GitHub web upload per-file limit',async()=>{
 async function scan(url){for(const item of await fs.readdir(url,{withFileTypes:true})){const child=new URL(item.name+(item.isDirectory()?'/':''),url);if(item.isDirectory())await scan(child);else assert.ok((await fs.stat(child)).size<25*1024*1024,child.pathname);}}
 await scan(root);
});
