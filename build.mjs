import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.weedmadrid.com';
const CTA_LINK = 'https://www.weedmadrid.com/invite/vallehermoso-club-social-madrid';
const BASE_PATH = process.env.BASE_PATH || ''; // e.g. '/weedmadrid-seo' for GitHub Pages
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
const ZONES = Array.isArray(zonesData) ? zonesData : zonesData.zones;

// Load posts data - from individual files in posts/ dir, or fallback to posts.json
let POSTS = [];
const postsDir = path.join(DATA_DIR, 'posts');
if (fs.existsSync(postsDir) && fs.statSync(postsDir).isDirectory()) {
  const postFiles = fs.readdirSync(postsDir).filter(f => f.endsWith('.json')).sort();
  for (const file of postFiles) {
    const post = loadJSON(path.join(postsDir, file));
    POSTS.push(post);
  }
  console.log(`Loaded ${POSTS.length} posts from ${postsDir}/`);
} else {
  const postsPath = path.join(DATA_DIR, 'posts.json');
  if (fs.existsSync(postsPath)) {
    POSTS = loadJSON(postsPath);
    console.log(`Loaded ${POSTS.length} posts from posts.json`);
  }
}

// Template engine — supports {{#if x == 'y'}}, {{else if}}, {{else}}, {{#each}}, {{../}}, {{> partial}}
class TemplateEngine {
  constructor(partials = {}) {
    this.partials = partials;
  }

  render(template, data = {}, parentData = null) {
    let result = this.resolvePartials(template);
    result = this.processBlocks(result, data, parentData);
    result = this.replaceVariables(result, data, parentData);
    return result;
  }

