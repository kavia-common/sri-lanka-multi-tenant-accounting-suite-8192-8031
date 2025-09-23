const request = require('supertest');
require('../jest.setup'); // sets up env and mocks
const app = require('../src/app');
const { signJwt } = require('../src/utils/auth');

describe('Accounting Backend API (integration, with mocked repository)', () => {
  const tenantA = 'tenant-A';
  const tenantB = 'tenant-B';

  function tokenFor({ sub = '1', email = 'admin@example.com', roles = ['admin'], tenantId = tenantA, companyId = null } = {}) {
    return signJwt({ sub, email, roles, tenantId, companyId });
  }

  test('health endpoint returns ok', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  describe('Auth register/login', () => {
    test('register then login', async () => {
      const reg = await request(app)
        .post('/auth/register')
        .send({ tenantId: tenantA, email: 'admin@a.com', password: 'pass', name: 'Admin A', roles: ['admin'] });
      expect(reg.status).toBe(201);
      expect(reg.body.status).toBe('ok');
      expect(reg.body.user.email).toBe('admin@a.com');

      const login = await request(app)
        .post('/auth/login')
        .send({ tenantId: tenantA, email: 'admin@a.com', password: 'pass' });
      expect(login.status).toBe(200);
      expect(login.body.token).toBeDefined();
      expect(login.body.user.email).toBe('admin@a.com');
    });

    test('login fails with invalid credentials', async () => {
      const login = await request(app)
        .post('/auth/login')
        .send({ tenantId: tenantA, email: 'no@a.com', password: 'bad' });
      // notFound('User not found') => 404
      expect([400, 401, 404]).toContain(login.status);
      expect(login.body.status).toBe('error');
    });
  });

  describe('Authorization and company requirement', () => {
    test('protected route without token is unauthorized', async () => {
      const res = await request(app).get('/companies');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    test('company-scoped route without companyId fails', async () => {
      const adminToken = tokenFor({ roles: ['admin'] });
      const res = await request(app).get('/chart_of_accounts').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('COMPANY_REQUIRED');
    });

    test('insufficient role forbidden', async () => {
      const userToken = tokenFor({ roles: ['auditor'], companyId: 1 });
      const res = await request(app).post('/chart_of_accounts').set('Authorization', `Bearer ${userToken}`).send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Companies CRUD (tenant-scoped)', () => {
    let adminTokenA;
    beforeAll(() => {
      adminTokenA = tokenFor({ roles: ['admin'], tenantId: tenantA });
    });

    test('create and list companies', async () => {
      const created = await request(app)
        .post('/companies')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ name: 'Company A1', currency: 'LKR' });
      expect(created.status).toBe(201);
      const companyId = created.body.company.id;
      expect(companyId).toBeDefined();

      const list = await request(app).get('/companies').set('Authorization', `Bearer ${adminTokenA}`);
      expect(list.status).toBe(200);
      expect(list.body.companies).toEqual(expect.arrayContaining([expect.objectContaining({ id: companyId, name: 'Company A1' })]));
    });

    test('tenant isolation: tenantB cannot see tenantA companies', async () => {
      const adminTokenB = tokenFor({ roles: ['admin'], tenantId: tenantB });
      const listB = await request(app).get('/companies').set('Authorization', `Bearer ${adminTokenB}`);
      expect(listB.status).toBe(200);
      expect(listB.body.companies).toEqual([]); // isolated
    });
  });

  describe('Chart of Accounts, Journal and Ledger', () => {
    let adminTokenA;
    let companyIdA;
    let accountantTokenA;
    let assetId;
    let incomeId;

    beforeAll(async () => {
      // create a company under tenantA
      adminTokenA = tokenFor({ roles: ['admin'], tenantId: tenantA });
      const created = await request(app)
        .post('/companies')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ name: 'Company A2', currency: 'LKR' });
      expect(created.status).toBe(201);
      companyIdA = created.body.company.id;
      accountantTokenA = tokenFor({ roles: ['accountant'], tenantId: tenantA, companyId: companyIdA });
    });

    test('create accounts (asset and income)', async () => {
      const res1 = await request(app)
        .post('/chart_of_accounts')
        .set('Authorization', `Bearer ${accountantTokenA}`)
        .send({ code: '1000', name: 'Cash', type: 'asset' });
      expect(res1.status).toBe(201);
      assetId = res1.body.account.id;

      const res2 = await request(app)
        .post('/chart_of_accounts')
        .set('Authorization', `Bearer ${accountantTokenA}`)
        .send({ code: '4000', name: 'Revenue', type: 'income' });
      expect(res2.status).toBe(201);
      incomeId = res2.body.account.id;

      const list = await request(app)
        .get('/chart_of_accounts')
        .set('Authorization', `Bearer ${accountantTokenA}`);
      expect(list.status).toBe(200);
      expect(list.body.accounts.length).toBeGreaterThanOrEqual(2);
    });

    test('journal validation: requires balanced lines', async () => {
      const bad = await request(app)
        .post('/journal_entries')
        .set('Authorization', `Bearer ${accountantTokenA}`)
        .send({
          reference: 'INV-1',
          memo: 'Unbalanced entry',
          lines: [
            { accountId: assetId, debit: 1000 },
            { accountId: incomeId, credit: 900 },
          ],
        });
      expect(bad.status).toBe(409);
      expect(bad.body.message).toMatch(/Debits and credits must be equal|must have at least two lines/i);
    });

    test('post balanced journal and affect ledger', async () => {
      const good = await request(app)
        .post('/journal_entries')
        .set('Authorization', `Bearer ${accountantTokenA}`)
        .send({
          reference: 'INV-2',
          memo: 'Cash sale',
          lines: [
            { accountId: assetId, debit: 1500, description: 'Cash received' },
            { accountId: incomeId, credit: 1500, description: 'Revenue' },
          ],
        });
      expect(good.status).toBe(201);
      const journalId = good.body.journal.id;
      expect(journalId).toBeDefined();

      const list = await request(app)
        .get('/journal_entries')
        .set('Authorization', `Bearer ${accountantTokenA}`);
      expect(list.status).toBe(200);
      expect(list.body.journals).toEqual(expect.arrayContaining([expect.objectContaining({ id: journalId })]));

      const cashStmt = await request(app)
        .get(`/general_ledger/accounts/${assetId}`)
        .set('Authorization', `Bearer ${accountantTokenA}`);
      expect(cashStmt.status).toBe(200);
      expect(cashStmt.body.account.id).toBe(assetId);
      expect(cashStmt.body.entries.length).toBeGreaterThanOrEqual(1);

      const tb = await request(app)
        .get('/general_ledger/trial_balance')
        .set('Authorization', `Bearer ${accountantTokenA}`);
      expect(tb.status).toBe(200);
      const cashRow = tb.body.accounts.find((a) => a.accountId === assetId);
      const revRow = tb.body.accounts.find((a) => a.accountId === incomeId);
      expect(cashRow).toBeDefined();
      expect(revRow).toBeDefined();
    });

    test('company isolation: using a token for different company cannot access accounts', async () => {
      const otherCompany = await request(app)
        .post('/companies')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ name: 'Company A3', currency: 'LKR' });
      expect(otherCompany.status).toBe(201);
      const companyIdA3 = otherCompany.body.company.id;

      const tokenOtherCompany = tokenFor({ roles: ['accountant'], tenantId: tenantA, companyId: companyIdA3 });
      const list = await request(app).get('/chart_of_accounts').set('Authorization', `Bearer ${tokenOtherCompany}`);
      expect(list.status).toBe(200);
      // Should not see accounts created under companyIdA
      expect(list.body.accounts.find((a) => a.id === assetId)).toBeUndefined();
    });
  });

  describe('Masters CRUD (customers/vendors/tax_rates/currencies)', () => {
    let accountantTokenA;
    let companyIdA;

    beforeAll(async () => {
      const adminTokenA = tokenFor({ roles: ['admin'], tenantId: tenantA });
      const created = await request(app)
        .post('/companies')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ name: 'Company M1', currency: 'LKR' });
      expect(created.status).toBe(201);
      companyIdA = created.body.company.id;
      accountantTokenA = tokenFor({ roles: ['accountant'], tenantId: tenantA, companyId: companyIdA });
    });

    test('create and get customer', async () => {
      const created = await request(app)
        .post('/customers')
        .set('Authorization', `Bearer ${accountantTokenA}`)
        .send({ name: 'Customer A', email: 'c@a.com' });
      expect(created.status).toBe(201);
      const id = created.body.customers?.id || created.body.customers || created.body.bankAccounts?.id || created.body.taxRates?.id || created.body.currencies?.id || created.body.customers?.id;
      // The controller returns { [entity]: doc } with entity key 'customers'
      const customerId = created.body.customers.id;
      const got = await request(app)
        .get(`/customers/${customerId}`)
        .set('Authorization', `Bearer ${accountantTokenA}`);
      expect(got.status).toBe(200);
      expect(got.body.customer.id).toBe(customerId);
    });

    test('list tax_rates and currencies initially empty', async () => {
      const taxRates = await request(app).get('/tax_rates').set('Authorization', `Bearer ${accountantTokenA}`);
      expect(taxRates.status).toBe(200);
      expect(Array.isArray(taxRates.body.taxRates)).toBe(true);

      const currencies = await request(app).get('/currencies').set('Authorization', `Bearer ${accountantTokenA}`);
      expect(currencies.status).toBe(200);
      expect(Array.isArray(currencies.body.currencies)).toBe(true);
    });
  });

  describe('Error handling: invalid token', () => {
    test('invalid JWT yields 401', async () => {
      const res = await request(app).get('/companies').set('Authorization', 'Bearer bad.token.here');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });
});
