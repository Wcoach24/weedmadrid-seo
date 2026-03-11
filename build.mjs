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
// Returns { html, context } for advanced processing
function renderTemplate(templateString, context = {}) {
  let html = templateString;

  // FIRST PASS: Resolve nested and recursive partials
  html = resolvePartialsRecursive(html, context);

  // SECOND PASS: Process conditionals
  html = processConditionals(html, context);

  // THIRD PASS: Process loops
  html = processLoops(html, context);

  // FOURTH PASS: Replace variables
  html = replaceVariables(html, context);

  return html;
}

function resolvePartialsRecursive(html, context, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) {
    console.warn('⚠️  Partial recursion depth exceeded (max: ' + maxDepth + ')');
    return html;
  }

  const partialRegex = /{{>\s*([\w-/]+)\s*}}/g;
  let hasPartials = false;
  let result = html;

  result = result.replace(partialRegex, (match, partialName) => {
    hasPartials = true;
    const partialPath = path.join(PARTIALS_DIR, partialName + '.html');

    if (!fs.existsSync(partialPath)) {
      console.warn(`⚠️  Partial not found: ${partialPath}`);
      return match; // Return unresolved if not found
    }

    let partialContent = fs.readFileSync(partialPath, 'utf8');
    // Recursively resolve partials within this partial
    partialContent = resolvePartialsRecursive(partialContent, context, depth + 1, maxDepth);
    return partialContent;
  });

  // If we found and resolved partials, recurse again to handle nested partials
  if (hasPartials) {
    const stillHasPartials = /{{>\s*[\w-/]+\s*}}/.test(result);
    if (stillHasPartials) {
      result = resolvePartialsRecursive(result, context, depth + 1, maxDepth);
    }
  }

  return result;
}

