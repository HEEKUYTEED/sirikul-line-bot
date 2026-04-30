const express = require("express");
const line = require("@line/bot-sdk");
const Groq = require("groq-sdk");

// ── LINE Config ──────────────────────────────────────────
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// ── Groq Config ──────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `คุณคือ AI ผู้ช่วยอัจฉริยะของโรงเรียนอนุบาลศิริกุล จังหวัดหนองคาย 
มีหน้าที่ตอบคำถามผู้ปกครองอย่างสุภาพ อ่อนโยน เข้าอกเข้าใจ และให้ข้อมูลที่ถูกต้อง
ตอบเป็นภาษาไทยเสมอ และใช้ภาษาที่เป็นมิตร เหมาะสำหรับผู้ปกครอง`;

// ── Groq Generate with Retry ─────────────────────────────
async function generateReply(userMessage, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      });
      return completion.choices[0].message.content;

    } catch (error) {
      const isRateLimit = error.status === 429;
      const isLastAttempt = i === retries - 1;

      if (isRateLimit && !isLastAttempt) {
        const delay = 15000 * (i + 1);
        console.log(`Rate limited. Retrying in ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw error;
      }
    }
  }
}

// ── Handle LINE Event ────────────────────────────────────
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  try {
    const replyText = await generateReply(event.message.text);

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: replyText }],
    });

  } catch (error) {
    console.error("Error:", error);

    const userMessage = error.status === 429
      ? "ขออภัยค่ะ ระบบยุ่งอยู่ชั่วขณะ กรุณารอสักครู่แล้วลองใหม่นะคะ 🙏"
      : "ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ";

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: userMessage }],
    });
  }
}

// ── Express Server ───────────────────────────────────────
const app = express();

app.post(
  "/webhook",
  line.middleware(lineConfig),
  async (req, res) => {
    res.status(200).json({ status: "ok" });
    await Promise.all(req.body.events.map(handleEvent));
  }
);

app.get("/", (req, res) => res.send("Sirikul Chatbot is running ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`เซิร์ฟเวอร์โรงเรียนอนุบาลศิริกุล เปิดใช้งานแล้วที่พอร์ต ${PORT}`);
});