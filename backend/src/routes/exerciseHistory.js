const router = require('express').Router();
const ExerciseHistory = require('../models/ExerciseHistory');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

// GET /api/exercise-history?userId=&exerciseId=&from=&to=&page=&limit=
router.get('/', async (req, res) => {
  try {
    const { userId, exerciseId, from, to, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (exerciseId) filter.exerciseId = exerciseId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const total = await ExerciseHistory.countDocuments(filter);
    const records = await ExerciseHistory.find(filter)
      .populate('userId', 'firstName lastName username telegramId')
      .populate('exerciseId', 'name category muscleGroup')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ records, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/exercise-history
router.post('/', async (req, res) => {
  try {
    const { userId, exerciseId, sets, reps, weightKg, durationMin, notes, date } = req.body;
    const record = await ExerciseHistory.create({
      userId, exerciseId, sets, reps, weightKg, durationMin, notes, date,
    });
    const populated = await record.populate([
      { path: 'userId', select: 'firstName lastName username' },
      { path: 'exerciseId', select: 'name category muscleGroup' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/exercise-history/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['sets', 'reps', 'weightKg', 'durationMin', 'notes', 'date', 'exerciseId'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const record = await ExerciseHistory.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('userId', 'firstName lastName username telegramId')
      .populate('exerciseId', 'name category muscleGroup');
    if (!record) return res.status(404).json({ message: 'Not found' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/exercise-history/:id
router.delete('/:id', async (req, res) => {
  try {
    const record = await ExerciseHistory.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
