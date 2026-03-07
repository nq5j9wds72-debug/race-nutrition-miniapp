const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors({
  origin: "https://race-nutrition-miniapp.pages.dev"
}));
app.use(express.json());

const metrics = {
  started_at: new Date().toISOString(),
  counters: {
    miniapp_open: 0,
    auth_success: 0,
    calc_success: 0,
    calc_validation_error: 0
  }
};

function incrementMetric(eventName, extra = {}) {
  if (!Object.prototype.hasOwnProperty.call(metrics.counters, eventName)) {
    metrics.counters[eventName] = 0;
  }

  metrics.counters[eventName] += 1;

  console.log(JSON.stringify({
    type: "metric_event",
    event: eventName,
    count: metrics.counters[eventName],
    ts: new Date().toISOString(),
    ...extra
  }));
}

function validateTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return { ok: false, error: "В данных Telegram отсутствует подпись hash." };
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
    return { ok: false, error: "Подпись данных Telegram не прошла проверку." };
  }

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = 24 * 60 * 60;

  if (!authDate || now - authDate > maxAgeSeconds) {
    return { ok: false, error: "Данные Telegram устарели или не содержат время авторизации." };
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

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return Number(value);
}

function isInRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function calculateFluidPerHourMl(normalizedInput) {
  const sweatRateLph = normalizedInput.sweat_rate_lph;
  const temperatureC = normalizedInput.temperature_c;

  if (Number.isFinite(sweatRateLph)) {
    return sweatRateLph * 1000 * 0.7;
  }

  if (temperatureC < 10) return 400;
  if (temperatureC <= 19) return 500;
  if (temperatureC <= 29) return 650;
  return 800;
}

function getSodiumConcentrationMgL(temperatureC) {
  if (temperatureC >= 30) return 900;
  if (temperatureC >= 20) return 700;
  return 500;
}

function roundTo5(value) {
  return Math.round(Number(value) / 5) * 5;
}

function formatDurationHuman(durationMin) {
  const totalMin = Number(durationMin || 0);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;

  if (hours > 0) {
    return `${hours} ч ${String(minutes).padStart(2, "0")} мин`;
  }

  return `${minutes} мин`;
}

// health check
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// simple metrics view
app.get("/api/metrics", (req, res) => {
  res.json({
    ok: true,
    metrics
  });
});

// auth with Telegram initData validation
app.post("/api/auth", (req, res) => {
  const initData = String(req.body?.initData || "");
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({
      ok: false,
      error: "На сервере не настроен BOT_TOKEN."
    });
  }

  if (!initData) {
    return res.status(400).json({
      ok: false,
      error: "Не переданы данные Telegram WebApp."
    });
  }

  const result = validateTelegramInitData(initData, botToken);

  if (!result.ok) {
    return res.status(401).json(result);
  }

  incrementMetric("auth_success", {
    has_user: Boolean(result.user)
  });

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
      error: "Поля a и b должны быть числами."
    });
  }

  return res.json({
    ok: true,
    input: { a, b },
    result: a + b
  });
});

