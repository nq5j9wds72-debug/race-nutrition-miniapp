const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// health check
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// auth stub (пока без проверки подписи)
app.post("/api/auth", (req, res) => {
  const initData = String(req.body?.initData || "");
  res.json({
    ok: true,
    received: initData.length,
    hasInitData: initData.length > 0,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});