'use strict';

const ScheduleService = require('../services/ScheduleService');

/**
 * SchedulesController
 * Provides CRUD for report schedules, listing delivery logs, and trigger testing.
 */
class SchedulesController {
  /**
   * PUBLIC_INTERFACE
   * Create a new report schedule.
   */
  async create(req, res) {
    try {
      const schedule = await ScheduleService.createSchedule({
        companyId: req.companyId,
        userId: req.user.userId,
        payload: req.body,
      });
      res.status(201).json({ status: 'success', data: schedule });
    } catch (e) {
      console.error('Create schedule error:', e);
      res.status(500).json({ status: 'error', message: 'Failed to create schedule' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Update an existing schedule.
   */
  async update(req, res) {
    try {
      const updated = await ScheduleService.updateSchedule({
        companyId: req.companyId,
        scheduleId: req.params.id,
        payload: req.body,
      });
      res.json({ status: 'success', data: updated });
    } catch (e) {
      console.error('Update schedule error:', e);
      res.status(500).json({ status: 'error', message: 'Failed to update schedule' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Delete a schedule.
   */
  async remove(req, res) {
    try {
      await ScheduleService.deleteSchedule({ companyId: req.companyId, scheduleId: req.params.id });
      res.json({ status: 'success', message: 'Deleted' });
    } catch (e) {
      console.error('Delete schedule error:', e);
      res.status(500).json({ status: 'error', message: 'Failed to delete schedule' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Get a schedule by id.
   */
  async get(req, res) {
    try {
      const s = await ScheduleService.getSchedule({ companyId: req.companyId, scheduleId: req.params.id });
      if (!s) return res.status(404).json({ status: 'error', message: 'Not found' });
      res.json({ status: 'success', data: s });
    } catch (e) {
      console.error('Get schedule error:', e);
      res.status(500).json({ status: 'error', message: 'Failed to get schedule' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * List schedules
   */
  async list(req, res) {
    try {
      const { page, limit } = req.query;
      const rows = await ScheduleService.listSchedules({
        companyId: req.companyId, page: Number(page) || 1, limit: Number(limit) || 50
      });
      res.json({ status: 'success', data: rows });
    } catch (e) {
      console.error('List schedules error:', e);
      res.status(500).json({ status: 'error', message: 'Failed to list schedules' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * List logs
   */
  async logs(req, res) {
    try {
      const { page, limit } = req.query;
      const rows = await ScheduleService.listLogs({
        companyId: req.companyId, scheduleId: req.params.id, page: Number(page) || 1, limit: Number(limit) || 50
      });
      res.json({ status: 'success', data: rows });
    } catch (e) {
      console.error('List logs error:', e);
      res.status(500).json({ status: 'error', message: 'Failed to list logs' });
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Manually trigger a schedule run (for testing).
   */
  async trigger(req, res) {
    try {
      const { id } = req.params;
      const s = await ScheduleService.getSchedule({ companyId: req.companyId, scheduleId: id });
      if (!s) return res.status(404).json({ status: 'error', message: 'Schedule not found' });
      await ScheduleService.runSchedule({ scheduleId: id, triggerUserId: req.user.userId });
      res.json({ status: 'success', message: 'Triggered' });
    } catch (e) {
      console.error('Trigger schedule error:', e);
      res.status(500).json({ status: 'error', message: 'Failed to trigger schedule' });
    }
  }
}

module.exports = new SchedulesController();
