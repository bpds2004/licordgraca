import { SUPABASE_ANON_KEY, SUPABASE_URL, SITE_CONTENT_ID } from './site-config.js';

const DEFAULT_CONTENT_URL = '/content/default-content.json';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const safeUrl = (value = '', fallback = '#') => {
  const url = String(value).trim();
  if (!url) return fallback;
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? url : fallback;
  } catch {
    return fallback;
  }
};

const slugify = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '') || `item-${Date.now()}`;

const deepMerge = (base, override) => {
  if (Array.isArray(override)) return override;
  if (!override || typeof override !== 'object') return override ?? base;
  const result = { ...(base || {}) };
  Object.entries(override).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(result[key], value)
      : value;
  });
  return result;
};

const formatPrice = (value) => new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR'
}).format(Number(value) || 0);

const fetchJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
};

const loadContent = async () => {
  const defaults = await fetchJson(DEFAULT_CONTENT_URL);
  try {
    const rows = await fetchJson(
      `${SUPABASE_URL}/rest/v1/site_content?id=eq.${encodeURIComponent(SITE_CONTENT_ID)}&select=content`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json'
        }
      }
    );
    return rows?.[0]?.content ? deepMerge(defaults, rows[0].content) : defaults;
  } catch (error) {
    console.info('A usar o conteúdo local do site.', error.message);
    return defaults;
  }
};

