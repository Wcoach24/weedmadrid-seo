/* Weed Madrid Personalization Engine — See full 757-line implementation in source */
(function() {
  'use strict';
  const CONFIG = { storageKey: 'wm_user', inviteUrl: 'https://www.weedmadrid.com/invite/vallehermoso-club-social-madrid' };
  function getUserProfile() { try { const raw = localStorage.getItem(CONFIG.storageKey); if(raw) { const p = JSON.parse(raw); p.visits++; return p; } } catch(e) {} return { firstVisit: new Date().toISOString(), visits: 1, returningUser: false, pagesViewed: [] }; }
  function init() { const profile = getUserProfile(); personalizeCTAs(profile); injectSocialProof(profile); initFAQAccordion(); }
  function personalizeCTAs(profile) { const ctas = document.querySelectorAll('[data-cta]'); ctas.forEach(c => { if(profile.visits > 1) c.textContent = 'Continue'; }); }
  function injectSocialProof() { const counters = document.querySelectorAll('[data-social-proof]'); counters.forEach(c => { c.textContent = '1,850+'; }); }
  function initFAQAccordion() { document.querySelectorAll('.faq-question').forEach(q => { q.addEventListener('click', function() { this.nextElementSibling.style.maxHeight = this.nextElementSibling.style.maxHeight ? null : this.nextElementSibling.scrollHeight + 'px'; }); }); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();