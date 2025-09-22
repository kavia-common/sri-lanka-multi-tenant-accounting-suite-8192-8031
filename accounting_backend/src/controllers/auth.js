const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/password');

class AuthController {
  /**
   * User login endpoint
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const userQuery = 'SELECT id, email, password_hash, first_name, last_name, is_active FROM users WHERE email = $1';
      const userResult = await db.query(userQuery, [email]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const user = userResult.rows[0];

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          status: 'error',
          message: 'Account is disabled',
          code: 'ACCOUNT_DISABLED'
        });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      });

      // Get user's companies
      const companiesQuery = `
        SELECT c.id, c.name, c.code, uc.role, uc.permissions
        FROM companies c
        INNER JOIN user_companies uc ON c.id = uc.company_id
        WHERE uc.user_id = $1 AND c.is_active = true
        ORDER BY c.name
      `;
      const companiesResult = await db.query(companiesQuery, [user.id]);

      res.json({
        status: 'success',
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name
          },
          companies: companiesResult.rows
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }

  /**
   * User registration endpoint
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async register(req, res) {
    try {
      const { email, password, first_name, last_name } = req.body;

      // Check if user already exists
      const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
      const existingUserResult = await db.query(existingUserQuery, [email]);

      if (existingUserResult.rows.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'User already exists with this email',
          code: 'USER_EXISTS'
        });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const createUserQuery = `
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, created_at)
        VALUES ($1, $2, $3, $4, true, NOW())
        RETURNING id, email, first_name, last_name, created_at
      `;
      const createUserResult = await db.query(createUserQuery, [
        email,
        passwordHash,
        first_name,
        last_name
      ]);

      const newUser = createUserResult.rows[0];

      // Generate JWT token
      const token = generateToken({
        userId: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name
      });

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: {
          token,
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            createdAt: newUser.created_at
          },
          companies: [] // New user has no companies initially
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  // PUBLIC_INTERFACE
  async getProfile(req, res) {
    try {
      const userQuery = `
        SELECT id, email, first_name, last_name, created_at, updated_at
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      const userResult = await db.query(userQuery, [req.user.userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const user = userResult.rows[0];

      res.json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get user profile',
        code: 'PROFILE_ERROR'
      });
    }
  }
}

module.exports = new AuthController();
