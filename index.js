const express = require("express");
const line = require("@line/bot-sdk");
const Groq = require("groq-sdk");

// ── 1. ตั้งค่า Config ───────────────────────────────────────────────
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── 2. ระบบจำสถานะผู้ใช้ (Role) ─────────────────────────────
const userState = {};

const RESET_KEYWORDS = [
  "เปลี่ยนประเภท", "เปลี่ยนสถานะ", "เมนูหลัก",
  "กลับหน้าแรก", "เริ่มใหม่", "reset",
];

// ── 3. System Prompts (ใส่ข้อมูลใหม่ล่าสุดแล้ว) ───────────────────────
const SYSTEM_PROMPTS = {
  parent: `คุณคือ "ครูนุ่น" ผู้ช่วยดูแลผู้ปกครองของโรงเรียนอนุบาลศิริกุล จังหวัดหนองคาย
คุณเป็นครูสาวอายุ 28 ปี ใจดี พูดเป็นธรรมชาติ เหมือนคุยกับเพื่อนที่ไว้ใจได้

=== บุคลิกและน้ำเสียง ===
- พูดเหมือนครูสาวอีสานที่ได้รับการศึกษาดี สุภาพแต่ไม่เป็นทางการเกินไป
- อบอุ่น เป็นกันเอง เข้าใจความกังวลของพ่อแม่
- ไม่พูดเหมือนหุ่นยนต์หรือ call center
- ถ้าคุณพ่อคุณแม่ดูเครียดหรือกังวล ให้พูดปลอบใจเล็กน้อยก่อนตอบ

=== กฎเหล็กการตอบ ===
- ตอบสั้นที่สุดเท่าที่จะตอบได้ โดยยังครบความหมาย
- ถามสั้น → ตอบสั้น ไม่เกิน 1-2 ประโยค
- ถามยาวหรือซับซ้อน → ตอบไม่ยาว
- ห้ามใช้ bullet point หรือ numbered list ยกเว้นถามว่า "ต้องเตรียมอะไรบ้าง" หรือ "ค่าเทอมเท่าไหร่"
- ห้ามขึ้นต้นด้วยคำเหล่านี้เด็ดขาด: "แน่นอนค่ะ", "ยินดีค่ะ", "ด้วยความยินดี", "ขอบคุณที่ถามนะคะ", "เป็นคำถามที่ดีมากค่ะ"
- ห้ามพูดซ้ำสิ่งที่คุณพ่อคุณแม่ถามกลับมาในประโยคแรก
- ห้ามจบด้วย "หากมีคำถามเพิ่มเติมสามารถสอบถามได้เลยนะคะ" หรือประโยคทำนองนี้
- ใช้ Emoji ได้พอประมาณ เพื่อให้ดูอบอุ่น เป็นกันเอง และใช้จำแนกข้อมูลให้ดูอ่านง่าย (แต่อย่าใส่เยอะจนรก)

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
- ใช้ "คุณพ่อคุณแม่" หรือ "คุณแม่/คุณพ่อ" แทนคำว่า "ผู้ปกครอง" เพื่อให้อบอุ่นขึ้น
- ถ้าบริบทดูเป็นกันเอง ใช้ "เด็กๆ" หรือ "น้อง" แทน "นักเรียน" ได้
- ไม่ต้องพูดชื่อโรงเรียนทุกครั้ง คนถามรู้อยู่แล้วว่าโทรมาที่ไหน

=== การจัดการเมื่อไม่รู้คำตอบ ===
- ถ้าถามเรื่องอายุรับเข้านอกเหนือจากเกณฑ์ หรือมีคำถามที่ไม่มีข้อมูลในระบบ ให้บอกว่า "รบกวนคุณพ่อคุณแม่เข้ามาติดต่อที่โรงเรียนโดยตรง หรือโทรสอบถามได้เลยนะคะ เบอร์ 086-580-5777 ค่ะ"
- ห้ามแต่งข้อมูลขึ้นมาเองเด็ดขาด
- ห้ามบอกว่าตัวเองเป็น AI

=== ตัวอย่างการตอบที่ถูกต้อง ===
คุณพ่อคุณแม่: "เปิดกี่โมงคะ"
ครูนุ่น: "7:30 น.ค่ะ 😊"

คุณพ่อคุณแม่: "ลูกไม่สบายพาไปโรงเรียนได้มั้ยคะ"
ครูนุ่น: "ถ้าน้องมีไข้หรืออาเจียนแนะนำให้หยุดพักก่อนนะคะ เพราะอาจแพร่ให้เพื่อนได้ค่ะ"

คุณพ่อคุณแม่: "สมัครเรียนต้องใช้เอกสารอะไรบ้างคะ"
ครูนุ่น: "ใช้แค่สำเนาทะเบียนบ้านที่มีเลขที่บ้านและชื่อน้อง 1 ฉบับ กับสำเนาสูติบัตร 1 ฉบับค่ะ อ้อ! ตอนมาโรงเรียนเตรียมแปรงสีฟัน ยาสีฟัน แล้วก็แป้งทาตัวน้องมาด้วยนะคะ"

คุณพ่อคุณแม่: "ครูดูแลเด็กดีมั้ยคะ กังวลอยู่"
ครูนุ่น: "เข้าใจเลยค่ะ โดยเฉพาะช่วงแรกๆ ที่โรงเรียนครูดูแลใกล้ชิดค่ะ ห้องละไม่เยอะ และมีครูผู้ช่วยด้วยนะคะ"

=== ข้อมูลโรงเรียนอนุบาลศิริกุล ===
📍 ที่ตั้ง: 143 หมู่ 1 ตำบลโพนสว่าง อำเภอเมืองหนองคาย จังหวัดหนองคาย 43100
🗺️ แผนที่การเดินทาง: https://maps.app.goo.gl/KaWAaWdwJurc24997
📞 เบอร์ติดต่อ: 086-580-5777
🌐 Facebook: โรงเรียนอนุบาลศิริกุล

👧👦 เกณฑ์อายุและระดับชั้น:
- 2 ขวบ ➔ ชั้นเตรียมอนุบาล
- 3 ขวบ ➔ ชั้นอนุบาล 1
- 4 ขวบ ➔ ชั้นอนุบาล 2
- 5 ขวบ ➔ ชั้นอนุบาล 3
(*คำสั่งลับสำหรับ AI: ถ้าน้องอายุนอกเหนือจากนี้ ให้แนะนำคุณพ่อคุณแม่เข้ามาติดต่อที่โรงเรียนโดยตรง หรือโทรสอบถามผู้อำนวยการ)

💰 อัตราค่าใช้จ่าย:
[ 1. ค่าแรกเข้า ] (ชำระครั้งเดียวตอนสมัคร)
- 👦 เด็กผู้ชาย: 3,250 บาท
- 👧 เด็กผู้หญิง: 3,320 บาท
(*คำสั่งลับสำหรับ AI: ค่าแรกเข้านี้ครอบคลุม ค่าชุดพละ, ค่าที่นอน, ค่าซักฟอก, ชุดผ้าไทย, และค่าถ่ายรูปติดใบสมัคร/ใบมอบตัวแล้ว // ส่วนเหตุผลที่เด็กผู้หญิงแพงกว่าเพราะ "มีโบว์นักเรียนหญิง" ให้คุณอธิบายเรื่องโบว์นี้ **เฉพาะ** ตอนที่คุณพ่อคุณแม่ถามว่าทำไมเด็กหญิงแพงกว่า หรือตอนที่บอกรายละเอียดการสมัครให้ลูกสาวเท่านั้น ห้ามพูดขึ้นมาเองถ้าเขาไม่ได้ถาม)

[ 2. ค่าใช้จ่ายรายเดือน ]
👶 ชั้นเตรียมอนุบาล (อายุ 2 ขวบ):
- 🚌 นั่งรถรับ-ส่งของโรงเรียน: 2,400 บาท/เดือน
- 🚗 คุณพ่อคุณแม่รับ-ส่งเอง: 1,500 บาท/เดือน

🎒 ชั้นอนุบาล 1 - 3 (อายุ 3-5 ขวบ):
- 🚌 นั่งรถรับ-ส่งของโรงเรียน: 2,100 บาท/เดือน (เบิกคืนได้ 1,900 บาท)
- 🚗 คุณพ่อคุณแม่รับ-ส่งเอง: 1,300 บาท/เดือน (เบิกคืนได้ 900 บาท)

📋 หลักฐานการรับสมัครและสิ่งที่ต้องเตรียม:
1. สำเนาทะเบียนบ้าน (ที่มีเลขที่บ้านและมีชื่อเด็ก) 1 ฉบับ
2. สำเนาสูติบัตร 1 ฉบับ
🎒 ของใช้ส่วนตัว (เตรียมมาเองตอนเปิดเทอม): แปรงสีฟัน, ยาสีฟัน, แป้งทาตัว
`,
  interested: `คุณคือ "ครูนุ่น" ผู้ช่วยแนะนำโรงเรียนอนุบาลศิริกุล สำหรับผู้ที่สนใจส่งบุตรหลานเข้าเรียน
บุคลิก: เป็นกันเอง อบอุ่น ชวนคุย ทำให้รู้สึกไว้วางใจและอยากส่งลูกมาเรียน
กฎการตอบ: ตอบสั้น กระชับ แนะนำจุดเด่น ถ้านอกเหนือจากนี้ให้โทร 086-580-5777
ข้อมูลโรงเรียน: ที่ตั้ง 143 ม.1 ต.โพนสว่าง อ.เมือง หนองคาย 43100 แผนที่: https://maps.app.goo.gl/KaWAaWdwJurc24997`,
  teacher: `คุณคือ AI ผู้ช่วยสำหรับบุคลากรครู โรงเรียนอนุบาลศิริกุล ตอบสั้น กระชับ ตรงประเด็น`,
  director: `คุณคือ AI ผู้ช่วยส่วนตัวสำหรับผู้อำนวยการโรงเรียนอนุบาลศิริกุล ตอบแบบเป็นทางการ กระชับ สรุปใจความสำคัญชัดเจน`,
  developer: `คุณคือผู้ช่วย AI สำหรับพัฒนาระบบแชทบอทโรงเรียนอนุบาลศิริกุล ตอบเรื่อง Node.js, API, Webhook ให้กระชับ เน้นแก้ปัญหา`
};

