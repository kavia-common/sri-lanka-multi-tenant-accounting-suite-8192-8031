const healthService = require('../services/health');

class HealthController {
  async check(req, res) {
    const healthStatus = await healthService.getStatus();
    return res.status(200).json(healthStatus);
  }
}

module.exports = new HealthController();
