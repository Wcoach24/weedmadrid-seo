// Main JavaScript for Weed Madrid

// Language selector
document.addEventListener('DOMContentLoaded', function() {
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.addEventListener('change', function(e) {
      const lang = e.target.value;
      window.location.href = lang;
    });
  }
  
  // Mobile menu toggle
  const navbarToggle = document.getElementById('navbarToggle');
  const navbarMenu = document.getElementById('navbarMenu');
  
  if (navbarToggle && navbarMenu) {
    navbarToggle.addEventListener('click', function() {
      navbarMenu.classList.toggle('active');
    });
  }
  
  // CTA tracking
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
  
  // Map initialization (if Leaflet is available)
  const mapContainer = document.getElementById('mapContainer');
  const zoneMapContainer = document.getElementById('zoneMapContainer');
  
  if (mapContainer || zoneMapContainer) {
    loadMap();
  }
});

function loadMap() {
  // Placeholder for map loading
  // In production, use Leaflet.js with OpenStreetMap tiles
  console.log('Map would be loaded here using Leaflet.js');
}

// Analytics tracking
if (typeof gtag === 'undefined') {
  window.gtag = function() {};
}

// Mobile responsive menu close on link click
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function() {
    const navbarMenu = document.getElementById('navbarMenu');
    if (navbarMenu) {
      navbarMenu.classList.remove('active');
    }
  });
});

// IntersectionObserver for data-reveal animations
(function() {
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
})();

// FAQ accordion toggle (for non-details/summary browsers)
document.querySelectorAll('[data-faq-toggle]').forEach(item => {
  const h3 = item.querySelector('h3');
  if (h3) {
    h3.style.cursor = 'pointer';
    h3.addEventListener('click', () => {
      item.classList.toggle('open');
    });
  }
});
