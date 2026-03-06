const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors({
  origin: "https://race-nutrition-miniapp.pages.dev"
}));
app.use(express.json());

function validateTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return { ok: false, error: "hash not found" };
  }

  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) {
    return { ok: false, error: "invalid hash" };
  }

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = 24 * 60 * 60;

  if (!authDate || now - authDate > maxAgeSeconds) {
    return { ok: false, error: "auth_date is too old or missing" };
  }

  let user = null;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      user = null;
    }
  }

  return {
    ok: true,
    user,
    authDate
  };
}

// health check
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// auth with Telegram initData validation
app.post("/api/auth", (req, res) => {
  const initData = String(req.body?.initData || "");
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({
      ok: false,
      error: "BOT_TOKEN is not set on server"
    });
  }

  if (!initData) {
    return res.status(400).json({
      ok: false,
      error: "initData is empty"
    });
  }

  const result = validateTelegramInitData(initData, botToken);

  if (!result.ok) {
    return res.status(401).json(result);
  }

  return res.json({
    ok: true,
    user: result.user,
    authDate: result.authDate
  });
});

// test calculation route
app.post("/api/calc-test", (req, res) => {
  const a = Number(req.body?.a);
  const b = Number(req.body?.b);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return res.status(400).json({
      ok: false,
      error: "a and b must be numbers"
    });
  }

  return res.json({
    ok: true,
    input: { a, b },
    result: a + b
  });
});

// main nutrition calculation route (v1: validation + carbs)
app.post("/api/calc", (req, res) => {
  const input = req.body || {};

  const normalizedInput = {
    race_type: input.race_type ?? null,
    duration_min: input.duration_min ?? null,
    weight_kg: input.weight_kg ?? null,
    temperature_c: input.temperature_c ?? null,
    fuel_format: input.fuel_format ?? null,
    gi_tolerance_level: input.gi_tolerance_level ?? null,
    effort_level: input.effort_level ?? "race",
    humidity_pct: input.humidity_pct ?? null,
    distance_km: input.distance_km ?? null,
    sweat_rate_lph: input.sweat_rate_lph ?? null,
    elevation_gain_m: input.elevation_gain_m ?? null,
    sodium_loss_profile: input.sodium_loss_profile ?? null
  };

  const errors = [];
  const warnings = [];

  if (!["road", "trail", "ultra"].includes(normalizedInput.race_type)) {
    errors.push("Поле race_type должно быть: road, trail или ultra.");
  }

  if (!Number.isFinite(Number(normalizedInput.duration_min))) {
    errors.push("Поле duration_min должно быть числом.");
  }

  if (!Number.isFinite(Number(normalizedInput.weight_kg))) {
    errors.push("Поле weight_kg должно быть числом.");
  }

  if (!Number.isFinite(Number(normalizedInput.temperature_c))) {
    errors.push("Поле temperature_c должно быть числом.");
  }

  if (!["drink_only", "gels", "combo"].includes(normalizedInput.fuel_format)) {
    errors.push("Поле fuel_format должно быть: drink_only, gels или combo.");
  }

  if (!["low", "medium", "high"].includes(normalizedInput.gi_tolerance_level)) {
    errors.push("Поле gi_tolerance_level должно быть: low, medium или high.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      ok: false,
      errors,
      warnings: [],
      normalized_input: normalizedInput,
      result: null,
      plan: null
    });
  }

  const durationMin = Number(normalizedInput.duration_min);
  const durationHours = durationMin / 60;

  let carbsPerHour = 0;

  if (durationMin < 60) {
    if (normalizedInput.gi_tolerance_level === "low") carbsPerHour = 0;
    if (normalizedInput.gi_tolerance_level === "medium") carbsPerHour = 15;
    if (normalizedInput.gi_tolerance_level === "high") carbsPerHour = 30;
  } else if (durationMin <= 150) {
    if (normalizedInput.gi_tolerance_level === "low") carbsPerHour = 30;
    if (normalizedInput.gi_tolerance_level === "medium") carbsPerHour = 45;
    if (normalizedInput.gi_tolerance_level === "high") carbsPerHour = 60;
  } else {
    if (normalizedInput.gi_tolerance_level === "low") carbsPerHour = 60;
    if (normalizedInput.gi_tolerance_level === "medium") carbsPerHour = 75;
    if (normalizedInput.gi_tolerance_level === "high") carbsPerHour = 90;
  }

  let carbIntervalMin = 30;
  if (carbsPerHour > 45 && carbsPerHour <= 75) carbIntervalMin = 20;
  if (carbsPerHour > 75) carbIntervalMin = 15;

  const carbIntakesPerHour = 60 / carbIntervalMin;
  const carbsPerIntake = carbsPerHour / carbIntakesPerHour;
  const carbsTotal = carbsPerHour * durationHours;

  const gelBasisG = 25;
  const gelsPerHourEst = carbsPerHour / gelBasisG;
  const gelsTotalEst = carbsTotal / gelBasisG;

  if (carbsPerHour >= 75) {
    warnings.push("Высокий план по углеводам лучше заранее протестировать на тренировке.");
  }

  if (normalizedInput.fuel_format === "drink_only" && carbsPerHour > 60) {
    warnings.push("Только напитком такой объём углеводов набрать может быть неудобно.");
  }

  return res.json({
    ok: true,
    errors: [],
    warnings,
    normalized_input: normalizedInput,
    result: {
      carbs: {
        carbs_per_hour_g: carbsPerHour,
        carbs_total_g: carbsTotal,
        carb_interval_min: carbIntervalMin,
        carbs_per_intake_g: carbsPerIntake
      },
      fluid: {
        fluid_per_hour_ml: 0,
        fluid_total_ml: 0,
        fluid_interval_min: 15,
        fluid_per_intake_ml: 0
      },
      sodium: {
        sodium_per_hour_mg: 0,
        sodium_total_mg: 0,
        sodium_interval_min: 15,
        sodium_per_intake_mg: 0
      },
      gel_equivalent: {
        gels_per_hour_est: gelsPerHourEst,
        gels_total_est: gelsTotalEst,
        gel_basis_g: gelBasisG
      }
    },
    plan: {
      summary: `Тебе нужно около ${carbsPerHour} г углеводов в час.`,
      plan_steps: [
        `Принимай углеводы каждые ${carbIntervalMin} минут.`,
        `Это примерно ${carbsPerIntake} г углеводов за один приём.`,
        `Это примерно ${gelsPerHourEst} геля в час, если в одном геле ${gelBasisG} г углеводов.`
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});