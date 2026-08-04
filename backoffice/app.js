import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL, SITE_ASSETS_BUCKET, SITE_CONTENT_ID } from '../site-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const views = [
  { id: 'general', icon: '⌂', label: 'Geral', title: 'Conteúdo geral', description: 'Marca, navegação, destaque inicial e mensagens gerais.' },
  { id: 'products', icon: '◆', label: 'Produtos', title: 'Produtos', description: 'Sabores, imagens, descrições, tamanhos e preços.' },
  { id: 'kits', icon: '▣', label: 'Kits', title: 'Kits', description: 'Kits, opções de escolha, imagens e preços.' },
  { id: 'events', icon: '◷', label: 'Eventos', title: 'Próximos eventos', description: 'Calendário apresentado no site público.' },
  { id: 'about', icon: '●', label: 'Sobre e FAQ', title: 'Sobre e perguntas', description: 'História da marca e perguntas frequentes.' },
  { id: 'contact', icon: '✦', label: 'Contactos', title: 'Contactos e feedback', description: 'Redes sociais, email, telefone e ligações úteis.' },
  { id: 'appearance', icon: '◐', label: 'Aparência', title: 'Aparência e secções', description: 'Cores, imagem de fundo, títulos, visibilidade e portes.' },
  { id: 'backup', icon: '⇩', label: 'Cópias', title: 'Cópias de segurança', description: 'Exportar, importar ou repor o conteúdo inicial.' }
];

const dom = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginStatus: document.getElementById('login-status'),
  app: document.getElementById('admin-app'),
  nav: document.getElementById('admin-nav'),
  editor: document.getElementById('editor'),
  viewTitle: document.getElementById('view-title'),
  viewDescription: document.getElementById('view-description'),
  adminEmail: document.getElementById('admin-email'),
  saveButton: document.getElementById('save-button'),
  logoutButton: document.getElementById('logout-button'),
  dirtyIndicator: document.getElementById('dirty-indicator'),
  setupAlert: document.getElementById('setup-alert'),
  toast: document.getElementById('toast'),
  importFile: document.getElementById('import-file')
};

let defaults = {};
let content = {};
let currentUser = null;
let activeView = 'general';
let dirty = false;
let toastTimer;

const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const price = (value) => Number(value || 0).toFixed(2).replace('.', ',');

const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const setPath = (object, path, value) => {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((value, key) => value[key], object);
  target[last] = value;
};

const markDirty = () => {
  dirty = true;
  dom.dirtyIndicator.textContent = 'Alterações por guardar';
  dom.dirtyIndicator.classList.add('is-dirty');
};

const markSaved = () => {
  dirty = false;
  dom.dirtyIndicator.textContent = 'Tudo guardado';
  dom.dirtyIndicator.classList.remove('is-dirty');
};

const showToast = (message, error = false) => {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.toggle('is-error', error);
  dom.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), 3600);
};

const field = (label, path, options = {}) => {
  const value = getPath(content, path) ?? '';
  const type = options.type || 'text';
  const classes = options.span ? 'span-2' : '';
  const attributes = [
    `data-path="${escapeHtml(path)}"`,
    options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : '',
    options.min !== undefined ? `min="${options.min}"` : '',
    options.step !== undefined ? `step="${options.step}"` : ''
  ].filter(Boolean).join(' ');

  if (type === 'textarea') {
    return `<label class="${classes}">${escapeHtml(label)}<textarea ${attributes}>${escapeHtml(value)}</textarea>${options.help ? `<span class="help-text">${escapeHtml(options.help)}</span>` : ''}</label>`;
  }
  if (type === 'checkbox') {
    return `<label class="check-label ${classes}"><input type="checkbox" ${attributes} ${value ? 'checked' : ''}>${escapeHtml(label)}</label>`;
  }
  return `<label class="${classes}">${escapeHtml(label)}<input type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${attributes}>${options.help ? `<span class="help-text">${escapeHtml(options.help)}</span>` : ''}</label>`;
};