function processConditionals(html, context) {
  // {{#if condition}} ... {{/if}}
  // {{#if x == 'value'}} ... {{else if y == 'value'}} ... {{else}} ... {{/if}}

  const ifBlockRegex = /{{#if\s+([^}]+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/ if}}/g;

  return html.replace(ifBlockRegex, (match, condition, thenBlock, elseBlock) => {
    const conditionResult = evaluateCondition(condition, context);
    return conditionResult ? thenBlock.trim() : (elseBlock ? elseBlock.trim() : '');
  });
}

function evaluateCondition(condition, context) {
  condition = condition.trim();

  // Handle {{#if x == 'y'}}
  if (condition.includes('==')) {
    const [left, right] = condition.split('==').map(s => s.trim());
    const leftValue = context[left] ?? left.replace(/['"]/g, '');
    const rightValue = right.replace(/['"]/g, '');
    return String(leftValue) === String(rightValue);
  }

  // Handle {{#if x}}
  const value = context[condition];
  return Boolean(value && value !== '' && value !== 0);
}

function processLoops(html, context) {
  // {{#each array}}...{{/each}}
  const eachRegex = /{{#each\s+([\w.]+)}}([\s\S]*?){{\/ each}}/g;

  return html.replace(eachRegex, (match, arrayName, blockContent) => {
    const array = context[arrayName] || [];

    if (!Array.isArray(array)) {
      console.warn(`⚠️  Not an array: ${arrayName}`);
      return '';
    }

    return array
      .map((item, index) => {
        const itemContext = {
          ...context,
          this: item,
          index: index,
          '@index': index,
          '@first': index === 0,
          '@last': index === array.length - 1,
          // Map item properties to context so {{name}} works
          ...item,
        };
        return replaceVariables(blockContent, itemContext);
      })
      .join('');
  });
}

function replaceVariables(html, context) {
  // Replace {{var}}, {{obj.prop}}, {{../parent}}
  return html.replace(/{{([\w.@#^/]+)}}/g, (match, varName) => {
    // Handle relative paths like {{../}}
    if (varName.startsWith('../')) {
      return match; // Leave unprocessed in this simple version
    }

    // Handle special variables
    if (varName === '@index') return context['@index'] ?? '';
    if (varName === '@first') return context['@first'] ? 'true' : '';
    if (varName === '@last') return context['@last'] ? 'true' : '';

    // Handle dot notation like {{obj.prop}}
    const parts = varName.split('.');
    let value = context;
    for (const part of parts) {
      value = value?.[part];
    }
    return value !== undefined ? value : '';
  });
}

// Copy static assets (CSS, JS, images)
function copyAssets() {
  console.log('\n📦 Copying assets...');

  // Create dist directories
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR);
  if (!fs.existsSync(path.join(DIST_DIR, 'css'))) fs.mkdirSync(path.join(DIST_DIR, 'css'));
  if (!fs.existsSync(path.join(DIST_DIR, 'js'))) fs.mkdirSync(path.join(DIST_DIR, 'js'));
  if (!fs.existsSync(path.join(DIST_DIR, 'img'))) fs.mkdirSync(path.join(DIST_DIR, 'img'));

  // Copy CSS
  if (fs.existsSync(CSS_DIR)) {
    fs.readdirSync(CSS_DIR).forEach(file => {
      const src = path.join(CSS_DIR, file);
      const dest = path.join(DIST_DIR, 'css', file);
      fs.copyFileSync(src, dest);
    });
    console.log(`✓ Copied ${fs.readdirSync(CSS_DIR).length} CSS files`);
  }

  // Copy JS
  if (fs.existsSync(JS_DIR)) {
    fs.readdirSync(JS_DIR).forEach(file => {
      const src = path.join(JS_DIR, file);
      const dest = path.join(DIST_DIR, 'js', file);
      fs.copyFileSync(src, dest);
    });
    console.log(`✓ Copied ${fs.readdirSync(JS_DIR).length} JS files`);
  }

  // Copy images
  if (fs.existsSync(IMG_DIR)) {
    const copyDirRecursive = (srcDir, destDir) => {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);
      fs.readdirSync(srcDir).forEach(file => {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        if (fs.statSync(srcPath).isDirectory()) {
          copyDirRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      });
    };
    copyDirRecursive(IMG_DIR, path.join(DIST_DIR, 'img'));
    console.log(`✓ Copied image files`);
  }
}

// Generate individual pages from templates
function generatePages() {
  console.log('\n🎨 Generating pages...');

  const pagesDir = path.join(TEMPLATES_DIR, 'pages');
  if (!fs.existsSync(pagesDir)) {
    console.error('❌ Pages directory not found:', pagesDir);
    return;
  }

  const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

  pages.forEach(pageFile => {
    const pageName = pageFile.replace('.html', '');
    const templatePath = path.join(pagesDir, pageFile);
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // Generate page for each language
    LANGUAGES.forEach(lang => {
      // Prepare page context
      const pageContext = {
        currentLang: lang,
        currentDate: TODAY,
        baseUrl: BASE_URL,
        ctaLink: CTA_LINK,
        zones: ZONES,
        posts: POSTS.filter(p => p.lang === lang || !p.lang),
        langPrefix: lang === DEFAULT_LANG ? '' : '/' + lang,
      };

      const html = renderTemplate(templateContent, pageContext);

      // Determine output path
      let outputPath;
      if (lang === DEFAULT_LANG) {
        outputPath = path.join(DIST_DIR, pageName + '.html');
      } else {
        const langDir = path.join(DIST_DIR, lang);
        if (!fs.existsSync(langDir)) fs.mkdirSync(langDir);
        outputPath = path.join(langDir, pageName + '.html');
      }

      fs.writeFileSync(outputPath, html);
    });

    console.log(`✓ Generated: ${pageName}`);
  });
}

// Generate zone pages
function generateZonePages() {
  console.log('\n🗺️  Generating zone pages...');

  const zoneTemplateFile = path.join(TEMPLATES_DIR, 'zone.html');
  if (!fs.existsSync(zoneTemplateFile)) {
    console.error('❌ Zone template not found:', zoneTemplateFile);
    return;
  }

  const zoneTemplate = fs.readFileSync(zoneTemplateFile, 'utf8');

  ZONES.forEach(zone => {
    LANGUAGES.forEach(lang => {
      const zoneContext = {
        zone,
        currentLang: lang,
        currentDate: TODAY,
        baseUrl: BASE_URL,
        ctaLink: CTA_LINK,
        langPrefix: lang === DEFAULT_LANG ? '' : '/' + lang,
      };

      const html = renderTemplate(zoneTemplate, zoneContext);

      let outputPath;
      if (lang === DEFAULT_LANG) {
        const zonesDir = path.join(DIST_DIR, 'clubes');
        if (!fs.existsSync(zonesDir)) fs.mkdirSync(zonesDir);
        outputPath = path.join(zonesDir, zone.slug + '.html');
      } else {
        const langDir = path.join(DIST_DIR, lang, 'clubes');
        if (!fs.existsSync(langDir)) fs.mkdirSync(langDir, { recursive: true });
        outputPath = path.join(langDir, zone.slug + '.html');
      }

      fs.writeFileSync(outputPath, html);
    });
  });

  console.log(`✓ Generated zone pages for ${ZONES.length} zones × ${LANGUAGES.length} languages`);
}

// Generate blog post pages
function generateBlogPages() {
  console.log('\n📝 Generating blog pages...');

  const blogTemplateFile = path.join(TEMPLATES_DIR, 'blog-post.html');
  if (!fs.existsSync(blogTemplateFile)) {
    console.error('❌ Blog template not found:', blogTemplateFile);
    return;
  }

  const blogTemplate = fs.readFileSync(blogTemplateFile, 'utf8');

  POSTS.forEach(post => {
    const lang = post.lang || DEFAULT_LANG;
    const postContext = {
      post,
      currentLang: lang,
      currentDate: TODAY,
      baseUrl: BASE_URL,
      ctaLink: CTA_LINK,
      langPrefix: lang === DEFAULT_LANG ? '' : '/' + lang,
    };

    const html = renderTemplate(blogTemplate, postContext);

    let outputPath;
    if (lang === DEFAULT_LANG) {
      const blogDir = path.join(DIST_DIR, 'blog');
      if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir);
      outputPath = path.join(blogDir, post.slug + '.html');
    } else {
      const langDir = path.join(DIST_DIR, lang, 'blog');
      if (!fs.existsSync(langDir)) fs.mkdirSync(langDir, { recursive: true });
      outputPath = path.join(langDir, post.slug + '.html');
    }

    fs.writeFileSync(outputPath, html);
  });

  console.log(`✓ Generated ${POSTS.length} blog posts`);
}

// Generate sitemap.xml
function generateSitemap() {
  console.log('\n🗺️  Generating sitemaps...');

  let pageSitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  pageSitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  // Home pages for each language
  LANGUAGES.forEach(lang => {
    const url = lang === DEFAULT_LANG ? BASE_URL + '/' : BASE_URL + '/' + lang + '/';
    pageSitemap += '  <url>\n';
    pageSitemap += '    <loc>' + url + '</loc>\n';
    pageSitemap += '    <lastmod>' + TODAY + '</lastmod>\n';
    pageSitemap += '    <priority>1.0</priority>\n';
    pageSitemap += '  </url>\n';
  });

  // Zone pages
  ZONES.forEach(zone => {
    LANGUAGES.forEach(lang => {
      const url =
        lang === DEFAULT_LANG
          ? BASE_URL + '/clubes/' + zone.slug + '/'
          : BASE_URL + '/' + lang + '/clubes/' + zone.slug + '/';
      pageSitemap += '  <url>\n';
      pageSitemap += '    <loc>' + url + '</loc>\n';
      pageSitemap += '    <lastmod>' + TODAY + '</lastmod>\n';
      pageSitemap += '    <priority>0.8</priority>\n';
      pageSitemap += '  </url>\n';
    });
  });

  // Blog posts
  POSTS.forEach(post => {
    const lang = post.lang || DEFAULT_LANG;
    const url =
      lang === DEFAULT_LANG
        ? BASE_URL + '/blog/' + post.slug + '/'
        : BASE_URL + '/' + lang + '/blog/' + post.slug + '/';
    pageSitemap += '  <url>\n';
    pageSitemap += '    <loc>' + url + '</loc>\n';
    pageSitemap += '    <lastmod>' + (post.dateModified || TODAY) + '</lastmod>\n';
    pageSitemap += '    <priority>0.7</priority>\n';
    pageSitemap += '  </url>\n';
  });

  pageSitemap += '</urlset>';
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), pageSitemap);
  console.log(`✓ Generated sitemap.xml (${LANGUAGES.length * (1 + ZONES.length + POSTS.length)} URLs)`);
}

// Generate robots.txt
function generateRobots() {
  const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /temp

Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/image-sitemap.xml
`;
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots);
  console.log(`✓ Generated robots.txt`);
}

// Main build function
async function build() {
  console.log('🚀 Building weedmadrid.com...');
  console.log(`📅 Build date: ${TODAY}`);
  console.log(`🌍 Languages: ${LANGUAGES.join(', ')}`);
  console.log(`📍 Zones: ${ZONES.length}`);
  console.log(`📝 Posts: ${POSTS.length}\n`);

  // Clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
    console.log('🧹 Cleaned dist directory');
  }

  copyAssets();
  generatePages();
  generateZonePages();
  generateBlogPages();
  generateSitemap();
  generateRobots();

  console.log('\n✓ Build complete!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