// main nutrition calculation route (v1: validation + carbs + fluid + sodium)
app.post("/api/calc", (req, res) => {
  const input = req.body || {};

  const normalizedInput = {
    race_type: input.race_type ?? null,
    duration_min: toNullableNumber(input.duration_min),
    weight_kg: toNullableNumber(input.weight_kg),
    temperature_c: toNullableNumber(input.temperature_c),
    fuel_format: input.fuel_format ?? null,
    gi_tolerance_level: input.gi_tolerance_level ?? null,
    effort_level: input.effort_level ?? "race",
    humidity_pct: toNullableNumber(input.humidity_pct),
    distance_km: toNullableNumber(input.distance_km),
    sweat_rate_lph: toNullableNumber(input.sweat_rate_lph),
    elevation_gain_m: toNullableNumber(input.elevation_gain_m),
    sodium_loss_profile: input.sodium_loss_profile ?? null
  };

  const errors = [];
  const warnings = [];

  if (!["road", "trail", "ultra"].includes(normalizedInput.race_type)) {
    errors.push("Выбери корректный тип гонки: шоссе, трейл или ультра.");
  }

  if (!isInRange(normalizedInput.duration_min, 30, 2160)) {
    errors.push("Длительность гонки должна быть от 30 минут до 36 часов.");
  }

  if (!isInRange(normalizedInput.weight_kg, 35, 150)) {
    errors.push("Вес должен быть числом от 35 до 150 кг.");
  }

  if (!isInRange(normalizedInput.temperature_c, -20, 45)) {
    errors.push("Температура должна быть от -20 до 45 °C.");
  }

  if (!["drink_only", "gels", "combo"].includes(normalizedInput.fuel_format)) {
    errors.push("Выбери корректный формат питания: только питьё, гели или комбинированно.");
  }

  if (!["low", "medium", "high"].includes(normalizedInput.gi_tolerance_level)) {
    errors.push("Выбери корректную переносимость углеводов: низкая, средняя или высокая.");
  }

  if (
    normalizedInput.humidity_pct !== null &&
    !isInRange(normalizedInput.humidity_pct, 0, 100)
  ) {
    errors.push("Влажность должна быть числом от 0 до 100%.");
  }

  if (
    normalizedInput.distance_km !== null &&
    !isInRange(normalizedInput.distance_km, 1, 300)
  ) {
    errors.push("Дистанция должна быть числом от 1 до 300 км.");
  }

  if (
    normalizedInput.sweat_rate_lph !== null &&
    !isInRange(normalizedInput.sweat_rate_lph, 0.2, 2.5)
  ) {
    errors.push("Потливость должна быть числом от 0.2 до 2.5 литра в час.");
  }

  if (
    normalizedInput.elevation_gain_m !== null &&
    !isInRange(normalizedInput.elevation_gain_m, 0, 20000)
  ) {
    errors.push("Набор высоты должен быть числом от 0 до 20000 м.");
  }

  if (errors.length > 0) {
    incrementMetric("calc_validation_error", {
      error_count: errors.length
    });

    return res.status(400).json({
      ok: false,
      errors,
      warnings: [],
      normalized_input: normalizedInput,
      result: null,
      plan: null
    });
  }

  const durationMin = normalizedInput.duration_min;
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

  if (
    normalizedInput.sweat_rate_lph === null &&
    normalizedInput.temperature_c >= 20
  ) {
    warnings.push("В жару без данных о вашей потливости точность расчёта жидкости ниже.");
  }

  if (durationMin > 720) {
    warnings.push("Очень длинная гонка: расчёт носит ориентировочный характер и требует проверки на практике.");
  }

  warnings.push("Натрий — это ориентир, а не защита от перепивания.");

  const fluidPerHourMl = calculateFluidPerHourMl(normalizedInput);
  const fluidTotalMl = fluidPerHourMl * durationHours;
  const fluidIntervalMin = 15;
  const fluidPerIntakeMl = fluidPerHourMl / 4;

  const sodiumConcentrationMgL = getSodiumConcentrationMgL(normalizedInput.temperature_c);
  const sodiumPerHourMg = (fluidPerHourMl / 1000) * sodiumConcentrationMgL;
  const sodiumTotalMg = sodiumPerHourMg * durationHours;
  const sodiumIntervalMin = 15;
  const sodiumPerIntakeMg = sodiumPerHourMg / 4;

  const durationHuman = formatDurationHuman(durationMin);

  const displayCarbsPerHour = Math.round(carbsPerHour);
  const displayCarbsPerIntake = Math.round(carbsPerIntake);
  const displayCarbsTotal = Math.round(carbsTotal);

  const displayFluidPerHourMl = Math.round(fluidPerHourMl);
  const displayFluidPerIntakeMl = roundTo5(fluidPerIntakeMl);
  const displayFluidTotalMl = Math.round(fluidTotalMl);

  const displaySodiumPerHourMg = Math.round(sodiumPerHourMg);
  const displaySodiumPerIntakeMg = Math.round(sodiumPerIntakeMg);
  const displaySodiumTotalMg = Math.round(sodiumTotalMg);

  incrementMetric("calc_success", {
    race_type: normalizedInput.race_type,
    duration_min: normalizedInput.duration_min,
    used_sweat_rate: normalizedInput.sweat_rate_lph !== null
  });

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
        fluid_per_hour_ml: fluidPerHourMl,
        fluid_total_ml: fluidTotalMl,
        fluid_interval_min: fluidIntervalMin,
        fluid_per_intake_ml: fluidPerIntakeMl
      },
      sodium: {
        sodium_per_hour_mg: sodiumPerHourMg,
        sodium_total_mg: sodiumTotalMg,
        sodium_interval_min: sodiumIntervalMin,
        sodium_per_intake_mg: sodiumPerIntakeMg
      },
      gel_equivalent: {
        gels_per_hour_est: gelsPerHourEst,
        gels_total_est: gelsTotalEst,
        gel_basis_g: gelBasisG
      }
    },
    plan: {
      summary: `На ${durationHuman} тебе нужен план: около ${displayCarbsPerHour} г углеводов в час, ${displayFluidPerHourMl} мл жидкости в час и ${displaySodiumPerHourMg} мг натрия в час.`,
      plan_steps: [
        "Начни питание с первых 20–30 минут гонки, не жди сильного голода или упадка энергии.",
        `Принимай углеводы каждые ${carbIntervalMin} мин: около ${displayCarbsPerIntake} г за приём.`,
        `Пей каждые ${fluidIntervalMin} мин: около ${displayFluidPerIntakeMl} мл за приём.`,
        `Старайся получать около ${displaySodiumPerIntakeMg} мг натрия за приём.`,
        `Всего за гонку ориентир такой: ${displayCarbsTotal} г углеводов, ${displayFluidTotalMl} мл жидкости и ${displaySodiumTotalMg} мг натрия.`
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});