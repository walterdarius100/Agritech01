import assert from 'node:assert/strict';
import { renderNewsletterEmail } from '../supabase/functions/newsletter/index.ts';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(new URL('..', import.meta.url).pathname);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const path = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!path.startsWith(root + '/')) return res.writeHead(403).end();
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  try {
    const content = await readFile(path);
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const lastShown = 'agritech:newsletter:last-shown';
const sessionShown = 'agritech:newsletter:session-shown';
const subscribed = 'agritech:newsletter:subscribed';
const day = 24 * 60 * 60 * 1000;
let browser;

async function fixture(options, preview = false, existingContext) {
  const context = existingContext ?? await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  const submissions = [];
  const contacts = [];
  let contactFailure = null;
  let networkFailure = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/functions/v1/contact-requests') {
      const headers = {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'Content-Type',
        'access-control-allow-methods': 'POST, OPTIONS'
      };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const contact = route.request().postDataJSON();
      contacts.push(contact);
      if (contactFailure === 'uncertain') return route.abort();
      if (contactFailure === 'rejected') return route.fulfill({ status: 400, json: { status: 'rejected' }, headers });
      return route.fulfill({ json: { status: 'recorded', id: contact.id }, headers });
    }
    if (url.href === 'https://newsletter-test.invalid/functions/v1/newsletter') {
      const headers = {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'Content-Type',
        'access-control-allow-methods': 'POST, OPTIONS'
      };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const submission = route.request().postDataJSON();
      submissions.push(submission);
      if (networkFailure) return route.abort();
      const outcome = { subscribe: 'received', unsubscribe: 'unsubscribed' }[submission.action];
      return route.fulfill({ status: outcome === 'received' ? 202 : 200, json: { outcome }, headers });
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/js/services/articles-service.js') {
      return route.fulfill({ contentType: 'text/javascript', body: `
        export async function getArticleBySlug(slug) {
          const paragraph = '<p>' + 'Conseils sur la conservation des sols et la gestion de l’eau en agriculture. '.repeat(3) + '</p>';
          return { slug, title: 'Les sols', status: 'published', publishedAt: '2026-01-01',
            content: slug === 'court' ? '<p>Un article bref.</p>' : paragraph.repeat(32) };
        }
        export async function getPublishedArticles() { return []; }
        export function getFeaturedArticle() { return null; }
      ` });
    }
    if (url.pathname === '/api/newsletter') {
      assert.equal(route.request().method(), 'GET');
      return route.fulfill({ status: preview ? 200 : 404, json: { preview } });
    }
    if (url.pathname === '/js/config/newsletter-config.js') {
      return route.fulfill({ contentType: 'text/javascript', body: `
        export const NEWSLETTER_SITE_ORIGIN = ${JSON.stringify(origin)};
        export const NEWSLETTER_API_URL = 'https://newsletter-test.invalid/functions/v1/newsletter';
      ` });
    }
    return route.continue();
  });
  const dialog = page.locator('#articleNewsletter');
  return { page, dialog, submissions, errors, contacts, fail: value => { networkFailure = value; }, failContact: value => { contactFailure = value; } };
}

async function openArticle(page, slug = 'sols') {
  await page.goto(`${origin}/article.html?slug=${slug}`);
  await page.locator('.article-content').waitFor();
}

