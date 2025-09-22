# Multi-Tenant Accounting Backend API

A comprehensive Node.js/Express REST API for multi-tenant accounting software with double-entry bookkeeping, JWT authentication, and PostgreSQL integration.

## 🚀 Features

### Core Features
- **Multi-Tenancy**: Complete data isolation by company with user-company access control
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Double-Entry Bookkeeping**: Full implementation of double-entry accounting principles
- **Chart of Accounts**: Hierarchical account management per company
- **Financial Reporting**: Trial balance, balance sheet, and profit & loss reports
- **Input Validation**: Comprehensive validation using express-validator
- **Rate Limiting**: Protection against brute force and DoS attacks
- **Security**: Helmet.js security headers and CORS configuration

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User login with JWT token generation
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get authenticated user profile

#### Company Management
- `GET /api/companies` - List user's companies
- `POST /api/companies` - Create new company
- `GET /api/companies/:id` - Get company details

#### Chart of Accounts
- `GET /api/accounts` - Get chart of accounts (company context required)
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:id` - Get account details
- `PUT /api/accounts/:id` - Update account

#### Transactions
- `GET /api/transactions` - List transactions with pagination
- `POST /api/transactions` - Create new transaction with journal entries
- `GET /api/transactions/:id` - Get transaction details

#### Financial Reports
- `GET /api/reports/trial-balance` - Generate trial balance report
- `GET /api/reports/balance-sheet` - Generate balance sheet report
- `GET /api/reports/profit-loss` - Generate profit & loss report

## 🛠 Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.21.2
- **Database**: PostgreSQL with pg driver and connection pooling
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Validation**: express-validator
- **Security**: helmet, express-rate-limit
- **Documentation**: Swagger/OpenAPI 3.0
- **Development**: nodemon, eslint

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ database
- Environment variables configured (see .env.example)

## 🚀 Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your database and JWT configurations
   ```

3. **Database Setup**
   - Create PostgreSQL database
   - Run the schema initialization script:
   ```bash
   psql -d your_database -f init_database.sql
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Access API Documentation**
   - API Docs: http://localhost:3001/docs
   - OpenAPI JSON: http://localhost:3001/openapi.json

## 🗄 Database Schema

The application uses a PostgreSQL database with the following key tables:

- **users** - User accounts and authentication
- **companies** - Multi-tenant company data
- **user_companies** - User-company access relationships
- **accounts** - Chart of accounts (hierarchical)
- **transactions** - Transaction headers
- **journal_entries** - Double-entry journal entries

See `database_schema.md` for detailed schema documentation and `init_database.sql` for the complete setup script.

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: Configurable rate limits per endpoint
- **Input Validation**: Comprehensive request validation
- **CORS**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js security middleware
- **Multi-Tenant Isolation**: Company-based data separation

## 🏢 Multi-Tenancy

The API implements complete multi-tenancy with:

- **Company Context**: All data operations scoped to company
- **User-Company Access**: Fine-grained access control
- **Data Isolation**: Row-level security and company_id filtering
- **Company Switching**: Switch context via `x-company-id` header

### Using Company Context

Include the company ID in request headers:
```bash
curl -H "Authorization: Bearer your-jwt-token" \
     -H "x-company-id: company-uuid" \
     http://localhost:3001/api/accounts
```

## 📊 Double-Entry Bookkeeping

The API enforces double-entry bookkeeping principles:

- **Balanced Transactions**: Debits must equal credits
- **Journal Entries**: Each transaction has multiple entries
- **Account Types**: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- **Balance Calculation**: Real-time account balance updates

### Creating a Transaction

```json
{
  "date": "2024-01-15",
  "description": "Office supplies purchase",
  "reference": "INV-001",
  "entries": [
    {
      "account_id": "expense-account-uuid",
      "debit_amount": 150.00,
      "description": "Office supplies"
    },
    {
      "account_id": "cash-account-uuid",
      "credit_amount": 150.00,
      "description": "Cash payment"
    }
  ]
}
```

## 📈 Financial Reporting

### Trial Balance
Shows all accounts with their debit/credit totals and balances.

### Balance Sheet
Assets, Liabilities, and Equity as of a specific date.

### Profit & Loss
Revenue and expenses for a date range with net income calculation.

### Report Email Scheduling
- Create and manage schedules to email reports periodically (daily/weekly/monthly/custom).
- Endpoints:
  - GET /api/schedules
  - POST /api/schedules
  - GET /api/schedules/:id
  - PUT /api/schedules/:id
  - DELETE /api/schedules/:id
  - GET /api/schedules/:id/logs
  - POST /api/schedules/:id/trigger
- Requires SMTP environment variables (see .env.example). A background scheduler runs every minute to deliver due reports.

## 🔧 Configuration

### Environment Variables

```bash
# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@host:port/database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=accounting_db
DB_USER=accounting_user
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=*
```

## 🧪 API Testing

### Using curl

```bash
# Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","first_name":"John","last_name":"Doe"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Create company (with JWT token)
curl -X POST http://localhost:3001/api/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name":"My Company","code":"MYCO","email":"info@myco.com"}'
```

## 📝 Development

### Scripts

- `npm run dev` - Start development server with nodemon
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests (to be implemented)
- `npm run generate-openapi` - Generate OpenAPI specification

### Code Structure

```
src/
├── app.js              # Express app configuration
├── server.js           # Server startup
├── config/
│   └── database.js     # Database connection
├── controllers/        # Route handlers
├── middleware/         # Custom middleware
├── routes/            # Route definitions
├── utils/             # Utility functions
└── validators/        # Input validation rules
```

## 🐛 Error Handling

The API provides consistent error responses:

```json
{
  "status": "error",
  "message": "Descriptive error message",
  "code": "ERROR_CODE",
  "errors": [] // For validation errors
}
```

## 📖 API Documentation

Complete API documentation is available at `/docs` when the server is running. The documentation includes:

- Interactive API explorer
- Request/response schemas
- Authentication examples
- Error code references

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add comprehensive input validation for new endpoints
3. Include Swagger documentation for new routes
4. Ensure proper error handling and logging
5. Test multi-tenant data isolation

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the API documentation at `/docs`
- Review the database schema in `database_schema.md`
- Examine the initialization script `init_database.sql`

---

**Note**: This API requires a PostgreSQL database to be fully functional. Database connection errors are expected until the database is properly configured with the required schema.
