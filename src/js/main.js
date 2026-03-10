'use strict';

// ============================================================================
// WEED MADRID - MAIN JAVASCRIPT
// Conversion-optimized features + existing functionality preserved
// ============================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initLanguageSelector();
  initMobileMenu();
  initCTATracking();
  initMapIfNeeded();
  initViewingCount();
  initTimeBasedGreeting();
  initReturningVisitor();
  initScrollProgress();
  initSmartCTAVisibility();
  initFAQAutoExpand();
  initNumberCounter();
  initExitIntent();
  initUTMCapture();
  initMobileNavClose();
  initRevealAnimations();
  initFAQAccordion();
});

// ============================================================================
// 1. LANGUAGE SELECTOR (existing)
// ============================================================================
function initLanguageSelector() {
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', function(e) {
      const lang = e.target.value;
      window.location.href = lang;
    });
  }
}

// ============================================================================
// 2. MOBILE MENU TOGGLE (existing)
// ============================================================================
function initMobileMenu() {
  const navbarToggle = document.getElementById('navbarToggle');
  const navbarMenu = document.getElementById('navbarMenu');

  if (navbarToggle && navbarMenu) {
    navbarToggle.addEventListener('click', function() {
      navbarMenu.classList.toggle('active');
    });
  }
}

// ============================================================================
// 3. CTA TRACKING (existing + enhanced with UTM)
// ============================================================================
function initCTATracking() {
  const ctaLinks = document.querySelectorAll('[data-event]');
  ctaLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const event = this.getAttribute('data-event');
      if (window.gtag) {
        gtag('event', event);
      }
      console.log('CTA event:', event);
    });
  });
}

// ============================================================================
// 4. MAP INITIALIZATION (existing)
// ============================================================================
function initMapIfNeeded() {
  const mapContainer = document.getElementById('mapContainer');
  const zoneMapContainer = document.getElementById('zoneMapContainer');

  if (mapContainer || zoneMapContainer) {
    loadMap();
  }
}

function loadMap() {
  // Placeholder for map loading
  // In production, use Leaflet.js with OpenStreetMap tiles
  console.log('Map would be loaded here using Leaflet.js');
}

// ============================================================================
// 5. LIVE VIEWING COUNT (new - personalization feature)
// ============================================================================
function initViewingCount() {
  const viewingCountEl = document.getElementById('viewingCount');
  if (!viewingCountEl) return;

  // Set initial random count
  function updateViewingCount() {
    const newCount = Math.floor(Math.random() * (85 - 35 + 1)) + 35;
    viewingCountEl.textContent = newCount;
  }

  updateViewingCount();

  // Update every 30-45 seconds
  setInterval(() => {
    updateViewingCount();
  }, Math.random() * (45000 - 30000) + 30000);
}

// ============================================================================
// 6. TIME-BASED GREETING (new - personalization feature)
// ============================================================================
function initTimeBasedGreeting() {
  const heroSubtitle = document.querySelector('.hero-subtitle');
  if (!heroSubtitle) return;

  const hour = new Date().getHours();
  const lang = document.documentElement.lang || 'es';
  let greeting = '';

  if (hour < 12) {
    greeting = lang === 'en' ? 'Good morning' : 'Buenos días';
  } else if (hour < 18) {
    greeting = lang === 'en' ? 'Good afternoon' : 'Buenas tardes';
  } else {
    greeting = lang === 'en' ? 'Good evening' : 'Buenas noches';
  }

  // Prepend greeting to subtitle
  const greetingEl = document.createElement('span');
  greetingEl.className = 'time-based-greeting';
  greetingEl.textContent = greeting + '. ';
  heroSubtitle.insertBefore(greetingEl, heroSubtitle.firstChild);
}

// ============================================================================
// 7. RETURNING VISITOR DETECTION (new - personalization feature)
// ============================================================================
function initReturningVisitor() {
  const visits = parseInt(localStorage.getItem('wm_visits') || '0', 10);
  const newVisits = visits + 1;
  localStorage.setItem('wm_visits', newVisits);

  if (newVisits > 1) {
    document.body.classList.add('returning-visitor');
    // CSS can now target .returning-visitor to show different content
  }
}

