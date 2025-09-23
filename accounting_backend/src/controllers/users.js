'use strict';

const userService = require('../services/users');

class UsersController {
  async create(req, res) {
    try {
      const user = await userService.create(req.user.tenantId, req.user.userId, req.body);
      return res.status(201).json({ status: 'ok', user });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'USER_CREATE_ERROR', message: e.message });
    }
  }

  async list(req, res) {
    try {
      const users = await userService.list(req.user.tenantId);
      return res.status(200).json({ status: 'ok', users });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'USER_LIST_ERROR', message: e.message });
    }
  }

  async get(req, res) {
    try {
      const user = await userService.get(req.user.tenantId, req.params.id);
      return res.status(200).json({ status: 'ok', user });
    } catch (e) {
      return res.status(e.status || 404).json({ status: 'error', code: e.code || 'USER_GET_ERROR', message: e.message });
    }
  }

  async update(req, res) {
    try {
      const user = await userService.update(req.user.tenantId, req.user.userId, req.params.id, req.body);
      return res.status(200).json({ status: 'ok', user });
    } catch (e) {
      return res.status(e.status || 400).json({ status: 'error', code: e.code || 'USER_UPDATE_ERROR', message: e.message });
    }
  }

  async remove(req, res) {
    try {
      const result = await userService.remove(req.user.tenantId, req.user.userId, req.params.id);
      return res.status(200).json({ status: 'ok', ...result });
    } catch (e) {
      return res.status(e.status || 404).json({ status: 'error', code: e.code || 'USER_DELETE_ERROR', message: e.message });
    }
  }
}

module.exports = new UsersController();
