const nodemailer = require('nodemailer');

const requiredFields = [
  'customer_name',
  'customer_contact',
  'customer_email',
  'customer_address',
  'payment_method',
  'order_items',
  'order_subtotal',
  'order_shipping',
  'order_total'
];

const allowedOrigins = [
  'https://licordgraca.pt',
  'https://www.licordgraca.pt'
];

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const ensureEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

const parseRequestBody = (req) => {
  if (!req.body) {
    return null;
  }
  if (typeof req.body === 'object') {
    return req.body;
  }
  try {
    return JSON.parse(req.body);
  } catch (error) {
    return null;
  }
};

const createTransporter = () => {
  const host = ensureEnv('SMTP_HOST');
  const port = Number(ensureEnv('SMTP_PORT'));
  const user = ensureEnv('SMTP_USER');
  const pass = ensureEnv('SMTP_PASS');
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
};

const buildEmailContent = (payload) => {
  const field = (name) => escapeHtml(payload[name]);
  const lines = [
    `Nome: ${payload.customer_name}`,
    `Telefone: ${payload.customer_contact}`,
    `Email: ${payload.customer_email}`,
    `Morada: ${payload.customer_address}`,
    `NIF: ${payload.customer_nif || 'Não indicado'}`,
    `Método de pagamento: ${payload.payment_method}`,
    `Produtos:\n${payload.order_items}`,
    `Subtotal: ${payload.order_subtotal}`,
    `Portes: ${payload.order_shipping}`,
    `Total: ${payload.order_total}`
  ];

  return {
    text: lines.join('\n'),
    html: `
      <p><strong>Nome:</strong> ${field('customer_name')}</p>
      <p><strong>Telefone:</strong> ${field('customer_contact')}</p>
      <p><strong>Email:</strong> ${field('customer_email')}</p>
      <p><strong>Morada:</strong> ${field('customer_address')}</p>
      <p><strong>NIF:</strong> ${field('customer_nif') || 'Não indicado'}</p>
      <p><strong>Método de pagamento:</strong> ${field('payment_method')}</p>
      <p><strong>Produtos:</strong><br>${field('order_items').replace(/\n/g, '<br>')}</p>
      <p><strong>Subtotal:</strong> ${field('order_subtotal')}</p>
      <p><strong>Portes:</strong> ${field('order_shipping')}</p>
      <p><strong>Total:</strong> ${field('order_total')}</p>
    `
  };
};

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  let payload;
  try {
    payload = parseRequestBody(req);
  } catch (error) {
    payload = null;
  }

  if (!payload) {
    res.status(400).json({ error: 'Invalid payload.' });
    return;
  }

  const missing = requiredFields.filter((field) => !payload[field]);
  if (missing.length) {
    res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    return;
  }

  let transporter;
  try {
    transporter = createTransporter();
  } catch (error) {
    res.status(500).json({ error: 'Email configuration missing.' });
    return;
  }

  const to = process.env.ORDER_TO || process.env.SMTP_USER;
  const from = process.env.ORDER_FROM || process.env.SMTP_USER;
  const { text, html } = buildEmailContent(payload);

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo: payload.customer_email,
      subject: 'Nova encomenda - Licor Dona Graça',
      text,
      html: `<h2>Nova encomenda</h2>${html}`
    });
  } catch (error) {
    console.error('EMAIL ERROR:', error);
    res.status(500).json({ error: error.message });
    return;
  }

  // A encomenda já chegou à loja; uma falha na cópia ao cliente não deve anulá-la.
  try {
    await transporter.sendMail({
      from,
      to: payload.customer_email,
      replyTo: to,
      subject: 'Recebemos a sua encomenda - Licor Dona Graça',
      text: `Obrigado pela sua encomenda! Receberá entre 1 a 2 dias úteis informações para realizar o pagamento.\n\n${text}`,
      html: `<h2>Obrigado pela sua encomenda!</h2><p>Receberá entre 1 a 2 dias úteis informações para realizar o pagamento.</p>${html}`
    });
  } catch (error) {
    console.error('CUSTOMER EMAIL ERROR:', error);
  }

  res.status(200).json({ ok: true });
};
