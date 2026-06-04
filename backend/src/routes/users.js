const router = require('express').Router();
const User = require('../models/User');
const adminAuth = require('../middleware/adminAuth');

// All routes require admin auth
router.use(adminAuth);

// GET /api/users — list all registered users with optional filters
router.get('/', async (req, res) => {
  try {
    const { search, gender, sport, isBlocked, page = 1, limit = 20 } = req.query;
    const filter = { isRegistered: true };

    if (gender) filter.gender = gender;
    if (sport) filter.sport = new RegExp(sport, 'i');
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ username: re }, { firstName: re }, { lastName: re }];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/stats
router.get('/stats', async (req, res) => {
  try {
    const total = await User.countDocuments({ isRegistered: true });
    const blocked = await User.countDocuments({ isRegistered: true, isBlocked: true });
    const males = await User.countDocuments({ isRegistered: true, gender: 'male' });
    const females = await User.countDocuments({ isRegistered: true, gender: 'female' });

    const sportStats = await User.aggregate([
      { $match: { isRegistered: true } },
      { $group: { _id: '$sport', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({ total, blocked, males, females, sportStats });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/users/:id — edit user data
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['age', 'gender', 'sport', 'height', 'weight', 'isBlocked'];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
