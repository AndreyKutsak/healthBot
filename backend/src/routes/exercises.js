const router = require('express').Router();
const Exercise = require('../models/Exercise');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

// GET /api/exercises
router.get('/', async (req, res) => {
  try {
    const { search, category, muscleGroup, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (muscleGroup) filter.muscleGroup = muscleGroup;
    if (search) filter.name = new RegExp(search, 'i');

    const total = await Exercise.countDocuments(filter);
    const exercises = await Exercise.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ exercises, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/exercises
router.post('/', async (req, res) => {
  try {
    const { name, category, muscleGroup, description, effectiveness } = req.body;
    const exercise = await Exercise.create({ name, category, muscleGroup, description, effectiveness });
    res.status(201).json(exercise);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/exercises/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'category', 'muscleGroup', 'description', 'effectiveness'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const exercise = await Exercise.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!exercise) return res.status(404).json({ message: 'Not found' });
    res.json(exercise);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/exercises/:id
router.delete('/:id', async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndDelete(req.params.id);
    if (!exercise) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
