import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildSourceReaders } from './build-source-readers.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
if (!process.argv[2]) throw new Error('Pass the absolute Cathay Flex platform directory.');
const platform = resolve(process.argv[2]);
const require = createRequire(resolve(platform, 'package.json'));
const { build } = require('esbuild');
const result = await build({
  entryPoints: [resolve(root, 'scripts/engine-entry.ts')],
  outfile: resolve(root, 'technology/engine.mjs'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  metafile: true,
  plugins: [{ name: 'flex-source', setup(build) {
    build.onResolve({filter:/^@flex\//}, args => ({path:resolve(platform, 'lib/flex', args.path.slice(6) + '.ts')}));
  }}],
});
const inputs = Object.keys(result.metafile.inputs).map(path => resolve(path));
const sources = inputs.filter(path => path.startsWith(resolve(platform,'lib/flex') + '/')).sort();
const allowed = new Set(['seed.ts','story.ts','engine.ts','intent.ts','generic-market.ts','predicates.ts','request-quote.ts','request-quote-schema.ts','selection.ts','time.ts','types.ts','order-book.ts']);
if (sources.some(path => !allowed.has(basename(path)))) throw new Error('Review new platform dependency before publishing its source.');
// Only pure domain modules and synthetic fixtures are exported. No API, authentication or environment modules.
await mkdir(resolve(root,'technology/source'), {recursive:true});
const files = [];
for (const path of [...sources, resolve(platform,'lib/flex/types.ts')]) {
  const data = await readFile(path);
  await copyFile(path, resolve(root,'technology/source',basename(path)));
  files.push({file:basename(path),sha256:createHash('sha256').update(data).digest('hex')});
}
await copyFile(resolve(platform,'docs/research/selection-benchmark-20261004.json'),resolve(root,'technology/benchmark.json'));
await copyFile(resolve(platform,'docs/research/algorithm-frontiers.md'),resolve(root,'technology/algorithm-frontiers.md'));
const manifest = {
  generatedAt:new Date().toISOString(),
  platformBaseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:platform,encoding:'utf8'}).trim(),
  sourceTreeDigest:createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  files,
  engineBytes:(await readFile(resolve(root,'technology/engine.mjs'))).length,
  engineSha256:createHash('sha256').update(await readFile(resolve(root,'technology/engine.mjs'))).digest('hex'),
  runtime:'Browser JavaScript. Same pure domain functions as the platform. Synthetic bookings. No live AI or airline connection.',
};
await writeFile(resolve(root,'technology/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const digest = value => createHash('sha256').update(value).digest('hex').slice(0,12);
const revision = manifest.engineSha256.slice(0,12);
const lab = resolve(root,'technology/lab.mjs');
await writeFile(lab,(await readFile(lab,'utf8')).replace(/from '\.\/engine\.mjs(?:\?v=[^']*)?'/,`from './engine.mjs?v=${revision}'`));
const view = resolve(root,'technology/system.js');
await writeFile(view,(await readFile(view,'utf8')).replace(/from '\.\/lab\.mjs(?:\?v=[^']*)?'/,`from './lab.mjs?v=${digest(await readFile(lab))}'`));
const html = resolve(root,'technology/index.html');
await writeFile(html,(await readFile(html,'utf8'))
  .replace(/system\.js\?v=[^"']+/,`system.js?v=${digest(await readFile(view))}`)
  .replace(/system\.css\?v=[^"']+/,`system.css?v=${digest(await readFile(resolve(root,'technology/system.css')))}`));
await buildSourceReaders(root);
console.log(JSON.stringify({sourceFiles:files.length,engineBytes:manifest.engineBytes,digest:manifest.sourceTreeDigest}));
