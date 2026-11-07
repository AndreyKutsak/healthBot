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

// POST /api/exercises/import — bulk upsert from CSV/JSON
router.post('/import', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Немає записів для імпорту' });
    }
    const ops = records
      .filter((r) => r.name && String(r.name).trim())
      .map((r) => ({
        updateOne: {
          filter: { name: String(r.name).trim() },
          update: {
            $set: {
              name: String(r.name).trim(),
              category: r.category || 'Інше',
              muscleGroup: r.muscleGroup || 'Інше',
              description: r.description || '',
              effectiveness: r.effectiveness || 'Середня',
            },
          },
          upsert: true,
        },
      }));
    if (!ops.length) return res.status(400).json({ message: 'Немає валідних записів (поле name обов\'язкове)' });
    const result = await Exercise.bulkWrite(ops);
    res.json({ inserted: result.upsertedCount, updated: result.modifiedCount, total: ops.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
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
