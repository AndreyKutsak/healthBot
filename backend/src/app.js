require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const exerciseRoutes = require("./routes/exercises");
const exerciseHistoryRoutes = require("./routes/exerciseHistory");
const foodRoutes = require("./routes/food");
const foodHistoryRoutes = require("./routes/foodHistory");
const meRoutes = require("./routes/me");
const { startBot } = require("./bot");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/exercise-history", exerciseHistoryRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/food-history", foodHistoryRoutes);
app.use("/api/me", meRoutes);

// EMBER web app (Telegram Mini App) — static files of the prototype
app.use(express.static(require("path").join(__dirname, "..", "..", "prototype-v1", "dist")));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    startBot();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
