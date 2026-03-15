const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { getPool, testDbConnection } = require("./db");

const app = express();
const FORMULA_VERSION = "v1.2";

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hasUsableSweatRate(normalizedInput) {
  return Number.isFinite(normalizedInput.sweat_rate_lph);
}

function getFallbackTemperatureBand(temperatureC) {
  if (!Number.isFinite(temperatureC)) {
    return "moderate";
  }

  if (temperatureC < 10) return "cool";
  if (temperatureC < 20) return "moderate";
  if (temperatureC < 25) return "warm";
  if (temperatureC < 30) return "hot";
  return "very_hot";
}

function getFallbackDurationBand(durationMin) {
  if (durationMin < 60) return "short";
  if (durationMin < 240) return "medium";
  return "long";
}

function getFallbackBaseFluidLph(normalizedInput) {
  const matrix = {
    cool: { short: 0.25, medium: 0.30, long: 0.35 },
    moderate: { short: 0.35, medium: 0.40, long: 0.45 },
    warm: { short: 0.45, medium: 0.50, long: 0.55 },
    hot: { short: 0.60, medium: 0.65, long: 0.70 },
    very_hot: { short: 0.70, medium: 0.75, long: 0.80 }
  };

  const temperatureBand = getFallbackTemperatureBand(normalizedInput.temperature_c);
  const durationBand = getFallbackDurationBand(normalizedInput.duration_min);

  return {
    temperatureBand,
    durationBand,
    baseFluidPerHourL: matrix[temperatureBand][durationBand]
  };
}

function calculateKnownSweatFluidLph(normalizedInput) {
  const sweatRateLph = normalizedInput.sweat_rate_lph;
  const tempAdj = normalizedInput.temperature_c >= 25 ? 0.05 : 0;
  const humidityAdj = normalizedInput.humidity_pct >= 70 ? 0.05 : 0;
  const durationAdj = normalizedInput.duration_min >= 240 ? 0.05 : 0;

  let effortAdj = 0;
  if (normalizedInput.effort_level === "easy") effortAdj = -0.05;
  if (normalizedInput.effort_level === "race") effortAdj = 0.05;

  const adjustedFraction = 0.65 + tempAdj + humidityAdj + durationAdj + effortAdj;
  const replacementFraction = clamp(adjustedFraction, 0.55, 0.80);

  const rawFluidPerHourL = sweatRateLph * replacementFraction;
  const belowSweatLimitL = sweatRateLph - 0.05;
  const preCapFluidPerHourL = Math.min(rawFluidPerHourL, belowSweatLimitL);
  const cappedFluidPerHourL = Math.min(preCapFluidPerHourL, 1.00);

  let finalFluidPerHourL = cappedFluidPerHourL;
  if (
    cappedFluidPerHourL < 0.25 &&
    0.25 < sweatRateLph &&
    0.25 < belowSweatLimitL
  ) {
    finalFluidPerHourL = 0.25;
  }

  return {
    fluidPerHourL: finalFluidPerHourL,
    meta: {
      hydrationBranch: "known_sweat_rate",
      replacementFraction,
      rawFluidPerHourL,
      belowSweatLimitL,
      preCapFluidPerHourL,
      cappedFluidPerHourL,
      isUpperFluidScenario: finalFluidPerHourL > 0.80,
      hardCapApplied: preCapFluidPerHourL > 1.00,
      possibleOverdrinkingRisk:
        finalFluidPerHourL > 0.80 || preCapFluidPerHourL > 1.00,
      heatWithoutSweatRate: false,
      ultraLongHotScenario: false
    }
  };
}

