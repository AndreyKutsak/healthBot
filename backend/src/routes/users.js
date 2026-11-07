const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Violation = require('../models/Violation');
const FoodHistory = require('../models/FoodHistory');
const ExerciseHistory = require('../models/ExerciseHistory');
const TrainingPlan = require('../models/TrainingPlan');
const adminAuth = require('../middleware/adminAuth');
const { EATEN } = require('../utils/nutrition');

// All routes require admin auth
router.use(adminAuth);

// GET /api/users — list all registered users with optional filters
router.get('/', async (req, res) => {
  try {
    const { search, gender, isBlocked, page = 1, limit = 20 } = req.query;
    const filter = { isRegistered: true };

    if (gender) filter.gender = gender;
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

    const goalStats = await User.aggregate([
      { $match: { isRegistered: true } },
      { $group: { _id: '$goal', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const gymStats = await User.aggregate([
      { $match: { isRegistered: true } },
      { $group: { _id: '$canUseGym', count: { $sum: 1 } } },
    ]);

    res.json({ total, blocked, males, females, goalStats, gymStats });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:id/violations
router.get('/:id/violations', async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, lastWeek, violations] = await Promise.all([
      Violation.countDocuments({ userId: req.params.id }),
      Violation.countDocuments({ userId: req.params.id, date: { $gte: sevenDaysAgo } }),
      Violation.find({ userId: req.params.id }).sort({ date: -1 }).limit(20),
    ]);
    res.json({ total, lastWeek, violations });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:id/calorie-stats
router.get('/:id/calorie-stats', async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.params.id);
    const user = await User.findById(uid).select('dailyCalories dailyProtein dailyFat dailyCarbs');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [fToday, fWeek, fMonth, eToday, eWeek, eMonth] = await Promise.all([
      FoodHistory.aggregate([{ $match: { userId: uid, date: { $gte: todayStart }, ...EATEN } }, { $group: { _id: null, t: { $sum: '$calories' } } }]),
      FoodHistory.aggregate([{ $match: { userId: uid, date: { $gte: weekStart }, ...EATEN } }, { $group: { _id: null, t: { $sum: '$calories' } } }]),
      FoodHistory.aggregate([{ $match: { userId: uid, date: { $gte: monthStart }, ...EATEN } }, { $group: { _id: null, t: { $sum: '$calories' } } }]),
      ExerciseHistory.aggregate([{ $match: { userId: uid, date: { $gte: todayStart } } }, { $group: { _id: null, t: { $sum: '$caloriesBurned' } } }]),
      ExerciseHistory.aggregate([{ $match: { userId: uid, date: { $gte: weekStart } } }, { $group: { _id: null, t: { $sum: '$caloriesBurned' } } }]),
      ExerciseHistory.aggregate([{ $match: { userId: uid, date: { $gte: monthStart } } }, { $group: { _id: null, t: { $sum: '$caloriesBurned' } } }]),
    ]);

    res.json({
      norm: { calories: user.dailyCalories, protein: user.dailyProtein, fat: user.dailyFat, carbs: user.dailyCarbs },
      consumed: { today: fToday[0]?.t || 0, week: fWeek[0]?.t || 0, month: fMonth[0]?.t || 0 },
      burned:   { today: eToday[0]?.t || 0, week: eWeek[0]?.t || 0, month: eMonth[0]?.t || 0 },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id/training-plan
router.get('/:id/training-plan', async (req, res) => {
  try {
    const plan = await TrainingPlan.findOne({ userId: req.params.id, active: true });
    res.json({ plan: plan || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    const allowed = ['age', 'gender', 'height', 'weight', 'goal', 'isBlocked', 'injuries', 'gymFocus', 'gymExperience', 'dietType', 'mealCount', 'foodRestrictions'];
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

// POST /api/users/:id/send-message — send Telegram message to user from admin panel
router.post('/:id/send-message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Текст повідомлення обов\'язковий' });
    }

    const user = await User.findById(req.params.id).select('telegramId firstName username isBlocked');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const botRef = require('../bot/botRef');
    const bot = botRef.get();
    if (!bot) return res.status(503).json({ message: 'Бот недоступний' });

    await bot.telegram.sendMessage(user.telegramId, message.trim());
    res.json({ message: 'Повідомлення надіслано' });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
