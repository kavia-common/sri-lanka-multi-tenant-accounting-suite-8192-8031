const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const { initSchema } = require('./repositories/bootstrap');

// Initialize express app
const app = express();

// Initialize DB schema on boot (idempotent)
initSchema().catch((e) => {
  console.error('Database schema initialization failed:', e.message);
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.set('trust proxy', true);
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');
  let protocol = req.protocol;

  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');

  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
      (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
      },
    ],
  };

  // Ocean Professional theme colors
  const primary = '#2563EB';
  const secondary = '#F59E0B';
  const background = '#f9fafb';
  const surface = '#ffffff';
  const text = '#111827';
  const error = '#EF4444';

  const customCss = `
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --surface: ${surface};
      --background: ${background};
      --text: ${text};
      --error: ${error};
    }
    body.swagger-ui {
      background: var(--background);
      color: var(--text);
    }
    .swagger-ui .topbar {
      background: linear-gradient(90deg, rgba(37,99,235,0.08), rgba(249,250,251,1));
      border-bottom: 1px solid rgba(0,0,0,0.06);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .swagger-ui .topbar a {
      color: var(--primary);
      font-weight: 600;
    }
    .swagger-ui .opblock {
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.06);
      background: var(--surface);
    }
    .swagger-ui .btn {
      border-radius: 8px;
    }
    .swagger-ui .btn.execute {
      background: var(--primary) !important;
      border-color: var(--primary) !important;
    }
    .swagger-ui .btn.authorize {
      background: var(--secondary) !important;
      border-color: var(--secondary) !important;
      color: #1f2937 !important;
      font-weight: 600;
    }
    .swagger-ui .model-title, .swagger-ui .opblock-summary-path, .swagger-ui .opblock-summary-description {
      color: var(--text);
    }
    .swagger-ui .info .title {
      color: var(--text);
    }
    .swagger-ui .errors-wrapper {
      color: var(--error);
    }
  `;

  const customSiteTitle = 'Sri Lanka Accounting API — Ocean Professional';
  const swaggerOptions = {
    customSiteTitle,
    customCss,
    customfavIcon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22 fill=%22%232563EB%22/></svg>',
  };

  swaggerUi.setup(dynamicSpec, swaggerOptions)(req, res, next);
});

// Parse JSON request body
app.use(express.json());

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal Server Error';
  console.error('Error:', code, message, err.details || err.stack);
  res.status(status).json({
    status: 'error',
    code,
    message,
  });
});

module.exports = app;
