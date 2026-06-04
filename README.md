# Health Bot

Telegram бот з React адмін-панеллю.

## Запуск

### 1. MongoDB
Переконайтесь що MongoDB запущено локально на порту 27017.

### 2. Backend
```bash
cd backend
npm install
# Відредагуйте .env — вставте ваш BOT_TOKEN
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Адмін-панель: http://localhost:3000  
Логін: `admin` / `admin123`

## Структура

```
backend/
  src/
    app.js              — Express + MongoDB + запуск бота
    bot/
      index.js          — Telegraf бот
      handlers/
        registration.js — крок за кроком реєстрація
        commands.js     — команди зареєстрованих користувачів
    models/
      User.js           — модель користувача
      Admin.js          — модель адміна (bcrypt пароль)
    routes/
      auth.js           — POST /api/auth/login
      users.js          — CRUD /api/users (захищено JWT)
    middleware/
      adminAuth.js      — JWT middleware

frontend/
  src/
    App.jsx             — Router + захист маршрутів
    pages/
      Login.jsx         — сторінка входу
      Dashboard.jsx     — статистика
      Users.jsx         — таблиця користувачів + редагування
    components/
      Layout.jsx        — sidebar + topbar
    services/
      api.js            — axios з JWT interceptor
```