  resolvePartials(template) {
    return template.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => this.partials[name] || '');
  }

  processBlocks(template, data, parentData) {
    let result = '';
    let pos = 0;
    while (pos < template.length) {
      const ifIdx = template.indexOf('{{#if ', pos);
      const eachIdx = template.indexOf('{{#each ', pos);
      let nextIdx = -1, nextType = null;
      if (ifIdx !== -1 && (eachIdx === -1 || ifIdx < eachIdx)) { nextIdx = ifIdx; nextType = 'if'; }
      else if (eachIdx !== -1) { nextIdx = eachIdx; nextType = 'each'; }
      if (nextIdx === -1) { result += template.slice(pos); break; }
      result += template.slice(pos, nextIdx);
      if (nextType === 'if') {
        const r = this.processIfBlock(template, nextIdx, data, parentData);
        result += r.output; pos = r.endPos;
      } else {
        const r = this.processEachBlock(template, nextIdx, data, parentData);
        result += r.output; pos = r.endPos;
      }
    }
    return result;
  }

  processIfBlock(template, startPos, data, parentData) {
    const openEnd = template.indexOf('}}', startPos);
    if (openEnd === -1) return { output: '', endPos: template.length };
    const expr = template.slice(startPos + 5, openEnd).trim();
    const bodyStart = openEnd + 2;
    const { body, endPos } = this.findClose(template, bodyStart, 'if');
    const branches = this.splitIfBranches(body, expr);
    for (const b of branches) {
      if (b.type === 'else' || this.evalCond(b.condition, data, parentData)) {
        const processed = this.processBlocks(b.content, data, parentData);
        return { output: this.replaceVariables(processed, data, parentData), endPos };
      }
    }
    return { output: '', endPos };
  }

  splitIfBranches(body, firstCond) {
    const branches = [];
    let remaining = body;
    let cond = firstCond;
    while (true) {
      const eiIdx = this.findTopLevel(remaining, '{{else if ');
      const eIdx = this.findTopLevel(remaining, '{{else}}');
      if (eiIdx !== -1 && (eIdx === -1 || eiIdx < eIdx)) {
        branches.push({ type: 'if', condition: cond, content: remaining.slice(0, eiIdx) });
        const tagEnd = remaining.indexOf('}}', eiIdx + 10);
        cond = remaining.slice(eiIdx + 10, tagEnd).trim();
        remaining = remaining.slice(tagEnd + 2);
      } else if (eIdx !== -1) {
        branches.push({ type: 'if', condition: cond, content: remaining.slice(0, eIdx) });
        branches.push({ type: 'else', content: remaining.slice(eIdx + 8) });
        break;
      } else {
        branches.push({ type: 'if', condition: cond, content: remaining });
        break;
      }
    }
    return branches;
  }

  findTopLevel(template, tag) {
    let depth = 0;
    let pos = 0;
    while (pos < template.length) {
      if (template.startsWith('{{#if ', pos) || template.startsWith('{{#each ', pos)) {
        depth++;
        pos += 6;
      } else if (template.startsWith('{{/if}}', pos) || template.startsWith('{{/each}}', pos)) {
        depth--;
        pos += 7;
      } else if (depth === 0 && template.startsWith(tag, pos)) {
        return pos;
      } else {
        pos++;
      }
    }
    return -1;
  }

  processEachBlock(template, startPos, data, parentData) {
    const openEnd = template.indexOf('}}', startPos);
    if (openEnd === -1) return { output: '', endPos: template.length };
    const arrayName = template.slice(startPos + 8, openEnd).trim();
    const bodyStart = openEnd + 2;
    const { body, endPos } = this.findClose(template, bodyStart, 'each');
    const array = this.resolve(arrayName, data, parentData);
    if (!Array.isArray(array) || !array.length) return { output: '', endPos };
    let output = '';
    for (let i = 0; i < array.length; i++) {
      const item = typeof array[i] === 'object' ? { ...array[i] } : { value: array[i] };
      item.index = i; item.first = i === 0; item.last = i === array.length - 1;
      let rendered = this.processBlocks(body, item, data);
      output += this.replaceVariables(rendered, item, data);
    }
    return { output, endPos };
  }

  findClose(template, startPos, blockType) {
    const closeTag = `{{/${blockType}}}`;
    const openTag = `{{#${blockType} `;
    let depth = 1, pos = startPos;
    while (depth > 0 && pos < template.length) {
      const nOpen = template.indexOf(openTag, pos);
      const nClose = template.indexOf(closeTag, pos);
      if (nClose === -1) return { body: template.slice(startPos), endPos: template.length };
      if (nOpen !== -1 && nOpen < nClose) { depth++; pos = nOpen + openTag.length; }
      else { depth--; if (depth === 0) return { body: template.slice(startPos, nClose), endPos: nClose + closeTag.length }; pos = nClose + closeTag.length; }
    }
    return { body: template.slice(startPos), endPos: template.length };
  }

  evalCond(condition, data, parentData) {
    const eq = condition.match(/^([\w.\/]+)\s*==\s*'([^']*)'$/);
    if (eq) return this.resolve(eq[1], data, parentData) === eq[2];
    const neq = condition.match(/^([\w.\/]+)\s*!=\s*'([^']*)'$/);
    if (neq) return this.resolve(neq[1], data, parentData) !== neq[2];
    return !!this.resolve(condition, data, parentData);
  }

  resolve(expr, data, parentData) {
    if (expr.startsWith('../')) return this.getVal(expr.slice(3), parentData || {});
    return this.getVal(expr, data);
  }

  getVal(key, data) {
    if (!data) return undefined;
    const parts = key.split('.');
    let v = data;
    for (const p of parts) { if (v == null) return undefined; v = v[p]; }
    return v;
  }

  replaceVariables(template, data, parentData) {
    return template.replace(/\{\{([^#/}>][^}]*)\}\}/g, (match, expr) => {
      const key = expr.trim();
      if (key.startsWith('>')) return match;
      const value = this.resolve(key, data, parentData);
      return value != null ? String(value) : '';
    });
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

  // Homepage labels per language
  const homeLabels = {
    es: {
      zones: 'Zonas', clubs: 'Clubs', membersActive: 'Socios Activos',
      heroTitle: 'Cannabis Clubs en Madrid — Directorio Completo 2026',
      heroSubtitle: 'Encuentra y únete a los mejores clubs cannábicos de Madrid. Directorio actualizado con horarios, precios, ubicaciones y reseñas reales de más de 2,500 socios.',
      requestInvitation: 'Solicitar Invitación Gratis',
      browseClubs: 'Explorar Clubes por Zona',
      viewingNow: 'personas consultando ahora',
      proofVerified: 'Clubs verificados', proofFast: 'Invitación en 24h',
      proofPrivate: '100% Confidencial', proofMultilang: '6 idiomas disponibles',
      mapTitle: 'Mapa Interactivo de Cannabis Clubs en Madrid',
      mapSubtitle: 'Encuentra el club más cercano a ti. Haz clic en un marcador para ver detalles.',
      zonesTitle: 'Cannabis Clubs por Zona en Madrid',
      zonesSubtitle: '19 barrios cubiertos con información detallada de cada club.',
      viewAllClubs: 'Ver Todas las 19 Zonas',
      howTitle: 'Cómo Unirse a un Cannabis Club en Madrid',
      howSubtitle: 'Proceso simple en 3 pasos. La mayoría de invitaciones se procesan en menos de 24 horas.',
      step1Title: 'Elige tu Zona', step1Text: 'Explora nuestro directorio y selecciona el club o zona que más te convenga según ubicación, horarios y precios.',
      step2Title: 'Solicita tu Invitación', step2Text: 'Rellena el formulario con tus datos básicos. Solo necesitas DNI o pasaporte y ser mayor de edad. Tarda 2 minutos.',
      step3Title: 'Visita tu Club', step3Text: 'Recibe tu invitación por email o WhatsApp en 24 horas. Presenta tu documento y disfruta de la experiencia.',
      testimonialsTitle: 'Lo que Dicen Nuestros Socios',
      testimonial1: 'Proceso súper fácil. En 24 horas tenía mi invitación y pude visitar el club esa misma tarde. El personal fue muy amable.',
      testimonialFrom: 'Turista desde Roma',
      testimonial2: 'Después de buscar mucho, esta web fue la única que me dio información real y actualizada. Recomendado 100%.',
      testimonialFrom2: 'Turista desde Londres',
      testimonial3: 'Excelente guía para extranjeros. Todo claro, todo simple. El club estaba exactamente como describían.',
      testimonialFrom3: 'Turista desde París',
      legalTitle: '¿Es Legal? Marco Legal de los Cannabis Clubs en España',
      legalStatus: 'Estatus Legal',
      legalText1: 'Los cannabis clubs en España operan como asociaciones privadas sin ánimo de lucro, amparadas por el derecho de asociación. El consumo compartido en espacios privados entre adultos es una actividad tolerada por las autoridades.',
      legalPrivacy: 'Privacidad Total',
      legalText2: 'Tu información personal está protegida por la LOPD. Los clubs mantienen registros confidenciales y tu membresía es completamente privada.',
      legalRequirements: 'Requisitos de Acceso',
      legalText3: 'Ser mayor de 18/21 años según el club, presentar documento de identidad original (DNI o pasaporte), y contar con una invitación de un miembro existente.',
      faqTitle: 'Preguntas Frecuentes sobre Cannabis Clubs en Madrid',
      viewAllFaq: 'Ver Todas las Preguntas',
      blogTitle: 'Últimas Guías y Artículos',
      viewAllBlog: 'Ver Todos los Artículos',
      ctaUrgency: 'Plazas limitadas esta semana',
      ctaTitle: 'Únete a la Comunidad Cannábica de Madrid',
      ctaSubtitle: 'Solicita tu invitación ahora y accede a los mejores cannabis clubs de la capital. Proceso 100% online, seguro y confidencial.',
      ctaStatMembers: 'socios satisfechos', ctaStatRating: 'valoración media', ctaStatSpeed: 'tiempo de respuesta',
      ctaReassurance: 'Sin compromiso · Sin pago previo · Cancelación libre'
    },
    en: {
      zones: 'Zones', clubs: 'Clubs', membersActive: 'Active Members',
      heroTitle: 'Cannabis Clubs in Madrid — Complete 2026 Directory',
      heroSubtitle: 'Find and join the best cannabis clubs in Madrid. Updated directory with hours, prices, locations and real reviews from 2,500+ members.',
      requestInvitation: 'Request Free Invitation',
      browseClubs: 'Browse Clubs by Area',
      viewingNow: 'people browsing now',
      proofVerified: 'Verified clubs', proofFast: 'Invitation in 24h',
      proofPrivate: '100% Confidential', proofMultilang: '6 languages available',
      mapTitle: 'Interactive Map of Cannabis Clubs in Madrid',
      mapSubtitle: 'Find the closest club to you. Click a marker for details.',
      zonesTitle: 'Cannabis Clubs by Area in Madrid',
      zonesSubtitle: '19 neighborhoods covered with detailed info on every club.',
      viewAllClubs: 'View All 19 Areas',
      howTitle: 'How to Join a Cannabis Club in Madrid',
      howSubtitle: 'Simple 3-step process. Most invitations are processed in under 24 hours.',
      step1Title: 'Choose Your Area', step1Text: 'Browse our directory and select the club or area that suits you based on location, hours and prices.',
      step2Title: 'Request Your Invitation', step2Text: 'Fill out the form with your basic info. You only need your ID or passport and be of legal age. Takes 2 minutes.',
      step3Title: 'Visit Your Club', step3Text: 'Receive your invitation via email or WhatsApp within 24 hours. Show your ID and enjoy the experience.',
      testimonialsTitle: 'What Our Members Say',
      testimonial1: 'Super easy process. Within 24 hours I had my invitation and could visit the club that same afternoon. Staff were very friendly.',
      testimonialFrom: 'Tourist from Rome',
      testimonial2: 'After searching a lot, this website was the only one that gave me real and updated information. 100% recommended.',
      testimonialFrom2: 'Tourist from London',
      testimonial3: 'Excellent guide for foreigners. Everything clear, everything simple. The club was exactly as described.',
      testimonialFrom3: 'Tourist from Paris',
      legalTitle: 'Is It Legal? Legal Framework for Cannabis Clubs in Spain',
      legalStatus: 'Legal Status',
      legalText1: 'Cannabis clubs in Spain operate as private non-profit associations, protected by the right of association. Shared consumption in private spaces among adults is tolerated by authorities.',
      legalPrivacy: 'Total Privacy',
      legalText2: 'Your personal information is protected under Spanish data protection law. Clubs keep confidential records and your membership is completely private.',
      legalRequirements: 'Access Requirements',
      legalText3: 'Be over 18/21 years old depending on the club, present your original ID document (national ID or passport), and have an invitation from an existing member.',
      faqTitle: 'Frequently Asked Questions About Cannabis Clubs in Madrid',
      viewAllFaq: 'View All Questions',
      blogTitle: 'Latest Guides & Articles',
      viewAllBlog: 'View All Articles',
      ctaUrgency: 'Limited spots this week',
      ctaTitle: 'Join Madrid\'s Cannabis Community',
      ctaSubtitle: 'Request your invitation now and access the best cannabis clubs in the capital. 100% online, secure and confidential process.',
      ctaStatMembers: 'happy members', ctaStatRating: 'average rating', ctaStatSpeed: 'response time',
      ctaReassurance: 'No commitment · No upfront payment · Free cancellation'
    },
    fr: {
      zones: 'Quartiers', clubs: 'Clubs', membersActive: 'Membres Actifs',
      heroTitle: 'Clubs Cannabis à Madrid — Annuaire Complet 2026',
      heroSubtitle: 'Trouvez et rejoignez les meilleurs clubs cannabis de Madrid. Annuaire mis à jour avec horaires, tarifs et avis de plus de 2 500 membres.',
      requestInvitation: 'Demander une Invitation Gratuite',
      browseClubs: 'Parcourir par Quartier',
      viewingNow: 'personnes consultent maintenant',
      proofVerified: 'Clubs vérifiés', proofFast: 'Invitation en 24h',
      proofPrivate: '100% Confidentiel', proofMultilang: '6 langues disponibles',
      mapTitle: 'Carte Interactive des Clubs Cannabis à Madrid',
      mapSubtitle: 'Trouvez le club le plus proche. Cliquez sur un marqueur pour les détails.',
      zonesTitle: 'Clubs Cannabis par Quartier à Madrid',
      zonesSubtitle: '19 quartiers couverts avec des informations détaillées.',
      viewAllClubs: 'Voir les 19 Quartiers',
      howTitle: 'Comment Rejoindre un Club Cannabis à Madrid',
      howSubtitle: 'Processus simple en 3 étapes. La plupart des invitations sont traitées en moins de 24 heures.',
      step1Title: 'Choisissez Votre Quartier', step1Text: 'Parcourez notre annuaire et sélectionnez le club ou le quartier qui vous convient selon l\'emplacement, les horaires et les tarifs.',
      step2Title: 'Demandez Votre Invitation', step2Text: 'Remplissez le formulaire avec vos informations de base. Vous n\'avez besoin que de votre pièce d\'identité. 2 minutes.',
      step3Title: 'Visitez Votre Club', step3Text: 'Recevez votre invitation par email ou WhatsApp sous 24 heures. Présentez votre pièce d\'identité et profitez.',
      testimonialsTitle: 'Ce que Disent Nos Membres',
      testimonial1: 'Processus super facile. En 24 heures j\'avais mon invitation et j\'ai pu visiter le club le même après-midi.',
      testimonialFrom: 'Touriste de Rome',
      testimonial2: 'Après beaucoup de recherches, ce site était le seul à donner des informations réelles et à jour. 100% recommandé.',
      testimonialFrom2: 'Touriste de Londres',
      testimonial3: 'Excellent guide pour les étrangers. Tout est clair, tout est simple. Le club était exactement comme décrit.',
      testimonialFrom3: 'Touriste de Paris',
      legalTitle: 'Est-ce Légal? Cadre Juridique des Clubs Cannabis en Espagne',
      legalStatus: 'Statut Légal',
      legalText1: 'Les clubs cannabis en Espagne fonctionnent comme des associations privées à but non lucratif. La consommation partagée dans des espaces privés entre adultes est tolérée par les autorités.',
      legalPrivacy: 'Confidentialité Totale',
      legalText2: 'Vos informations personnelles sont protégées par la loi espagnole sur la protection des données. Votre adhésion est complètement privée.',
      legalRequirements: 'Conditions d\'Accès',
      legalText3: 'Avoir plus de 18/21 ans selon le club, présenter une pièce d\'identité originale (CNI ou passeport), et disposer d\'une invitation d\'un membre existant.',
      faqTitle: 'Questions Fréquentes sur les Clubs Cannabis à Madrid',
      viewAllFaq: 'Voir Toutes les Questions',
      blogTitle: 'Derniers Guides et Articles',
      viewAllBlog: 'Voir Tous les Articles',
      ctaUrgency: 'Places limitées cette semaine',
      ctaTitle: 'Rejoignez la Communauté Cannabis de Madrid',
      ctaSubtitle: 'Demandez votre invitation maintenant. Processus 100% en ligne, sécurisé et confidentiel.',
      ctaStatMembers: 'membres satisfaits', ctaStatRating: 'note moyenne', ctaStatSpeed: 'temps de réponse',
      ctaReassurance: 'Sans engagement · Sans paiement préalable · Annulation libre'
    },
    it: {
      zones: 'Zone', clubs: 'Club', membersActive: 'Membri Attivi',
      heroTitle: 'Club Cannabis a Madrid — Directory Completa 2026',
      heroSubtitle: 'Trova e unisciti ai migliori club cannabis di Madrid. Directory aggiornata con orari, prezzi e recensioni reali di oltre 2.500 membri.',
      requestInvitation: 'Richiedi Invito Gratuito',
      browseClubs: 'Esplora per Zona',
      viewingNow: 'persone stanno navigando ora',
      proofVerified: 'Club verificati', proofFast: 'Invito in 24h',
      proofPrivate: '100% Riservato', proofMultilang: '6 lingue disponibili',
      mapTitle: 'Mappa Interattiva dei Club Cannabis a Madrid',
      mapSubtitle: 'Trova il club più vicino a te. Clicca su un marcatore per i dettagli.',
      zonesTitle: 'Club Cannabis per Zona a Madrid',
      zonesSubtitle: '19 quartieri coperti con informazioni dettagliate.',
      viewAllClubs: 'Vedi Tutte le 19 Zone',
      howTitle: 'Come Iscriversi a un Club Cannabis a Madrid',
      howSubtitle: 'Processo semplice in 3 passaggi. La maggior parte degli inviti viene elaborata in meno di 24 ore.',
      step1Title: 'Scegli la Tua Zona', step1Text: 'Esplora la directory e seleziona il club o la zona più adatta in base a posizione, orari e prezzi.',
      step2Title: 'Richiedi il Tuo Invito', step2Text: 'Compila il modulo con i tuoi dati di base. Ti serve solo il documento d\'identità. 2 minuti.',
      step3Title: 'Visita il Tuo Club', step3Text: 'Ricevi il tuo invito via email o WhatsApp entro 24 ore. Presenta il documento e goditi l\'esperienza.',
      testimonialsTitle: 'Cosa Dicono i Nostri Membri',
      testimonial1: 'Processo super facile. In 24 ore avevo il mio invito e ho potuto visitare il club quel pomeriggio stesso.',
      testimonialFrom: 'Turista da Roma',
      testimonial2: 'Dopo molte ricerche, questo sito è stato l\'unico a darmi informazioni reali e aggiornate. Consigliato 100%.',
      testimonialFrom2: 'Turista da Londra',
      testimonial3: 'Eccellente guida per stranieri. Tutto chiaro, tutto semplice. Il club era esattamente come descritto.',
      testimonialFrom3: 'Turista da Parigi',
      legalTitle: 'È Legale? Quadro Giuridico dei Club Cannabis in Spagna',
      legalStatus: 'Stato Legale',
      legalText1: 'I club cannabis in Spagna operano come associazioni private senza scopo di lucro. Il consumo condiviso in spazi privati tra adulti è tollerato dalle autorità.',
      legalPrivacy: 'Privacy Totale',
      legalText2: 'Le tue informazioni personali sono protette dalla legge spagnola sulla protezione dei dati. La tua iscrizione è completamente privata.',
      legalRequirements: 'Requisiti di Accesso',
      legalText3: 'Avere più di 18/21 anni a seconda del club, presentare un documento d\'identità originale (carta d\'identità o passaporto) e avere un invito da un membro esistente.',
      faqTitle: 'Domande Frequenti sui Club Cannabis a Madrid',
      viewAllFaq: 'Vedi Tutte le Domande',
      blogTitle: 'Ultime Guide e Articoli',
      viewAllBlog: 'Vedi Tutti gli Articoli',
      ctaUrgency: 'Posti limitati questa settimana',
      ctaTitle: 'Unisciti alla Comunità Cannabis di Madrid',
      ctaSubtitle: 'Richiedi il tuo invito ora. Processo 100% online, sicuro e riservato.',
      ctaStatMembers: 'membri soddisfatti', ctaStatRating: 'valutazione media', ctaStatSpeed: 'tempo di risposta',
      ctaReassurance: 'Senza impegno · Senza pagamento anticipato · Cancellazione libera'
    },
    de: {
      zones: 'Bezirke', clubs: 'Clubs', membersActive: 'Aktive Mitglieder',
      heroTitle: 'Cannabis Clubs in Madrid — Vollständiges Verzeichnis 2026',
      heroSubtitle: 'Finden und besuchen Sie die besten Cannabis Clubs in Madrid. Aktuelles Verzeichnis mit Öffnungszeiten, Preisen und echten Bewertungen von über 2.500 Mitgliedern.',
      requestInvitation: 'Kostenlose Einladung anfordern',
      browseClubs: 'Clubs nach Bezirk durchsuchen',
      viewingNow: 'Personen schauen gerade',
      proofVerified: 'Verifizierte Clubs', proofFast: 'Einladung in 24h',
      proofPrivate: '100% Vertraulich', proofMultilang: '6 Sprachen verfügbar',
      mapTitle: 'Interaktive Karte der Cannabis Clubs in Madrid',
      mapSubtitle: 'Finden Sie den nächsten Club. Klicken Sie auf einen Marker für Details.',
      zonesTitle: 'Cannabis Clubs nach Bezirk in Madrid',
      zonesSubtitle: '19 Stadtteile mit detaillierten Informationen zu jedem Club.',
      viewAllClubs: 'Alle 19 Bezirke anzeigen',
      howTitle: 'Wie Man einem Cannabis Club in Madrid Beitritt',
      howSubtitle: 'Einfacher 3-Schritte-Prozess. Die meisten Einladungen werden in weniger als 24 Stunden bearbeitet.',
      step1Title: 'Wählen Sie Ihren Bezirk', step1Text: 'Durchsuchen Sie unser Verzeichnis und wählen Sie den Club oder Bezirk, der am besten zu Ihnen passt.',
      step2Title: 'Fordern Sie Ihre Einladung an', step2Text: 'Füllen Sie das Formular mit Ihren Grunddaten aus. Sie brauchen nur Ihren Ausweis oder Reisepass. 2 Minuten.',
      step3Title: 'Besuchen Sie Ihren Club', step3Text: 'Erhalten Sie Ihre Einladung per E-Mail oder WhatsApp innerhalb von 24 Stunden. Zeigen Sie Ihren Ausweis und genießen Sie.',
      testimonialsTitle: 'Was Unsere Mitglieder Sagen',
      testimonial1: 'Super einfacher Prozess. Innerhalb von 24 Stunden hatte ich meine Einladung und konnte den Club am selben Nachmittag besuchen.',
      testimonialFrom: 'Tourist aus Rom',
      testimonial2: 'Nach langem Suchen war diese Website die einzige mit aktuellen und echten Informationen. 100% empfehlenswert.',
      testimonialFrom2: 'Tourist aus London',
      testimonial3: 'Ausgezeichneter Leitfaden für Ausländer. Alles klar, alles einfach. Der Club war genau wie beschrieben.',
      testimonialFrom3: 'Tourist aus Paris',
      legalTitle: 'Ist es Legal? Rechtsrahmen für Cannabis Clubs in Spanien',
      legalStatus: 'Rechtsstatus',
      legalText1: 'Cannabis Clubs in Spanien sind private gemeinnützige Vereine. Der gemeinsame Konsum in privaten Räumen unter Erwachsenen wird von den Behörden geduldet.',
      legalPrivacy: 'Totale Privatsphäre',
      legalText2: 'Ihre persönlichen Daten sind durch das spanische Datenschutzgesetz geschützt. Ihre Mitgliedschaft ist vollständig privat.',
      legalRequirements: 'Zugangsvoraussetzungen',
      legalText3: 'Über 18/21 Jahre alt sein (je nach Club), einen gültigen Originalausweis vorlegen (Personalausweis oder Reisepass) und eine Einladung eines bestehenden Mitglieds haben.',
      faqTitle: 'Häufig Gestellte Fragen zu Cannabis Clubs in Madrid',
      viewAllFaq: 'Alle Fragen Anzeigen',
      blogTitle: 'Neueste Leitfäden & Artikel',
      viewAllBlog: 'Alle Artikel Anzeigen',
      ctaUrgency: 'Begrenzte Plätze diese Woche',
      ctaTitle: 'Treten Sie Madrids Cannabis-Community Bei',
      ctaSubtitle: 'Fordern Sie jetzt Ihre Einladung an. 100% online, sicher und vertraulich.',
      ctaStatMembers: 'zufriedene Mitglieder', ctaStatRating: 'Durchschnittsbewertung', ctaStatSpeed: 'Antwortzeit',
      ctaReassurance: 'Ohne Verpflichtung · Keine Vorauszahlung · Kostenlose Stornierung'
    },
    pt: {
      zones: 'Zonas', clubs: 'Clubes', membersActive: 'Membros Ativos',
      heroTitle: 'Clubes Cannabis em Madrid — Diretório Completo 2026',
      heroSubtitle: 'Encontre e junte-se aos melhores clubes cannabis de Madrid. Diretório atualizado com horários, preços e avaliações reais de mais de 2.500 membros.',
      requestInvitation: 'Solicitar Convite Grátis',
      browseClubs: 'Explorar por Zona',
      viewingNow: 'pessoas navegando agora',
      proofVerified: 'Clubes verificados', proofFast: 'Convite em 24h',
      proofPrivate: '100% Confidencial', proofMultilang: '6 idiomas disponíveis',
      mapTitle: 'Mapa Interativo dos Clubes Cannabis em Madrid',
      mapSubtitle: 'Encontre o clube mais próximo de si. Clique num marcador para detalhes.',
      zonesTitle: 'Clubes Cannabis por Zona em Madrid',
      zonesSubtitle: '19 bairros cobertos com informações detalhadas.',
      viewAllClubs: 'Ver Todas as 19 Zonas',
      howTitle: 'Como Juntar-se a um Clube Cannabis em Madrid',
      howSubtitle: 'Processo simples em 3 passos. A maioria dos convites é processada em menos de 24 horas.',
      step1Title: 'Escolha a Sua Zona', step1Text: 'Explore o nosso diretório e selecione o clube ou zona que mais lhe convém com base na localização, horários e preços.',
      step2Title: 'Solicite o Seu Convite', step2Text: 'Preencha o formulário com os seus dados básicos. Só precisa do seu documento de identidade. 2 minutos.',
      step3Title: 'Visite o Seu Clube', step3Text: 'Receba o seu convite por email ou WhatsApp em 24 horas. Apresente o documento e aproveite a experiência.',
      testimonialsTitle: 'O Que Dizem os Nossos Membros',
      testimonial1: 'Processo super fácil. Em 24 horas tinha o meu convite e pude visitar o clube nessa mesma tarde.',
      testimonialFrom: 'Turista de Roma',
      testimonial2: 'Depois de muito procurar, este site foi o único que me deu informação real e atualizada. Recomendado 100%.',
      testimonialFrom2: 'Turista de Londres',
      testimonial3: 'Excelente guia para estrangeiros. Tudo claro, tudo simples. O clube era exatamente como descrito.',
      testimonialFrom3: 'Turista de Paris',
      legalTitle: 'É Legal? Enquadramento Legal dos Clubes Cannabis em Espanha',
      legalStatus: 'Estatuto Legal',
      legalText1: 'Os clubes cannabis em Espanha funcionam como associações privadas sem fins lucrativos. O consumo partilhado em espaços privados entre adultos é tolerado pelas autoridades.',
      legalPrivacy: 'Privacidade Total',
      legalText2: 'As suas informações pessoais são protegidas pela lei espanhola de proteção de dados. A sua adesão é completamente privada.',
      legalRequirements: 'Requisitos de Acesso',
      legalText3: 'Ter mais de 18/21 anos conforme o clube, apresentar documento de identidade original (BI ou passaporte) e ter um convite de um membro existente.',
      faqTitle: 'Perguntas Frequentes sobre Clubes Cannabis em Madrid',
      viewAllFaq: 'Ver Todas as Perguntas',
      blogTitle: 'Últimos Guias e Artigos',
      viewAllBlog: 'Ver Todos os Artigos',
      ctaUrgency: 'Vagas limitadas esta semana',
      ctaTitle: 'Junte-se à Comunidade Cannabis de Madrid',
      ctaSubtitle: 'Solicite o seu convite agora. Processo 100% online, seguro e confidencial.',
      ctaStatMembers: 'membros satisfeitos', ctaStatRating: 'avaliação média', ctaStatSpeed: 'tempo de resposta',
      ctaReassurance: 'Sem compromisso · Sem pagamento prévio · Cancelamento livre'
    }
  };

  // Homepage FAQs per language
  const homeFaqs = {
    es: [
      { question: '¿Qué es un cannabis club en Madrid?', answer: 'Un cannabis club es una asociación privada sin ánimo de lucro donde adultos mayores de edad pueden consumir cannabis de forma legal y controlada. Funcionan como clubes sociales con membresía.' },
      { question: '¿Cuál es la edad mínima para entrar?', answer: 'La mayoría de clubs requieren ser mayor de 21 años, aunque algunos aceptan socios desde los 18 años. Siempre verifica con el club específico antes de visitarlo.' },
      { question: '¿Necesito invitación para entrar a un cannabis club?', answer: 'Sí. Los cannabis clubs son asociaciones privadas y necesitas una invitación o referencia de un miembro existente. Nosotros facilitamos este proceso de forma rápida y segura.' },
      { question: '¿Cuánto cuesta la membresía de un cannabis club?', answer: 'Las cuotas de membresía varían entre 20€ y 50€ mensuales según el club. Algunos ofrecen membresías anuales con descuento. Los precios de productos van de 8€ a 15€ por gramo.' },
      { question: '¿Los turistas pueden acceder a cannabis clubs en Madrid?', answer: 'Sí, muchos clubs en zonas turísticas como Sol, Chueca y Gran Vía aceptan turistas internacionales. Solo necesitas pasaporte original y una invitación válida.' },
      { question: '¿Cuáles son los horarios de los cannabis clubs?', answer: 'La mayoría abre entre las 12:00-14:00 y cierra entre las 22:00-01:00. Los clubs céntricos tienen horarios más amplios. Los viernes y sábados suelen cerrar más tarde.' },
      { question: '¿Puedo consumir dentro del club?', answer: 'Sí, la mayoría de clubs tienen zonas de consumo con sofás, mesas y ambiente social. Es uno de los principales beneficios de ser miembro. Cada club tiene sus propias normas.' },
      { question: '¿Es seguro y confidencial el proceso?', answer: 'Completamente. Tu información está protegida por la LOPD (Ley Orgánica de Protección de Datos). Los clubs mantienen registros confidenciales y tu privacidad está garantizada.' }
    ],
    en: [
      { question: 'What is a cannabis club in Madrid?', answer: 'A cannabis club is a private non-profit association where adults can consume cannabis legally in a controlled setting. They operate as social clubs with membership.' },
      { question: 'What is the minimum age to enter?', answer: 'Most clubs require you to be over 21 years old, although some accept members from 18. Always check with the specific club before visiting.' },
      { question: 'Do I need an invitation to enter a cannabis club?', answer: 'Yes. Cannabis clubs are private associations and you need an invitation or referral from an existing member. We facilitate this process quickly and securely.' },
      { question: 'How much does a cannabis club membership cost?', answer: 'Membership fees range from €20 to €50 per month depending on the club. Some offer discounted annual memberships. Product prices range from €8 to €15 per gram.' },
      { question: 'Can tourists access cannabis clubs in Madrid?', answer: 'Yes, many clubs in tourist areas like Sol, Chueca and Gran Vía accept international tourists. You just need your original passport and a valid invitation.' },
      { question: 'What are the opening hours of cannabis clubs?', answer: 'Most open between 12:00-14:00 and close between 22:00-01:00. Central clubs have longer hours. Fridays and Saturdays usually close later.' },
      { question: 'Can I consume inside the club?', answer: 'Yes, most clubs have consumption areas with sofas, tables and a social atmosphere. This is one of the main benefits of membership. Each club has its own rules.' },
      { question: 'Is the process secure and confidential?', answer: 'Absolutely. Your information is protected under Spanish data protection law (LOPD). Clubs maintain confidential records and your privacy is guaranteed.' }
    ]
  };
  // FR/IT/DE/PT default to EN FAQs (will be translated later or use EN)
  homeFaqs.fr = homeFaqs.en;
  homeFaqs.it = homeFaqs.en;
  homeFaqs.de = homeFaqs.en;
  homeFaqs.pt = homeFaqs.en;

  // Homepage meta data per language
  const homeMeta = {
    es: { title: 'Cannabis Clubs en Madrid — Directorio Completo 2026 | Weed Madrid', desc: 'Encuentra los mejores cannabis clubs en Madrid. Directorio actualizado 2026 con 19 zonas, precios, horarios y cómo unirte. ✓ Solicita tu invitación gratis.' },
    en: { title: 'Cannabis Clubs in Madrid — Complete 2026 Directory | Weed Madrid', desc: 'Find the best cannabis clubs in Madrid. Updated 2026 directory with 19 areas, prices, hours and how to join. ✓ Request your free invitation.' },
    fr: { title: 'Clubs Cannabis à Madrid — Annuaire Complet 2026 | Weed Madrid', desc: 'Trouvez les meilleurs clubs cannabis à Madrid. Annuaire 2026 avec 19 quartiers, tarifs, horaires. ✓ Demandez votre invitation gratuite.' },
    it: { title: 'Club Cannabis a Madrid — Directory Completa 2026 | Weed Madrid', desc: 'Trova i migliori club cannabis a Madrid. Directory 2026 con 19 zone, prezzi, orari. ✓ Richiedi il tuo invito gratuito.' },
    de: { title: 'Cannabis Clubs in Madrid — Vollständiges Verzeichnis 2026 | Weed Madrid', desc: 'Finden Sie die besten Cannabis Clubs in Madrid. Verzeichnis 2026 mit 19 Bezirken, Preisen, Öffnungszeiten. ✓ Kostenlose Einladung anfordern.' },
    pt: { title: 'Clubes Cannabis em Madrid — Diretório Completo 2026 | Weed Madrid', desc: 'Encontre os melhores clubes cannabis em Madrid. Diretório 2026 com 19 zonas, preços, horários. ✓ Solicite o seu convite grátis.' }
  };

  // Get latest 3 posts
  const latestPosts = POSTS.slice(0, 3);

  // Homepage for each language
  for (const lang of LANGUAGES) {
    const langPath = lang === 'es' ? '' : `/${lang}`;
    const canUrl = lang === 'es' ? `${BASE_URL}/` : `${BASE_URL}/${lang}/`;
    const outputPath = lang === 'es'
      ? path.join(DIST_DIR, 'index.html')
      : path.join(DIST_DIR, lang, 'index.html');

    // Prepare posts for this language
    const postsForLang = latestPosts.map(p => ({
      slug: p.slug,
      title: lang === 'es' ? p.title_es : (p.title_en || p.title_es),
      category: p.category,
      reading_time: p.reading_time,
      date_published: p.date_published
    }));

    // Generate FAQPage schema
    const faqSchema = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (homeFaqs[lang] || homeFaqs.en).map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer }
      }))
    });

    generatePage(homepageTemplate, {
      lang,
      labels: homeLabels[lang] || homeLabels.en,
      faqs: homeFaqs[lang] || homeFaqs.en,
      latestPosts: postsForLang,
      hreflangTags: generateHreflangTags('/', lang),
      canPath: lang === 'es' ? '/' : `/${lang}/`,
      zones: ZONES,
      zonesJson: JSON.stringify(ZONES.map(z => ({ slug: z.slug || z.id, name: z.name, lat: z.lat, lng: z.lng, clubs_count: z.clubs_count }))),
      metaTitle: homeMeta[lang]?.title || homeMeta.en.title,
      metaDescription: homeMeta[lang]?.desc || homeMeta.en.desc,
      canonicalUrl: canUrl,
      ogTitle: homeMeta[lang]?.title || homeMeta.en.title,
      ogDescription: homeMeta[lang]?.desc || homeMeta.en.desc,
      ogUrl: canUrl,
      twitterTitle: homeMeta[lang]?.title || homeMeta.en.title,
      twitterDescription: homeMeta[lang]?.desc || homeMeta.en.desc,
      pageSchema: faqSchema
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

  console.log('\nBuild complete!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
