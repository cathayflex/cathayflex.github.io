import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const modules = {
  'predicates.ts': {
    title:'Condition evaluation', chapter:'understand',
    purpose:'Check when a traveller’s conditions apply, including combinations such as “both”, “either” and “except”.',
    input:'A structured condition tree and the facts available for each individual condition.',
    result:'Each check returns true, false or unknown. AND, OR and NOT preserve that distinction as conditions are combined.',
    safeguard:'Missing information remains unknown, including under NOT. The matching system requires a true permission condition before proposing the corresponding change.',
    example:true,
  },
  'order-book.ts': {
    title:'The request book', chapter:'market-model',
    purpose:'Make the current requests, saved flexibility and pending agreements readable from one consistent state.',
    input:'The platform’s current requests, permissions, contracts and wallet reservations.',
    result:'A detached view of lifecycle status, exact authorization, consent, funding and the reason each entry has that status.',
    safeguard:'Reading the book cannot publish a request, change a price, reserve inventory or process an expiry. Saved flexibility carries no transaction authority.',
  },
  'selection.ts': {
    title:'Selecting compatible arrangements', chapter:'match',
    purpose:'Choose complete arrangements that can coexist within the available resources and funding.',
    input:'Individually validated candidate contracts, active reservations, resource capacity and the declared objective.',
    result:'A compatible selection, an objective value and an upper bound. A stopped search retains a feasible result and reports its remaining uncertainty.',
    safeguard:'Conflicting seats, allocation dependencies, wallet debits, request earmarks and reward budgets constrain the selection. The proof covers the supplied candidate set.',
  },
  'engine.ts': {
    title:'Confirming and settling changes', chapter:'commit',
    purpose:'Carry an authorized arrangement through reservation, participant consent, verified execution and settlement.',
    input:'The current state and a command with its request identity and expected state version.',
    result:'A new state containing the resulting reservations, contract status, booking changes and verified ledger entries.',
    safeguard:'Stale commands and changed booking dependencies are checked. Uncertain adapter writes keep their reservations during reconciliation. Airline adapters here are simulated.',
  },
  'intent.ts': {
    title:'Validating travel requirements', chapter:'understand',
    purpose:'Connect reviewed statements to booking facts and check the conditions that apply to a proposed outcome.',
    input:'Saved rules and their source evidence, the traveller’s account context and proposed allocation changes.',
    result:'Applicable requirements, validation issues and request progress. Complete outcomes include companions who keep their existing seats.',
    safeguard:'Standing hard restrictions survive softer journey preferences. Unsupported or ambiguous requirements need review before they can authorize a change.',
  },
  'request-quote.ts': {
    title:'Validating fixed quotes', chapter:'commit',
    purpose:'Give a reviewed request an exact credit price and verify that later arrangements still satisfy the accepted terms.',
    input:'The reviewed request, booking and party context, product catalog and chosen validity period.',
    result:'A fixed quote with specific products, quantities and debit, or a reason the request cannot be quoted. Candidate coverage is checked against those exact terms.',
    safeguard:'A change to the accepted request revision, booking, party or quoted product invalidates reuse. Matching cannot silently substitute a different price or incomplete bundle.',
  },
  'request-quote-schema.ts': {
    title:'The fixed quote contract', chapter:'commit',
    purpose:'Define the fields that a fixed quote and its publication terms must contain.',
    input:'A proposed quote or request authorization payload.',
    result:'A validated structured record containing the request identity, exact line items, debit and expiry.',
    safeguard:'Shape validation is followed by contextual validation in the quote and transaction modules. A well-formed object alone grants no authority.',
  },
  'generic-market.ts': {
    title:'Constructing complete arrangements', chapter:'match',
    purpose:'Find candidate exchanges from available rights and reviewed conditions across the supported resource types.',
    input:'Current allocations, inventory, requests, permissions and generation budgets.',
    result:'Bounded seat cycles, chains, joint party arrangements and resource bundles, together with generation diagnostics.',
    safeguard:'Complete outcomes still pass deterministic validation. Generation limits are reported and can leave feasible arrangements outside the explored domain.',
  },
  'seed.ts': {
    title:'Synthetic booking data', chapter:'evidence',
    purpose:'Provide reproducible starting states for the platform and public examples.',
    input:'The selected example setup.',
    result:'Synthetic travellers, bookings, resources, wallets and operating assumptions.',
    safeguard:'These fixtures illustrate the system. They contain no live airline bookings and provide no evidence of production demand or economics.',
  },
  'story.ts': {
    title:'The demonstration sequence', chapter:'evidence',
    purpose:'Connect a prepared travel story to commands that run through the platform’s transition engine.',
    input:'The current demonstration step and state.',
    result:'The next story command and its prepared travel context.',
    safeguard:'The story is an authored example. Its commands use the domain engine, and its successful outcome does not establish general matching coverage.',
  },
  'time.ts': {
    title:'Simulation time', chapter:'evidence',
    purpose:'Translate the simulation clock into consistent journey and expiry times.',
    input:'The simulation’s recorded time and calendar context.',
    result:'Time values shared by the example and its lifecycle checks.',
    safeguard:'Controlled simulation time is separate from a production scheduling service.',
  },
  'types.ts': {
    title:'The domain model', chapter:'market-model',
    purpose:'Give resources, conditions, candidates, contracts and commands explicit shared structures.',
    input:'The concepts represented by the matching and transaction system.',
    result:'TypeScript definitions used throughout the domain modules.',
    safeguard:'Static types describe valid structures. Runtime validation and transaction checks still enforce the actual state and authority.',
  },
};
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function buildSourceReaders(root) {
  const manifest = JSON.parse(await readFile(resolve(root,'technology/manifest.json'),'utf8'));
  const technology = await readFile(resolve(root,'technology/index.html'),'utf8');
  const header = technology.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0]
    .replace('href="/#intelligence"','href="/technology/"')
    .replace('Back to the idea','Inside the system')
    .replace('href="#evidence"','href="/technology/#evidence"');
  if (!header) throw new Error('The technology header is missing.');
  const css = createHash('sha256').update(await readFile(resolve(root,'technology/source/reader.css'))).digest('hex').slice(0,12);
  for (const entry of manifest.files) {
    const description = modules[entry.file];
    if (!description) throw new Error(`Add a reader explanation for ${entry.file}.`);
    const source = await readFile(resolve(root,'technology/source',entry.file),'utf8');
    if (createHash('sha256').update(source).digest('hex') !== entry.sha256) throw new Error(`Source hash mismatch for ${entry.file}.`);
    const slug = entry.file.replace(/\.ts$/,'');
    const directory = resolve(root,'technology/source',slug);
    const example = description.example ? `<section class="reader-example" aria-labelledby="example-title"><h2 id="example-title">When a condition is unknown</h2><p>Suppose a permission requires both a short flight and a solo booking. The flight duration is known, but the booking party is unresolved.</p><dl><div><dt>Flight is short</dt><dd>True</dd></div><div><dt>Traveller is flying alone</dt><dd>Unknown</dd></div><div><dt>Both conditions apply</dt><dd>Unknown</dd></div></dl><p>The system cannot use that permission until the missing context is resolved. Negating an unknown condition still produces unknown.</p></section>` : '';
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(description.title)} | Cathay Flex</title><meta name="description" content="${escape(description.purpose)}"><meta name="theme-color" content="#006564"><link rel="canonical" href="https://cathayflex.github.io/technology/source/${slug}/"><link rel="icon" href="/assets/cathay-brushwing.png"><link rel="stylesheet" href="/fonts.css?v=20261003-cathay"><link rel="stylesheet" href="/style.css?v=20261003-clear-headings"><link rel="stylesheet" href="/technology/source/reader.css?v=${css}"><script src="/app.js?v=20261003-product" defer></script></head>
<body><a class="skip-link" href="#main">Skip to content</a>${header}
<main id="main" class="source-reader" tabindex="-1"><a class="reader-back" href="/technology/#${description.chapter}"><span aria-hidden="true">←</span> Back to the explanation</a><p class="reader-eyebrow">INSIDE THE IMPLEMENTATION</p><h1>${escape(description.title)}</h1><p class="reader-intro">${escape(description.purpose)}</p><dl class="reader-facts"><div><dt>What it reads</dt><dd>${escape(description.input)}</dd></div><div><dt>What it produces</dt><dd>${escape(description.result)}</dd></div><div><dt>What to know</dt><dd>${escape(description.safeguard)}</dd></div></dl>${example}
<details class="reader-code"><summary><span>View TypeScript source</span><span class="reader-file">${entry.file}</span><span class="reader-plus" aria-hidden="true">+</span></summary><div class="reader-code-body"><p>TypeScript is the implementation language. This is the source exported with the public matching engine.</p><pre tabindex="0" aria-label="${escape(entry.file)} source"><code>${escape(source)}</code></pre><a href="https://github.com/cathayflex/cathayflex.github.io/blob/main/technology/source/${entry.file}" target="_blank" rel="noopener">View this file on GitHub <span aria-hidden="true">↗</span></a></div></details>
<details class="reader-provenance"><summary>Source verification</summary><p>The source shown above matches the published export manifest.</p><dl><dt>SHA-256</dt><dd><code>${entry.sha256}</code></dd><dt>Platform source commit</dt><dd><code>${manifest.platformBaseCommit}</code></dd></dl></details></main><footer class="site-footer"><div class="footer-main"><p>Team Globe · Cathay Hackathon 2026</p><a href="/technology/">Inside the system <span aria-hidden="true">↗</span></a></div></footer></body></html>
`;
    await mkdir(directory,{recursive:true});
    await writeFile(resolve(directory,'index.html'),html);
  }
  return manifest.files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await buildSourceReaders(resolve(fileURLToPath(new URL('..',import.meta.url))));
  console.log(`Generated ${count} source reading pages.`);
}
