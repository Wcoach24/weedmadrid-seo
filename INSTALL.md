# Installation & Quick Start

## Prerequisites
- Node.js 14+ (comes with npm)
- Bash or compatible shell

## Installation

1. Navigate to the project directory:
```bash
cd /sessions/kind-festive-sagan/mnt/Proyecto\ WMadrid/weedmadrid-seo
```

2. Run the build script:
```bash
node build.mjs
```

## Output

The build script will:
1. Clean the existing `dist/` folder
2. Copy static assets (CSS, JS, images)
3. Generate 150+ HTML pages across 6 languages
4. Create `sitemap.xml` with all 150+ URLs
5. Create `robots.txt` with proper directives

Expected output:
```
Starting build...

Copying CSS...
Copying JS...
Copying images...

Generating pages...

[150+ page generation messages]

Generated: /path/to/dist/sitemap.xml
Generated: /path/to/dist/robots.txt

✓ Build complete!
```

## Files Structure

```
src/
├── templates/
│   ├── homepage.html          # Main page template
│   ├── clubs.html             # Clubs directory
│   ├── zone.html              # Individual zone pages
│   ├── how-to.html            # How to join guide
│   ├── faq.html               # FAQ page
│   ├── prices.html            # Pricing page
│   ├── tourists.html          # Tourist guide
│   └── partials/              # Reusable components
│       ├── head.html
│       ├── header.html
│       ├── footer.html
│       ├── schema-org.html
│       └── schema-breadcrumb.html
├── data/
│   └── zones.json             # Zone configuration
├── css/
│   └── style.css              # Stylesheet
├── js/
│   └── main.js                # JavaScript
└── img/                       # Images (empty, add yours)

dist/                          # Generated output
├── index.html
├── sitemap.xml
├── robots.txt
├── css/, js/, img/
├── en/, fr/, it/, de/, pt/    # Language directories
└── clubes/                    # Zone pages
    ├── index.html
    └── [zone]/index.html
```

## Customization

### Edit Zone Data
File: `src/data/zones.json`

```json
{
  "zones": [
    {
      "id": "sol",
      "name": "Sol",
      "slug": "sol",
      "lat": 40.4168,
      "lng": -3.7038,
      "description": "Zone description here",
      "metro": "Metro lines",
      "clubs_count": 3
    }
  ]
}
```

### Edit Templates
File: `src/templates/[template].html`

Use these template variables:
- `{{variable}}` - Replace with value
- `{{#if condition}}...{{/if}}` - Conditional
- `{{#each array}}...{{/each}}` - Loop
- `{{> partial}}` - Include partial

### Edit CSS
File: `src/css/style.css`

Mobile-first design:
- Base styles for mobile
- `@media (min-width: 768px)` for desktop

### Add Images
1. Add images to `src/img/`
2. Reference in templates: `<img src="/img/filename.png" alt="description">`
3. Run build to copy to dist/

## Deployment

### Option 1: Vercel (Recommended)
```bash
vercel deploy dist/
```

### Option 2: Netlify
```bash
netlify deploy --prod --dir=dist
```

### Option 3: GitHub Pages
1. Push to GitHub
2. Enable GitHub Pages in settings
3. Point to `dist/` folder

### Option 4: Manual Upload
Copy entire `dist/` folder to your web server via:
- FTP
- SFTP
- SSH (scp)
- Cloud storage

## Verification

After build completes:

1. Check homepage exists:
```bash
ls -lh dist/index.html
```

2. Check all languages generated:
```bash
ls -d dist/{en,fr,it,de,pt}/
```

3. Check zone pages exist:
```bash
ls dist/clubes/ | head -10
```

4. Check sitemaps:
```bash
wc -l dist/sitemap.xml
head dist/robots.txt
```

## Troubleshooting

### Build fails with permission errors
```bash
# Grant execution permission
chmod +x build.mjs
```

### Missing partials
Verify all 5 partial files exist:
```bash
ls src/templates/partials/
# Should show: head.html, header.html, footer.html, 
#              schema-org.html, schema-breadcrumb.html
```

### No CSS in output
Check that style.css exists:
```bash
ls -lh src/css/style.css
```

### Links are broken
Ensure hreflang generation is working. Check dist/index.html:
```bash
grep hreflang dist/index.html | head -3
```

## Development Workflow

1. Make changes to templates or data
2. Run build: `node build.mjs`
3. Test locally: `open dist/index.html`
4. Deploy: `vercel deploy dist/` or similar

## Monitoring

Once deployed, monitor:
- Google Search Console for indexing
- PageSpeed Insights for performance
- Analytics for traffic and conversions
- Sitemap submission at search engines

## Support

For issues:
1. Check README.md for feature overview
2. Review template examples in src/templates/
3. Check zones.json for data structure
4. Review CLAUDE.md project guidelines
