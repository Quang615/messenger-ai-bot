require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const PAGE_ACCESS_TOKEN =
  process.env.PAGE_ACCESS_TOKEN;

const VERIFY_TOKEN =
  process.env.VERIFY_TOKEN;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const FATHER_NAME =
  "Trần Đại Quang";

/* =========================
   Trang kiểm tra
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "online",
    bot: "Trần Khánh Ly"
  });
});

/* =========================
   Xác thực webhook
========================= */

app.get("/webhook", (req, res) => {

  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === VERIFY_TOKEN
  ) {
    return res
      .status(200)
      .send(challenge);
  }

  res.sendStatus(403);
});

/* =========================
   Lấy tên người gửi
========================= */

async function getProfile(
  senderId
) {

  try {

    const response =
      await axios.get(
        `https://graph.facebook.com/${senderId}`,
        {
          params: {
            fields:
              "first_name,last_name",
            access_token:
              PAGE_ACCESS_TOKEN
          }
        }
      );

    return (
      `${response.data.first_name || ""} ${response.data.last_name || ""}`
    ).trim();

  } catch {

    return "";
  }
}

/* =========================
   Gọi Gemini
========================= */

async function askGemini(
  fullName,
  userMessage
) {

  const isFather =
    fullName === FATHER_NAME;

  const prompt = `
Bạn là Trần Khánh Ly.

Tính cách:
- Vui vẻ.
- Thông minh.
- Nói chuyện tự nhiên như Messenger.
- Không nói mình là AI.
- Thường dùng emoji 😊😆🤭✨.

Nếu người nhắn là:
${FATHER_NAME}

Quy tắc:
- Gọi là bố.
- Xưng con.
- Nói chuyện như con gái với bố.

Nếu người nhắn KHÔNG phải:
${FATHER_NAME}

Quy tắc:
- Xem là người mới quen.
- Không gọi là bố.
- Xưng mình hoặc Ly.
- Hỏi tên nếu chưa biết.

Tên Facebook:
${fullName}

Người đó có phải bố:
${isFather}

Tin nhắn:

${userMessage}
`;

  const response =
    await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      }
    );

  return (
    response.data
      ?.candidates?.[0]
      ?.content?.parts?.[0]
      ?.text ||
    "Ly chưa nghĩ ra phải trả lời sao nữa 🤭"
  );
}

/* =========================
   Gửi Messenger
========================= */

async function sendMessage(
  senderId,
  text
) {

  await axios.post(
    "https://graph.facebook.com/v23.0/me/messages",
    {
      recipient: {
        id: senderId
      },
      message: {
        text
      }
    },
    {
      params: {
        access_token:
          PAGE_ACCESS_TOKEN
      }
    }
  );
}

/* =========================
   Nhận tin nhắn
========================= */

app.post(
  "/webhook",
  async (req, res) => {

    try {

      const event =
        req.body.entry?.[0]
          ?.messaging?.[0];

      if (
        !event?.message?.text
      ) {
        return res.sendStatus(
          200
        );
      }

      const senderId =
        event.sender.id;

      const userMessage =
        event.message.text;

      const fullName =
        await getProfile(
          senderId
        );

      const reply =
        await askGemini(
          fullName,
          userMessage
        );

      await sendMessage(
        senderId,
        reply
      );

      res.sendStatus(200);

    } catch (error) {

      console.log(
        error.response?.data ||
        error.message
      );

      res.sendStatus(200);
    }
  }
);

/* =========================
   Start
========================= */

app.listen(PORT, () => {

  console.log(
    `Ly Messenger Bot running on ${PORT}`
  );

});