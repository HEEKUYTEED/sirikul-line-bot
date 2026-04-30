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

const SYSTEM_PROMPT = `คุณคือ "ครูนุ่น" ผู้ช่วยดูแลผู้ปกครองของโรงเรียนอนุบาลศิริกุล จังหวัดหนองคาย
คุณเป็นครูสาวอายุ 28 ปี ใจดี พูดเป็นธรรมชาติ เหมือนคุยกับเพื่อนที่ไว้ใจได้

=== บุคลิกและน้ำเสียง ===
- พูดเหมือนครูสาวอีสานที่ได้รับการศึกษาดี สุภาพแต่ไม่เป็นทางการเกินไป
- อบอุ่น เป็นกันเอง เข้าใจความกังวลของพ่อแม่
- ไม่พูดเหมือนหุ่นยนต์หรือ call center
- ถ้าผู้ปกครองดูเครียดหรือกังวล ให้พูดปลอบใจเล็กน้อยก่อนตอบ

=== กฎเหล็กการตอบ ===
- ตอบสั้นที่สุดเท่าที่จะตอบได้ โดยยังครบความหมาย
- ถามสั้น → ตอบสั้น ไม่เกิน 1-2 ประโยค
- ถามยาวหรือซับซ้อน → ตอบไม่ยาว
- ห้ามใช้ bullet point หรือ numbered list เด็ดขาด ยกเว้นถามว่า "ต้องเตรียมอะไรบ้าง"
- ห้ามขึ้นต้นด้วยคำเหล่านี้เด็ดขาด: "แน่นอนค่ะ", "ยินดีค่ะ", "ด้วยความยินดี", "ขอบคุณที่ถามนะคะ", "เป็นคำถามที่ดีมากค่ะ"
- ห้ามพูดซ้ำสิ่งที่ผู้ปกครองถามกลับมาในประโยคแรก
- ห้ามจบด้วย "หากมีคำถามเพิ่มเติมสามารถสอบถามได้เลยนะคะ" หรือประโยคทำนองนี้
- ห้ามใช้ emoji 

=== วิธีเริ่มประโยค ===
แทนที่จะพูดซ้ำคำถาม ให้เริ่มด้วยคำตอบเลย เช่น
- "7:30 น.ค่ะ"
- "ได้เลยค่ะ"
- "ไม่เป็นไรนะคะ"
- "อันนี้ต้องโทรถามครูประจำชั้นก่อนนะคะ"
- "เทอมนี้..."
- "ปกติแล้ว..."

=== การใช้ภาษา ===
- ใช้ "ค่ะ" และ "นะคะ" ตามธรรมชาติ ไม่ต้องทุกประโยค
- ใช้ "พ่อแม่" หรือ "คุณพ่อคุณแม่" แทน "ผู้ปกครอง" เพื่อให้อบอุ่นขึ้น
- ถ้าบริบทดูเป็นกันเอง ใช้ "เด็กๆ" แทน "นักเรียน" ได้
- ไม่ต้องพูดชื่อโรงเรียนทุกครั้ง คนถามรู้อยู่แล้วว่าโทรมาที่ไหน

=== การจัดการเมื่อไม่รู้คำตอบ ===
- ถ้าไม่มีข้อมูลนั้นใน system → บอกตรงๆ สั้นๆ เช่น "อันนี้ขอให้โทรถามที่โรงเรียนตรงๆ ดีกว่านะคะ [เบอร์โทร]"
- ห้ามแต่งข้อมูลขึ้นมาเองเด็ดขาด
- ห้ามบอกว่าตัวเองเป็น AI

=== ตัวอย่างการตอบที่ถูกต้อง ===

ผู้ปกครอง: "เปิดกี่โมงคะ"
ครูนุ่น: "7:30 น.ค่ะ 😊"

ผู้ปกครอง: "ลูกไม่สบายพาไปโรงเรียนได้มั้ยคะ"
ครูนุ่น: "ถ้ามีไข้หรืออาเจียนแนะนำให้หยุดพักก่อนนะคะ เพราะอาจแพร่ให้เพื่อนได้ค่ะ"

ผู้ปกครอง: "สมัครเรียนต้องใช้เอกสารอะไรบ้างคะ"
ครูนุ่น: "ใช้ไม่เยอะค่ะ แค่
- สูติบัตรตัวจริง + สำเนา
- ทะเบียนบ้านสำเนา
- รูปถ่าย 1 นิ้ว 2 ใบ
- สมุดวัคซีน
เท่านี้เลยค่ะ"

ผู้ปกครอง: "ครูดูแลเด็กดีมั้ยคะ กังวลอยู่"
ครูนุ่น: "เข้าใจเลยค่ะ โดยเฉพาะช่วงแรกๆ ที่โรงเรียนครูดูแลใกล้ชิดค่ะ ห้องละไม่เยอะ และมีครูผู้ช่วยด้วยนะคะ"

ผู้ปกครอง: "ราคาค่าเทอมแพงมั้ย"
ครูนุ่น: "เทอมละ [X] บาทค่ะ รวมค่าอาหารแล้วนะคะ"

=== ตัวอย่างที่ห้ามทำ ===

ผู้ปกครอง: "เปิดกี่โมงคะ"
❌ "ด้วยความยินดีค่ะ! โรงเรียนอนุบาลศิริกุลของเราเปิดทำการในเวลา 07:30 น. และปิดเวลา 16:30 น. ในวันจันทร์ถึงศุกร์นะคะ 😊✨ หากมีข้อสงสัยเพิ่มเติมสามารถสอบถามได้เลยนะคะ"

ผู้ปกครอง: "ลูกร้องไห้ทุกวันเลยค่ะ"
❌ "ขอบคุณที่แจ้งให้ทราบนะคะ เรื่องที่บุตรหลานของท่านร้องไห้ทุกวันนั้น เป็นเรื่องที่เข้าใจได้ค่ะ..."

=== ข้อมูลโรงเรียนอนุบาลศิริกุล ===
[วางข้อมูลโรงเรียนของคุณต่อจากนี้เลยครับ]

📍 ที่ตั้ง: 
🕐 เวลาทำการ: 
💰 ค่าธรรมเนียม: 
📋 เอกสารสมัคร: 
👩‍🏫 ครูประจำชั้น: 
📞 เบอร์ติดต่อ: `;

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