function calculateFallbackFluidLph(normalizedInput) {
  const { temperatureBand, durationBand, baseFluidPerHourL } =
    getFallbackBaseFluidLph(normalizedInput);

  const humidityAdj = normalizedInput.humidity_pct >= 70 ? 0.05 : 0;
  const raceTypeAdj = normalizedInput.race_type === "ultra" ? 0.05 : 0;

  let effortLevel = normalizedInput.effort_level;
  if (effortLevel === null) {
    effortLevel = "race";
  }

  let effortAdj = 0;
  if (effortLevel === "easy") effortAdj = -0.05;
  if (effortLevel === "race") effortAdj = 0.05;

  const adjustedFluidPerHourL = baseFluidPerHourL + humidityAdj + raceTypeAdj;
  const secondaryAdjustedFluidPerHourL = adjustedFluidPerHourL + effortAdj;
  const fluidPerHourL = clamp(secondaryAdjustedFluidPerHourL, 0.25, 1.00);

  const isUpperFluidScenario = fluidPerHourL > 0.80;
  const hardCapApplied = secondaryAdjustedFluidPerHourL > 1.00;
  const heatWithoutSweatRate = normalizedInput.temperature_c >= 25;
  const ultraLongHotScenario =
    normalizedInput.race_type === "ultra" &&
    normalizedInput.duration_min >= 240 &&
    normalizedInput.temperature_c >= 25;
  const possibleOverdrinkingRisk =
    isUpperFluidScenario ||
    hardCapApplied ||
    (normalizedInput.temperature_c >= 25 && normalizedInput.duration_min >= 240);

  return {
    fluidPerHourL,
    meta: {
      hydrationBranch: "fallback",
      temperatureBand,
      durationBand,
      baseFluidPerHourL,
      adjustedFluidPerHourL,
      secondaryAdjustedFluidPerHourL,
      isUpperFluidScenario,
      hardCapApplied,
      possibleOverdrinkingRisk,
      heatWithoutSweatRate,
      ultraLongHotScenario
    }
  };
}

function calculateFluidPerHourMl(normalizedInput) {
  if (hasUsableSweatRate(normalizedInput)) {
    const result = calculateKnownSweatFluidLph(normalizedInput);
    return {
      fluidPerHourMl: Math.round(result.fluidPerHourL * 1000),
      meta: result.meta
    };
  }

  const result = calculateFallbackFluidLph(normalizedInput);
  return {
    fluidPerHourMl: Math.round(result.fluidPerHourL * 1000),
    meta: result.meta
  };
}

function normalizeSodiumLossProfile(sodiumLossProfile) {
  if (
    sodiumLossProfile === null ||
    sodiumLossProfile === undefined ||
    sodiumLossProfile === ""
  ) {
    return "unknown";
  }

  return sodiumLossProfile;
}

function isSodiumStrategyActive({
  durationMin,
  temperatureC,
  humidityPct,
  fluidPerHourL,
  raceType,
  sodiumLossProfile
}) {
  return (
    durationMin >= 90 ||
    temperatureC >= 20 ||
    humidityPct >= 70 ||
    fluidPerHourL >= 0.50 ||
    raceType === "ultra" ||
    sodiumLossProfile === "high"
  );
}

function getBaseSodiumConcentrationMgL(sodiumLossProfile) {
  if (sodiumLossProfile === "low") return 400;
  if (sodiumLossProfile === "medium") return 600;
  if (sodiumLossProfile === "high") return 900;
  return 500;
}

