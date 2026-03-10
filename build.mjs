import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.weedmadrid.com';
const CTA_LINK = 'https://www.weedmadrid.com/invite/vallehermoso-club-social-madrid';
const TODAY = new Date().toISOString().split('T')[0];

// Language configuration
const LANGUAGES = ['es', 'en', 'fr', 'it', 'de', 'pt'];
const DEFAULT_LANG = 'es';

// Directory paths
const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const TEMPLATES_DIR = path.join(SRC_DIR, 'templates');
const PARTIALS_DIR = path.join(TEMPLATES_DIR, 'partials');
const DATA_DIR = path.join(SRC_DIR, 'data');
const CSS_DIR = path.join(SRC_DIR, 'css');
const JS_DIR = path.join(SRC_DIR, 'js');
const IMG_DIR = path.join(SRC_DIR, 'img');

// Load data
function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const zonesData = loadJSON(path.join(DATA_DIR, 'zones.json'));
const ZONES = zonesData.zones;

// Load posts data
let POSTS = [];
const postsPath = path.join(DATA_DIR, 'posts.json');
if (fs.existsSync(postsPath)) {
  POSTS = loadJSON(postsPath);
}

// Template engine
class TemplateEngine {
  constructor(partials = {}) {
    this.partials = partials;
  }

  render(template, data = {}) {
    let result = template;

    // Handle partials: {{> header}}
    result = result.replace(/\{\{>\s*(\w+)\s*\}\}/g, (match, name) => {
      return this.partials[name] || '';
    });

    // Handle conditionals: {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      return data[condition] ? content : '';
    });

    // Handle loops: {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
      const array = data[arrayName] || [];
      return array.map((item, index) => {
        const itemData = typeof item === 'object' ? item : { value: item };
        itemData.index = index;
        itemData.first = index === 0;
        itemData.last = index === array.length - 1;
        return this.renderItemContent(content, itemData);
      }).join('');
    });

    // Handle variable replacement: {{variable}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const keys = key.trim().split('.');
      let value = data;
      for (const k of keys) {
        value = value[k];
        if (value === undefined) return '';
      }
      return value !== undefined ? String(value) : '';
    });

    return result;
  }

  renderItemContent(template, itemData) {
    return this.render(template, itemData);
  }
}

// Ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Load all partials
function loadPartials() {
  const partials = {};
  const files = fs.readdirSync(PARTIALS_DIR);

  for (const file of files) {
    if (file.endsWith('.html')) {
      const name = file.replace('.html', '');
      const filePath = path.join(PARTIALS_DIR, file);
      partials[name] = fs.readFileSync(filePath, 'utf8');
    }
  }

  return partials;
}

