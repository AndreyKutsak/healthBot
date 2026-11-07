// Personal API for the EMBER web app (Telegram Mini App).
// Every route works only with the data of the signed-in Telegram user (req.user).
const router = require('express').Router();
const mongoose = require('mongoose');
const Food = require('../models/Food');
const FoodHistory = require('../models/FoodHistory');
const ExerciseHistory = require('../models/ExerciseHistory');
const TrainingPlan = require('../models/TrainingPlan');
const Sleep = require('../models/Sleep');
const telegramAuth = require('../middleware/telegramAuth');
const { handleAI, processTool } = require('../bot/handlers/aiHandler');
const { EATEN, entryMacros, entryName, sumNutrition, snapshotFor } = require('../utils/nutrition');

router.use(telegramAuth);

const MEAL_TYPES = ['Сніданок', 'Обід', 'Вечеря', 'Перекус'];
const STATUSES = ['eaten', 'planned'];
const SLEEP_QUALITY = ['bad', 'ok', 'good'];
const DAY_ABBR = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- helpers ----------

class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const pad = (n) => String(n).padStart(2, '0');
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function num(value, min, max, label) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n) || n < min || n > max) {
    throw new BadRequest(`${label}: введіть число від ${min} до ${max}`);
  }
  return n;
}

const optNum = (value, label) =>
  value === null || value === undefined || value === '' ? null : Math.round(num(value, 0, 2000, label));

const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Client timezone as Date#getTimezoneOffset() (minutes, e.g. -120 for Kyiv in winter).
function tzOffset(req) {
  const tz = Number(req.query.tz ?? req.body?.tz);
  return Number.isFinite(tz) && Math.abs(tz) <= 840 ? Math.round(tz) : new Date().getTimezoneOffset();
}