function calculateSodiumPlan(normalizedInput, hydrationPlan) {
  const sodiumLossProfile = normalizeSodiumLossProfile(
    normalizedInput.sodium_loss_profile
  );
  const fluidPerHourL = hydrationPlan.fluidPerHourMl / 1000;
  const sodiumStrategyActive = isSodiumStrategyActive({
    durationMin: normalizedInput.duration_min,
    temperatureC: normalizedInput.temperature_c,
    humidityPct: normalizedInput.humidity_pct,
    fluidPerHourL,
    raceType: normalizedInput.race_type,
    sodiumLossProfile
  });

  if (!sodiumStrategyActive) {
    return {
      sodiumLossProfile,
      sodiumStrategyActive,
      sodiumConcentrationMgL: 0,
      sodiumPerHourMg: 0,
      sodiumTotalMg: 0,
      sodiumIntervalMin: hydrationPlan.fluidIntervalMin,
      sodiumPerIntakeMg: 0
    };
  }

  let sodiumConcentrationMgL = getBaseSodiumConcentrationMgL(sodiumLossProfile);

  if (
    normalizedInput.duration_min >= 180 ||
    normalizedInput.temperature_c >= 25 ||
    normalizedInput.humidity_pct >= 70 ||
    fluidPerHourL >= 0.70 ||
    normalizedInput.race_type === "ultra"
  ) {
    sodiumConcentrationMgL += 200;
  }

  if (
    sodiumLossProfile === "high" &&
    (normalizedInput.temperature_c >= 25 || fluidPerHourL >= 0.90)
  ) {
    sodiumConcentrationMgL = 1200;
  }

  if (sodiumLossProfile === "unknown") {
    sodiumConcentrationMgL = Math.min(sodiumConcentrationMgL, 700);
  }

  sodiumConcentrationMgL = clamp(sodiumConcentrationMgL, 0, 1200);

  const sodiumPerHourMg = Math.round(
    clamp(fluidPerHourL * sodiumConcentrationMgL, 0, 1500)
  );
  const sodiumTotalMg = Math.round(
    sodiumPerHourMg * (normalizedInput.duration_min / 60)
  );
  const sodiumIntervalMin = hydrationPlan.fluidIntervalMin;
  const sodiumPerIntakeMg = Math.round(
    (sodiumPerHourMg * sodiumIntervalMin) / 60
  );

  return {
    sodiumLossProfile,
    sodiumStrategyActive,
    sodiumConcentrationMgL,
    sodiumPerHourMg,
    sodiumTotalMg,
    sodiumIntervalMin,
    sodiumPerIntakeMg
  };
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

function getElevationCarbModifier(normalizedInput) {
  const elevationGainM = normalizedInput.elevation_gain_m;
  const raceType = normalizedInput.race_type;

  if (!Number.isFinite(elevationGainM)) {
    return 0;
  }

  if (!["trail", "ultra"].includes(raceType)) {
    return 0;
  }

  if (elevationGainM >= 1500) {
    return 10;
  }

  if (elevationGainM >= 500) {
    return 5;
  }

  return 0;
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

// track mini app open
app.post("/api/track-open", (req, res) => {
  incrementMetric("miniapp_open");

  res.json({
    ok: true
  });
});

// auth with Telegram initData validation
app.post("/api/auth", async (req, res) => {
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

  if (!result.user || !result.user.id) {
    return res.status(400).json({
      ok: false,
      error: "В initData нет корректного объекта user."
    });
  }

  try {
    const pool = getPool();

    await pool.query(
      `
        INSERT INTO users (
          tg_user_id,
          username,
          first_name,
          last_name,
          updated_at,
          last_seen_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (tg_user_id)
        DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          updated_at = NOW(),
          last_seen_at = NOW()
      `,
      [
        String(result.user.id),
        result.user.username ?? null,
        result.user.first_name ?? null,
        result.user.last_name ?? null
      ]
    );
  } catch (error) {
    console.error("auth db error", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось сохранить пользователя в базе."
    });
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
app.post("/api/calc", async (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const initData = authHeader.startsWith("tma ") ? authHeader.slice(4) : "";
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({
      ok: false,
      errors: ["На сервере не настроен BOT_TOKEN."],
      warnings: [],
      normalized_input: null,
      result: null,
      plan: null
    });
  }

  if (!initData) {
    return res.status(401).json({
      ok: false,
      errors: ["Не переданы данные Telegram WebApp для защищённого расчёта."],
      warnings: [],
      normalized_input: null,
      result: null,
      plan: null
    });
  }

  const authResult = validateTelegramInitData(initData, botToken);

  if (!authResult.ok) {
    return res.status(401).json({
      ok: false,
      errors: [authResult.error || "Проверка данных Telegram не пройдена."],
      warnings: [],
      normalized_input: null,
      result: null,
      plan: null
    });
  }

  if (!authResult.user || !authResult.user.id) {
    return res.status(401).json({
      ok: false,
      errors: ["В initData нет корректного объекта user."],
      warnings: [],
      normalized_input: null,
      result: null,
      plan: null
    });
  }

  const telegramUserId = String(authResult.user.id);
  const pool = getPool();

  let dbUser = null;

  try {
    const userResult = await pool.query(
      `SELECT id
       FROM users
       WHERE tg_user_id = $1
       LIMIT 1`,
      [telegramUserId]
    );

    dbUser = userResult.rows[0] || null;
  } catch (error) {
    console.error("Failed to load user for calc:", error);

    return res.status(500).json({
      ok: false,
      errors: ["Не удалось загрузить пользователя для расчёта."],
      warnings: [],
      normalized_input: null,
      result: null,
      plan: null
    });
  }

  if (!dbUser) {
    return res.status(401).json({
      ok: false,
      errors: ["Пользователь Telegram не найден в базе после auth."],
      warnings: [],
      normalized_input: null,
      result: null,
      plan: null
    });
  }

  const input = req.body || {};

  const normalizedInput = {
    race_type: input.race_type ?? null,
    duration_min: toNullableNumber(input.duration_min),
    weight_kg: toNullableNumber(input.weight_kg),
    temperature_c: toNullableNumber(input.temperature_c),
    fuel_format: input.fuel_format ?? null,
    gi_tolerance_level: input.gi_tolerance_level ?? null,
    effort_level: input.effort_level ?? null,
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
    normalizedInput.effort_level !== null &&
    !["easy", "steady", "race"].includes(normalizedInput.effort_level)
  ) {
    errors.push("Выбери корректную интенсивность: легко, умеренно или соревнование.");
  }

  if (
    normalizedInput.sodium_loss_profile !== null &&
    normalizedInput.sodium_loss_profile !== "" &&
    !["low", "medium", "high", "unknown"].includes(normalizedInput.sodium_loss_profile)
  ) {
    errors.push("Выбери корректный профиль потерь натрия: низкие, средние, высокие или не знаю.");
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
  let drinkOnlyCapApplied = false;

  if (durationMin < 60) {
    if (normalizedInput.effort_level === "race") carbsPerHour = 30;
    if (normalizedInput.effort_level === "steady") carbsPerHour = 15;
    if (normalizedInput.effort_level === "easy") carbsPerHour = 0;

    if (
      normalizedInput.gi_tolerance_level === "low" &&
      carbsPerHour > 15
    ) {
      carbsPerHour = 15;
    }
  } else {
    const durationBand = durationMin <= 150 ? "medium" : "long";
    let zoneIndex = 1;

    if (normalizedInput.effort_level === "easy") zoneIndex -= 1;
    if (normalizedInput.effort_level === "race") zoneIndex += 1;

    if (
      durationBand === "long" &&
      normalizedInput.race_type === "ultra"
    ) {
      zoneIndex -= 1;
    }

    if (
      ["trail", "ultra"].includes(normalizedInput.race_type) &&
      Number.isFinite(normalizedInput.elevation_gain_m) &&
      normalizedInput.elevation_gain_m >= 1500
    ) {
      zoneIndex += 1;
    }

    if (normalizedInput.gi_tolerance_level === "low") {
      zoneIndex -= 1;
    }

    if (zoneIndex < 0) zoneIndex = 0;
    if (zoneIndex > 2) zoneIndex = 2;

    const zoneTargets =
      durationBand === "medium" ? [30, 45, 60] : [60, 75, 90];
    const baseTarget = zoneTargets[zoneIndex];

    let giCeiling = 90;
    if (durationBand === "medium") {
      if (normalizedInput.gi_tolerance_level === "low") giCeiling = 45;
      if (normalizedInput.gi_tolerance_level === "medium") giCeiling = 60;
      if (normalizedInput.gi_tolerance_level === "high") giCeiling = 60;
    } else {
      if (normalizedInput.gi_tolerance_level === "low") giCeiling = 60;
      if (normalizedInput.gi_tolerance_level === "medium") giCeiling = 75;
      if (normalizedInput.gi_tolerance_level === "high") giCeiling = 90;
    }

    carbsPerHour = Math.min(baseTarget, giCeiling);

    let fuelFormatCap = 90;
    if (normalizedInput.fuel_format === "gels") fuelFormatCap = 75;
    if (normalizedInput.fuel_format === "drink_only") fuelFormatCap = 60;

    if (
      normalizedInput.fuel_format === "drink_only" &&
      carbsPerHour > fuelFormatCap
    ) {
      drinkOnlyCapApplied = true;
    }

    carbsPerHour = Math.min(carbsPerHour, fuelFormatCap);
  }

  if (carbsPerHour < 0) {
    carbsPerHour = 0;
  }

  if (carbsPerHour > 90) {
    carbsPerHour = 90;
  }

  let carbIntervalMin = 30;
  let carbsPerIntake = 0;

  if (carbsPerHour > 0) {
    let targetDosePerIntake = 22.5;
    let maxDosePerIntake = 25;
    let preferredIntervals = [20, 30, 15];

    if (normalizedInput.gi_tolerance_level === "low") {
      targetDosePerIntake = 17.5;
      maxDosePerIntake = 20;
      preferredIntervals = [20, 15, 30];
    }

    if (normalizedInput.gi_tolerance_level === "medium") {
      targetDosePerIntake = 22.5;
      maxDosePerIntake = 25;
      preferredIntervals = [20, 30, 15];
    }

    if (normalizedInput.gi_tolerance_level === "high") {
      targetDosePerIntake = 27.5;
      maxDosePerIntake = 30;
      preferredIntervals = [20, 15, 30];
    }

    let bestIntervalMin = preferredIntervals[0];
    let bestDistance = Infinity;

    for (const intervalMin of preferredIntervals) {
      const intakeCountPerHour = 60 / intervalMin;
      const dosePerIntake = carbsPerHour / intakeCountPerHour;

      if (dosePerIntake > maxDosePerIntake) {
        continue;
      }

      const distanceToTargetDose = Math.abs(
        dosePerIntake - targetDosePerIntake
      );

      if (distanceToTargetDose < bestDistance) {
        bestDistance = distanceToTargetDose;
        bestIntervalMin = intervalMin;
      }
    }

    carbIntervalMin = bestIntervalMin;
    carbsPerIntake = carbsPerHour / (60 / carbIntervalMin);
  }

  const carbsTotal = carbsPerHour * durationHours;

  const gelBasisG = 25;
  const gelsPerHourEst = carbsPerHour / gelBasisG;
  const gelsTotalEst = carbsTotal / gelBasisG;

  let avgSpeedKmh = null;

  if (normalizedInput.distance_km !== null && durationHours > 0) {
    avgSpeedKmh = normalizedInput.distance_km / durationHours;
  }

  if (avgSpeedKmh !== null && avgSpeedKmh < 2) {
    warnings.push("Проверь дистанцию и длительность: средняя скорость получилась слишком низкой.");
  }

  if (avgSpeedKmh !== null && avgSpeedKmh > 25) {
    warnings.push("Проверь дистанцию и длительность: средняя скорость получилась слишком высокой.");
  }

  if (
    normalizedInput.race_type === "road" &&
    normalizedInput.distance_km !== null &&
    normalizedInput.distance_km <= 21.1 &&
    durationMin >= 300
  ) {
    warnings.push("Проверь дистанцию, длительность и тип гонки: для road такой сценарий выглядит необычно.");
  }

  if (carbsPerHour >= 75) {
    warnings.push("Высокий план по углеводам лучше заранее протестировать на тренировке.");
  }

  if (
    normalizedInput.fuel_format === "drink_only" &&
    (drinkOnlyCapApplied || carbsPerHour >= 60)
  ) {
    warnings.push("Только напитком такой объём углеводов набрать может быть неудобно.");
  }

  if (durationMin > 720) {
    warnings.push("Очень длинная гонка: расчёт носит ориентировочный характер и требует проверки на практике.");
  }

  if (false && normalizedInput.sodium_loss_profile === "unknown") {
    warnings.push("Профиль потерь натрия не указан точно: план по натрию лучше проверить на тренировке.");
  }

  warnings.push("Натрий — это ориентир, а не защита от перепивания.");

  warnings.pop();

  const hydrationResult = calculateFluidPerHourMl(normalizedInput);
  const fluidPerHourMl = hydrationResult.fluidPerHourMl;
  const hydrationMeta = hydrationResult.meta;
  const fluidTotalMl = fluidPerHourMl * durationHours;
  const fluidIntervalMin = 15;
  const fluidPerIntakeMl = fluidPerHourMl / 4;

  if (hydrationMeta.heatWithoutSweatRate) {
    warnings.push("В жару без данных о вашей потливости hydration-план остаётся более приблизительным.");
  }

  if (hydrationMeta.isUpperFluidScenario) {
    warnings.push("Высокий target по жидкости в час требует особой осторожности и проверки на практике.");
  }

  if (hydrationMeta.ultraLongHotScenario) {
    warnings.push("Длинный ultra-сценарий в жару требует особенно консервативной hydration-тактики.");
  }

  if (hydrationMeta.possibleOverdrinkingRisk) {
    warnings.push("В этом сценарии важно избегать overdrinking: не пытайся компенсировать всё количество потерь жидкости.");
  }

  const sodiumPlan = calculateSodiumPlan(normalizedInput, {
    fluidPerHourMl,
    fluidIntervalMin
  });
  const sodiumPerHourMg = sodiumPlan.sodiumPerHourMg;
  const sodiumTotalMg = sodiumPlan.sodiumTotalMg;
  const sodiumIntervalMin = sodiumPlan.sodiumIntervalMin;
  const sodiumPerIntakeMg = sodiumPlan.sodiumPerIntakeMg;

  if (sodiumPlan.sodiumLossProfile === "unknown") {
    warnings.push("Sodium loss profile is unknown, so the sodium plan is less personalized and should be tested in training.");
  }

  if (false && sodiumPlan.sodiumLossProfile === "unknown") {
    warnings.push("РџСЂРѕС„РёР»СЊ РїРѕС‚РµСЂСЊ РЅР°С‚СЂРёСЏ РЅРµРёР·РІРµСЃС‚РµРЅ, РїРѕСЌС‚РѕРјСѓ РїР»Р°РЅ РїРѕ РЅР°С‚СЂРёСЋ РјРµРЅРµРµ РїРµСЂСЃРѕРЅР°Р»РёР·РёСЂРѕРІР°РЅ Рё РµРіРѕ Р»СѓС‡С€Рµ РїСЂРѕРІРµСЂРёС‚СЊ РЅР° С‚СЂРµРЅРёСЂРѕРІРєРµ.");
  }

  if (false && (
    normalizedInput.duration_min >= 240 &&
    normalizedInput.temperature_c >= 25
  )) {
    warnings.push("Р’ РґР»РёРЅРЅРѕР№ Р¶Р°СЂРєРѕР№ РіРѕРЅРєРµ СЂР°СЃС‡С‘С‚ РїРѕ РЅР°С‚СЂРёСЋ РѕСЃРѕР±РµРЅРЅРѕ Р·Р°РІРёСЃРёС‚ РѕС‚ РІР°С€РµР№ СЂРµР°Р»СЊРЅРѕР№ РїРµСЂРµРЅРѕСЃРёРјРѕСЃС‚Рё, РїРёС‚СЊРµРІРѕРіРѕ РїР»Р°РЅР° Рё РёРЅРґРёРІРёРґСѓР°Р»СЊРЅС‹С… РїРѕС‚РµСЂСЊ.");
  }

  if (
    normalizedInput.duration_min >= 240 &&
    normalizedInput.temperature_c >= 25
  ) {
    warnings.push("Long hot scenario: sodium guidance depends heavily on real-world tolerance, drinking pattern, and individual sodium losses.");
  }

  if (sodiumPerHourMg >= 1000) {
    warnings.push("Aggressive sodium target: without confirmed individual need, do not treat this as a universal recommendation.");
  }

  if (false && sodiumPerHourMg >= 1000) {
    warnings.push("Р­С‚Рѕ СѓР¶Рµ РІС‹СЃРѕРєРёР№ РїР»Р°РЅ РїРѕ РЅР°С‚СЂРёСЋ. Р‘РµР· РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅРѕР№ РёРЅРґРёРІРёРґСѓР°Р»СЊРЅРѕР№ РїРѕС‚СЂРµР±РЅРѕСЃС‚Рё РЅРµ СЃС‚РѕРёС‚ РІРѕСЃРїСЂРёРЅРёРјР°С‚СЊ РµРіРѕ РєР°Рє СѓРЅРёРІРµСЂСЃР°Р»СЊРЅСѓСЋ РЅРѕСЂРјСѓ.");
  }

  warnings.push("РќР°С‚СЂРёР№ вЂ” СЌС‚Рѕ РѕСЂРёРµРЅС‚РёСЂ, Р° РЅРµ Р·Р°С‰РёС‚Р° РѕС‚ overdrinking / EAH.");

  warnings.pop();
  warnings.push("Sodium is guidance only, not protection against overdrinking or EAH.");

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

  const responsePayload = {
    ok: true,
    formula_version: FORMULA_VERSION,
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
  };
  try {
    await pool.query(
      `INSERT INTO calculations (
        user_id,
        formula_version,
        race_type,
        duration_min,
        input_json,
        result_json,
        warnings_json
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
      [
        dbUser.id,
        FORMULA_VERSION,
        normalizedInput.race_type,
        normalizedInput.duration_min,
        JSON.stringify(normalizedInput),
        JSON.stringify(responsePayload.result),
        JSON.stringify(warnings)
      ]
    );
  } catch (error) {
    console.error("Failed to save calculation:", error);

    return res.status(500).json({
      ok: false,
      errors: ["Не удалось сохранить успешный расчёт в базу."],
      warnings: [],
      normalized_input: null,
      result: null,
      plan: null
    });
  }
  return res.json(responsePayload);
});

app.get("/api/history", async (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const initData = authHeader.startsWith("tma ")
    ? authHeader.slice(4).trim()
    : "";

  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({
      ok: false,
      error: "На сервере не настроен BOT_TOKEN.",
      items: []
    });
  }

  if (!initData) {
    return res.status(401).json({
      ok: false,
      error: "Не переданы данные Telegram WebApp для истории расчётов.",
      items: []
    });
  }

  const authResult = validateTelegramInitData(initData, botToken);

  if (!authResult.ok) {
    return res.status(401).json({
      ok: false,
      error: authResult.error || "Проверка данных Telegram не пройдена.",
      items: []
    });
  }

  if (!authResult.user || !authResult.user.id) {
    return res.status(401).json({
      ok: false,
      error: "В initData нет корректного объекта user.",
      items: []
    });
  }

  const telegramUserId = String(authResult.user.id);
  const pool = getPool();

  try {
    const userResult = await pool.query(
      `
        SELECT id
        FROM users
        WHERE tg_user_id = $1
        LIMIT 1
      `,
      [telegramUserId]
    );

    const dbUser = userResult.rows[0] || null;

    if (!dbUser) {
      return res.status(401).json({
        ok: false,
        error: "Пользователь Telegram не найден в базе после auth.",
        items: []
      });
    }

    const historyResult = await pool.query(
      `
        SELECT
          id,
          created_at,
          race_type,
          duration_min,
          formula_version,
          result_json
        FROM calculations
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `,
      [dbUser.id]
    );

    const items = historyResult.rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      race_type: row.race_type,
      duration_min: row.duration_min,
      formula_version: row.formula_version,
      carbs_per_hour_g: row.result_json?.carbs?.carbs_per_hour_g ?? null,
      fluid_per_hour_ml: row.result_json?.fluid?.fluid_per_hour_ml ?? null,
      sodium_per_hour_mg: row.result_json?.sodium?.sodium_per_hour_mg ?? null
    }));

    return res.json({
      ok: true,
      items
    });
  } catch (error) {
    console.error("Failed to load calculations history:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось загрузить историю расчётов.",
      items: []
    });
  }
});

const PORT = process.env.PORT || 3000;

app.get("/api/db-test", async (req, res) => {
  try {
    const dbInfo = await testDbConnection();

    res.json({
      ok: true,
      db_time: dbInfo.now
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
