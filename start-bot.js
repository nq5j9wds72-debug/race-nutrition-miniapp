const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL || "https://race-nutrition-miniapp.onrender.com";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is required");
  process.exit(1);
}

function sendTelegramMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text
    });

    const options = {
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function handleTelegramUpdate(update) {
  const message = update && update.message;
  const text = message && typeof message.text === "string" ? message.text.trim() : "";
  const chatId = message && message.chat && message.chat.id;

  if (!chatId) {
    return Promise.resolve();
  }

  if (text === "/start") {
    const replyText =
      "Привет. Это Race Nutrition Mini App.\n\n" +
      "Здесь можно быстро рассчитать план питания на гонку:\n" +
      "углеводы, жидкость и натрий по твоим параметрам.\n\n" +
      "Нажми кнопку «План питания» слева от поля ввода, чтобы открыть приложение.\n\n" +
      `Ссылка: ${APP_URL}`;

    return sendTelegramMessage(chatId, replyText);
  }

  return Promise.resolve();
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/telegram-webhook") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const update = JSON.parse(body || "{}");
        await handleTelegramUpdate(update);

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        console.error("telegram webhook error", error);
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "Webhook failed" }));
      }
    });

    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Start bot listening on port ${PORT}`);
});