import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const chapters = {
  'predicates.ts': 'understand',
  'intent.ts': 'understand',
  'selection.ts': 'match',
  'generic-market.ts': 'match',
  'order-book.ts': 'match',
  'baggage.ts': 'match',
  'baggage-plans.ts': 'match',
  'capacity.ts': 'match',
  'allocation-policy.ts': 'match',
  'resource-model.ts': 'match',
  'resource-label.ts': 'understand',
  'service-catalogue.ts': 'match',
  'services.ts': 'commit',
  'booking-view.ts': 'commit',
  'types.ts': 'match',
  'engine.ts': 'commit',
  'request-quote.ts': 'commit',
  'request-quote-schema.ts': 'commit',
  'seed.ts': 'evidence',
  'story.ts': 'evidence',
  'time.ts': 'evidence',
};

export async function buildSourceRedirects(root) {
  const manifest = JSON.parse(await readFile(resolve(root,'technology/manifest.json'),'utf8'));
  for (const entry of manifest.files) {
    if (!Object.hasOwn(chapters,entry.file)) throw new Error(`Add a chapter redirect for ${entry.file}.`);
    const source = await readFile(resolve(root,'technology/source',entry.file));
    if (createHash('sha256').update(source).digest('hex') !== entry.sha256) throw new Error(`Source hash mismatch for ${entry.file}.`);
  }
  for (const entry of manifest.files) {
    const target = `/technology/#${chapters[entry.file]}`;
    const directory = resolve(root,'technology/source',entry.file.replace(/\.ts$/,''));
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0; url=${target}"><title>Continue to the system explanation</title><link rel="canonical" href="https://cathayflex.github.io/technology/"></head><body><p><a href="${target}">Continue to the system explanation.</a></p></body></html>
`;
    await mkdir(directory,{recursive:true});
    await writeFile(resolve(directory,'index.html'),html);
  }
  return manifest.files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await buildSourceRedirects(resolve(fileURLToPath(new URL('..',import.meta.url))));
  console.log(`Generated ${count} source chapter redirects.`);
}