// Copy directory recursively
function copyDir(src, dest) {
  ensureDir(dest);
  const files = fs.readdirSync(src);

  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Generate hreflang tags
function generateHreflangTags(path, lang = 'es') {
  const languages = ['es', 'en', 'fr', 'it', 'de', 'pt'];
  let hreflang = '';

  for (const l of languages) {
    let href;
    if (path === '/') {
      href = l === 'es' ? `${BASE_URL}/` : `${BASE_URL}/${l}/`;
    } else {
      const pathParts = path.split('/').filter(p => p);
      if (pathParts[0] !== 'en' && pathParts[0] !== 'fr' && pathParts[0] !== 'it' && pathParts[0] !== 'de' && pathParts[0] !== 'pt') {
        href = l === 'es' ? `${BASE_URL}${path}` : `${BASE_URL}/${l}${path}`;
      } else {
        const corePath = '/' + pathParts.slice(1).join('/');
        href = l === 'es' ? `${BASE_URL}${corePath}` : `${BASE_URL}/${l}${corePath}`;
      }
    }
    hreflang += `<link rel="alternate" hreflang="${l}" href="${href}" />\n  `;
  }

  hreflang += `<link rel="alternate" hreflang="x-default" href="${BASE_URL}/en/" />`;
  return hreflang;
}

// Generate page
function generatePage(template, data, outputPath) {
  ensureDir(path.dirname(outputPath));
  const partials = loadPartials();
  const engine = new TemplateEngine(partials);

  // Add global data
  const fullData = {
    baseUrl: BASE_URL,
    ctaLink: CTA_LINK,
    today: TODAY,
    ...data
  };

  const html = engine.render(template, fullData);
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Generated: ${outputPath}`);
}

// Build sitemap.xml
function generateSitemap() {
  const urls = [];

  const addUrl = (loc, lastmod = TODAY, changefreq = 'weekly', priority = '0.8') => {
    urls.push({
      loc,
      lastmod,
      changefreq,
      priority
    });
  };

  // Homepage for each language
  addUrl(`${BASE_URL}/`, TODAY, 'daily', '1.0');
  for (const lang of ['en', 'fr', 'it', 'de', 'pt']) {
    addUrl(`${BASE_URL}/${lang}/`, TODAY, 'daily', '1.0');
  }

  // Main pages
  const mainPages = [
    { path: '/clubes/', priority: '0.9' },
    { path: '/como-unirse/', priority: '0.8' },
    { path: '/preguntas-frecuentes/', priority: '0.8' },
    { path: '/precios/', priority: '0.8' },
    { path: '/para-turistas/', priority: '0.7' },
    { path: '/blog/', priority: '0.8' }
  ];

  for (const page of mainPages) {
    addUrl(`${BASE_URL}${page.path}`, TODAY, 'weekly', page.priority);
    for (const lang of ['en', 'fr', 'it', 'de', 'pt']) {
      addUrl(`${BASE_URL}/${lang}${page.path}`, TODAY, 'weekly', page.priority);
    }
  }

  // Zone pages
  for (const zone of ZONES) {
    addUrl(`${BASE_URL}/clubes/${zone.slug}/`, TODAY, 'weekly', '0.7');
    for (const lang of ['en', 'fr', 'it', 'de', 'pt']) {
      addUrl(`${BASE_URL}/${lang}/clubes/${zone.slug}/`, TODAY, 'weekly', '0.7');
    }
  }

  // Blog post pages
  for (const post of POSTS) {
    addUrl(`${BASE_URL}/blog/${post.slug}/`, TODAY, 'weekly', '0.6');
    for (const lang of ['en', 'fr', 'it', 'de', 'pt']) {
      addUrl(`${BASE_URL}/${lang}/blog/${post.slug}/`, TODAY, 'weekly', '0.6');
    }
  }

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '         xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n';
  xml += '         xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">\n';

  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
    xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  ensureDir(DIST_DIR);
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), xml, 'utf8');
  console.log(`Generated: ${path.join(DIST_DIR, 'sitemap.xml')}`);
}

// Generate robots.txt
function generateRobots() {
  let robots = 'User-agent: *\n';
  robots += 'Allow: /\n';
  robots += 'Disallow: /invite/\n';
  robots += '\n';
  robots += `Sitemap: ${BASE_URL}/sitemap.xml\n`;

  ensureDir(DIST_DIR);
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots, 'utf8');
  console.log(`Generated: ${path.join(DIST_DIR, 'robots.txt')}`);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Main build function
async function build() {
  console.log('Starting build...\n');

  // Clean and create dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  ensureDir(DIST_DIR);

  // Copy static assets
  if (fs.existsSync(CSS_DIR)) {
    console.log('Copying CSS...');
    copyDir(CSS_DIR, path.join(DIST_DIR, 'css'));
  }

  if (fs.existsSync(JS_DIR)) {
    console.log('Copying JS...');
    copyDir(JS_DIR, path.join(DIST_DIR, 'js'));
  }

  if (fs.existsSync(IMG_DIR)) {
    console.log('Copying images...');
    copyDir(IMG_DIR, path.join(DIST_DIR, 'img'));
  }

  console.log('\nGenerating pages...\n');

  // Load templates
  const homepageTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'homepage.html'), 'utf8');
  const clubsTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'clubs.html'), 'utf8');
  const zoneTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'zone.html'), 'utf8');
  const howToTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'how-to.html'), 'utf8');
  const faqTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'faq.html'), 'utf8');
  const pricesTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'prices.html'), 'utf8');
  const touristsTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'tourists.html'), 'utf8');
  const blogPostTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'blog-post.html'), 'utf8');
  const blogIndexTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'blog-index.html'), 'utf8');

  // Homepage for each language
  for (const lang of LANGUAGES) {
    const langPath = lang === 'es' ? '' : `/${lang}`;
    const outputPath = lang === 'es'
      ? path.join(DIST_DIR, 'index.html')
      : path.join(DIST_DIR, lang, 'index.html');

    generatePage(homepageTemplate, {
      lang,
      hreflangTags: generateHreflangTags('/', lang),
      canPath: lang === 'es' ? '/' : `/${lang}/`,
      zones: ZONES
    }, outputPath);
  }

  // Clubs directory for each language
  for (const lang of LANGUAGES) {
    const outputPath = lang === 'es'
      ? path.join(DIST_DIR, 'clubes', 'index.html')
      : path.join(DIST_DIR, lang, 'clubes', 'index.html');

    generatePage(clubsTemplate, {
      lang,
      hreflangTags: generateHreflangTags('/clubes/', lang),
      canPath: lang === 'es' ? '/clubes/' : `/${lang}/clubes/`,
      zones: ZONES
    }, outputPath);
  }

  // Zone labels per language
  const zoneLabels = {
    es: {
      home: 'Inicio', clubs: 'Clubes', requestInvitation: 'Solicitar Invitación',
      membersActive: 'miembros activos en Madrid', updated: 'Actualizado Marzo',
      viewingNow: 'personas viendo ahora', mapTitle: 'Ubicación en el Mapa',
      aboutZone: 'Sobre', transportTitle: 'Cómo Llegar — Transporte Público',
      localTips: 'Consejos Locales para', bestTime: '¿Cuándo es el Mejor Momento?',
      landmarksTitle: 'Qué Ver Cerca de', ctaTitle: '¿Quieres Unirte a un Club en',
      ctaSubtitle: 'Solicita tu invitación y accede a los mejores cannabis clubs de la zona.',
      faqTitle: 'Preguntas Frecuentes sobre', joinTitle: 'Solicita Acceso a un Club en',
      joinSubtitle: 'Proceso simple, rápido y seguro. Únete a miles de miembros satisfechos.',
      otherZones: 'Otras Zonas en Madrid'
    },
    en: {
      home: 'Home', clubs: 'Clubs', requestInvitation: 'Request Invitation',
      membersActive: 'active members in Madrid', updated: 'Updated March',
      viewingNow: 'people viewing now', mapTitle: 'Location on Map',
      aboutZone: 'About', transportTitle: 'How to Get There — Public Transport',
      localTips: 'Local Tips for', bestTime: 'When Is the Best Time?',
      landmarksTitle: 'What to See Near', ctaTitle: 'Want to Join a Club in',
      ctaSubtitle: 'Request your invitation and access the best cannabis clubs in the area.',
      faqTitle: 'FAQ About', joinTitle: 'Request Access to a Club in',
      joinSubtitle: 'Simple, fast and secure process. Join thousands of satisfied members.',
      otherZones: 'Other Areas in Madrid'
    },
    fr: {
      home: 'Accueil', clubs: 'Clubs', requestInvitation: 'Demander Invitation',
      membersActive: 'membres actifs à Madrid', updated: 'Mis à jour Mars',
      viewingNow: 'personnes consultent maintenant', mapTitle: 'Localisation sur la Carte',
      aboutZone: 'À Propos de', transportTitle: 'Comment S\'y Rendre — Transport Public',
      localTips: 'Conseils Locaux pour', bestTime: 'Quel Est le Meilleur Moment?',
      landmarksTitle: 'Que Voir Près de', ctaTitle: 'Rejoindre un Club à',
      ctaSubtitle: 'Demandez votre invitation et accédez aux meilleurs clubs cannabis.',
      faqTitle: 'FAQ sur', joinTitle: 'Demander l\'Accès à un Club à',
      joinSubtitle: 'Processus simple, rapide et sécurisé. Rejoignez des milliers de membres.',
      otherZones: 'Autres Quartiers à Madrid'
    },
    it: {
      home: 'Home', clubs: 'Club', requestInvitation: 'Richiedi Invito',
      membersActive: 'membri attivi a Madrid', updated: 'Aggiornato Marzo',
      viewingNow: 'persone stanno guardando', mapTitle: 'Posizione sulla Mappa',
      aboutZone: 'Su', transportTitle: 'Come Arrivare — Trasporto Pubblico',
      localTips: 'Consigli Locali per', bestTime: 'Qual è il Momento Migliore?',
      landmarksTitle: 'Cosa Vedere Vicino a', ctaTitle: 'Unisciti a un Club a',
      ctaSubtitle: 'Richiedi il tuo invito e accedi ai migliori club cannabis della zona.',
      faqTitle: 'FAQ su', joinTitle: 'Richiedi Accesso a un Club a',
      joinSubtitle: 'Processo semplice, veloce e sicuro. Unisciti a migliaia di membri.',
      otherZones: 'Altre Zone a Madrid'
    },
    de: {
      home: 'Startseite', clubs: 'Clubs', requestInvitation: 'Einladung anfordern',
      membersActive: 'aktive Mitglieder in Madrid', updated: 'Aktualisiert März',
      viewingNow: 'Personen sehen gerade', mapTitle: 'Standort auf der Karte',
      aboutZone: 'Über', transportTitle: 'Anfahrt — Öffentliche Verkehrsmittel',
      localTips: 'Lokale Tipps für', bestTime: 'Wann ist die beste Zeit?',
      landmarksTitle: 'Sehenswürdigkeiten in der Nähe von', ctaTitle: 'Einem Club in beitreten',
      ctaSubtitle: 'Fordern Sie Ihre Einladung an und erhalten Sie Zugang zu den besten Cannabis Clubs.',
      faqTitle: 'FAQ zu', joinTitle: 'Zugang zu einem Club in anfordern',
      joinSubtitle: 'Einfacher, schneller und sicherer Prozess. Tausende zufriedene Mitglieder.',
      otherZones: 'Andere Bezirke in Madrid'
    },
    pt: {
      home: 'Início', clubs: 'Clubes', requestInvitation: 'Solicitar Convite',
      membersActive: 'membros ativos em Madrid', updated: 'Atualizado Março',
      viewingNow: 'pessoas vendo agora', mapTitle: 'Localização no Mapa',
      aboutZone: 'Sobre', transportTitle: 'Como Chegar — Transporte Público',
      localTips: 'Dicas Locais para', bestTime: 'Qual é o Melhor Momento?',
      landmarksTitle: 'O Que Ver Perto de', ctaTitle: 'Juntar-se a um Clube em',
      ctaSubtitle: 'Solicite o seu convite e acesse os melhores clubes cannabis da zona.',
      faqTitle: 'FAQ sobre', joinTitle: 'Solicitar Acesso a um Clube em',
      joinSubtitle: 'Processo simples, rápido e seguro. Junte-se a milhares de membros.',
      otherZones: 'Outras Zonas em Madrid'
    }
  };

  // Zone pages for each language
  for (const zone of ZONES) {
    for (const lang of LANGUAGES) {
      const outputPath = lang === 'es'
        ? path.join(DIST_DIR, 'clubes', zone.slug, 'index.html')
        : path.join(DIST_DIR, lang, 'clubes', zone.slug, 'index.html');

      const labels = zoneLabels[lang] || zoneLabels['es'];
      const langPrefix = lang === 'es' ? '' : `/${lang}`;

      // Generate FAQ HTML
      const faqs = zone.faq || [];
      const faqItems = faqs.map(f => `
          <div class="faq-item" data-faq-toggle>
            <h3>${escapeXml(f.question)}</h3>
            <p>${escapeXml(f.answer)}</p>
          </div>`).join('');

      // Generate FAQ Schema JSON
      const faqSchema = faqs.map(f => `{
        "@type": "Question",
        "name": ${JSON.stringify(f.question)},
        "acceptedAnswer": {
          "@type": "Answer",
          "text": ${JSON.stringify(f.answer)}
        }
      }`).join(',');

      // Generate landmarks HTML
      const landmarks = zone.nearby_landmarks || [];
      const landmarksList = landmarks.map(l => `<li>${escapeXml(l)}</li>`).join('\n          ');

      // Generate related zones HTML
      const relatedZonesHtml = ZONES
        .filter(z => z.slug !== zone.slug)
        .map(z => {
          const href = lang === 'es' ? `/clubes/${z.slug}/` : `/${lang}/clubes/${z.slug}/`;
          return `<a href="${href}" class="zone-link-small" data-zone="${z.slug}">${z.name}<span class="clubs-badge">${z.clubs_count}</span></a>`;
        }).join('\n          ');

      // Meta description
      const metaDescription = lang === 'es'
        ? `Encuentra los mejores cannabis clubs en ${zone.name}, Madrid. Guía actualizada 2026 con precios, horarios y cómo unirte. ✓ Solicita invitación hoy.`
        : `Find the best cannabis clubs in ${zone.name}, Madrid. Updated 2026 guide with prices, hours and how to join. ✓ Request invitation today.`;

      generatePage(zoneTemplate, {
        lang,
        zone,
        labels,
        langPrefix,
        hreflangTags: generateHreflangTags(`/clubes/${zone.slug}/`, lang),
        canPath: lang === 'es' ? `/clubes/${zone.slug}/` : `/${lang}/clubes/${zone.slug}/`,
        metaDescription,
        faqItems,
        faqSchema,
        landmarksList,
        relatedZonesHtml
      }, outputPath);
    }
  }

  // How to join page for each language
  for (const lang of LANGUAGES) {
    const outputPath = lang === 'es'
      ? path.join(DIST_DIR, 'como-unirse', 'index.html')
      : path.join(DIST_DIR, lang, 'como-unirse', 'index.html');

    generatePage(howToTemplate, {
      lang,
      hreflangTags: generateHreflangTags('/como-unirse/', lang),
      canPath: lang === 'es' ? '/como-unirse/' : `/${lang}/como-unirse/`
    }, outputPath);
  }

  // FAQ page for each language
  for (const lang of LANGUAGES) {
    const outputPath = lang === 'es'
      ? path.join(DIST_DIR, 'preguntas-frecuentes', 'index.html')
      : path.join(DIST_DIR, lang, 'preguntas-frecuentes', 'index.html');

    generatePage(faqTemplate, {
      lang,
      hreflangTags: generateHreflangTags('/preguntas-frecuentes/', lang),
      canPath: lang === 'es' ? '/preguntas-frecuentes/' : `/${lang}/preguntas-frecuentes/`
    }, outputPath);
  }

  // Prices page for each language
  for (const lang of LANGUAGES) {
    const outputPath = lang === 'es'
      ? path.join(DIST_DIR, 'precios', 'index.html')
      : path.join(DIST_DIR, lang, 'precios', 'index.html');

    generatePage(pricesTemplate, {
      lang,
      hreflangTags: generateHreflangTags('/precios/', lang),
      canPath: lang === 'es' ? '/precios/' : `/${lang}/precios/`,
      zones: ZONES
    }, outputPath);
  }

  // Tourists page for each language
  for (const lang of LANGUAGES) {
    const outputPath = lang === 'es'
      ? path.join(DIST_DIR, 'para-turistas', 'index.html')
      : path.join(DIST_DIR, lang, 'para-turistas', 'index.html');

    generatePage(touristsTemplate, {
      lang,
      hreflangTags: generateHreflangTags('/para-turistas/', lang),
      canPath: lang === 'es' ? '/para-turistas/' : `/${lang}/para-turistas/`
    }, outputPath);
  }

  // Blog labels per language
  const blogLabels = {
    es: {
      home: 'Inicio',
      blog: 'Blog',
      writtenBy: 'Escrito por',
      faqTitle: 'Preguntas Frecuentes',
      ctaTitle: '¿Quieres unirte a un club cannabico en Madrid?',
      ctaSubtitle: 'Solicita tu invitación y accede a los mejores cannabis clubs de Madrid.',
      requestInvitation: 'Solicitar Invitación',
      relatedZones: 'Zonas Relacionadas',
      otherPosts: 'Otros Artículos del Blog',
      blogSubtitle: 'Guía completa sobre cannabis clubs en Madrid'
    },
    en: {
      home: 'Home',
      blog: 'Blog',
      writtenBy: 'Written by',
      faqTitle: 'Frequently Asked Questions',
      ctaTitle: 'Want to join a cannabis club in Madrid?',
      ctaSubtitle: 'Request your invitation and access the best cannabis clubs in Madrid.',
      requestInvitation: 'Request Invitation',
      relatedZones: 'Related Zones',
      otherPosts: 'Other Blog Articles',
      blogSubtitle: 'Complete guide to cannabis clubs in Madrid'
    },
    fr: {
      home: 'Accueil',
      blog: 'Blog',
      writtenBy: 'Écrit par',
      faqTitle: 'Questions Fréquemment Posées',
      ctaTitle: 'Voulez-vous rejoindre un club cannabis à Madrid?',
      ctaSubtitle: 'Demandez votre invitation et accédez aux meilleurs clubs cannabis de Madrid.',
      requestInvitation: 'Demander Invitation',
      relatedZones: 'Zones Associées',
      otherPosts: 'Autres Articles du Blog',
      blogSubtitle: 'Guide complet des clubs cannabis à Madrid'
    },
    it: {
      home: 'Home',
      blog: 'Blog',
      writtenBy: 'Scritto da',
      faqTitle: 'Domande Frequenti',
      ctaTitle: 'Vuoi unirti a un club cannabis a Madrid?',
      ctaSubtitle: 'Richiedi il tuo invito e accedi ai migliori club cannabis di Madrid.',
      requestInvitation: 'Richiedi Invito',
      relatedZones: 'Zone Correlate',
      otherPosts: 'Altri Articoli del Blog',
      blogSubtitle: 'Guida completa ai club cannabis di Madrid'
    },
    de: {
      home: 'Startseite',
      blog: 'Blog',
      writtenBy: 'Geschrieben von',
      faqTitle: 'Häufig Gestellte Fragen',
      ctaTitle: 'Möchten Sie einem Cannabis Club in Madrid beitreten?',
      ctaSubtitle: 'Fordern Sie Ihre Einladung an und erhalten Sie Zugang zu den besten Cannabis Clubs in Madrid.',
      requestInvitation: 'Einladung anfordern',
      relatedZones: 'Verbundene Bezirke',
      otherPosts: 'Andere Blog-Artikel',
      blogSubtitle: 'Vollständiger Leitfaden zu Cannabis Clubs in Madrid'
    },
    pt: {
      home: 'Início',
      blog: 'Blog',
      writtenBy: 'Escrito por',
      faqTitle: 'Perguntas Frequentes',
      ctaTitle: 'Quer se juntar a um clube cannabis em Madrid?',
      ctaSubtitle: 'Solicite seu convite e acesse os melhores clubes cannabis de Madrid.',
      requestInvitation: 'Solicitar Convite',
      relatedZones: 'Zonas Relacionadas',
      otherPosts: 'Outros Artigos do Blog',
      blogSubtitle: 'Guia completo para clubs cannabis em Madrid'
    }
  };

  // Blog post pages for each language
  for (const post of POSTS) {
    for (const lang of LANGUAGES) {
      const outputPath = lang === 'es'
        ? path.join(DIST_DIR, 'blog', post.slug, 'index.html')
        : path.join(DIST_DIR, lang, 'blog', post.slug, 'index.html');

      const labels = blogLabels[lang] || blogLabels['es'];
      const langPrefix = lang === 'es' ? '' : `/${lang}`;

      // Get post title and content based on language
      // Fallback: FR/IT/DE/PT use English if no translation, then Spanish
      const postTitle = (lang === 'es' ? post.title_es : post[`title_${lang}`] || post.title_en || post.title_es);
      const postContent = (lang === 'es' ? post.content_es : post[`content_${lang}`] || post.content_en || post.content_es);

      // Generate FAQ items using details/summary pattern
      const faqItems = (post.faq || []).map(f => `
          <details class="faq-item">
            <summary>${escapeXml(f.question)}</summary>
            <p>${escapeXml(f.answer)}</p>
          </details>`).join('');

      // Generate FAQ Schema JSON
      const faqSchema = (post.faq || []).map(f => `{
        "@type": "Question",
        "name": ${JSON.stringify(f.question)},
        "acceptedAnswer": {
          "@type": "Answer",
          "text": ${JSON.stringify(f.answer)}
        }
      }`).join(',');

      // Generate related zones HTML
      const relatedZonesHtml = ZONES.slice(0, 5).map(z => {
        const href = lang === 'es' ? `/clubes/${z.slug}/` : `/${lang}/clubes/${z.slug}/`;
        return `<a href="${href}" class="zone-link-small" data-zone="${z.slug}">${z.name}</a>`;
      }).join('\n        ');

      // Generate other posts HTML
      const otherPostsHtml = POSTS
        .filter(p => p.slug !== post.slug)
        .slice(0, 3)
        .map(p => {
          const href = lang === 'es' ? `/blog/${p.slug}/` : `/${lang}/blog/${p.slug}/`;
          const pTitle = lang === 'es' ? p.title_es : p[`title_${lang}`] || p.title_en || p.title_es;
          const pDesc = lang === 'es' ? p.meta_description_es : p[`meta_description_${lang}`] || p.meta_description_en || p.meta_description_es || '';
          return `<article class="post-card">
            <h3><a href="${href}">${escapeXml(pTitle)}</a></h3>
            <p class="post-meta">${p.date_published}</p>
            <p class="post-excerpt">${escapeXml(pDesc)}</p>
          </article>`;
        }).join('\n        ');

      // Meta description with language fallback
      const metaDescription = (lang === 'es' ? post.meta_description_es : post[`meta_description_${lang}`] || post.meta_description_en || post.meta_description_es) || `Cannabis clubs en Madrid - ${postTitle}`;

      generatePage(blogPostTemplate, {
        lang,
        langPrefix,
        post: {
          ...post,
          title: postTitle
        },
        postContent,
        metaDescription,
        hreflangTags: generateHreflangTags(`/blog/${post.slug}/`, lang),
        canPath: lang === 'es' ? `/blog/${post.slug}/` : `/${lang}/blog/${post.slug}/`,
        labels,
        faqItems,
        faqSchema,
        relatedZonesHtml,
        otherPostsHtml
      }, outputPath);
    }
  }

  // Blog index page for each language
  for (const lang of LANGUAGES) {
    const outputPath = lang === 'es'
      ? path.join(DIST_DIR, 'blog', 'index.html')
      : path.join(DIST_DIR, lang, 'blog', 'index.html');

    const labels = blogLabels[lang] || blogLabels['es'];
    const langPrefix = lang === 'es' ? '' : `/${lang}`;

    // Generate posts list HTML
    const postsListHtml = POSTS.map(post => {
      const postTitle = (lang === 'es' ? post.title_es : post[`title_${lang}`] || post.title_en || post.title_es);
      const href = lang === 'es' ? `/blog/${post.slug}/` : `/${lang}/blog/${post.slug}/`;
      return `<article class="post-card">
        <h2><a href="${href}">${escapeXml(postTitle)}</a></h2>
        <p class="post-meta">
          <span class="date">${post.date_published}</span>
          <span class="author">${labels.writtenBy} ${escapeXml(post.author)}</span>
          ${post.reading_time ? `<span class="reading-time">${post.reading_time} min</span>` : ''}
        </p>
        ${post.category ? `<p class="post-category">${escapeXml(post.category)}</p>` : ''}
        <p class="post-excerpt">${escapeXml((lang === 'es' ? post.meta_description_es : post[`meta_description_${lang}`] || post.meta_description_en || post.meta_description_es) || '')}</p>
      </article>`;
    }).join('\n      ');

    // Page title based on language
    const pageTitle = lang === 'es' ? 'Blog de Cannabis Clubs en Madrid' : lang === 'en' ? 'Cannabis Clubs Blog in Madrid' : lang === 'fr' ? 'Blog des Clubs Cannabis à Madrid' : lang === 'it' ? 'Blog dei Club Cannabis a Madrid' : lang === 'de' ? 'Blog Cannabis Clubs in Madrid' : 'Blog de Clubes Cannabis em Madrid';

    generatePage(blogIndexTemplate, {
      lang,
      langPrefix,
      pageTitle,
      metaDescription: labels.blogSubtitle,
      hreflangTags: generateHreflangTags('/blog/', lang),
      canPath: lang === 'es' ? '/blog/' : `/${lang}/blog/`,
      labels,
      postsListHtml
    }, outputPath);
  }

  // Generate sitemap and robots
  generateSitemap();
  generateRobots();

  console.log('\n✓ Build complete!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
