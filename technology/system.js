const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const interpretations = {
  request: {
    words:'“For <em>Tokyo</em>, can the <em>three of us sit together</em>? We also need <em>one extra checked bag</em>.”',
    context:'Your booking · CX 520 · Lin, Mia and Jamie',
    rules:[['Journey','CX 520 · Hong Kong to Tokyo',''],['Seating','3 adjacent seats','Same row and seat block · Lin, Mia, Jamie'],['Baggage','1 extra checked bag','Catalog product · up to 23 kg']],
    caption:'Review the requirements, accept the quote, publish the request.',
    announcement:'Travel request. The Tokyo booking, three adjacent seats and one extra bag become matching requirements.',
  },
  flexibility: {
    words:'“When I travel <em>alone</em>, any seat is fine on flights <em>up to six hours</em>. On longer flights, I need an <em>aisle</em>. With my family, I’d like us to <em>sit together</em>.”',
    context:'Saved preferences · Applied to the relevant journeys',
    rules:[['Acceptable','Any seat','Solo · Flight ≤ 6 hours'],['Required','Aisle seat','Solo · Flight > 6 hours'],['Preferred','Seats together','Family journey']],
    caption:'Saved flexibility guides which changes Flex offers you.',
    announcement:'Saved flexibility. Solo short flights allow any seat. Solo long flights require an aisle. Family journeys prefer seats together.',
  },
};
let interpretationAnimation;
const interpretationContent=document.getElementById('interpretation-content');
for(const button of document.querySelectorAll('[data-interpret]')) button.addEventListener('click',event=>{
  if(button.getAttribute('aria-pressed')==='true') return;
  const value=interpretations[button.dataset.interpret];
  document.querySelectorAll('[data-interpret]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  document.getElementById('spoken-words').innerHTML=value.words;
  document.getElementById('spoken-context').textContent=value.context;
  document.getElementById('interpreted-rules').innerHTML=value.rules.map(([name,rule,scope])=>`<div><dt>${name}</dt><dd>${rule}${scope?`<small>${scope}</small>`:''}</dd></div>`).join('');
  document.getElementById('interpretation-caption').textContent=value.caption;
  document.getElementById('interpretation-status').textContent=value.announcement;
  interpretationAnimation?.cancel();
  if(event.detail&&!reduced.matches) interpretationAnimation=interpretationContent.animate([{opacity:.4,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)'});
});
reduced.addEventListener('change',()=>interpretationAnimation?.cancel());
const chapterLinks=[...document.querySelectorAll('.chapter-nav a')];
const sections=chapterLinks.map(link=>document.querySelector(link.hash));
function updateChapter(){
  let active=0;
  sections.forEach((section,index)=>{if(section.getBoundingClientRect().top<200)active=index;});
  chapterLinks.forEach((link,index)=>{if(index===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
}
addEventListener('scroll',updateChapter,{passive:true});updateChapter();
fetch('manifest.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(manifest=>{
  document.getElementById('build-evidence').textContent=`${manifest.files.length} domain modules · Source digest ${manifest.sourceTreeDigest.slice(0,12)} · Exported ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Hong_Kong'}).format(new Date(manifest.generatedAt))}`;
}).catch(()=>{document.getElementById('build-evidence').textContent='Source hashes and export details are included in the repository manifest.';});
fetch('benchmark.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(report=>{
  const rows=report.rows.filter(row=>row.nodeLimit===20000);
  document.getElementById('benchmark-results').innerHTML=`<p class="benchmark-context">Recorded selection runs · 20,000-node budget · ${report.platform} ${report.arch}</p><div class="benchmark-scroll" tabindex="0" aria-label="Measured search results"><table><thead><tr><th>Candidates</th><th>Nodes visited</th><th>Result</th><th>Time</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.suppliedCandidates}</td><td>${row.visited.toLocaleString('en')}</td><td>${row.complete?'Best within supplied set':'Feasible at search limit'}</td><td>${row.elapsedMs.toFixed(1)} ms</td></tr>`).join('')}</tbody></table></div>`;
}).catch(()=>{document.getElementById('benchmark-results').innerHTML='<p>The recorded search results are available in the repository’s benchmark data.</p>';});