const selectField = (label, path, options, span = false) => {
  const value = getPath(content, path);
  return `<label class="${span ? 'span-2' : ''}">${escapeHtml(label)}<select data-path="${escapeHtml(path)}">${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
};

const imageField = (label, path) => {
  const value = getPath(content, path) || '';
  const preview = value || '/licordgraca.png';
  return `<div class="span-2"><label>${escapeHtml(label)}</label><div class="image-field">
    <img class="image-preview" src="${escapeHtml(preview)}" alt="Pré-visualização">
    <div class="image-controls">
      <input data-path="${escapeHtml(path)}" value="${escapeHtml(value)}" placeholder="/imagem.png ou https://...">
      <label class="button button-secondary file-button">Carregar imagem<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload-path="${escapeHtml(path)}"></label>
    </div>
  </div></div>`;
};

const panel = (title, description, body) => `<section class="panel"><h2>${escapeHtml(title)}</h2>${description ? `<p class="panel-description">${escapeHtml(description)}</p>` : ''}${body}</section>`;
const actions = (list, index, extra = '') => `<div class="row-actions">
  ${extra}
  <button class="button button-secondary button-small" type="button" data-action="move-up" data-list="${list}" data-index="${index}" aria-label="Mover para cima">↑</button>
  <button class="button button-secondary button-small" type="button" data-action="move-down" data-list="${list}" data-index="${index}" aria-label="Mover para baixo">↓</button>
  <button class="button button-danger button-small" type="button" data-action="delete" data-list="${list}" data-index="${index}">Eliminar</button>
</div>`;

const renderGeneral = () => [
  panel('Identidade da marca', 'Define o título do separador, descrição e imagens principais.', `<div class="form-grid">
    ${field('Título do site', 'meta.title')}
    ${field('Descrição para motores de pesquisa', 'meta.description', { span: true, type: 'textarea' })}
    ${imageField('Logótipo', 'meta.logo')}
    ${imageField('Ícone do separador', 'meta.favicon')}
  </div>`),
  panel('Destaque inicial', 'O primeiro conteúdo que os visitantes veem.', `<div class="form-grid">
    ${field('Título principal', 'hero.title')}
    ${field('Texto de apoio', 'hero.subtitle', { span: true, type: 'textarea' })}
    ${field('Texto do botão', 'hero.button')}
  </div>`),
  panel('Menu', 'Altere os nomes apresentados no cabeçalho.', `<div class="form-grid">
    ${field('Início', 'navigation.home')}${field('Produtos', 'navigation.products')}
    ${field('Kits', 'navigation.kits')}${field('Eventos', 'navigation.events')}
    ${field('Sobre', 'navigation.about')}${field('FAQ', 'navigation.faq')}
    ${field('Contactos', 'navigation.contact')}${field('Carrinho', 'navigation.cart')}
  </div>`),
  panel('Mensagens do site', 'Confirmação de idade, aviso de telemóvel e rodapé.', `<div class="form-grid">
    ${field('Ativar confirmação de idade', 'ageGate.enabled', { type: 'checkbox', span: true })}
    ${field('Pergunta de confirmação', 'ageGate.question', { type: 'textarea', span: true })}
    ${field('Mensagem de acesso recusado', 'ageGate.deniedMessage', { type: 'textarea', span: true })}
    ${field('Título do aviso móvel', 'mobileHint.title')}${field('Botão do aviso móvel', 'mobileHint.button')}
    ${field('Mensagem do aviso móvel', 'mobileHint.message', { type: 'textarea', span: true })}
    ${field('Texto do rodapé', 'footer.text', { span: true })}
  </div>`)
].join('');

const renderCategories = () => panel('Categorias', 'Organizam os produtos no site.', `<div class="panel-header"><span></span><button class="button button-secondary button-small" type="button" data-action="add-category">+ Nova categoria</button></div>
  ${(content.productCategories || []).map((category, index) => `<div class="item-card"><div class="item-header"><h3>${escapeHtml(category.title || 'Categoria')}</h3>${actions('productCategories', index)}</div><div class="form-grid">
    ${field('Nome da categoria', `productCategories.${index}.title`)}
    ${selectField('Apresentação', `productCategories.${index}.layout`, [{ value: 'standard', label: 'Grelha normal' }, { value: 'honor', label: 'Grelha compacta' }])}
  </div></div>`).join('')}`);

const renderProducts = () => {
  const categoryOptions = (content.productCategories || []).map((category) => ({ value: category.id, label: category.title }));
  return `${renderCategories()}${panel('Produtos', 'Pode adicionar, ocultar, ordenar ou eliminar produtos.', `<div class="panel-header"><span>${content.products?.length || 0} produtos</span><button class="button button-primary button-small" type="button" data-action="add-product">+ Novo produto</button></div>
    ${(content.products || []).map((product, index) => `<article class="item-card"><div class="item-header"><h3>${escapeHtml(product.name || 'Novo produto')}</h3>${actions('products', index)}</div>
      <div class="form-grid">
        ${field('Visível no site', `products.${index}.visible`, { type: 'checkbox' })}
        ${selectField('Categoria', `products.${index}.categoryId`, categoryOptions)}
        ${field('Nome', `products.${index}.name`)}
        ${field('Descrição', `products.${index}.description`, { type: 'textarea', span: true })}
        ${imageField('Imagem', `products.${index}.image`)}
      </div>
      <div class="inline-list"><div class="panel-header"><strong>Tamanhos e preços</strong><button class="button button-secondary button-small" type="button" data-action="add-size" data-index="${index}">+ Tamanho</button></div>
        ${(product.sizes || []).map((size, sizeIndex) => `<div class="inline-row">
          ${field('Tamanho', `products.${index}.sizes.${sizeIndex}.label`)}
          ${field('Preço (€)', `products.${index}.sizes.${sizeIndex}.price`, { type: 'number', min: 0, step: .01 })}
          <button class="button button-danger button-small" type="button" data-action="delete-size" data-index="${index}" data-subindex="${sizeIndex}">Eliminar tamanho</button>
        </div>`).join('')}
      </div>
    </article>`).join('') || '<div class="empty-state">Ainda não existem produtos.</div>'}`)}`;
};

const renderKits = () => panel('Kits', 'Configure o preço e as escolhas disponíveis em cada kit.', `<div class="panel-header"><span>${content.kits?.length || 0} kits</span><button class="button button-primary button-small" type="button" data-action="add-kit">+ Novo kit</button></div>
  ${(content.kits || []).map((kit, index) => `<article class="item-card"><div class="item-header"><h3>${escapeHtml(kit.name || 'Novo kit')}</h3>${actions('kits', index)}</div>
    <div class="form-grid">
      ${field('Visível no site', `kits.${index}.visible`, { type: 'checkbox' })}
      ${field('Destacar visualmente', `kits.${index}.featured`, { type: 'checkbox' })}
      ${field('Nome', `kits.${index}.name`)}
      ${field('Preço (€)', `kits.${index}.price`, { type: 'number', min: 0, step: .01 })}
      ${field('Descrição', `kits.${index}.description`, { type: 'textarea', span: true })}
      ${field('Detalhe fixo da encomenda', `kits.${index}.detail`, { span: true, help: 'Ex.: Sabores predefinidos (5 x 100ml)' })}
      ${imageField('Imagem', `kits.${index}.image`)}
    </div>
    <div class="inline-list"><div class="panel-header"><strong>Grupos de escolha</strong><button class="button button-secondary button-small" type="button" data-action="add-option-group" data-index="${index}">+ Grupo</button></div>
      ${(kit.optionGroups || []).map((group, groupIndex) => `<div class="item-card"><div class="item-header"><strong>${escapeHtml(group.label || 'Grupo')}</strong><button class="button button-danger button-small" type="button" data-action="delete-option-group" data-index="${index}" data-subindex="${groupIndex}">Eliminar</button></div><div class="form-grid">
        ${field('Pergunta', `kits.${index}.optionGroups.${groupIndex}.label`)}
        <label class="span-2">Opções (uma por linha)<textarea data-lines-path="kits.${index}.optionGroups.${groupIndex}.options">${escapeHtml((group.options || []).join('\n'))}</textarea></label>
      </div></div>`).join('') || '<p class="help-text">Sem escolhas: o kit é adicionado diretamente ao carrinho.</p>'}
    </div>
  </article>`).join('') || '<div class="empty-state">Ainda não existem kits.</div>'}`);

const renderEvents = () => panel('Calendário de eventos', 'A ordem abaixo é a ordem apresentada no site.', `<div class="panel-header"><span>${content.events?.length || 0} eventos</span><button class="button button-primary button-small" type="button" data-action="add-event">+ Novo evento</button></div>
  ${(content.events || []).map((event, index) => `<article class="item-card"><div class="item-header"><h3>${escapeHtml(event.title || 'Novo evento')}</h3>${actions('events', index)}</div><div class="form-grid">
    ${field('Visível no site', `events.${index}.visible`, { type: 'checkbox' })}
    ${field('Ícone', `events.${index}.icon`, { help: 'Pode usar um emoji, por exemplo: 🎉' })}
    ${field('Nome do evento', `events.${index}.title`)}
    ${field('Data apresentada', `events.${index}.date`)}
    ${field('Localização', `events.${index}.location`, { span: true })}
  </div></article>`).join('') || '<div class="empty-state">Ainda não existem eventos.</div>'}`);

const renderAbout = () => `${panel('Sobre a marca', 'Imagem e texto da secção Sobre Nós.', `<div class="form-grid">
  ${field('Mostrar secção', 'about.visible', { type: 'checkbox', span: true })}
  ${field('Título', 'about.title')}${field('Descrição da imagem', 'about.imageAlt')}
  ${imageField('Imagem', 'about.image')}
  <label class="span-2">Parágrafos (um por linha)<textarea data-lines-path="about.paragraphs">${escapeHtml((content.about?.paragraphs || []).join('\n'))}</textarea></label>
</div>`)}${panel('Perguntas frequentes', 'Adicione, ordene ou oculte perguntas.', `<div class="panel-header"><span>${content.faq?.length || 0} perguntas</span><button class="button button-primary button-small" type="button" data-action="add-faq">+ Nova pergunta</button></div>
  ${(content.faq || []).map((item, index) => `<article class="item-card"><div class="item-header"><h3>${escapeHtml(item.question || 'Nova pergunta')}</h3>${actions('faq', index)}</div><div class="form-grid">
    ${field('Visível no site', `faq.${index}.visible`, { type: 'checkbox', span: true })}
    ${field('Pergunta', `faq.${index}.question`, { span: true })}
    ${field('Resposta', `faq.${index}.answer`, { type: 'textarea', span: true })}
  </div></article>`).join('') || '<div class="empty-state">Ainda não existem perguntas.</div>'}`)}`;

const renderContact = () => `${panel('Contactos', 'Dados apresentados na secção de contactos.', `<div class="form-grid">
  ${field('Mostrar secção', 'contact.visible', { type: 'checkbox', span: true })}
  ${field('Título', 'contact.title')}${field('Texto de introdução', 'contact.intro')}
  ${field('Nome no Instagram', 'contact.instagramLabel')}${field('Ligação do Instagram', 'contact.instagramUrl', { type: 'url' })}
  ${field('Email', 'contact.email', { type: 'email' })}
  ${field('Nome no Facebook', 'contact.facebookLabel')}${field('Ligação do Facebook', 'contact.facebookUrl', { type: 'url' })}
  ${field('Telefone apresentado', 'contact.phoneLabel')}${field('Telefone para chamada', 'contact.phone')}
</div>`)}${panel('Opiniões e reclamações', 'Textos e ligação da área de feedback.', `<div class="form-grid">
  ${field('Mostrar secção', 'feedback.visible', { type: 'checkbox', span: true })}
  ${field('Título', 'feedback.title')}${field('Texto do botão de feedback', 'feedback.buttonLabel')}
  ${field('Texto do Livro de Reclamações', 'feedback.complaintsLabel')}${field('Ligação do Livro de Reclamações', 'feedback.complaintsUrl', { type: 'url' })}
</div>`)}`;

const renderAppearance = () => `${panel('Cores e fundo', 'Personalize a identidade visual sem alterar CSS.', `<div class="form-grid">
  ${field('Cor principal', 'theme.primary', { type: 'color' })}${field('Cor de destaque', 'theme.accent', { type: 'color' })}
  ${field('Fundo principal', 'theme.background', { type: 'color' })}${field('Fundo das secções', 'theme.surface', { type: 'color' })}
  ${field('Cor do texto', 'theme.text', { type: 'color' })}${imageField('Imagem de fundo do destaque', 'theme.heroImage')}
</div>`)}${panel('Secções e títulos', 'Oculte uma secção sem apagar o seu conteúdo.', `<div class="form-grid">
  ${field('Mostrar produtos', 'productSection.visible', { type: 'checkbox' })}${field('Título dos produtos', 'productSection.title')}
  ${field('Texto antes dos tamanhos', 'productSection.sizeLabel')}${field('Botão dos produtos', 'productSection.addButton')}
  ${field('Mostrar kits', 'kitSection.visible', { type: 'checkbox' })}${field('Título dos kits', 'kitSection.title')}
  ${field('Botão dos kits', 'kitSection.addButton')}
  ${field('Mostrar eventos', 'eventSection.visible', { type: 'checkbox' })}${field('Título dos eventos', 'eventSection.title')}
  ${field('Subtítulo dos eventos', 'eventSection.subtitle')}
  ${field('Mostrar FAQ', 'faqSection.visible', { type: 'checkbox' })}${field('Título do FAQ', 'faqSection.title')}
</div>`)}${panel('Portes', 'Valores usados no cálculo do carrinho.', `<div class="form-grid">
  ${field('Valor base (€)', 'commerce.shippingBase', { type: 'number', min: 0, step: .01 })}
  ${field('Valor por artigo adicional (€)', 'commerce.shippingExtraItem', { type: 'number', min: 0, step: .01 })}
  ${field('Descrição dos portes', 'commerce.shippingLabel', { span: true })}
</div>`)}`;

const renderBackup = () => `<section class="panel"><h2>Cópias de segurança</h2><p class="panel-description">Guarde uma cópia num ficheiro ou recupere uma versão anterior.</p><div class="toolbar">
  <button class="button button-secondary" type="button" data-action="export">Exportar conteúdo</button>
  <button class="button button-secondary" type="button" data-action="import">Importar conteúdo</button>
  <button class="button button-danger" type="button" data-action="reset-defaults">Repor conteúdo inicial</button>
</div><p class="help-text">Importar ou repor apenas prepara as alterações. Carregue em “Guardar alterações” para as publicar.</p></section>
<section class="panel"><h2>Resumo atual</h2><div class="form-grid">
  <div><strong>${content.products?.length || 0}</strong><p class="help-text">produtos</p></div>
  <div><strong>${content.kits?.length || 0}</strong><p class="help-text">kits</p></div>
  <div><strong>${content.events?.length || 0}</strong><p class="help-text">eventos</p></div>
  <div><strong>${content.faq?.length || 0}</strong><p class="help-text">perguntas frequentes</p></div>
</div></section>`;

const renderEditor = () => {
  const view = views.find((item) => item.id === activeView) || views[0];
  dom.viewTitle.textContent = view.title;
  dom.viewDescription.textContent = view.description;
  dom.nav.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('is-active', button.dataset.view === activeView));
  const renderers = { general: renderGeneral, products: renderProducts, kits: renderKits, events: renderEvents, about: renderAbout, contact: renderContact, appearance: renderAppearance, backup: renderBackup };
  dom.editor.innerHTML = renderers[activeView]();
};

const renderNav = () => {
  dom.nav.innerHTML = views.map((view) => `<button class="nav-button ${view.id === activeView ? 'is-active' : ''}" type="button" data-view="${view.id}"><span class="nav-icon" aria-hidden="true">${view.icon}</span>${escapeHtml(view.label)}</button>`).join('');
};

const loadDefaults = async () => {
  const response = await fetch('/content/default-content.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar o conteúdo inicial.');
  defaults = await response.json();
};

const verifyAdmin = async (user) => {
  const { data, error } = await supabase.from('site_admins').select('email').eq('email', user.email.toLowerCase()).maybeSingle();
  if (error) {
    dom.setupAlert.hidden = false;
    throw new Error('O backoffice ainda não está configurado na base de dados.');
  }
  if (!data) throw new Error('Esta conta não tem autorização para gerir o site.');
};

const loadSavedContent = async () => {
  const { data, error } = await supabase.from('site_content').select('content').eq('id', SITE_CONTENT_ID).maybeSingle();
  if (error) throw error;
  content = clone(data?.content || defaults);
};

const enterApp = async (user) => {
  currentUser = user;
  await verifyAdmin(user);
  await loadSavedContent();
  dom.adminEmail.textContent = user.email;
  dom.loginScreen.hidden = true;
  dom.app.hidden = false;
  renderNav();
  renderEditor();
  markSaved();
};

const saveContent = async () => {
  if (!currentUser) return;
  dom.saveButton.disabled = true;
  dom.saveButton.textContent = 'A guardar…';
  const payload = { id: SITE_CONTENT_ID, content, updated_by: currentUser.id, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('site_content').upsert(payload, { onConflict: 'id' });
  dom.saveButton.disabled = false;
  dom.saveButton.textContent = 'Guardar alterações';
  if (error) {
    dom.setupAlert.hidden = false;
    showToast(`Não foi possível guardar: ${error.message}`, true);
    return;
  }
  dom.setupAlert.hidden = true;
  markSaved();
  showToast('Alterações publicadas no site.');
};

const uploadImage = async (input) => {
  const file = input.files?.[0];
  const path = input.dataset.uploadPath;
  if (!file || !path) return;
  if (file.size > 8 * 1024 * 1024) {
    showToast('A imagem não pode ultrapassar 8 MB.', true);
    input.value = '';
    return;
  }
  showToast('A carregar imagem…');
  const extension = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const storagePath = `uploads/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(SITE_ASSETS_BUCKET).upload(storagePath, file, { cacheControl: '3600', upsert: false });
  if (error) {
    dom.setupAlert.hidden = false;
    showToast(`Não foi possível carregar a imagem: ${error.message}`, true);
    return;
  }
  const { data } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(storagePath);
  setPath(content, path, data.publicUrl);
  markDirty();
  renderEditor();
  showToast('Imagem carregada. Guarde para a publicar.');
};

