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
  
  hreflang += `<link rel="alternate" hreflang="x-default" href="${BASE_URL}/en/">`;
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
    { path: '/para-turistas/', priority: '0.7' }
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
  
  // Zone pages for each language
  for (const zone of ZONES) {
    for (const lang of LANGUAGES) {
      const outputPath = lang === 'es'
        ? path.join(DIST_DIR, 'clubes', zone.slug, 'index.html')
        : path.join(DIST_DIR, lang, 'clubes', zone.slug, 'index.html');
      
      generatePage(zoneTemplate, {
        lang,
        zone,
        hreflangTags: generateHreflangTags(`/clubes/${zone.slug}/`, lang),
        canPath: lang === 'es' ? `/clubes/${zone.slug}/` : `/${lang}/clubes/${zone.slug}/`,
        allZones: ZONES
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
  
  // Generate sitemap and robots
  generateSitemap();
  generateRobots();
  
  console.log('\n✓ Build complete!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});