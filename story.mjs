import { seats, travellers, findExchange, settleExchange, redeem } from './market.mjs?v=20261002e';

const scenes = [
  { duration:7, chapter:'A change of plans', shot:'alex', kicker:'ALEX · A CHANGE OF PLANS', title:'Alex needs an<br> earlier arrival.', description:'His flight reaches Taipei at 13:40.<br> He now needs to arrive before 13:00.' },
  { duration:8, chapter:'A little flexibility', shot:'maya', kicker:'MAYA · A POSSIBLE CHANGE', title:'Maya can leave later.<br> She needs an aisle.', description:'Her place on the earlier flight could help Alex.<br> Flex asks what a change would need to include.' },
  { duration:8, chapter:'Words become conditions', shot:'ai', kicker:'FLEX · UNDERSTANDING MAYA', title:'Two conditions.<br> In her own words.', description:'AI organises Maya’s request.<br> She checks the conditions before Flex uses them.' },
  { duration:7, chapter:'Why a simple swap fails', shot:'maya', kicker:'FLEX · CHECKING A TWO-PERSON SWAP', title:'This swap misses<br> Maya’s condition.', description:'Alex would arrive earlier, but Maya would get<br> a window seat. Flex rules out this combination.' },
  { duration:7, chapter:'The third person', shot:'sam', kicker:'SAM · ANOTHER POSSIBILITY', title:'Sam has the aisle.<br> A window suits him too.', description:'He wants to keep the noon flight.<br> A seat change could work for him.' },
  { duration:12, chapter:'Finding the complete exchange', shot:'match', kicker:'FLEX · COORDINATING THREE CHANGES', title:'Three changes.<br> One complete fit.', description:'' },
  { duration:10, chapter:'Everyone decides', shot:'offers', kicker:'FLEX · ONE COMPLETE OFFER', title:'Every traveller<br> has a choice.', description:'Each person reviews their new booking.<br> Flex handles the offer and the credits.' },
  { duration:7, chapter:'The exchange is complete', shot:'alex', kicker:'ALEX · BOOKING CONFIRMED', title:'Alex can make<br> his connection.', description:'The complete exchange is confirmed.<br> Flex releases 600 credits to Maya and 100 to Sam.' },
  { duration:12, chapter:'Value on a future journey', shot:'maya', kicker:'MAYA · THREE WEEKS LATER', title:'Her flexibility pays<br> for something different.', description:'Maya uses 200 Flex credits for extra baggage<br> on a future trip to Tokyo.' },
  { duration:7, chapter:'What the exchange made possible', shot:'summary', kicker:'CATHAY FLEX', title:'An earlier arrival.<br> Rewards for future trips.', description:'One platform coordinates the changes,<br> confirms the bookings and settles the credits.' }
];
let duration=0;
scenes.forEach(scene=>{scene.start=duration;duration+=scene.duration;});
const result=findExchange();
const settled=settleExchange(travellers.map(person=>person.id));
const player=document.getElementById('story-player');
const screen=document.getElementById('film-screen');
const camera=document.getElementById('film-camera');
const platform=document.getElementById('film-platform');
const summary=document.getElementById('film-summary');
const play=document.getElementById('story-play');
const progress=document.getElementById('story-progress');
const previous=document.getElementById('story-previous');
const next=document.getElementById('story-next');
const dialog=document.getElementById('story-dialog');
const expand=document.getElementById('story-expand');
const close=document.getElementById('story-close');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let position=0,playing=false,lastFrame=null,animationFrame=0,lastKey='',activeScene=-1,placeholder=null,previousOverflow='';
const tickIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const bag='<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="9" y="11" width="19" height="20" rx="3"/><path d="M14 11V7a4 4 0 0 1 8 0v4M14 17v8m9-8v8M12 31v2m13-2v2"/></svg>';
const chair='<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M9 4h13l2 17H11L9 4Zm2 17v5h18v-5H11Zm4 5v6m11-6v6M7 15v10m0-7h4"/></svg>';
const clock=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
const initial=person=>seats.find(seat=>seat.id===person.initialSeat);
function indexAt() { return Math.min(scenes.length-1,Math.max(0,scenes.findLastIndex(scene=>position>=scene.start))); }
function header(person,label='Your journey') { return `<div class="device-bezel" aria-hidden="true"></div><div class="device-header"><span class="device-brand">Flex</span><span>${person.name}</span></div><div class="device-label">${label}</div>`; }
function booking(seat,label='YOUR BOOKING',highlight=false) { return `<div class="film-booking"><p>${label}</p><div class="flight-cities"><span>HKG</span>${arrow}<span>TPE</span></div><div class="flight-hours"><span>${seat.flight}<small>Departure</small></span><span class="${highlight?'time-emphasis':''}">${seat.arrival}<small>Arrival</small></span></div><div class="flight-seat"><span>Seat ${seat.seat}</span><strong>${seat.type}</strong></div></div>`; }
function message(name,words) { return `<div class="film-message"><span>${name} says</span><p>“${words}”</p></div>`; }
function cameraTarget(shot) {
  if (['maya','alex','sam'].includes(shot)) {
    const x={maya:90,alex:450,sam:810}[shot];
    return `translate(${780-x*1.12}px, -230px) scale(1.12)`;
  }
  if (shot==='ai') return 'translate(-307.5px, 160px) scale(1.35)';
  return 'translate(42px, 15px) scale(.93)';
}
function focusFor(index,elapsed) {
  if(index===5) return ['maya','sam','alex'][Math.min(2,Math.floor(elapsed/4))];
  if(index===6) return elapsed<8 ? ['maya','alex','sam'][Math.min(2,Math.floor(elapsed/2.5))] : 'all';
  if(index===8) return elapsed<6?'maya':'sam';
  return scenes[index].shot;
}
function drawPhones(index,elapsed,shot,focus) {
  travellers.forEach((person,i)=>{
    const phone=screen.querySelector(`[data-person="${person.id}"]`);
    const grouped=index===5||index===6;
    const visible=grouped||person.id===shot;
    phone.classList.toggle('is-visible',visible);
    phone.classList.toggle('is-focus',person.id===focus||focus==='all');
    phone.classList.toggle('is-compact',grouped);
    phone.setAttribute('aria-hidden',String(!visible));
    let body='';
    if(index===0&&person.id==='alex') {
      body=header(person)+booking(initial(person),'CURRENT FLIGHT',true)+'<div class="connection-alert"><span>CONNECTION UPDATE</span><strong>Arrive before 13:00</strong><p>Your current flight arrives too late.</p></div>';
    } else if(index===1&&person.id==='maya') {
      body=header(person,'A change that could work')+booking(initial(person))+message('Maya','I can fly two hours later, as long as I get an aisle seat.');
    } else if(index===3&&person.id==='maya') {
      body=header(person,'A candidate Flex rejects')+booking(seats[1],'TWO-PERSON SWAP')+'<div class="connection-alert"><span>CONDITION NOT MET</span><strong>Window seat offered</strong><p>Maya requires an aisle if she leaves later.</p></div>';
    } else if(index===4&&person.id==='sam') {
      body=header(person,'A seat he can change')+booking(initial(person))+message('Sam','A window or an aisle is fine. Keep me on the noon flight.');
    } else if(grouped) {
      const seat=settled.assignments[person.id];
      const accepted=index===6&&elapsed>=2+i*2.5;
      body=header(person,index===5?'A coordinated match':'Your offer from Flex')+`<div class="compact-booking"><strong>${seat.flight}</strong><span>Hong Kong to Taipei</span><p>Seat ${seat.seat} <b>${seat.type}</b></p></div>`;
      if(index===5) body+=`<div class="match-reason">${person.id==='maya'?'Sam’s aisle meets Maya’s condition.':person.id==='sam'?'Alex’s window keeps Sam on the noon flight.':'Maya’s flight gets Alex there at 11:40.'}</div>`;
      else body+=`<div class="compact-reward">${person.reward?'+'+person.reward+' Flex credits':'Earlier arrival at 11:40'}</div><div class="film-consent ${accepted?'is-accepted':''}">${accepted?tickIcon:''}${accepted?'Accepted':'Reviewing offer'}</div>`;
    } else if(index===7&&person.id==='alex') {
      body=header(person,'Your updated journey')+booking(settled.assignments.alex,'CONFIRMED FLIGHT')+`<div class="confirmed-arrival">${tickIcon}<strong>Arrival at 11:40</strong><p>Your earlier arrival is confirmed.</p></div>`;
    } else if(index===8&&person.id===shot) {
      const maya=person.id==='maya',price=maya?200:100;
      const localTime=maya?elapsed:elapsed-6;
      const spent=localTime>=3;
      body=header(person,'A future journey')+`<div class="future-city">HKG ${arrow} ${maya?'NRT':'BKK'}</div><div class="film-service">${maya?bag:chair}<h4>${maya?'Extra baggage':'A preferred seat'}</h4><p>${price} Flex credits</p></div><div class="film-consent ${spent?'is-accepted':''}">${spent?tickIcon:''}${spent?'Booked through Flex':'Choosing through Flex'}</div><div class="film-balance"><span>Flex balance</span><strong>${spent?redeem(person.reward,price):person.reward}</strong></div>`;
    }
    if(phone.dataset.content!==body) { phone.innerHTML=body;phone.dataset.content=body; }
  });
}
function drawPlatform(index,elapsed,focus) {
  const visible=index===2||index===5||index===6;
  platform.classList.toggle('is-visible',visible);
  platform.setAttribute('aria-hidden',String(!visible));
  platform.classList.toggle('is-ai',index===2);
  let body='<div class="film-platform-header"><span>Flex</span><small>Central platform</small></div>';
  if(index===2) body+='<div class="ai-mapping"><div><span>“Two hours later”</span>'+arrow+'<strong>Departure by 12:00</strong></div><div><span>“An aisle seat”</span>'+arrow+'<strong>Aisle required if later</strong></div></div><p class="platform-footnote">Maya confirms these conditions before matching.</p>';
  if(index===5) {
    const lines={maya:['Maya receives','Sam’s aisle seat','12:00 · Seat 18C'],sam:['Sam receives','Alex’s window seat','12:00 · Seat 18A'],alex:['Alex receives','Maya’s earlier flight','10:00 · Seat 22A']};
    const line=lines[focus];
    body+=`<div class="platform-assignment"><span>${line[0]}</span><strong>${line[1]}</strong><p>${line[2]}</p></div><p class="platform-footnote">${result.candidates.length} combinations checked · ${result.matches.length} meets every condition</p>`;
  }
  if(index===6) {
    const accepted=travellers.filter((_,i)=>elapsed>=2+i*2.5).length;
    body+=`<div class="platform-decisions"><strong>${accepted}<span> / 3</span></strong><p>travellers have accepted</p></div><p class="platform-footnote">Cathay funds 700 credits. Flex settles the complete offer.</p>`;
  }
  if(platform.dataset.content!==body) {platform.innerHTML=body;platform.dataset.content=body;}
}
function drawSummary(index) {
  summary.classList.toggle('is-visible',index===9);
  summary.setAttribute('aria-hidden',String(index!==9));
  if(index!==9)return;
  summary.innerHTML=`<div><span>Alex</span><strong>Arrival before<br> 13:00.</strong><p>A confirmed arrival at 11:40.</p></div><div><span>Maya</span><strong>An aisle seat.<br> Baggage next time.</strong><p>400 Flex credits remain.</p></div><div><span>Sam</span><strong>The same flight.<br> A future seat.</strong><p>His reward funds a later reservation.</p></div><p class="summary-ledger">700 credits issued <span>·</span> 300 used for services <span>·</span> 400 still available</p>`;
}
function render(force=false) {
  const index=indexAt(),scene=scenes[index],elapsed=position-scene.start;
  const focus=focusFor(index,elapsed);
  const sub=index===5?Math.min(2,Math.floor(elapsed/4)):index===6?Math.floor(elapsed/1.5):index===8?Math.floor(elapsed/3):0;
  const key=`${index}:${sub}:${focus}`;
  progress.value=position;
  progress.style.setProperty('--progress',`${position/duration*100}%`);
  document.getElementById('story-time').textContent=`${clock(position)} / ${clock(duration)}`;
  previous.disabled=index===0;next.disabled=index===scenes.length-1;
  if(!force&&key===lastKey)return;
  const changed=index!==activeScene;activeScene=index;lastKey=key;
  const shot=index===8?focus:scene.shot;
  screen.dataset.shot=shot;
  screen.dataset.focus=focus;
  screen.classList.toggle('camera-moving',playing&&!reducedMotion.matches);
  camera.style.transform=cameraTarget(shot);
  document.getElementById('scene-number').textContent=`SCENE ${String(index+1).padStart(2,'0')} / 10`;
  document.getElementById('scene-title').textContent=scene.chapter;
  document.getElementById('shot-kicker').textContent=index===8&&focus==='sam'?'SAM · ON ANOTHER JOURNEY':scene.kicker;
  document.getElementById('shot-title').innerHTML=index===8&&focus==='sam'?'His reward becomes<br> a seat he prefers.':scene.title;
  document.getElementById('shot-description').innerHTML=index===5?{maya:'Maya gets an aisle<br> on the later flight.',sam:'Sam keeps his flight<br> and takes the window.',alex:'Alex takes the earlier flight<br> and arrives before 13:00.'}[focus]:index===8&&focus==='sam'?'Sam uses his 100 credits for a preferred seat<br> on a future trip to Bangkok.':scene.description;
  progress.setAttribute('aria-valuetext',`Scene ${index+1} of 10, ${scene.chapter}.`);
  drawPhones(index,elapsed,shot,focus);drawPlatform(index,elapsed,focus);drawSummary(index);
  if(changed&&playing&&!reducedMotion.matches) {
    const copy=screen.querySelector('.film-copy');copy.getAnimations().forEach(a=>a.cancel());
    copy.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:700,easing:'cubic-bezier(.23,1,.32,1)'});
  }
}
function updatePlay() {
  play.innerHTML=playing?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zm6 0h3v14h-3Z"/></svg><span>Pause</span>':`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z"/></svg><span>${position>=duration?'Replay story':position===0?'Play story':'Continue'}</span>`;
  play.setAttribute('aria-label',playing?'Pause the exchange story':position>=duration?'Replay the exchange story':'Play the exchange story');
  screen.classList.toggle('is-playing',playing);
}
function pause(){playing=false;lastFrame=null;cancelAnimationFrame(animationFrame);updatePlay();}
function tick(now){if(!playing)return;if(lastFrame!==null)position=Math.min(duration,position+(now-lastFrame)/1000);lastFrame=now;render();if(position>=duration){pause();return;}animationFrame=requestAnimationFrame(tick);}
play.addEventListener('click',()=>{if(playing){pause();return;}if(position>=duration)position=0;playing=true;lastFrame=null;updatePlay();render();animationFrame=requestAnimationFrame(tick);});
function seek(value){pause();position=value;render(true);updatePlay();}
progress.addEventListener('input',()=>seek(Number(progress.value)));
previous.addEventListener('click',()=>seek(scenes[Math.max(0,indexAt()-1)].start));
next.addEventListener('click',()=>seek(scenes[Math.min(scenes.length-1,indexAt()+1)].start));
expand.addEventListener('click',()=>{placeholder=document.createElement('div');placeholder.style.height=player.offsetHeight+'px';player.replaceWith(placeholder);dialog.append(player);previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();play.focus();});
close.addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{pause();if(placeholder)placeholder.replaceWith(player);placeholder=null;document.body.style.overflow=previousOverflow;expand.focus({preventScroll:true});});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&playing)pause();},{threshold:0}).observe(screen);
new ResizeObserver(entries=>{screen.style.setProperty('--film-scale',entries[0].contentRect.width/1200);}).observe(screen);
progress.max=duration;
render();
