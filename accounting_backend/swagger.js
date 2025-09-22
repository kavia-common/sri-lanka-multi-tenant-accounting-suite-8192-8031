const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: process.env.SWAGGER_TITLE || 'Multi-Tenant Accounting API',
      version: process.env.SWAGGER_VERSION || '1.0.0',
      description: process.env.SWAGGER_DESCRIPTION || 'A comprehensive REST API for multi-tenant accounting software with double-entry bookkeeping, company management, and financial reporting.',
      contact: {
        name: 'API Support',
        email: 'support@accounting-api.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme. Example: "Authorization: Bearer {token}"'
        }
      },
      parameters: {
        CompanyId: {
          name: 'x-company-id',
          in: 'header',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Company ID for multi-tenant context'
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Companies',
        description: 'Multi-tenant company management'
      },
      {
        name: 'Accounts',
        description: 'Chart of accounts management'
      },
      {
        name: 'Transactions',
        description: 'Double-entry bookkeeping transactions'
      },
      {
        name: 'Reports',
        description: 'Financial reporting and analytics'
      },
      {
        name: 'Custom Reports',
        description: 'Create, manage, and execute custom financial report templates'
      }
    ]
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
