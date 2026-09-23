import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require=createRequire(new URL('../../api-server/package.json',import.meta.url));
const { build }=require('esbuild');
const temp=await mkdtemp(path.join(tmpdir(),'writing-demo-tests-'));
try {
 const out=path.join(temp,'tests.mjs');
 await build({entryPoints:[new URL('./demo-regressions.ts',import.meta.url).pathname],outfile:out,bundle:true,platform:'node',format:'esm',define:{'import.meta.env.DEV':'false','import.meta.env.BASE_URL':'"/"'}});
 await import(pathToFileURL(out).href);
} finally {await rm(temp,{recursive:true,force:true});}
