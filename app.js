const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
const navigationLinks = [...navigation.querySelectorAll('a[href^="#"]')];
const navigationSections = navigationLinks.map(link => document.querySelector(link.getAttribute('href')));
let currentSection = -1;
function updateHeader() {
  header.classList.toggle('scrolled', scrollY > 12);
  let next = -1;
  navigationSections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= header.offsetHeight + 80) next = index;
  });
  if (next === currentSection) return;
  currentSection = next;
  navigationLinks.forEach((link, index) => {
    if (index === next) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
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
