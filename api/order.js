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
      <h2>Nova encomenda</h2>
      <p><strong>Nome:</strong> ${payload.customer_name}</p>
      <p><strong>Telefone:</strong> ${payload.customer_contact}</p>
      <p><strong>Email:</strong> ${payload.customer_email}</p>
      <p><strong>Morada:</strong> ${payload.customer_address}</p>
      <p><strong>NIF:</strong> ${payload.customer_nif || 'Não indicado'}</p>
      <p><strong>Método de pagamento:</strong> ${payload.payment_method}</p>
      <p><strong>Produtos:</strong><br>${payload.order_items.replace(/\n/g, '<br>')}</p>
      <p><strong>Subtotal:</strong> ${payload.order_subtotal}</p>
      <p><strong>Portes:</strong> ${payload.order_shipping}</p>
      <p><strong>Total:</strong> ${payload.order_total}</p>
    `
  };
};

module.exports = async (req, res) => {
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
      subject: 'Nova encomenda - Licor Dona Graça',
      text,
      html
    });

    res.status(200).json({ ok: true });
  }  catch (error) {
  console.error("EMAIL ERROR:", error);
  res.status(500).json({ error: error.message });
  }

};
