const icons = {
  flight: '<svg viewBox="0 0 36 36"><path d="m5 20 26-11-10 24-5-11-11-2Zm11 2L31 9M7 28l-3 3m8-2-3 4"/></svg>',
  bag: '<svg viewBox="0 0 36 36"><rect x="9" y="11" width="19" height="20" rx="3"/><path d="M14 11V7a4 4 0 0 1 8 0v4M14 17v8m9-8v8M12 31v2m13-2v2"/></svg>',
  seat: '<svg viewBox="0 0 36 36"><path d="M9 4h13l2 17H11L9 4Zm2 17v5h18v-5H11Zm4 5v6m11-6v6M7 15v10m0-7h4"/></svg>',
  meal: '<svg viewBox="0 0 36 36"><path d="M5 24h26M8 24a10 10 0 0 1 20 0M18 12V9m-4 0h8M8 29h20"/></svg>'
};
const stories = [
  {kind:'FLIGHT TIMING TO BAGGAGE', title:'A little later today.<br>A little more next time.', description:'When a later flight works for you, that flexibility can free a place for someone who needs it. Earn Flex, then put it towards extra baggage on another journey.', footnote:'Different resources. Different journeys. Connected by Flex.', label:'YOUR FLEXIBILITY, CARRIED FORWARD', give:{time:'THIS JOURNEY',label:'Your flight timing',title:'A later departure',detail:'Same day. Same cabin. On your terms.',icon:'flight'}, receive:{time:'YOUR NEXT JOURNEY',label:'Your travel extras',title:'Room for one more bag',detail:'Use the value you earned when you need it.',icon:'bag'}, bottom:'Value moves with you.', accessible:'Flight flexibility earns Flex credits, which can be used for baggage on a future journey'},
  {kind:'SEAT PREFERENCES TO A BETTER FIT', title:'An aisle for you.<br>A window for someone else.', description:'You prefer the aisle. Another traveller prefers the window. Flex connects compatible preferences, including exchanges between several travellers, so more people can find a better fit.',footnote:'An exchange can include Flex credits when preferences differ in value.',label:'DIFFERENT PREFERENCES, BETTER MATCHED',give:{time:'WHAT YOU CAN OFFER',label:'Your current place',title:'A window seat',detail:'Another traveller prefers the view.',icon:'seat'},receive:{time:'WHAT MATTERS TO YOU',label:'Your preferred place',title:'An aisle seat',detail:'Every traveller agrees before a change is made.',icon:'seat'},bottom:'A better fit can start with a different preference.',accessible:'A traveller exchanges a window seat for a preferred aisle seat when all participants agree'},
  {kind:'CATERING CHOICE TO A FUTURE EXTRA', title:'A choice today.<br>Comfort on another journey.',description:'An early meal choice helps the airline plan what to prepare. An eligible opt-out earns Flex that can go towards a seat reservation on a future journey.',footnote:'The opportunity depends on the service, its preparation deadline and availability.',label:'A SMALL CHOICE, WITH VALUE BEYOND TODAY',give:{time:'BEFORE THIS FLIGHT',label:'Your meal preference',title:'Skip an eligible meal',detail:'Confirm before the preparation deadline.',icon:'meal'},receive:{time:'ON A FUTURE JOURNEY',label:'Your travel extras',title:'A seat you prefer',detail:'Put earned Flex towards an eligible reservation.',icon:'seat'},bottom:'Different moments. The same value.',accessible:'An eligible advance meal change earns Flex credits towards a future seat reservation'}
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tabs = [...document.querySelectorAll('[data-story]')];
const panel = document.getElementById('story-panel');
let active = 0;
let storyAnimations = [];
function setStory(index, animate = false) {
  const story = stories[index];
  active = index;
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', 'story-tab-' + index);
  document.getElementById('story-kind').textContent = story.kind;
  document.getElementById('story-title').innerHTML = story.title;
  document.getElementById('story-description').textContent = story.description;
  document.getElementById('story-footnote').textContent = story.footnote;
  document.getElementById('exchange-label').textContent = story.label;
  document.getElementById('exchange-bottomline').textContent = story.bottom;
  document.querySelector('.exchange-art').setAttribute('aria-label', story.accessible);
  for (const side of ['give', 'receive']) {
    for (const field of ['time', 'label', 'title', 'detail']) document.getElementById(side + '-' + field).textContent = story[side][field];
    document.getElementById(side + '-icon').innerHTML = icons[story[side].icon];
  }
  const token = document.querySelector('.flex-token');
  token.innerHTML = index === 1 ? '<svg viewBox="0 0 24 18" width="22" height="18" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 5h18m-4-4 4 4-4 4M22 13H4m4-4-4 4 4 4"/></svg>' : 'Flex';
  storyAnimations.forEach(animation => animation.cancel());
  storyAnimations = [];
  if (animate && !reducedMotion.matches) {
    storyAnimations = [document.querySelector('.story-editorial'), ...document.querySelectorAll('.exchange-ticket')].map((element, i) =>
      element.animate([{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}], {duration:280,delay:i*25,easing:'cubic-bezier(.23,1,.32,1)'})
    );
  }
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', event => { if (active !== index) setStory(index, event.detail > 0); });
  tab.addEventListener('keydown', event => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setStory(next);
    tabs[next].focus();
  });
});
setStory(0);
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.getElementById('site-nav');
const narrow = matchMedia('(max-width: 800px)');
function closeMenu(restoreFocus = false) {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.hidden = narrow.matches;
  if (restoreFocus) menuButton.focus();
}
closeMenu();
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.hidden = !open;
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  document.documentElement.dataset.keyboard = 'true';
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('pointerdown', event => {
  document.documentElement.dataset.keyboard = 'false';
  if (narrow.matches && !event.target.closest('.site-header')) closeMenu();
}, { passive:true });
narrow.addEventListener('change', () => closeMenu());
const header = document.querySelector('.site-header');
function updateHeader() { header.classList.toggle('scrolled', scrollY > 12); }
addEventListener('scroll', updateHeader, { passive:true });
updateHeader();
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (document.documentElement.dataset.keyboard !== 'true') {
        entry.target.animate([{opacity:.25,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}], {duration:700,easing:'cubic-bezier(.23,1,.32,1)'});
      }
      observer.unobserve(entry.target);
    });
  }, { threshold:.12 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}
