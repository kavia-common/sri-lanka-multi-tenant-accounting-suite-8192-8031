'use strict';

const cron = require('node-cron');
const db = require('./config/database');
const ScheduleService = require('./services/ScheduleService');

/**
 * Initialize background scheduler:
 * - Every minute, find due active schedules and run them sequentially.
 */
function initScheduler() {
  // run at every minute
  cron.schedule('* * * * *', async () => {
    try {
      const { rows } = await db.query(
        `SELECT id FROM report_schedules
         WHERE is_active = true
           AND next_run_at IS NOT NULL
           AND next_run_at <= now()
         ORDER BY next_run_at ASC
         LIMIT 10`
      );

      for (const r of rows) {
        try {
          await ScheduleService.runSchedule({ scheduleId: r.id, triggerUserId: null });
        } catch (err) {
          console.error('Schedule run failed for', r.id, err);
        }
      }
    } catch (e) {
      console.error('Scheduler query error:', e);
    }
  }, {
    timezone: process.env.SCHEDULER_TZ || 'UTC'
  });

  console.log('Email scheduler initialized: running every minute.');
}

module.exports = { initScheduler };
