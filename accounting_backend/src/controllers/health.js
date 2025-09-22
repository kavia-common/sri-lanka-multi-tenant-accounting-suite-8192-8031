const healthService = require('../services/health');

/**
 * Health controller for simple health checks.
 */
// PUBLIC_INTERFACE
class HealthController {
  check(req, res) {
    const healthStatus = healthService.getStatus();
    return res.status(200).json(healthStatus);
  }
}

module.exports = new HealthController();
