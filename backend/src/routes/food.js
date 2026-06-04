const router = require('express').Router();
const Food = require('../models/Food');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

// GET /api/food
router.get('/', async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.name = new RegExp(search, 'i');

    const total = await Food.countDocuments(filter);
    const foods = await Food.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ foods, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/food
router.post('/', async (req, res) => {
  try {
    const { name, category, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g } = req.body;
    const food = await Food.create({ name, category, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g });
    res.status(201).json(food);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/food/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'category', 'caloriesPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const food = await Food.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!food) return res.status(404).json({ message: 'Not found' });
    res.json(food);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/food/:id
router.delete('/:id', async (req, res) => {
  try {
    const food = await Food.findByIdAndDelete(req.params.id);
    if (!food) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