// Local date "YYYY-MM-DD" of a moment for the given offset.
function localKey(date, offset) {
  const d = new Date(date.getTime() - offset * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Local calendar day -> UTC range. Invalid or empty date means "today".
function dayRange(dateStr, offset) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  let midnightUtc;
  if (match) {
    midnightUtc = Date.UTC(+match[1], +match[2] - 1, +match[3]);
  } else {
    const local = new Date(Date.now() - offset * 60000);
    midnightUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  }
  const from = new Date(midnightUtc + offset * 60000);
  return {
    key: localKey(from, offset),
    from,
    to: new Date(from.getTime() + DAY_MS),
    weekday: new Date(midnightUtc).getUTCDay(),
  };
}

function parseDate(value) {
  if (value === undefined || value === null || value === '') return new Date();
  const d = new Date(value);
  const year = d.getUTCFullYear();
  if (Number.isNaN(d.getTime()) || year < 2000 || year > new Date().getUTCFullYear() + 2) {
    throw new BadRequest('Невірна дата');
  }
  return d;
}

function mealTypeFor(value, when, offset) {
  if (MEAL_TYPES.includes(value)) return value;
  const h = new Date(when.getTime() - offset * 60000).getUTCHours();
  if (h >= 5 && h < 11) return 'Сніданок';
  if (h >= 11 && h < 16) return 'Обід';
  if (h >= 16 && h < 21) return 'Вечеря';
  return 'Перекус';
}

const normOf = (u) => ({
  calories: u.dailyCalories ?? null,
  protein: u.dailyProtein ?? null,
  fat: u.dailyFat ?? null,
  carbs: u.dailyCarbs ?? null,
});

const serializeFood = (f) => ({
  id: f._id,
  name: f.name,
  category: f.category,
  caloriesPer100g: f.caloriesPer100g,
  proteinPer100g: f.proteinPer100g,
  fatPer100g: f.fatPer100g,
  carbsPer100g: f.carbsPer100g,
});

function serializeEntry(e) {
  const foodId = e.foodId && e.foodId._id ? e.foodId._id : e.foodId || null;
  return {
    id: e._id,
    foodId,
    name: entryName(e),
    amountG: e.amountG ?? null,
    calories: e.calories,
    ...entryMacros(e),
    approx: !!e.approx,
    status: e.status || 'eaten',
    mealType: e.mealType,
    notes: e.notes || '',
    date: e.date,
  };
}

const serializeExercise = (l) => ({
  id: l._id,
  name: l.exerciseId?.name || 'Вправа',
  category: l.exerciseId?.category || null,
  sets: l.sets,
  reps: l.reps,
  weightKg: l.weightKg,
  durationMin: l.durationMin,
  caloriesBurned: l.caloriesBurned,
  date: l.date,
});

function workoutFor(plan, weekday, logged) {
  if (!plan) return null;
  const session = plan.schedule.find((d) => d.dayOfWeek === DAY_ABBR[weekday]);
  const loggedNames = logged.map((l) => (l.exerciseId?.name || '').toLowerCase()).filter(Boolean);
  const isDone = (name) => {
    const n = name.toLowerCase();
    return loggedNames.some((l) => l.includes(n) || n.includes(l));
  };
  return {
    planName: plan.name,
    name: session ? session.name : null,
    rest: !session,
    exercises: session
      ? session.exercises.map((e) => ({
          name: e.exerciseName,
          sets: e.sets,
          reps: e.reps,
          durationMin: e.durationMin,
          restSec: e.restSec,
          notes: e.notes,
          done: isDone(e.exerciseName),
        }))
      : [],
  };
}

async function findOwnEntry(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return FoodHistory.findOne({ _id: req.params.id, userId: req.user._id });
}

// Builds a FoodHistory payload from a client item: either a catalog food with grams
// or a custom entry (own dish / approximate estimate).
async function buildEntry(item) {
  if (!item || typeof item !== 'object') throw new BadRequest('Порожній запис');

  if (item.foodId) {
    if (!mongoose.isValidObjectId(item.foodId)) throw new BadRequest('Невідомий продукт');
    const amountG = num(item.amountG, 1, 5000, 'Порція, г');
    const food = await Food.findById(item.foodId);
    if (!food) throw new BadRequest('Продукт не знайдено в базі');
    return { foodId: food._id, amountG, ...snapshotFor(food, amountG), notes: str(item.notes, 200) };
  }

  const name = str(item.name, 120);
  if (!name) throw new BadRequest('Вкажіть назву страви');
  return {
    name,
    calories: Math.round(num(item.calories, 0, 10000, 'Калорії')),
    amountG: item.amountG === undefined || item.amountG === null || item.amountG === ''
      ? null
      : num(item.amountG, 1, 5000, 'Порція, г'),
    protein: optNum(item.protein, 'Білки'),
    fat: optNum(item.fat, 'Жири'),
    carbs: optNum(item.carbs, 'Вуглеводи'),
    approx: !!item.approx,
    notes: str(item.notes, 200),
  };
}

// ---------- profile & day ----------

// GET /api/me — profile and daily norm
router.get('/', (req, res) => {
  const u = req.user;
  res.json({
    firstName: u.firstName,
    username: u.username,
    age: u.age,
    gender: u.gender,
    height: u.height,
    weight: u.weight,
    goal: u.goal,
    canUseGym: u.canUseGym,
    trainingDays: u.trainingDays,
    injuries: u.injuries,
    dietType: u.dietType,
    mealCount: u.mealCount,
    foodRestrictions: u.foodRestrictions,
    norm: normOf(u),
  });
});

// GET /api/me/day?date=YYYY-MM-DD&tz= — food, activity, workout and sleep of one day
router.get('/day', wrap(async (req, res) => {
  const offset = tzOffset(req);
  const day = dayRange(req.query.date, offset);
  const userId = req.user._id;
  const range = { $gte: day.from, $lt: day.to };

  const [foods, exercises, plan, sleep] = await Promise.all([
    FoodHistory.find({ userId, date: range }).populate('foodId').sort({ date: 1 }),
    ExerciseHistory.find({ userId, date: range }).populate('exerciseId', 'name category').sort({ date: 1 }),
    TrainingPlan.findOne({ userId, active: true }),
    Sleep.findOne({ userId, date: day.key }),
  ]);

  res.json({
    date: day.key,
    norm: normOf(req.user),
    eaten: sumNutrition(foods.filter((f) => f.status !== 'planned')),
    planned: sumNutrition(foods.filter((f) => f.status === 'planned')),
    entries: foods.map(serializeEntry),
    activity: {
      burned: exercises.reduce((s, l) => s + (l.caloriesBurned || 0), 0),
      minutes: exercises.reduce((s, l) => s + (l.durationMin || 0), 0),
      exercises: exercises.map(serializeExercise),
    },
    workout: workoutFor(plan, day.weekday, exercises),
    sleep: sleep ? { durationMin: sleep.durationMin, quality: sleep.quality } : null,
  });
}));

// GET /api/me/week?date=&tz= — 7 days ending at `date`: eaten and burned calories per day
router.get('/week', wrap(async (req, res) => {
  const offset = tzOffset(req);
  const last = dayRange(req.query.date, offset);
  const from = new Date(last.from.getTime() - 6 * DAY_MS);
  const userId = req.user._id;
  const range = { $gte: from, $lt: last.to };

  const [foods, exercises] = await Promise.all([
    FoodHistory.find({ userId, date: range, ...EATEN }).select('date calories'),
    ExerciseHistory.find({ userId, date: range }).select('date caloriesBurned durationMin'),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => ({
    date: localKey(new Date(from.getTime() + i * DAY_MS), offset),
    eaten: 0,
    burned: 0,
    minutes: 0,
  }));
  const at = (date) => days[Math.floor((date.getTime() - from.getTime()) / DAY_MS)];
  for (const f of foods) { const d = at(f.date); if (d) d.eaten += f.calories || 0; }
  for (const e of exercises) {
    const d = at(e.date);
    if (d) { d.burned += e.caloriesBurned || 0; d.minutes += e.durationMin || 0; }
  }

  res.json({ norm: normOf(req.user), weight: req.user.weight, goal: req.user.goal, days });
}));

// ---------- food ----------

// GET /api/me/foods/recent — foods the user logged recently, newest first
router.get('/foods/recent', wrap(async (req, res) => {
  const logs = await FoodHistory.find({ userId: req.user._id, foodId: { $ne: null } })
    .sort({ date: -1 })
    .limit(80)
    .populate('foodId');
  const seen = new Set();
  const foods = [];
  for (const l of logs) {
    if (!l.foodId || seen.has(String(l.foodId._id))) continue;
    seen.add(String(l.foodId._id));
    foods.push({ ...serializeFood(l.foodId), lastAmountG: l.amountG });
    if (foods.length >= 8) break;
  }
  res.json({ foods });
}));

// GET /api/me/foods/search?q= — catalog search
router.get('/foods/search', wrap(async (req, res) => {
  const q = str(req.query.q, 60);
  if (q.length < 2) return res.json({ foods: [] });
  const foods = await Food.find({ name: new RegExp(escapeRegex(q), 'i') }).sort({ name: 1 }).limit(12);
  res.json({ foods: foods.map(serializeFood) });
}));

// POST /api/me/food-entries — { items: [{foodId, amountG} | {name, calories, ...}], date, mealType, status }
router.post('/food-entries', wrap(async (req, res) => {
  const { items, date, mealType, status = 'eaten' } = req.body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    throw new BadRequest('Додайте від 1 до 20 страв');
  }
  if (!STATUSES.includes(status)) throw new BadRequest('Невідомий стан запису');

  const when = parseDate(date);
  const meal = mealTypeFor(mealType, when, tzOffset(req));
  const payloads = [];
  for (const item of items) payloads.push(await buildEntry(item));

  const created = await FoodHistory.insertMany(
    payloads.map((p) => ({ ...p, userId: req.user._id, date: when, mealType: meal, status }))
  );
  res.status(201).json({ entries: created.map(serializeEntry) });
}));

// PATCH /api/me/food-entries/:id — { amountG?, calories?, date?, status?, mealType? }
router.patch('/food-entries/:id', wrap(async (req, res) => {
  const entry = await findOwnEntry(req);
  if (!entry) return res.status(404).json({ message: 'Запис не знайдено' });
  const { amountG, calories, date, status, mealType } = req.body || {};

  if (amountG !== undefined) {
    const grams = num(amountG, 1, 5000, 'Порція, г');
    const food = entry.foodId && entry.protein == null ? await Food.findById(entry.foodId) : null;
    if (food) {
      // record made before snapshots existed: take values from the catalog
      Object.assign(entry, snapshotFor(food, grams));
    } else if (entry.amountG) {
      const k = grams / entry.amountG;
      entry.calories = Math.round(entry.calories * k);
      for (const m of ['protein', 'fat', 'carbs']) if (entry[m] != null) entry[m] = Math.round(entry[m] * k);
    }
    entry.amountG = grams;
  } else if (calories !== undefined) {
    const kcal = Math.round(num(calories, 0, 10000, 'Калорії'));
    const k = entry.calories ? kcal / entry.calories : null;
    for (const m of ['protein', 'fat', 'carbs']) {
      if (entry[m] != null) entry[m] = k === null ? null : Math.round(entry[m] * k);
    }
    entry.calories = kcal;
  }

  if (date !== undefined) entry.date = parseDate(date);
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw new BadRequest('Невідомий стан запису');
    entry.status = status;
  }
  if (mealType !== undefined) {
    if (!MEAL_TYPES.includes(mealType)) throw new BadRequest('Невідомий прийом їжі');
    entry.mealType = mealType;
  }

  await entry.save();
  await entry.populate('foodId');
  res.json({ entry: serializeEntry(entry) });
}));

