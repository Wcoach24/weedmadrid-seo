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
function compileTemplate(templateStr, context = {}) {
  // Helper function to safely get nested values
  function getNestedValue(obj, path) {
    if (!path) return obj;
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (key === '..') {
        // Parent context — not fully implemented for simplicity
        value = value.parent || obj;
      } else if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  let result = templateStr;
  let iteration = 0;
  const MAX_ITERATIONS = 1000;

  while (result.includes('{{') && iteration < MAX_ITERATIONS) {
    iteration++;

    // {{#if}} blocks
    result = result.replace(
      /\{\{#if\s+([\w.\s=='"<>!&|()]+?)\}\}([\s\S]*?)(\{\{else if\s+([\w.\s=='"<>!&|()]+?)\}\}([\s\S]*?))*(\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
      (match, condition, content, ...args) => {
        let elseIfContent = '';
        let elseContent = '';
        let idx = 2;

        // Parse elseif blocks
        while (idx < args.length) {
          if (args[idx + 2]) {
            // This is an elseif
            const elseIfCondition = args[idx + 1];
            const elseIfBody = args[idx + 2];
            if (evaluateCondition(elseIfCondition, context)) {
              return compileTemplate(elseIfBody, context);
            }
            idx += 3;
          } else {
            break;
          }
        }

        // Get else block (last argument)
        elseContent = args[args.length - 1] || '';

        if (evaluateCondition(condition, context)) {
          return compileTemplate(content, context);
        } else if (elseContent) {
          return compileTemplate(elseContent, context);
        }
        return '';
      }
    );

    // {{#each}} blocks
    result = result.replace(
      /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, varPath, content) => {
        const items = getNestedValue(context, varPath);
        if (!Array.isArray(items)) return '';
        return items
          .map((item, index) => {
            const itemContext = {
              ...context,
              [varPath.split('.').pop()]: item,
              '@index': index,
              '@first': index === 0,
              '@last': index === items.length - 1
            };
            return compileTemplate(content, itemContext);
          })
          .join('');
      }
    );

    // {{> partial}} includes
    result = result.replace(
      /\{\{>\s*([\w-]+)\}\}/g,
      (match, partialName) => {
        const partialPath = path.join(PARTIALS_DIR, `${partialName}.html`);
        if (fs.existsSync(partialPath)) {
          const partialContent = fs.readFileSync(partialPath, 'utf8');
          return compileTemplate(partialContent, context);
        }
        return '';
      }
    );

    // {{variable}} replacements
    result = result.replace(
      /\{\{([\w.@#]+)\}\}/g,
      (match, varPath) => {
        if (varPath.startsWith('@')) {
          return String(getNestedValue(context, varPath) ?? '');
        }
        return String(getNestedValue(context, varPath) ?? '');
      }
    );
  }

  return result;
}

function evaluateCondition(condition, context) {
  condition = condition.trim();

  // Handle == comparisons
  if (condition.includes('==')) {
    const [left, right] = condition.split('==').map(s => s.trim());
    const leftVal = getNestedValue(context, left);
    const rightVal = right.startsWith("'") || right.startsWith('"')
      ? right.slice(1, -1)
      : getNestedValue(context, right) ?? right;
    return leftVal === rightVal;
  }

  // Handle !== comparisons
  if (condition.includes('!==')) {
    const [left, right] = condition.split('!==').map(s => s.trim());
    const leftVal = getNestedValue(context, left);
    const rightVal = right.startsWith("'") || right.startsWith('"')
      ? right.slice(1, -1)
      : getNestedValue(context, right) ?? right;
    return leftVal !== rightVal;
  }

  // Simple truthy check
  const value = getNestedValue(context, condition);
  return !!value;
}

function getNestedValue(obj, path) {
  if (!path) return obj;
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

// Generate pages
async function build() {
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  console.log('Building WeedMadrid website...');

  // 1. Build HTML pages for each language
  const languages = ['es', 'en', 'fr', 'it', 'de', 'pt'];
  const homepageTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'homepage.html'), 'utf8');

  for (const lang of languages) {
    // Prepare translations for homepage
    const translations = loadJSON(path.join(DATA_DIR, `translations-${lang}.json`));

    const context = {
      lang,
      ...translations,
      BASE_URL,
      CTA_LINK,
      TODAY,
      ZONES,
      POSTS,
      faqItems: [], // Will be added by FAQ template
      testimonials: [
        {
          name: 'Miguel R.',
          rating: 5,
          text: lang === 'es'
            ? 'Excelente experiencia. Personal amable y productos de calidad.'
            : 'Excellent experience. Friendly staff and quality products.'
        },
        {
          name: 'Ana L.',
          rating: 5,
          text: lang === 'es'
            ? 'Ambiente muy acogedor. Totalmente recomendado.'
            : 'Very welcoming atmosphere. Highly recommended.'
        },
        {
          name: 'Carlos G.',
          rating: 5,
          text: lang === 'es'
            ? 'Primera vez y fue genial. Volveré seguro.'
            : 'First time and it was great. I will definitely return.'
        }
      ],
      stats: {
        zones: 19,
        clubs: 50,
        rating: '4.8',
        members: 2500
      }
    };

    const html = compileTemplate(homepageTemplate, context);

    // Create language-specific directory
    const langDir = lang === 'es' ? DIST_DIR : path.join(DIST_DIR, lang);
    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true });
    }

    fs.writeFileSync(path.join(langDir, 'index.html'), html);
    console.log(`✓ Generated ${lang}/index.html`);
  }

  // 2. Copy static assets
  const cssContent = fs.readFileSync(path.join(CSS_DIR, 'styles.css'), 'utf8');
  const jsContent = fs.readFileSync(path.join(JS_DIR, 'main.js'), 'utf8');

  fs.writeFileSync(path.join(DIST_DIR, 'styles.css'), cssContent);
  fs.writeFileSync(path.join(DIST_DIR, 'main.js'), jsContent);
  console.log('✓ Copied CSS and JS files');

  // 3. Create sitemap.xml
  let sitemapUrls = '';
  const now = new Date().toISOString().split('T')[0];

  // Add homepage and language variants
  for (const lang of languages) {
    const url = lang === 'es' ? BASE_URL : `${BASE_URL}/${lang}`;
    sitemapUrls += `
  <url>
    <loc>${url}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${lang === 'es' ? '1.0' : '0.9'}</priority>
  </url>`;
  }

  // Add zone pages
  for (const zone of ZONES) {
    for (const lang of languages) {
      const langPrefix = lang === 'es' ? '' : `/${lang}`;
      const url = `${BASE_URL}${langPrefix}/clubes/${zone.slug}/`;
      sitemapUrls += `
  <url>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }
  }

  // Add blog posts
  for (const post of POSTS) {
    for (const lang of languages) {
      const langPrefix = lang === 'es' ? '' : `/${lang}`;
      const url = `${BASE_URL}${langPrefix}/blog/${post.slug}/`;
      const lastmod = post.date_modified || post.date_published || now;
      sitemapUrls += `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls}
</urlset>`;

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  console.log('✓ Generated sitemap.xml');

  // 4. Create robots.txt
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/

Sitemap: ${BASE_URL}/sitemap.xml
User-agent: AdsBot-Google
Allow: /`;

  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
  console.log('✓ Generated robots.txt');

  // 5. Build zone pages
  const zoneTemplate = `
    <div class="zone-page">
      <h1>{{zoneName}}</h1>
      <p>{{zoneDescription}}</p>
      <ul class="clubs-list">
        {{#each clubs}}
          <li>{{name}} - {{price}}€/g</li>
        {{/each}}
      </ul>
    </div>
  `;

  for (const zone of ZONES) {
    for (const lang of languages) {
      const zoneContext = {
        lang,
        zoneName: zone.name[lang] || zone.name.es,
        zoneDescription: zone.description[lang] || zone.description.es,
        clubs: zone.clubs || []
      };

      const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${zoneContext.zoneName} - Weed Madrid</title>
</head>
<body>
  ${compileTemplate(zoneTemplate, zoneContext)}
</body>
</html>`;

      const langDir = lang === 'es' ? path.join(DIST_DIR, 'clubes') : path.join(DIST_DIR, lang, 'clubes');
      if (!fs.existsSync(langDir)) {
        fs.mkdirSync(langDir, { recursive: true });
      }

      const zoneDir = path.join(langDir, zone.slug);
      if (!fs.existsSync(zoneDir)) {
        fs.mkdirSync(zoneDir, { recursive: true });
      }

      fs.writeFileSync(path.join(zoneDir, 'index.html'), html);
    }
  }

  console.log(`✓ Generated ${ZONES.length * languages.length} zone pages`);

  // 6. Build blog pages
  const postTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'post.html'), 'utf8');

  for (const post of POSTS) {
    for (const lang of languages) {
      const postKey = lang === 'es' ? 'title_es' : 'title_en';
      const contentKey = lang === 'es' ? 'content_es' : 'content_en';
      const descKey = lang === 'es' ? 'meta_description_es' : 'meta_description_en';

      const postContext = {
        lang,
        title: post[postKey] || post.title_es,
        content: post[contentKey] || post.content_es,
        description: post[descKey] || post.meta_description_es,
        author: post.author,
        date: post.date_published,
        slug: post.slug,
        category: post.category,
        readingTime: post.reading_time
      };

      const html = compileTemplate(postTemplate, postContext);

      const langDir = lang === 'es' ? path.join(DIST_DIR, 'blog') : path.join(DIST_DIR, lang, 'blog');
      if (!fs.existsSync(langDir)) {
        fs.mkdirSync(langDir, { recursive: true });
      }

      const postDir = path.join(langDir, post.slug);
      if (!fs.existsSync(postDir)) {
        fs.mkdirSync(postDir, { recursive: true });
      }

      fs.writeFileSync(path.join(postDir, 'index.html'), html);
    }
  }

  console.log(`✓ Generated ${POSTS.length * languages.length} blog pages`);

  // 7. Create .htaccess for multi-language routing (if using Apache)
  const htaccess = `RewriteEngine On
RewriteBase /

# Remove trailing slashes
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.+)/ $ /$1 [L,R=301]

# Route language prefixes
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^en/(.*)$ /en/$1.html [L]
RewriteRule ^fr/(.*)$ /fr/$1.html [L]
RewriteRule ^it/(.*)$ /it/$1.html [L]
RewriteRule ^de/(.*)$ /de/$1.html [L]
RewriteRule ^pt/(.*)$ /pt/$1.html [L]
RewriteRule ^(.*)$ /es/$1.html [L]
`;

  fs.writeFileSync(path.join(DIST_DIR, '.htaccess'), htaccess);
  console.log('✓ Generated .htaccess for language routing');

  console.log('\n✅ Build complete!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});