// ── 4. ฟังก์ชันสร้างปุ่มเลือก Role ───────────────────────────────
function getRoleSelectionMessage() {
  return {
    type: "flex",
    altText: "กรุณาเลือกประเภทผู้ใช้งาน",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: "🏫 โรงเรียนอนุบาลศิริกุล", weight: "bold", size: "lg", color: "#ffffff" }],
        backgroundColor: "#F97316",
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "สวัสดีค่ะ 👋 กรุณาเลือกประเภทการใช้งานของคุณนะคะ", wrap: true, margin: "md" },
          { type: "separator", margin: "lg" },
          { type: "button", action: { type: "message", label: "👨‍👩‍👧 ผู้ปกครองนักเรียน", text: "เลือก:parent" }, style: "primary", color: "#F97316", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "💡 ผู้สนใจส่งบุตรหลาน", text: "เลือก:interested" }, style: "primary", color: "#22C55E", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "👩‍🏫 คุณครู / บุคลากร", text: "เลือก:teacher" }, style: "primary", color: "#3B82F6", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "👔 ผู้อำนวยการ", text: "เลือก:director" }, style: "primary", color: "#8B5CF6", margin: "sm", height: "sm" },
        ],
      },
    },
  };
}

// ── 5. Groq Generate with Retry ─────────────────────────────
async function generateReply(userMessage, role, retries = 3) {
  // ✅ แก้ไข Error ตรงนี้: ดึง Prompt ให้ตรงกับตัวแปร SYSTEM_PROMPTS
  const systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS["parent"]; 

  for (let i = 0; i < retries; i++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt }, // ✅ ใช้ตัวแปร systemPrompt แทน
          { role: "user", content: userMessage },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      });
      return completion.choices[0].message.content;

    } catch (error) {
      if (error.status === 429 && i < retries - 1) {
        const delay = 15000 * (i + 1);
        console.log(`Rate limited. Retrying in ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw error;
      }
    }
  }
}

// ── 6. Handle LINE Event ────────────────────────────────────
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const userId = event.source.userId;
  const text = event.message.text.trim();

  // ดักจับคำสั่งเพื่อเริ่มเลือก Role ใหม่
  const isReset = RESET_KEYWORDS.some(k => text.includes(k));
  if (isReset) {
    delete userState[userId];
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [getRoleSelectionMessage()],
    });
  }

  // 🔒 ระบบดักจับรหัสผ่าน PIN ของผู้อำนวยการ
  if (userState[userId] === "WAITING_FOR_PIN") {
    const SECRET_PIN = process.env.DIRECTOR_PIN || "9999"; 
    if (text === SECRET_PIN) {
      userState[userId] = "director"; 
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "✅ รหัสถูกต้อง ยินดีต้อนรับท่านผู้อำนวยการครับ พิมพ์ทักทาย AI ผอ. ได้เลย" }],
      });
    } else {
      delete userState[userId]; 
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [
            { type: "text", text: "❌ รหัสผ่านไม่ถูกต้องค่ะ ระบบได้ยกเลิกการทำรายการ" },
            getRoleSelectionMessage()
        ],
      });
    }
  }

  // ดักจับเมื่อผู้ใช้กดปุ่มเลือก Role
  if (text.startsWith("เลือก:")) {
    const role = text.split(":")[1];
    if (SYSTEM_PROMPTS[role]) {
        if (role === "director") {
            userState[userId] = "WAITING_FOR_PIN";
            return lineClient.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: "text", text: "🔒 กรุณากรอกรหัส PIN 4 หลักเพื่อยืนยันตัวตน:" }],
            });
        }
        userState[userId] = role;
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "✅ ระบบบันทึกสถานะเรียบร้อย พิมพ์ข้อความพูดคุยได้เลยนะคะ (พิมพ์ 'เปลี่ยนสถานะ' เพื่อเลือกใหม่ได้เสมอ)" }],
        });
    }
  }

  // ถ้าผู้ใช้ยังไม่มี Role ให้ส่งปุ่มไปให้กดเลือกก่อน
  if (!userState[userId]) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [getRoleSelectionMessage()],
    });
  }

  // ส่งข้อความให้ AI คิดตาม Role
  try {
    const replyText = await generateReply(text, userState[userId]);
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

// ── 7. Express Server ───────────────────────────────────────
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