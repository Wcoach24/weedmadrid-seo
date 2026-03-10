/* Weed Madrid — Personalization Engine v1.0 */
(function() {
  'use strict';

  const CONFIG = {
    storageKey: 'wm_user',
    inviteUrl: 'https://www.weedmadrid.com/invite/vallehermoso-club-social-madrid',
    socialProofMin: 1847,
    socialProofMax: 1853
  };

  function getUserProfile() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw) {
        const profile = JSON.parse(raw);
        profile.visits = (profile.visits || 0) + 1;
        profile.returningUser = true;
        profile.lastVisit = new Date().toISOString();
        // Track page
        const page = window.location.pathname;
        if (!profile.pagesViewed.includes(page)) {
          profile.pagesViewed.push(page);
        }
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(profile));
        return profile;
      }
    } catch (e) {
      // localStorage not available
    }
    const newProfile = {
      firstVisit: new Date().toISOString(),
      lastVisit: new Date().toISOString(),
      visits: 1,
      returningUser: false,
      pagesViewed: [window.location.pathname],
      preferredLang: document.documentElement.lang || 'es',
      referrer: document.referrer || 'direct'
    };
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(newProfile));
    } catch (e) {}
    return newProfile;
  }

  function personalizeCTAs(profile) {
    const ctas = document.querySelectorAll('[data-cta]');
    ctas.forEach(function(ctaBox) {
      const ctaType = ctaBox.getAttribute('data-cta');
      // Returning users get urgency messaging
      if (profile.returningUser && profile.visits > 2) {
        const btn = ctaBox.querySelector('.btn-primary');
        if (btn) {
          const lang = document.documentElement.lang || 'es';
          const urgencyTexts = {
            es: 'Solicitar Invitación Ahora',
            en: 'Request Your Invitation Now',
            fr: 'Demander Votre Invitation',
            it: 'Richiedi il Tuo Invito Ora',
            de: 'Jetzt Einladung Anfordern',
            pt: 'Solicitar Convite Agora'
          };
          btn.textContent = urgencyTexts[lang] || urgencyTexts.en;
        }
      }
    });
  }

  function injectSocialProof(profile) {
    const counters = document.querySelectorAll('[data-social-proof]');
    if (!counters.length) return;
    // Randomize slightly for believability
    const count = CONFIG.socialProofMin + Math.floor(Math.random() * (CONFIG.socialProofMax - CONFIG.socialProofMin));
    counters.forEach(function(el) {
      el.textContent = count.toLocaleString() + '+';
    });
  }

  function initFAQAccordion() {
    document.querySelectorAll('.faq-question').forEach(function(question) {
      question.addEventListener('click', function() {
        const answer = this.nextElementSibling;
        const isOpen = answer.style.maxHeight;
        // Close all others
        document.querySelectorAll('.faq-answer').forEach(function(a) {
          a.style.maxHeight = null;
        });
        document.querySelectorAll('.faq-question').forEach(function(q) {
          q.classList.remove('active');
        });
        if (!isOpen) {
          answer.style.maxHeight = answer.scrollHeight + 'px';
          this.classList.add('active');
        }
      });
    });
  }

  function trackZoneInterest(profile) {
    // If user is on a zone page, track it
    const path = window.location.pathname;
    const zoneMatch = path.match(/\/clubes\/([a-z-]+)/);
    if (zoneMatch) {
      profile.lastZone = zoneMatch[1];
      try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(profile));
      } catch (e) {}
    }
  }

  function init() {
    var profile = getUserProfile();
    personalizeCTAs(profile);
    injectSocialProof(profile);
    initFAQAccordion();
    trackZoneInterest(profile);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
