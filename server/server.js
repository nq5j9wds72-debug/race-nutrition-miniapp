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

// main nutrition calculation route (stub v1)
app.post("/api/calc", (req, res) => {
  const input = req.body || {};

  return res.json({
    ok: true,
    errors: [],
    warnings: [],
    normalized_input: {
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
    },
    result: {
      carbs: {
        carbs_per_hour_g: 0,
        carbs_total_g: 0,
        carb_interval_min: 0,
        carbs_per_intake_g: 0
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
        gels_per_hour_est: 0,
        gels_total_est: 0,
        gel_basis_g: 25
      }
    },
    plan: {
      summary: "Расчёт пока не подключён.",
      plan_steps: [
        "Сервер принял данные успешно.",
        "Следующим шагом подключим реальные формулы расчёта."
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});