const addItem = (list, item) => {
  content[list] ||= [];
  content[list].push(item);
  markDirty();
  renderEditor();
};

const handleAction = (button) => {
  const action = button.dataset.action;
  const index = Number(button.dataset.index);
  const subindex = Number(button.dataset.subindex);
  const list = button.dataset.list;

  if (action === 'add-category') addItem('productCategories', { id: id('category'), title: 'Nova categoria', layout: 'standard' });
  if (action === 'add-product') addItem('products', { id: id('product'), categoryId: content.productCategories?.[0]?.id || '', name: 'Novo produto', description: '', image: '/licordgraca.png', visible: true, sizes: [{ label: '500ml', price: 0 }] });
  if (action === 'add-kit') addItem('kits', { id: id('kit'), name: 'Novo kit', description: '', image: '/licordgraca.png', price: 0, detail: '', visible: true, featured: false, optionGroups: [] });
  if (action === 'add-event') addItem('events', { id: id('event'), icon: '📅', date: '', title: 'Novo evento', location: '', visible: true });
  if (action === 'add-faq') addItem('faq', { id: id('faq'), question: 'Nova pergunta', answer: '', visible: true });

  if (action === 'add-size') {
    content.products[index].sizes ||= [];
    content.products[index].sizes.push({ label: 'Novo tamanho', price: 0 });
    markDirty(); renderEditor();
  }
  if (action === 'delete-size' && confirm('Eliminar este tamanho?')) {
    content.products[index].sizes.splice(subindex, 1);
    markDirty(); renderEditor();
  }
  if (action === 'add-option-group') {
    content.kits[index].optionGroups ||= [];
    content.kits[index].optionGroups.push({ label: 'Escolhe uma opção', options: ['Opção 1'] });
    markDirty(); renderEditor();
  }
  if (action === 'delete-option-group' && confirm('Eliminar este grupo de escolhas?')) {
    content.kits[index].optionGroups.splice(subindex, 1);
    markDirty(); renderEditor();
  }
  if (action === 'move-up' || action === 'move-down') {
    const items = content[list];
    const target = action === 'move-up' ? index - 1 : index + 1;
    if (items?.[index] && items?.[target]) {
      [items[index], items[target]] = [items[target], items[index]];
      markDirty(); renderEditor();
    }
  }
  if (action === 'delete' && content[list]?.[index]) {
    if (list === 'productCategories' && content.products.some((product) => product.categoryId === content[list][index].id)) {
      showToast('Mude primeiro os produtos desta categoria.', true);
      return;
    }
    if (confirm('Eliminar este conteúdo? Esta ação só fica definitiva depois de guardar.')) {
      content[list].splice(index, 1);
      markDirty(); renderEditor();
    }
  }
  if (action === 'export') {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `licor-dona-graca-conteudo-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  if (action === 'import') dom.importFile.click();
  if (action === 'reset-defaults' && confirm('Repor todo o conteúdo inicial? Poderá rever antes de guardar.')) {
    content = clone(defaults);
    markDirty();
    renderEditor();
    showToast('Conteúdo inicial reposto. Falta guardar.');
  }
};

dom.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  dom.loginStatus.textContent = 'A entrar…';
  const { data, error } = await supabase.auth.signInWithPassword({ email: dom.loginEmail.value.trim(), password: dom.loginPassword.value });
  if (error) {
    dom.loginStatus.textContent = 'Email ou palavra-passe incorretos.';
    return;
  }
  try {
    await enterApp(data.user);
    dom.loginStatus.textContent = '';
  } catch (enterError) {
    dom.loginStatus.textContent = enterError.message;
    await supabase.auth.signOut();
  }
});

dom.nav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  activeView = button.dataset.view;
  renderEditor();
});

dom.editor.addEventListener('input', (event) => {
  const input = event.target;
  if (input.dataset.path) {
    const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
    setPath(content, input.dataset.path, value);
    markDirty();
  }
  if (input.dataset.linesPath) {
    setPath(content, input.dataset.linesPath, input.value.split('\n').map((line) => line.trim()).filter(Boolean));
    markDirty();
  }
});

dom.editor.addEventListener('change', (event) => {
  if (event.target.matches('[data-upload-path]')) uploadImage(event.target);
});

dom.editor.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button) handleAction(button);
});

dom.saveButton.addEventListener('click', saveContent);
dom.logoutButton.addEventListener('click', async () => {
  if (dirty && !confirm('Existem alterações por guardar. Pretende mesmo sair?')) return;
  await supabase.auth.signOut();
  location.reload();
});

dom.importFile.addEventListener('change', async () => {
  const file = dom.importFile.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported || typeof imported !== 'object' || !Array.isArray(imported.products)) throw new Error();
    content = imported;
    markDirty();
    renderEditor();
    showToast('Cópia importada. Reveja e guarde as alterações.');
  } catch {
    showToast('O ficheiro selecionado não é uma cópia válida.', true);
  } finally {
    dom.importFile.value = '';
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

try {
  await loadDefaults();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    try {
      await enterApp(data.session.user);
    } catch (error) {
      dom.loginStatus.textContent = error.message;
      await supabase.auth.signOut();
    }
  }
} catch (error) {
  dom.loginStatus.textContent = error.message;
}