async function readTo(page, fraction) {
  await page.mouse.move(200, 180);
  await page.mouse.wheel(0, 20);
  await page.locator('.article-content').evaluate((content, fraction) => {
    const { top, height } = content.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + top + fraction * height - window.innerHeight, behavior: 'instant' });
  }, fraction);
  // Allow both the reading progress bar and the invitation to process the scroll.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox']
  });
  const firstTab = await fixture({ viewport: { width: 1280, height: 850 } });
  {
    const { page, dialog } = firstTab;
    await openArticle(page);
    assert.equal(await dialog.isVisible(), false);
    await readTo(page, 0.52);
    assert.equal(await dialog.isVisible(), false);
    const focusTarget = page.locator('.article-detail-share');
    await focusTarget.evaluate(button => button.focus({ preventScroll: true }));
    await readTo(page, 0.56);
    await dialog.waitFor();
    assert.ok(parseFloat(await page.locator('.article-reading-progress__bar').evaluate(bar => bar.style.width)) > 0);
    assert.equal(await dialog.locator(':focus').getAttribute('aria-label'), 'Fermer l’invitation');
    await page.keyboard.press('Tab');
    assert.equal(await dialog.locator(':focus').getAttribute('type'), 'email');
    const scroll = await page.evaluate(() => scrollY);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement.matches('.article-detail-share'));
    assert.equal(await page.evaluate(() => scrollY), scroll);
    assert.ok(await page.evaluate(key => Number(localStorage.getItem(key)) > 0, lastShown));

    await openArticle(page, 'autre');
    await readTo(page, 0.58);
    assert.equal(await dialog.isVisible(), false);
    await page.reload();
    await page.locator('.article-content').waitFor();
    assert.equal(await dialog.isVisible(), false);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), sessionShown), 'true');
    await page.evaluate(([key, ago]) => localStorage.setItem(key, Date.now() - ago), [lastShown, 7 * day - 60_000]);
  }

  // An independently opened tab shares the cooldown but starts a new tab session.
  const desktop = await fixture(undefined, false, firstTab.page.context());
  const { page, dialog, submissions } = desktop;
  await openArticle(page);
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), sessionShown), null);
  await readTo(page, 0.58);
  assert.equal(await dialog.isVisible(), false);

  await page.evaluate(([key, ago]) => localStorage.setItem(key, Date.now() - ago), [lastShown, 7 * day + 1000]);
  await openArticle(firstTab.page, 'apres-sept-jours');
  await readTo(firstTab.page, 0.58);
  assert.equal(await firstTab.dialog.isVisible(), false);

  await openArticle(page, 'court');
  await page.mouse.wheel(0, 1400);
  assert.equal(await dialog.isVisible(), false);
  await openArticle(page);
  await readTo(page, 0.56);
  await dialog.waitFor();

  const input = dialog.locator('input[type=email]');
  const consent = dialog.getByRole('checkbox');
  const submit = dialog.locator('button[type=submit]');
  const status = dialog.getByRole('status');
  await submit.click();
  await status.getByText('Veuillez saisir votre adresse e-mail.').waitFor();
  await input.fill('invalide');
  await submit.click();
  await status.getByText('Veuillez saisir une adresse e-mail valide.').waitFor();
  await input.fill('LECTEUR@EXAMPLE.ORG');
  await submit.click();
  await status.getByText('Veuillez accepter de recevoir la newsletter Agri-tech.').waitFor();
  assert.equal(submissions.length, 0);
  await consent.check();
  desktop.fail(true);
  await submit.click();
  await status.getByText('Impossible de traiter votre demande. Veuillez réessayer.').waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), subscribed), null);
  desktop.fail(false);
  await submit.click();
  const receivedMessage = 'Merci ! Votre demande d’inscription à la newsletter Agri-tech a bien été reçue.';
  await status.getByText(receivedMessage).waitFor();
  assert.deepEqual(submissions[1], { action: 'subscribe', email: 'lecteur@example.org', source: 'article', consent: true });

  assert.equal(await page.evaluate(key => localStorage.getItem(key), subscribed), 'true');
  await page.goto(`${origin}/newsletter/#confirm=test-token`);
  await page.getByText(/Ce lien de confirmation a été retiré/).waitFor();
  assert.equal(submissions.length, 2);

  await page.evaluate(([shown, session]) => {
    localStorage.removeItem(shown);
    sessionStorage.removeItem(session);
  }, [lastShown, sessionShown]);
  await openArticle(page, 'autre');
  await readTo(page, 0.58);
  assert.equal(await dialog.isVisible(), false);

  for (const name of ['index', 'actualites', 'services', 'formations', 'projets', 'a-propos', 'mentions-legales', 'politique-confidentialite']) {
    await page.goto(`${origin}/${name}.html`);
    assert.equal(await dialog.count(), 0);
    await page.waitForFunction(() => !document.querySelector('#newsletterSubmit').disabled);
  }

  await page.goto(`${origin}/index.html`);
  const contact = page.locator('#leadForm');
  await contact.locator('#name').fill('Lecteur test');
  await contact.locator('#email').fill('contact@example.org');
  await contact.locator('#phone').fill('+509 3600 0000');
  await contact.locator('#need').selectOption({ index: 1 });
  await contact.locator('#message').fill('Demande de consultation.');
  await contact.locator('#consent').check();
  await contact.locator('#submitBtn').click();
  await contact.getByText('Votre demande a bien été enregistrée.', { exact: false }).waitFor();
  assert.equal(desktop.contacts[0].message, 'Demande de consultation.');
  assert.equal(desktop.contacts[0].consent, true);

  const fillContactIdentity = async () => {
    await contact.locator('#name').fill('Lecteur test');
    await contact.locator('#email').fill('contact@example.org');
    await contact.locator('#phone').fill('+509 3600 0000');
    await contact.locator('#consent').check();
  };
  await page.goto(`${origin}/index.html?need=Formation%20Agri-tech%20Academy#leadForm`);
  await contact.getByRole('button', { name: 'Réservez votre place' }).waitFor();
  assert.equal(await contact.locator('#message').isVisible(), false);
  await fillContactIdentity();
  desktop.failContact('uncertain');
  await contact.locator('#submitBtn').click();
  await contact.getByText('L’enregistrement de votre demande reste à vérifier.', { exact: false }).waitFor();
  desktop.failContact(null);
  await contact.locator('#submitBtn').click();
  await contact.getByText('Votre demande a bien été enregistrée.', { exact: false }).waitFor();
  assert.equal(desktop.contacts[1].message, '');
  assert.equal(desktop.contacts[1].id, desktop.contacts[2].id);

  await contact.locator('#need').selectOption('Partenariat');
  await contact.getByRole('button', { name: 'Discuter d’un partenariat' }).waitFor();
  await fillContactIdentity();
  await contact.locator('#submitBtn').click();
  await contact.getByText('Veuillez compléter les champs obligatoires', { exact: false }).waitFor();
  assert.equal(desktop.contacts.length, 3);
  await contact.locator('#message').fill('Demande de partenariat.');
  desktop.failContact('rejected');
  await contact.locator('#submitBtn').click();
  await contact.getByText('Votre demande n’a pas été enregistrée.', { exact: false }).waitFor();
  desktop.failContact(null);
  await contact.locator('#submitBtn').click();
  await contact.getByText('Votre demande a bien été enregistrée.', { exact: false }).waitFor();
  assert.equal(desktop.contacts[3].need, 'Partenariat');
  assert.equal(submissions.length, 2);
  await page.locator('#newsletterEmail').fill('lecteur@example.org');
  assert.equal(await page.locator('#newsletterForm').getByRole('checkbox').count(), 0);
  assert.equal(await page.locator('#newsletterForm').getByRole('link').count(), 0);
  assert.equal(await page.locator('footer').getByRole('link', { name: 'Politique de confidentialité' })
    .getAttribute('href'), 'politique-confidentialite.html');
  await page.locator('#newsletterSubmit').click();
  await page.locator('#newsletterStatus').getByText(receivedMessage).waitFor();
  assert.deepEqual(submissions[2], { action: 'subscribe', email: 'lecteur@example.org', source: 'footer' });
  await page.goto(`${origin}/newsletter/#unsubscribe=test-token`);
  const unsubscribe = page.getByRole('button', { name: 'Me désinscrire' });
  await unsubscribe.waitFor();
  assert.equal(submissions.length, 3);
  await unsubscribe.click();
  await page.getByText('Votre désinscription est enregistrée.').waitFor();
  assert.deepEqual(submissions[3], { action: 'unsubscribe', token: 'test-token' });

  const mobile = await fixture({
    viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce'
  });
  await openArticle(mobile.page);
  await readTo(mobile.page, 0.56);
  await mobile.dialog.waitFor();
  const bounds = await mobile.dialog.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 568);
  assert.equal(await mobile.dialog.evaluate(element => getComputedStyle(element).animationName), 'none');
  const mobileSubmit = await mobile.dialog.locator('button[type=submit]').boundingBox();
  assert.ok(mobileSubmit.y + mobileSubmit.height <= bounds.y + bounds.height);
  await mobile.dialog.getByRole('button', { name: 'Fermer l’invitation' }).click();
  await mobile.dialog.waitFor({ state: 'hidden' });

  const production = await fixture();
  await openArticle(production.page, 'sols&previewNewsletter=1');
  await production.page.waitForFunction(() =>
    !document.querySelector('#articleNewsletter button[type=submit]').disabled);
  assert.equal(await production.dialog.isVisible(), false);
  await readTo(production.page, 0.56);
  await production.dialog.waitFor();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
    const preview = await fixture({ viewport, reducedMotion: 'reduce' }, true);
    await preview.page.addInitScript(([shown, signedUp, session]) => {
      localStorage.setItem(shown, '123');
      localStorage.setItem(signedUp, 'true');
      sessionStorage.setItem(session, 'existing-marker');
    }, [lastShown, subscribed, sessionShown]);
    await openArticle(preview.page, 'sols&previewNewsletter=1');
    await preview.dialog.waitFor();
    const visual = preview.dialog.locator('.newsletter-dialog-visual');
    assert.equal(await visual.isVisible(), viewport.width > 620);
    const consentLabel = preview.dialog.locator('.newsletter-consent');
    assert.equal(await consentLabel.innerText(), 'J’accepte de recevoir la newsletter Agri-tech par e-mail.');
    assert.equal(await consentLabel.evaluate(element => getComputedStyle(element).fontWeight), '400');
    const lines = await consentLabel.locator('span').evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    });
    assert.ok(lines <= (viewport.width > 620 ? 1 : 2));
    assert.equal(await consentLabel.getByRole('checkbox').getAttribute('required'), '');

    if (process.env.NEWSLETTER_SCREENSHOTS) {
      await preview.page.evaluate(() => document.fonts.ready);
      await preview.page.screenshot({ path: `${process.env.NEWSLETTER_SCREENSHOTS}/newsletter-${viewport.width}.png` });
    }
    const bounds = await preview.dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
    const previewSubmit = preview.dialog.locator('button[type=submit]');
    const submitBounds = await previewSubmit.boundingBox();
    assert.ok(submitBounds.y + submitBounds.height <= bounds.y + bounds.height);
    await preview.dialog.locator('input[type=email]').fill('visuel@example.org');
    await preview.dialog.getByRole('checkbox').check();
    await previewSubmit.click();
    await preview.dialog.getByText('Aperçu terminé. Aucune inscription n’a été envoyée.').waitFor();
    assert.deepEqual(preview.submissions, []);
    assert.deepEqual(await preview.page.evaluate(keys => keys.map(key => localStorage.getItem(key)),
      [lastShown, subscribed]), ['123', 'true']);
    assert.equal(await preview.page.evaluate(key => sessionStorage.getItem(key), sessionShown), 'existing-marker');
    await preview.page.keyboard.press('Escape');
    await preview.dialog.waitFor({ state: 'hidden' });
    await preview.page.reload();
    await preview.dialog.waitFor();
    await preview.page.goto(`${origin}/newsletter/#unsubscribe=test-token`);
    await preview.page.getByRole('button', { name: 'Me désinscrire' }).waitFor();
    const brand = preview.page.locator('.newsletter-account-brand');
    assert.equal(await brand.innerText(), 'Agri-tech');
    const logo = brand.locator('img');
    await logo.waitFor();
    await preview.page.waitForFunction(() => document.querySelector('.newsletter-account-brand img').naturalWidth === 127);
    assert.deepEqual(preview.submissions, []);
    if (process.env.NEWSLETTER_SCREENSHOTS) {
      await preview.page.screenshot({ path: `${process.env.NEWSLETTER_SCREENSHOTS}/desinscription-${viewport.width}.png` });
    }
    assert.deepEqual(preview.errors, []);
  }

  for (const width of [320, 1024, 1440]) {
    const footerFixture = await fixture({ viewport: { width, height: 820 }, reducedMotion: 'reduce' });
    await footerFixture.page.goto(`${origin}/index.html`);
    const footer = footerFixture.page.locator('.site-footer');
    const newsletter = footer.locator('.footer-newsletter');
    await footer.scrollIntoViewIfNeeded();
    assert.doesNotMatch(await newsletter.innerText(), /En vous inscrivant|Demander la désinscription|Politique de confidentialité/);
    const column = await newsletter.boundingBox();
    const form = await newsletter.locator('form').boundingBox();
    assert.ok(column.x >= 0 && form.x + form.width <= width + 1);
    if (width > 900) {
      const heading = await newsletter.locator('h4').boundingBox();
      for (const selector of ['.footer-links h4', '.footer-contact h4']) {
        const neighbor = await footer.locator(selector).boundingBox();
        assert.ok(Math.abs(heading.y - neighbor.y) < 1);
        assert.equal(await newsletter.locator("h4").evaluate(element => getComputedStyle(element).lineHeight),
          await footer.locator(selector).evaluate(element => getComputedStyle(element).lineHeight));
      }
    }
    if (process.env.NEWSLETTER_SCREENSHOTS) {
      await footerFixture.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await (width === 320 ? newsletter : footer).screenshot({ path: `${process.env.NEWSLETTER_SCREENSHOTS}/footer-${width}.png` });
    }
    await footerFixture.page.close();
  }

  for (const width of [320, 1024]) {
    const mail = await browser.newPage({ viewport: { width, height: 800 } });
    await mail.route('**/*', route => route.abort());
    for (const details of [
      { kind: 'admin', email: 'a'.repeat(64) + '@example.org', source: 'footer', timestamp: '2026-11-22T15:30:00Z' },
      { kind: 'welcome', unsubscribe: '#apercu-desinscription' }
    ]) {
      const { html, text } = renderNewsletterEmail(details);
      await mail.setContent(html, { waitUntil: 'load' });
      assert.equal(await mail.locator('img').count(), 0);
      assert.equal(await mail.evaluate(() => document.documentElement.scrollWidth), width);
      assert.ok((await mail.getByRole('heading', { level: 1 }).boundingBox()).width <= 600);
      if (details.kind === 'welcome') {
        assert.match(text, /Se désinscrire : #apercu-desinscription/);
        await mail.getByRole('heading', { name: 'Bienvenue chez Agri-tech !' }).waitFor();
        assert.deepEqual(await mail.locator('p').allInnerTexts(), [
          'Bonjour,',
          'Merci pour votre inscription à la newsletter Agri-tech.',
          'Vous recevrez désormais nos articles, conseils pratiques, actualités agricoles et informations sur nos formations.',
          'Notre objectif est de partager avec vous des informations utiles, accessibles et adaptées aux réalités agricoles en Haïti.',
          'À bientôt,',
          "Walter Darius\nDirecteur général d'Agri-tech",
          'Vous avez reçu cet e-mail parce que vous êtes abonné à la newsletter Agri-tech.',
          'Se désinscrire'
        ]);
        const banner = mail.getByText('Agri-tech', { exact: true });
        assert.equal(await banner.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(15, 61, 46)');
        const signature = mail.locator('strong').filter({ hasText: 'Walter Darius' });
        assert.equal(await signature.evaluate(element => getComputedStyle(element).color), 'rgb(15, 61, 46)');
        assert.equal(await signature.locator('..').locator('em').innerText(), "Directeur général d'Agri-tech");
        const footer = mail.locator('p').filter({ hasText: 'Vous avez reçu cet e-mail' });
        assert.deepEqual(await footer.evaluate(element => {
          const style = getComputedStyle(element);
          return [style.borderTopWidth, style.color, style.fontSize];
        }), ['1px', 'rgb(91, 105, 98)', '13px']);
        const link = mail.getByRole('link', { name: 'Se désinscrire' });
        await mail.keyboard.press('Tab');
        assert.equal(await link.evaluate(element => element === document.activeElement), true);
        assert.equal(await link.getAttribute('href'), details.unsubscribe);
        assert.deepEqual(await link.evaluate(element => {
          const style = getComputedStyle(element);
          return [style.color, style.textDecorationLine, style.textDecorationThickness, style.outlineStyle];
        }), ['rgb(15, 61, 46)', 'underline', '3px', 'none']);
      } else {
        assert.match(text, /22 novembre 2026 à 10:30/);
        const label = await mail.getByRole('rowheader', { name: 'Adresse e-mail :' }).boundingBox();
        const value = await mail.getByRole('cell', { name: details.email }).boundingBox();
        assert.ok(label.x + label.width <= value.x + 1);
      }
      if (process.env.NEWSLETTER_SCREENSHOTS) {
        await mail.screenshot({ path: `${process.env.NEWSLETTER_SCREENSHOTS}/email-${details.kind}-${width}.png`, fullPage: true });
      }
    }
    await mail.close();
  }

  const denied = await fixture();
  await denied.page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('Quota indisponible'); };
  });
  await openArticle(denied.page);
  await readTo(denied.page, 0.57);
  assert.equal(await denied.dialog.isVisible(), false);

  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(`${origin}/article.html`);
  assert.equal(await noJs.locator('#articleNewsletter').isVisible(), false);
  assert.equal(await noJs.locator('#newsletterSubmit').isDisabled(), true);
  assert.deepEqual([...desktop.errors, ...mobile.errors], []);
  console.log('Newsletter Chromium : seuil, fréquence, clavier, mobile, formulaires et erreurs vérifiés.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