// ============================================================================
// 8. SCROLL PROGRESS INDICATOR (new - conversion feature)
// ============================================================================
function initScrollProgress() {
  // Create scroll progress element
  const scrollProgressEl = document.createElement('div');
  scrollProgressEl.className = 'scroll-progress';
  scrollProgressEl.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: #c9a96e;
    z-index: 9999;
    width: 0%;
    transition: width 0.2s ease;
  `;
  document.body.appendChild(scrollProgressEl);

  // Update progress on scroll
  window.addEventListener('scroll', function() {
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight - windowHeight;
    const scrolled = (window.scrollY / docHeight) * 100;
    scrollProgressEl.style.width = Math.min(scrolled, 100) + '%';
  });
}

// ============================================================================
// 9. SMART CTA VISIBILITY (new - conversion feature)
// ============================================================================
function initSmartCTAVisibility() {
  window.addEventListener('scroll', function() {
    const docHeight = document.documentElement.scrollHeight;
    const scrolled = window.scrollY + window.innerHeight;
    const percentScrolled = (scrolled / docHeight) * 100;

    if (percentScrolled > 40) {
      document.body.classList.add('cta-visible');
    }
  });
}

// ============================================================================
// 10. FAQ AUTO-EXPAND FIRST (new - conversion feature)
// ============================================================================
function initFAQAutoExpand() {
  const faqItems = document.querySelectorAll('details.faq-item, [data-faq-toggle]');
  if (!faqItems.length) return;

  let faqInteracted = false;

  // Track if user interacted with any FAQ
  faqItems.forEach(item => {
    if (item.tagName === 'DETAILS') {
      item.addEventListener('toggle', () => {
        faqInteracted = true;
      });
    } else {
      const h3 = item.querySelector('h3');
      if (h3) {
        h3.addEventListener('click', () => {
          faqInteracted = true;
        });
      }
    }
  });

  // Auto-expand first FAQ after 2 seconds if no interaction
  setTimeout(() => {
    if (!faqInteracted && faqItems.length > 0) {
      const firstFAQ = faqItems[0];
      if (firstFAQ.tagName === 'DETAILS') {
        firstFAQ.open = true;
      } else {
        firstFAQ.classList.add('open');
      }
    }
  }, 2000);
}

// ============================================================================
// 11. SMOOTH NUMBER COUNTER (new - conversion feature)
// ============================================================================
function initNumberCounter() {
  const statsSection = document.querySelector('.cta-stats');
  if (!statsSection || !('IntersectionObserver' in window)) return;

  let hasAnimated = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        animateNumbers();
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  observer.observe(statsSection);

  function animateNumbers() {
    const numbers = statsSection.querySelectorAll('[data-target]');
    numbers.forEach(el => {
      const target = parseInt(el.getAttribute('data-target'), 10);
      const duration = 1500; // 1.5 seconds
      const start = Date.now();

      function update() {
        const now = Date.now();
        const progress = Math.min((now - start) / duration, 1);
        const current = Math.floor(target * progress);

        let displayText = current.toLocaleString();
        // Preserve suffix (like + or ★)
        const suffix = el.textContent.replace(/[0-9,.]/g, '');
        el.textContent = displayText + suffix;

        if (progress < 1) {
          requestAnimationFrame(update);
        }
      }

      update();
    });
  }
}

// ============================================================================
// 12. EXIT INTENT DETECTION (new - conversion feature)
// ============================================================================
function initExitIntent() {
  // Only on desktop (not mobile)
  if (window.innerWidth < 768) return;

  let exitIntentTriggered = false;

  document.addEventListener('mouseleave', function(e) {
    // Trigger only when leaving from top of page
    if (e.clientY <= 0 && !exitIntentTriggered) {
      exitIntentTriggered = true;
      sessionStorage.setItem('wm_exit_intent_shown', 'true');
      document.body.classList.add('exit-intent');
      // CSS can now target .exit-intent to show notification
    }
  });
}

// ============================================================================
// 13. UTM PARAMETER CAPTURE (new - conversion feature)
// ============================================================================
function initUTMCapture() {
  const params = new URLSearchParams(window.location.search);
  const utm = {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    content: params.get('utm_content') || '',
    term: params.get('utm_term') || ''
  };

  // Only save if at least one UTM param exists
  if (Object.values(utm).some(v => v)) {
    localStorage.setItem('wm_utm', JSON.stringify(utm));

    // Add UTM params to all CTA links
    const ctaLinks = document.querySelectorAll('a[href*="/invite/"]');
    ctaLinks.forEach(link => {
      const url = new URL(link.href, window.location.origin);

      // Append existing UTMs to href
      for (const [key, value] of Object.entries(utm)) {
        if (value) {
          url.searchParams.set(key, value);
        }
      }

      link.href = url.toString();
    });
  }
}

// ============================================================================
// 14. MOBILE NAV CLOSE ON LINK CLICK (existing)
// ============================================================================
function initMobileNavClose() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function() {
      const navbarMenu = document.getElementById('navbarMenu');
      if (navbarMenu) {
        navbarMenu.classList.remove('active');
      }
    });
  });
}

// ============================================================================
// 15. REVEAL ANIMATIONS WITH INTERSECTION OBSERVER (existing)
// ============================================================================
function initRevealAnimations() {
  const reveals = document.querySelectorAll('[data-reveal]');
  if (!reveals.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
  } else {
    // Fallback: show all
    reveals.forEach(el => el.classList.add('revealed'));
  }
}

// ============================================================================
// 16. FAQ ACCORDION TOGGLE (existing - for non-details/summary browsers)
// ============================================================================
function initFAQAccordion() {
  document.querySelectorAll('[data-faq-toggle]').forEach(item => {
    const h3 = item.querySelector('h3');
    if (h3) {
      h3.style.cursor = 'pointer';
      h3.addEventListener('click', () => {
        item.classList.toggle('open');
      });
    }
  });
}

// ============================================================================
// ANALYTICS FALLBACK (existing)
// ============================================================================
if (typeof gtag === 'undefined') {
  window.gtag = function() {};
}