const applyMetaAndTheme = (content) => {
  document.documentElement.lang = 'pt-PT';
  document.title = content.meta?.title || document.title;
  let description = document.querySelector('meta[name="description"]');
  if (!description) {
    description = document.createElement('meta');
    description.name = 'description';
    document.head.appendChild(description);
  }
  description.content = content.meta?.description || '';

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && content.meta?.favicon) favicon.href = safeUrl(content.meta.favicon, '/licordgraca.png');

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', content.theme?.primary || '#daa520');
  root.style.setProperty('--brand-accent', content.theme?.accent || '#ffd700');
  root.style.setProperty('--brand-background', content.theme?.background || '#000000');
  root.style.setProperty('--brand-surface', content.theme?.surface || '#111111');
  root.style.setProperty('--brand-text', content.theme?.text || '#f1f1f1');

  const logo = document.querySelector('header .logo');
  if (logo && content.meta?.logo) logo.src = safeUrl(content.meta.logo, '/licordgraca.png');
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.style.backgroundImage = content.theme?.heroImage
      ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url("${safeUrl(content.theme.heroImage, '')}")`
      : '';
  }
};

const setSectionVisibility = (id, visible) => {
  const section = document.getElementById(id);
  if (section) section.hidden = visible === false;
  const link = document.querySelector(`nav a[href="#${id}"]`);
  if (link?.parentElement) link.parentElement.hidden = visible === false;
};

const renderNavigationAndHero = (content) => {
  const labels = content.navigation || {};
  ['home', 'products', 'kits', 'events', 'about', 'faq', 'contact'].forEach((id) => {
    const link = document.querySelector(`nav a[href="#${id}"]`);
    if (link && labels[id]) link.textContent = labels[id];
  });
  const cart = document.getElementById('cart-toggle');
  if (cart) cart.innerHTML = `<i class="fas fa-shopping-cart"></i> ${escapeHtml(labels.cart || 'Carrinho')}`;

  const hero = document.getElementById('home');
  if (hero) {
    const title = hero.querySelector('h2');
    const subtitle = hero.querySelector('p');
    const button = hero.querySelector('.btn');
    if (title) title.textContent = content.hero?.title || '';
    if (subtitle) subtitle.textContent = content.hero?.subtitle || '';
    if (button) button.textContent = content.hero?.button || '';
  }
};

const renderSizeOptions = (product, groupName, sizeLabel) => {
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  return `
    <label>${escapeHtml(sizeLabel)}</label>
    <div class="option-wrapper">
      ${sizes.map((size, index) => {
        const inputId = `${groupName}-${index}`;
        const label = `${size.label} - ${formatPrice(size.price)}`;
        return `
          <input class="option-input" type="radio" name="${escapeHtml(groupName)}" id="${escapeHtml(inputId)}" value="${Number(size.price) || 0}" data-label="${escapeHtml(label)}" ${index === sizes.length - 1 ? 'checked' : ''}>
          <label class="option-card" for="${escapeHtml(inputId)}">
            <span class="option-check"></span>
            <span class="option-title">${escapeHtml(size.label)}</span>
            <span class="option-price">${escapeHtml(formatPrice(size.price))}</span>
          </label>`;
      }).join('')}
    </div>`;
};

const renderProducts = (content) => {
  const section = document.getElementById('products');
  if (!section) return;
  setSectionVisibility('products', content.productSection?.visible !== false);
  const products = (content.products || []).filter((product) => product.visible !== false);
  const categories = content.productCategories || [];
  section.querySelector('.container').innerHTML = `
    <h2>${escapeHtml(content.productSection?.title || 'Produtos')}</h2>
    ${categories.map((category) => {
      const categoryProducts = products.filter((product) => product.categoryId === category.id);
      if (!categoryProducts.length) return '';
      return `
        <h3 class="product-category">${escapeHtml(category.title)}</h3>
        <div class="product-list ${category.layout === 'honor' ? 'product-list--honor' : ''}">
          ${categoryProducts.map((product) => {
            const groupName = `cms-size-${slugify(product.id || product.name)}`;
            return `
              <article class="product">
                <div class="card-media">
                  <div class="card-face card-face-front"><img src="${escapeHtml(safeUrl(product.image, '/licordgraca.png'))}" alt="${escapeHtml(product.name)}"></div>
                  <div class="card-face card-face-back"><p class="card-description">${escapeHtml(product.description)}</p></div>
                </div>
                <h3>${escapeHtml(product.name)}</h3>
                ${renderSizeOptions(product, groupName, content.productSection?.sizeLabel || 'Escolhe o tamanho')}
                <button type="button" data-cms-add-product data-name="${escapeHtml(product.name)}" data-group="${escapeHtml(groupName)}">${escapeHtml(content.productSection?.addButton || 'Adicionar ao Carrinho')}</button>
              </article>`;
          }).join('')}
        </div>`;
    }).join('')}`;
};

const renderKitOptions = (kit) => (kit.optionGroups || []).map((group, groupIndex) => {
  const groupName = `cms-kit-${slugify(kit.id || kit.name)}-${groupIndex}`;
  return `
    <label>${escapeHtml(group.label)}</label>
    <div class="option-wrapper option-wrapper--compact">
      ${(group.options || []).map((option, optionIndex) => {
        const inputId = `${groupName}-${optionIndex}`;
        return `
          <input class="option-input" type="radio" name="${escapeHtml(groupName)}" id="${escapeHtml(inputId)}" value="${escapeHtml(option)}" data-label="${escapeHtml(option)}" ${optionIndex === 0 ? 'checked' : ''}>
          <label class="option-card option-card--compact" for="${escapeHtml(inputId)}">
            <span class="option-check"></span><span class="option-title">${escapeHtml(option)}</span>
          </label>`;
      }).join('')}
    </div>`;
}).join('');

const renderKits = (content) => {
  const section = document.getElementById('kits');
  if (!section) return;
  setSectionVisibility('kits', content.kitSection?.visible !== false);
  const kits = (content.kits || []).filter((kit) => kit.visible !== false);
  section.querySelector('.container').innerHTML = `
    <h2>${escapeHtml(content.kitSection?.title || 'Kits')}</h2>
    <div class="kits-grid">
      ${kits.map((kit) => `
        <article class="kit-card ${kit.featured ? 'kit-card--featured' : ''}">
          <div class="card-media">
            <div class="card-face card-face-front"><img src="${escapeHtml(safeUrl(kit.image, '/licordgraca.png'))}" alt="${escapeHtml(kit.name)}"></div>
            <div class="card-face card-face-back"><p class="kit-description">${escapeHtml(kit.description)}</p></div>
          </div>
          <h3>${escapeHtml(kit.name)}</h3>
          ${renderKitOptions(kit)}
          <p class="kit-price">Preço do kit: ${escapeHtml(formatPrice(kit.price))}</p>
          <button type="button" data-cms-add-kit data-kit-id="${escapeHtml(kit.id)}">${escapeHtml(content.kitSection?.addButton || 'Adicionar ao Carrinho')}</button>
        </article>`).join('')}
    </div>`;
};

const renderEvents = (content) => {
  const section = document.getElementById('events');
  if (!section) return;
  setSectionVisibility('events', content.eventSection?.visible !== false);
  const events = (content.events || []).filter((event) => event.visible !== false);
  section.querySelector('.container').innerHTML = `
    <h2>${escapeHtml(content.eventSection?.title || 'Próximos Eventos')}</h2>
    <div class="events-grid"><div class="event-calendar">
      <h3>${escapeHtml(content.eventSection?.subtitle || 'Calendário')}</h3>
      <ul id="event-list">
        ${events.map((event) => `
          <li class="event-item">
            <span class="event-icon" aria-hidden="true">${escapeHtml(event.icon || '📅')}</span>
            <div class="event-details">
              <span class="event-date">${escapeHtml(event.date)}</span>
              <span class="event-title">${escapeHtml(event.title)}</span>
              <span class="event-location"><span aria-hidden="true">📍</span> ${escapeHtml(event.location)}</span>
            </div>
          </li>`).join('')}
      </ul>
    </div></div>`;
};

const renderAbout = (content) => {
  const section = document.getElementById('about');
  if (!section) return;
  setSectionVisibility('about', content.about?.visible !== false);
  section.querySelector('.container').innerHTML = `
    <h2>${escapeHtml(content.about?.title || 'Sobre Nós')}</h2>
    <img src="${escapeHtml(safeUrl(content.about?.image, '/patroa.png'))}" alt="${escapeHtml(content.about?.imageAlt || '')}" class="about-image">
    <div class="animated-rectangle">${(content.about?.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>`;
};

const faqTrackers = Array.from({ length: 25 }, (_, index) => `<div class="faq-tracker tr-${index + 1}"></div>`).join('');

const renderFaq = (content) => {
  const section = document.getElementById('faq');
  if (!section) return;
  setSectionVisibility('faq', content.faqSection?.visible !== false);
  const faq = (content.faq || []).filter((item) => item.visible !== false);
  section.querySelector('.container').innerHTML = `
    <h2>${escapeHtml(content.faqSection?.title || 'Perguntas e Respostas')}</h2>
    <div class="faq-grid">${faq.map((item) => `
      <div class="faq-card noselect"><div class="faq-canvas">
        ${faqTrackers}
        <div class="faq-card-surface"><p class="faq-question">${escapeHtml(item.question)}</p><p class="faq-answer">${escapeHtml(item.answer)}</p></div>
      </div></div>`).join('')}</div>`;
};

const renderContact = (content) => {
  const section = document.getElementById('contact');
  if (!section) return;
  setSectionVisibility('contact', content.contact?.visible !== false);
  const contact = content.contact || {};
  section.querySelector('.container').innerHTML = `
    <h2>${escapeHtml(contact.title || 'Contactos')}</h2>
    <p>${escapeHtml(contact.intro || '')}</p>
    <ul class="contact-info">
      <li><i class="fab fa-instagram"></i> <strong>Instagram:</strong> <a href="${escapeHtml(safeUrl(contact.instagramUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(contact.instagramLabel)}</a></li>
      <li><i class="fas fa-envelope"></i> <strong>Email:</strong> <a href="mailto:${escapeHtml(contact.email || '')}">${escapeHtml(contact.email)}</a></li>
      <li><i class="fab fa-facebook"></i> <strong>Facebook:</strong> <a href="${escapeHtml(safeUrl(contact.facebookUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(contact.facebookLabel)}</a></li>
      <li><i class="fas fa-phone-alt"></i> <strong>Telemóvel:</strong> <a href="tel:${escapeHtml(contact.phone || '')}">${escapeHtml(contact.phoneLabel)}</a></li>
    </ul>`;
};

const renderFeedbackAndUtilityText = (content) => {
  const section = document.getElementById('feedback-actions');
  if (section) {
    section.hidden = content.feedback?.visible === false;
    section.querySelector('.container').innerHTML = `
      <h2>${escapeHtml(content.feedback?.title || '')}</h2>
      <div class="feedback-buttons">
        <a class="complaint-button" href="${escapeHtml(safeUrl(content.feedback?.complaintsUrl))}" target="_blank" rel="noopener noreferrer">${escapeHtml(content.feedback?.complaintsLabel)}</a>
        <button class="feedback-button" type="button" id="feedback-open">${escapeHtml(content.feedback?.buttonLabel)}<span class="feedback-button-glow" aria-hidden="true"></span></button>
      </div>`;
  }
  const mobileTitle = document.getElementById('mobile-popup-title');
  const mobileMessage = document.getElementById('mobile-popup-message');
  const mobileButton = document.getElementById('mobile-popup-close');
  if (mobileTitle) mobileTitle.textContent = content.mobileHint?.title || '';
  if (mobileMessage) mobileMessage.textContent = content.mobileHint?.message || '';
  if (mobileButton) mobileButton.textContent = content.mobileHint?.button || '';
  const footer = document.querySelector('footer p');
  if (footer) footer.textContent = content.footer?.text || '';
  const shippingLabel = content.commerce?.shippingLabel || 'Portes (Portugal continental)';
  const cartShipping = document.getElementById('cart-shipping');
  if (cartShipping) cartShipping.textContent = `${shippingLabel}: €0.00`;
};

const renderSite = (content) => {
  window.siteContent = content;
  applyMetaAndTheme(content);
  renderNavigationAndHero(content);
  renderProducts(content);
  renderKits(content);
  renderEvents(content);
  renderAbout(content);
  renderFaq(content);
  renderContact(content);
  renderFeedbackAndUtilityText(content);
  document.documentElement.classList.add('cms-ready');
};

document.addEventListener('click', (event) => {
  const productButton = event.target.closest('[data-cms-add-product]');
  if (productButton && typeof window.adicionarAoCarrinho === 'function') {
    window.adicionarAoCarrinho(productButton.dataset.name, productButton.dataset.group);
    return;
  }
  const kitButton = event.target.closest('[data-cms-add-kit]');
  if (kitButton && typeof window.adicionarKitAoCarrinho === 'function') {
    const kit = window.siteContent?.kits?.find((item) => item.id === kitButton.dataset.kitId);
    if (!kit) return;
    const groups = (kit.optionGroups || []).map((group, index) => ({
      id: `cms-kit-${slugify(kit.id || kit.name)}-${index}`,
      label: group.label
    }));
    window.adicionarKitAoCarrinho(kit.name, groups.length ? groups : null, kit.price, kit.detail || '');
  }
});

try {
  renderSite(await loadContent());
} catch (error) {
  console.error('Não foi possível preparar o conteúdo do site.', error);
}
