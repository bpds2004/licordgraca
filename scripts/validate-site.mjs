import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const content = JSON.parse(await read('content/default-content.json'));
const vercel = JSON.parse(await read('vercel.json'));
const publicHtml = await read('indexlicor.html');
const adminHtml = await read('backoffice/index.html');
const adminCss = await read('backoffice/styles.css');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(content.version === 1, 'Versão de conteúdo inválida.');
assert(Array.isArray(content.products) && content.products.length > 0, 'Não existem produtos iniciais.');
assert(Array.isArray(content.kits) && content.kits.length > 0, 'Não existem kits iniciais.');
assert(publicHtml.includes('/site-content.js'), 'O site público não carrega o gestor de conteúdo.');
assert(adminHtml.includes('/backoffice/app.js'), 'O backoffice não carrega a aplicação.');
assert(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/i.test(adminCss), 'Os ecrãs ocultos do backoffice podem ficar visíveis.');
assert(vercel.rewrites.some((rule) => rule.source === '/backoffice'), 'Falta a rota do backoffice.');

const categoryIds = new Set(content.productCategories.map((category) => category.id));
const productIds = new Set();
for (const product of content.products) {
  assert(product.id && !productIds.has(product.id), `ID de produto repetido: ${product.id}`);
  productIds.add(product.id);
  assert(categoryIds.has(product.categoryId), `Categoria inexistente no produto ${product.name}.`);
  assert(Array.isArray(product.sizes) && product.sizes.length > 0, `O produto ${product.name} não tem tamanhos.`);
}

const localImages = [
  content.meta.logo,
  content.meta.favicon,
  content.about.image,
  ...content.products.map((product) => product.image),
  ...content.kits.map((kit) => kit.image)
].filter((path) => typeof path === 'string' && path.startsWith('/'));

for (const image of localImages) await access(resolve(root, image.slice(1)));

console.log(`Validação concluída: ${content.products.length} produtos, ${content.kits.length} kits, ${content.events.length} eventos.`);