// DELETE /api/me/food-entries/:id — returns the deleted entry so the client can undo
router.delete('/food-entries/:id', wrap(async (req, res) => {
  const entry = await findOwnEntry(req);
  if (!entry) return res.status(404).json({ message: 'Запис не знайдено' });
  await entry.populate('foodId');
  const data = serializeEntry(entry);
  await entry.deleteOne();
  res.json({ entry: data });
}));

// ---------- workout ----------

// POST /api/me/workout/log — { exerciseName, sets?, reps?, weightKg?, durationMin? }
// Uses the same logic as the AI tool log_exercise (catalog lookup + calories burned).
router.post('/workout/log', wrap(async (req, res) => {
  const name = str(req.body?.exerciseName, 120);
  if (!name) throw new BadRequest('Вкажіть вправу');
  const input = { exercise_name: escapeRegex(name) };
  const { sets, reps, weightKg, durationMin } = req.body;
  if (sets) input.sets = Math.round(num(sets, 1, 50, 'Підходи'));
  if (reps) input.reps = Math.round(num(reps, 1, 500, 'Повторення'));
  if (weightKg) input.weight_kg = num(weightKg, 0, 1000, 'Вага, кг');
  if (durationMin) input.duration_min = Math.round(num(durationMin, 1, 600, 'Тривалість, хв'));

  const result = await processTool('log_exercise', input, req.user);
  if (result.error) return res.status(404).json({ message: `Вправу «${name}» не знайдено в базі` });
  res.status(201).json(result);
}));

