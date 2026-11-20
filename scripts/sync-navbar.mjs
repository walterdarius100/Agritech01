import { readFileSync, writeFileSync } from 'node:fs';

const links = [
  ['index.html', 'Accueil'],
  ['services.html', 'Services'],
  ['formations.html', 'Formations'],
  ['projets.html', 'Projets'],
  ['actualites.html', 'Actualités'],
  ['index.html#processus', 'Méthode'],
  ['index.html#temoignages', 'Témoignages'],
  ['index.html#leadForm', 'Contact']
];

const pages = {
  'index.html': 'index.html',
  'services.html': 'services.html',
  'formations.html': 'formations.html',
  'actualites.html': 'actualites.html',
  'article.html': 'actualites.html',
  'projets.html': 'projets.html',
  'mentions-legales.html': null,
  'politique-confidentialite.html': null
};

function renderNavbar(page, active) {
  const items = links.map(([href, label]) => {
    const current = href === active ? ` aria-current="${active === page ? 'page' : 'true'}"` : '';
    return `        <a href="${href}"${current}>${label}</a>`;
  }).join('\n');

  return `  <!-- Navigation générée par node scripts/sync-navbar.mjs -->
  <header class="site-header" id="top">
    <nav class="navbar" aria-label="Navigation principale">
      <a class="brand" href="index.html" aria-label="Retour à l’accueil Agri-tech">
        <span class="brand-mark"><img src="assets/images/logo-agritech.png" alt="" aria-hidden="true" width="127" height="96" decoding="async" /></span>
        <span class="brand-text"><strong>Agri-tech</strong><small>Solutions agricoles</small></span>
      </a>

      <button class="menu-btn" id="menuBtn" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="navLinks">
        <span class="menu-icon" aria-hidden="true">
          <span class="menu-line"></span>
          <span class="menu-line"></span>
          <span class="menu-line"></span>
        </span>
      </button>

      <div class="nav-links" id="navLinks">
${items}
      </div>
    </nav>
  </header>`;
}

const navbarPattern = /(?:  <!-- Navigation générée par node scripts\/sync-navbar\.mjs -->\n)?  <header class="site-header" id="top">[\s\S]*?<\/header>/;
const checkOnly = process.argv.includes('--check');

for (const [page, active] of Object.entries(pages)) {
  const path = new URL(`../${page}`, import.meta.url);
  const source = readFileSync(path, 'utf8');
  if (!navbarPattern.test(source)) throw new Error(`Navbar introuvable dans ${page}.`);
  const updated = source.replace(navbarPattern, () => renderNavbar(page, active));
  if (source === updated) continue;
  if (checkOnly) {
    console.error(`Navbar à régénérer dans ${page}.`);
    process.exitCode = 1;
  } else {
    writeFileSync(path, updated);
  }
}
