import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('the published source manifest identifies the exact browser bundle and domain files',async()=>{
  const root=new URL('../technology/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  const hash=data=>createHash('sha256').update(data).digest('hex');
  assert.equal(hash(await readFile(new URL('engine.mjs',root))),manifest.engineSha256);
  for(const file of manifest.files){
    assert.match(file.file,/^[a-z-]+\.ts$/);
    assert.equal(hash(await readFile(new URL(`source/${file.file}`,root))),file.sha256);
  }
  assert.equal(hash(JSON.stringify(manifest.files)),manifest.sourceTreeDigest);
  assert(!manifest.files.some(file=>/auth|store|agent|env/.test(file.file)));
});
