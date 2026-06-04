const router = require('express').Router();
const FoodHistory = require('../models/FoodHistory');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

// GET /api/food-history?userId=&mealType=&from=&to=&page=&limit=
router.get('/', async (req, res) => {
  try {
    const { userId, mealType, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (mealType) filter.mealType = mealType;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const total = await FoodHistory.countDocuments(filter);
    const records = await FoodHistory.find(filter)
      .populate('userId', 'firstName lastName username telegramId')
      .populate('foodId', 'name category caloriesPer100g')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ records, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/food-history
router.post('/', async (req, res) => {
  try {
    const { userId, foodId, amountG, mealType, notes, date } = req.body;
    // auto-calc calories from food reference
    const Food = require('../models/Food');
    const food = await Food.findById(foodId);
    if (!food) return res.status(404).json({ message: 'Food not found' });

    const calories = Math.round((food.caloriesPer100g * amountG) / 100);
    const record = await FoodHistory.create({ userId, foodId, amountG, calories, mealType, notes, date });
    const populated = await record.populate([
      { path: 'userId', select: 'firstName lastName username' },
      { path: 'foodId', select: 'name category caloriesPer100g' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/food-history/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['amountG', 'mealType', 'notes', 'date', 'foodId'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // recalculate calories if amount or food changed
    if (updates.amountG || updates.foodId) {
      const existing = await FoodHistory.findById(req.params.id).populate('foodId');
      const Food = require('../models/Food');
      const foodDoc = updates.foodId
        ? await Food.findById(updates.foodId)
        : existing.foodId;
      const amount = updates.amountG ?? existing.amountG;
      if (foodDoc) updates.calories = Math.round((foodDoc.caloriesPer100g * amount) / 100);
    }

    const record = await FoodHistory.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('userId', 'firstName lastName username telegramId')
      .populate('foodId', 'name category caloriesPer100g');
    if (!record) return res.status(404).json({ message: 'Not found' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/food-history/:id
router.delete('/:id', async (req, res) => {
  try {
    const record = await FoodHistory.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
