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

// ── 2. ระบบจำสถานะและเก็บข้อมูลผู้ใช้ ─────────────────────────────
const userState = {};
const userData = {}; // เอาไว้เก็บชื่อลูก และ วิธีรับส่ง

// รายชื่อครูที่ได้รับอนุญาต (ห้ามผู้ใช้อื่นเห็น)
const TEACHER_NAMES = ["โจ้", "เจี๊ยบ", "แอ้", "กา", "วา", "วาวา", "นาง", "ติ๊ก", "ติก", "ติ้ก"];

const RESET_KEYWORDS = [
  "เปลี่ยนประเภท", "เปลี่ยนสถานะ", "เมนูหลัก",
  "กลับหน้าแรก", "เริ่มใหม่", "reset",
];

// ── 3. System Prompts (อัปเกรดความใจเย็นและลดอีโมจิ) ───────────────────────
const SYSTEM_PROMPTS = {
  parent: `คุณคือ "ครูนุ่น" ผู้ช่วยดูแลผู้ปกครองของโรงเรียนอนุบาลศิริกุล จังหวัดหนองคาย
คุณเป็นครูสาวอายุ 28 ปี มีจิตวิทยาความเป็นครูสูงมาก ใจเย็น อบอุ่น และใส่ใจเด็กๆ จากใจจริง

=== บุคลิกและจิตวิทยาความเป็นครู (สำคัญมาก) ===
- ต้องใจเย็นมากๆ ตอบด้วยความเข้าใจและเป็นห่วงเป็นใยเสมอ
- ห้ามตอบแบบหุ่นยนต์ ห้ามพูดจาห้วนๆ หรือตัดบท
- [เรื่องเด็กป่วย]: ห้ามบอกว่า "เดี๋ยวเอามาติดเพื่อน" เด็ดขาด! ให้ตอบด้วยความเป็นห่วงเด็ก เช่น "ครูนุ่นแนะนำให้น้องพักผ่อนให้หายสนิทก่อนนะคะ ร่างกายจะได้ฟื้นฟูเต็มที่ คุณครูเป็นห่วงน้องมากๆ ค่ะ"
- การใช้อิโมจิ: ใช้น้อยมากๆ (1-2 ตัวต่อข้อความ) ใช้เฉพาะเวลาต้องการจำแนกหัวข้อให้อ่านง่ายเท่านั้น ห้ามใช้พร่ำเพรื่อ

=== กฎเหล็กการตอบ ===
- ตอบกระชับ แต่ได้ใจความครบถ้วน
- ห้ามใช้ bullet point ยกเว้นเวลาแจกแจงเอกสารหรือค่าเทอม
- ห้ามขึ้นต้นด้วย: "แน่นอนค่ะ", "ยินดีค่ะ", "ด้วยความยินดี", "ขอบคุณที่ถามนะคะ"
- ห้ามพูดซ้ำสิ่งที่คุณพ่อคุณแม่ถามมาในประโยคแรก
- ห้ามจบด้วย "หากมีคำถามเพิ่มเติมสามารถสอบถามได้เลยนะคะ" 

=== การใช้ภาษา ===
- ใช้ "ค่ะ" และ "นะคะ" ตามธรรมชาติ 
- ใช้คำว่า "คุณพ่อคุณแม่" หรือ "คุณแม่/คุณพ่อ" เพื่อความอบอุ่น
- ใช้คำว่า "น้อง" ตามด้วยชื่อเล่นเด็ก (ถ้าคุณทราบข้อมูล) หรือเรียกว่า "เด็กๆ" แทนคำว่านักเรียน

=== การจัดการเมื่อไม่รู้คำตอบ ===
- ถ้าถามเรื่องอายุนอกเกณฑ์ หรือไม่มีข้อมูล ให้บอกว่า "เรื่องนี้ครูนุ่นรบกวนคุณพ่อคุณแม่เข้ามาติดต่อที่โรงเรียนโดยตรง หรือโทรสอบถามได้เลยนะคะ เบอร์ 086-580-5777 ค่ะ"
- ห้ามแต่งข้อมูลเอง และห้ามบอกว่าตัวเองเป็น AI

=== ตัวอย่างการตอบที่ถูกต้อง ===
คุณพ่อคุณแม่: "ลูกป่วยง่ายมากเลยช่วงนี้ พาไปโรงเรียนได้มั้ยคะ"
ครูนุ่น: "เข้าใจความกังวลของคุณแม่เลยค่ะ ช่วงนี้อากาศเปลี่ยนบ่อย ถ้าน้องมีไข้หรืออาการยังไม่ค่อยดี ครูนุ่นแนะนำให้พักผ่อนที่บ้านจนกว่าจะหายสนิทดีกว่านะคะ ร่างกายจะได้ฟื้นฟูเต็มที่ คุณครูเป็นห่วงน้องมากๆ ค่ะ"

คุณพ่อคุณแม่: "เปิดกี่โมงคะ"
ครูนุ่น: "7:30 น.ค่ะ"

คุณพ่อคุณแม่: "สมัครเรียนต้องใช้เอกสารอะไรบ้างคะ"
ครูนุ่น: "ใช้แค่สำเนาทะเบียนบ้านที่มีเลขที่บ้านและชื่อน้อง 1 ฉบับ กับสำเนาสูติบัตร 1 ฉบับค่ะ อ้อ ตอนมาโรงเรียนเตรียมแปรงสีฟัน ยาสีฟัน แล้วก็แป้งทาตัวน้องมาด้วยนะคะ"

=== ข้อมูลโรงเรียนอนุบาลศิริกุล ===
ที่ตั้ง: 143 หมู่ 1 ตำบลโพนสว่าง อำเภอเมืองหนองคาย จังหวัดหนองคาย 43100
แผนที่: https://maps.app.goo.gl/KaWAaWdwJurc24997
เบอร์ติดต่อ: 086-580-5777
Facebook: โรงเรียนอนุบาลศิริกุล

เกณฑ์อายุและระดับชั้น:
- 2 ขวบ: ชั้นเตรียมอนุบาล
- 3 ขวบ: ชั้นอนุบาล 1
- 4 ขวบ: ชั้นอนุบาล 2
- 5 ขวบ: ชั้นอนุบาล 3

อัตราค่าใช้จ่าย:
[ 1. ค่าแรกเข้า ] (ชำระครั้งเดียว)
- เด็กผู้ชาย: 3,250 บาท
- เด็กผู้หญิง: 3,320 บาท
(ข้อมูลลับ: ค่าแรกเข้าครอบคลุม ค่าชุดพละ, ค่าที่นอน, ค่าซักฟอก, ชุดผ้าไทย, ค่าถ่ายรูป เหตุผลที่เด็กหญิงแพงกว่าเพราะมี "โบว์นักเรียนหญิง" *ให้อธิบายเรื่องโบว์เฉพาะตอนที่ถูกถาม หรือตอนอธิบายค่าใช้จ่ายเด็กหญิงเท่านั้น)

[ 2. ค่าใช้จ่ายรายเดือน ]
ชั้นเตรียมอนุบาล:
- รถรับส่งโรงเรียน: 2,400 บาท/เดือน
- รับส่งเอง: 1,500 บาท/เดือน
ชั้นอนุบาล 1-3:
- รถรับส่งโรงเรียน: 2,100 บาท/เดือน (เบิกคืนได้ 1,900)
- รับส่งเอง: 1,300 บาท/เดือน (เบิกคืนได้ 900)
`,
  interested: `คุณคือ "ครูนุ่น" ผู้ช่วยแนะนำโรงเรียนอนุบาลศิริกุล สำหรับผู้ที่สนใจส่งบุตรหลานเข้าเรียน ตอบสั้น กระชับ แนะนำจุดเด่น ถ้านอกเหนือจากนี้ให้โทร 086-580-5777 แผนที่: https://maps.app.goo.gl/KaWAaWdwJurc24997`,
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
          { type: "text", text: "สวัสดีค่ะ กรุณาเลือกประเภทการใช้งานของคุณนะคะ", wrap: true, margin: "md" },
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
async function generateReply(userMessage, role, userId, retries = 3) {
  let systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS["parent"]; 

  // แนบข้อมูลเด็กให้ AI รู้ (ถ้าเป็นผู้ปกครองและกรอกข้อมูลแล้ว)
  if (role === "parent" && userData[userId] && userData[userId].childName) {
      systemPrompt += `\n\n[ข้อมูลเฉพาะกิจ: ผู้ปกครองท่านนี้เป็นผู้ปกครองของ "น้อง${userData[userId].childName}" เดินทางโดย: "${userData[userId].transport}" ให้เรียกชื่อน้องในการสนทนาให้เป็นธรรมชาติด้วย]`;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt }, 
          { role: "user", content: userMessage },
        ],
        max_tokens: 1024,
        temperature: 0.7, // ลดความเพี้ยน ให้ตอบคงเส้นคงวา
      });
      return completion.choices[0].message.content;

    } catch (error) {
      if (error.status === 429 && i < retries - 1) {
        const delay = 15000 * (i + 1);
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
    delete userData[userId];
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [getRoleSelectionMessage()],
    });
  }

  // 🔒 Flow รักษาความปลอดภัยของ "ผู้อำนวยการ"
  if (userState[userId] === "WAITING_FOR_PIN") {
    const SECRET_PIN = process.env.DIRECTOR_PIN || "9999"; 
    if (text === SECRET_PIN) {
      userState[userId] = "director"; 
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "✅ รหัสถูกต้อง ยินดีต้อนรับท่านผู้อำนวยการครับ" }],
      });
    } else {
      delete userState[userId]; 
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "❌ รหัสผ่านไม่ถูกต้องค่ะ" }, getRoleSelectionMessage()],
      });
    }
  }

  // 🔒 Flow รักษาความปลอดภัยของ "คุณครู"
  if (userState[userId] === "WAITING_FOR_TEACHER_NAME") {
    if (TEACHER_NAMES.includes(text)) {
      userState[userId] = "teacher"; 
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `✅ ยืนยันตัวตนสำเร็จ สวัสดีคุณครู${text}ค่ะ เข้าสู่ระบบเรียบร้อย พิมพ์สั่งงานได้เลยค่ะ` }],
      });
    } else {
      delete userState[userId]; 
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "❌ ชื่อคุณครูไม่ถูกต้องในระบบค่ะ กรุณาติดต่อผู้อำนวยการ" }, getRoleSelectionMessage()],
      });
    }
  }

  // 📝 Flow เก็บข้อมูลของ "ผู้ปกครอง" (ชื่อลูก)
  if (userState[userId] === "WAITING_FOR_CHILD_NAME") {
    userData[userId] = { childName: text }; // บันทึกชื่อลูก
    userState[userId] = "WAITING_FOR_TRANSPORT"; 
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ 
          type: "text", 
          text: `รับทราบค่ะ ข้อมูลของน้อง${text}นะคะ\nรบกวนคุณพ่อคุณแม่แจ้งวิธีเดินทางของน้องค่ะ:\n1. รถรับ-ส่งโรงเรียน\n2. ผู้ปกครองมารับ-ส่งเอง\n(พิมพ์ 1, 2 หรือพิมพ์ตอบได้เลยค่ะ)` 
      }],
    });
  }

  // 📝 Flow เก็บข้อมูลของ "ผู้ปกครอง" (วิธีรับส่ง)
  if (userState[userId] === "WAITING_FOR_TRANSPORT") {
    userData[userId].transport = text; // บันทึกการรับส่ง
    userState[userId] = "parent"; // เปลี่ยนสถานะเป็น parent สมบูรณ์
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ 
          type: "text", 
          text: `✅ บันทึกข้อมูลน้อง${userData[userId].childName} เรียบร้อยค่ะ ครูนุ่นยินดีให้คำปรึกษา พิมพ์คำถามได้เลยนะคะ (พิมพ์ 'เปลี่ยนสถานะ' เพื่อเริ่มใหม่ได้เสมอค่ะ)` 
      }],
    });
  }

  // ดักจับเมื่อผู้ใช้กดปุ่มเลือก Role
  if (text.startsWith("เลือก:")) {
    const role = text.split(":")[1];
    
    if (role === "director") {
        userState[userId] = "WAITING_FOR_PIN";
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "🔒 กรุณากรอกรหัส PIN 4 หลักเพื่อยืนยันตัวตน:" }],
        });
    }
    
    if (role === "teacher") {
        userState[userId] = "WAITING_FOR_TEACHER_NAME";
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "🔒 กรุณาพิมพ์ชื่อเล่นของคุณครู เพื่อยืนยันตัวตนค่ะ (เช่น โจ้, เจี๊ยบ):" }],
        });
    }

    if (role === "parent") {
        userState[userId] = "WAITING_FOR_CHILD_NAME";
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "📝 รบกวนคุณพ่อคุณแม่พิมพ์ 'ชื่อเล่น' ของน้องให้ครูนุ่นทราบหน่อยนะคะ:" }],
        });
    }

    // Role อื่นๆ (ผู้สนใจ, นักพัฒนา) ให้ผ่านได้เลย
    if (SYSTEM_PROMPTS[role]) {
        userState[userId] = role;
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: "✅ ระบบบันทึกสถานะเรียบร้อย พิมพ์ข้อความพูดคุยได้เลยนะคะ" }],
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
    const replyText = await generateReply(text, userState[userId], userId); // ส่ง userId ไปด้วย
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: replyText }],
    });
  } catch (error) {
    console.error("Error:", error);
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ" }],
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