// ---------- sleep ----------

// PUT /api/me/sleep — { date: YYYY-MM-DD (wake-up day), durationMin, quality: bad|ok|good }
router.put('/sleep', wrap(async (req, res) => {
  const day = dayRange(req.body?.date, tzOffset(req));
  const durationMin = Math.round(num(req.body?.durationMin, 0, 1440, 'Тривалість сну, хв'));
  const quality = SLEEP_QUALITY.includes(req.body?.quality) ? req.body.quality : null;
  const sleep = await Sleep.findOneAndUpdate(
    { userId: req.user._id, date: day.key },
    { durationMin, quality },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json({ sleep: { date: sleep.date, durationMin: sleep.durationMin, quality: sleep.quality } });
}));

// ---------- assistant ----------

const chatInFlight = new Set();

// POST /api/me/chat — { text } → the same AI assistant as in the Telegram bot
router.post('/chat', wrap(async (req, res) => {
  const text = str(req.body?.text, 1000);
  if (!text) throw new BadRequest('Напишіть повідомлення');
  const key = String(req.user._id);
  if (chatInFlight.has(key)) {
    return res.status(429).json({ message: 'Помічник ще відповідає на попереднє повідомлення' });
  }

  chatInFlight.add(key);
  try {
    const replies = [];
    // handleAI only needs the message text and a reply function from the Telegram context
    const ctx = { message: { text }, reply: async (t) => { replies.push(String(t)); } };
    await handleAI(ctx, req.user);
    res.json({ replies });
  } finally {
    chatInFlight.delete(key);
  }
}));

// ---------- errors ----------

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err.status === 400 || err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ message: err.message });
  }
  console.error('me API error:', err);
  res.status(500).json({ message: 'Помилка сервера' });
});

module.exports = router;
