const { getPlayerHistory } = require('../services/historyService');

// GET /api/players/:id/history?count=20
const getHistory = async (req, res) => {
  try {
    const count   = Math.min(Number(req.query.count) || 20, 50);
    const history = await getPlayerHistory(req.params.id, count);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getHistory };
