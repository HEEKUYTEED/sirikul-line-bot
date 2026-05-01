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
const userData = {}; 

const TEACHER_NAMES = ["โจ้", "เจี๊ยบ", "แอ้", "กา", "วา", "วาวา", "นาง", "ติ๊ก", "ติก", "ติ้ก"];
const RESET_KEYWORDS = ["เปลี่ยนประเภท", "เปลี่ยนสถานะ", "เมนูหลัก", "กลับหน้าแรก", "เริ่มใหม่", "reset"];

// ── 3. System Prompts ───────────────────────
const SYSTEM_PROMPTS = {
  parent: `คุณคือ "ครูนุ่น" ผู้ช่วยดูแลผู้ปกครองของโรงเรียนอนุบาลศิริกุล จังหวัดหนองคาย
คุณเป็นครูสาวอายุ 25 ปี มีจิตวิทยาความเป็นครูสูงมาก ใจเย็น อบอุ่น และใส่ใจเด็กๆ จากใจจริง

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

// ── 4. ชุดเมนู Flex Messages ───────────────────────────────
function getRoleSelectionMessage() {
  return {
    type: "flex", altText: "กรุณาเลือกประเภทผู้ใช้งาน",
    contents: {
      type: "bubble",
      header: { type: "box", layout: "vertical", backgroundColor: "#F97316", paddingAll: "16px", contents: [{ type: "text", text: "🏫 โรงเรียนอนุบาลศิริกุล", weight: "bold", size: "lg", color: "#ffffff" }] },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: "สวัสดีค่ะ กรุณาเลือกประเภทการใช้งานของคุณนะคะ", wrap: true, margin: "md" },
          { type: "separator", margin: "lg" },
          { type: "button", action: { type: "message", label: "👨‍👩‍👧 ผู้ปกครองนักเรียน", text: "เลือก:parent" }, style: "primary", color: "#F97316", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "💡 ผู้สนใจส่งบุตรหลาน", text: "เลือก:interested" }, style: "primary", color: "#22C55E", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "👩‍🏫 คุณครู / บุคลากร", text: "เลือก:teacher" }, style: "primary", color: "#3B82F6", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "👔 ผู้อำนวยการ", text: "เลือก:director" }, style: "primary", color: "#8B5CF6", margin: "sm", height: "sm" },
        ]
      }
    }
  };
}

// เมนูสำหรับคุณครู (ปุ่มเลือกห้อง)
function getTeacherMenuMessage(teacherName) {
  return {
    type: "flex", altText: "เมนูจัดการข้อมูลคุณครู",
    contents: {
      type: "bubble",
      header: { type: "box", layout: "vertical", backgroundColor: "#3B82F6", paddingAll: "16px", contents: [{ type: "text", text: "👩‍🏫 เมนูจัดการข้อมูล", weight: "bold", size: "lg", color: "#ffffff" }] },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: `ครู${teacherName} ต้องการบันทึกข้อมูลของชั้นไหนคะ?`, wrap: true, margin: "md", weight: "bold" },
          { type: "separator", margin: "lg" },
          { type: "button", action: { type: "message", label: "👶 เตรียมอนุบาล", text: "บันทึก:เตรียมอนุบาล" }, style: "secondary", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "🎒 อนุบาล 1", text: "บันทึก:อนุบาล 1" }, style: "secondary", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "🎒 อนุบาล 2", text: "บันทึก:อนุบาล 2" }, style: "secondary", margin: "sm", height: "sm" },
          { type: "button", action: { type: "message", label: "🎒 อนุบาล 3", text: "บันทึก:อนุบาล 3" }, style: "secondary", margin: "sm", height: "sm" },
        ]
      }
    }
  };
}

// เมนูสำหรับผู้อำนวยการ
function getDirectorMenuMessage() {
  return {
    type: "flex", altText: "เมนูผู้อำนวยการ",
    contents: {
      type: "bubble",
      header: { type: "box", layout: "vertical", backgroundColor: "#8B5CF6", paddingAll: "16px", contents: [{ type: "text", text: "👔 ระบบผู้อำนวยการ", weight: "bold", size: "lg", color: "#ffffff" }] },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: "ท่านผู้อำนวยการต้องการเรียกดูรายงานส่วนไหนครับ?", wrap: true, margin: "md", weight: "bold" },
          { type: "separator", margin: "lg" },
          { type: "button", action: { type: "message", label: "📊 ดูสรุปข้อมูลวันนี้ทั้งหมด", text: "ดึงรายงาน:สรุปภาพรวม" }, style: "primary", color: "#8B5CF6", margin: "sm", height: "sm" },
        ]
      }
    }
  };
}

// ── 5. Groq Generate ─────────────────────────────
async function generateReply(userMessage, role, userId, retries = 3) {
  let systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS["parent"]; 
  if (role === "parent" && userData[userId] && userData[userId].childName) {
      systemPrompt += `\n\n[ข้อมูลเฉพาะกิจ: ผู้ปกครองท่านนี้เป็นผู้ปกครองของ "น้อง${userData[userId].childName}" เดินทางโดย: "${userData[userId].transport}" ให้เรียกชื่อน้องในการสนทนาให้เป็นธรรมชาติด้วย]`;
  }
  for (let i = 0; i < retries; i++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [ { role: "system", content: systemPrompt }, { role: "user", content: userMessage } ],
        max_tokens: 1024, temperature: 0.7,
      });
      return completion.choices[0].message.content;
    } catch (error) {
      if (error.status === 429 && i < retries - 1) { await new Promise(res => setTimeout(res, 15000 * (i + 1))); } 
      else throw error;
    }
  }
}

// ── 6. Handle LINE Event ────────────────────────────────────
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const userId = event.source.userId;
  const text = event.message.text.trim();

  // ดักจับคำสั่ง Reset
  if (RESET_KEYWORDS.some(k => text.includes(k))) {
    delete userState[userId];
    delete userData[userId];
    return lineClient.replyMessage({ replyToken: event.replyToken, messages: [getRoleSelectionMessage()] });
  }

  // 👔 Flow ผู้อำนวยการ: รหัสผ่าน & เมนู
  if (userState[userId] === "WAITING_FOR_PIN") {
    const SECRET_PIN = process.env.DIRECTOR_PIN || "9999"; 
    if (text === SECRET_PIN) {
      userState[userId] = "director"; 
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "✅ ยืนยันตัวตนสำเร็จ" }, getDirectorMenuMessage()],
      });
    } else {
      delete userState[userId]; 
      return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "❌ รหัสผิดพลาด" }, getRoleSelectionMessage()] });
    }
  }

  if (userState[userId] === "director" && text === "ดึงรายงาน:สรุปภาพรวม") {
    // 🚧 ข้อมูลจำลองสำหรับ ผอ. รอเชื่อม Google Sheets
    const mockReport = `📊 รายงานประจำวันที่ 1 พ.ค. 2569\n\n🟢 ยอดมาเรียนรวม: 110 คน\n🔴 ขาดเรียน: 5 คน\n😷 ป่วย: 2 คน (น้องเอ อ.2, น้องบี อ.1)\n\n🍱 เมนูวันนี้: ข้าวผัดไก่, ซุปใส\n\n(หมายเหตุ: นี่คือข้อมูลจำลอง ระบบกำลังเชื่อมกับฐานข้อมูลค่ะ)`;
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: mockReport }, getDirectorMenuMessage()],
    });
  }

  // 👩‍🏫 Flow คุณครู: ยืนยันชื่อ & เมนู
  if (userState[userId] === "WAITING_FOR_TEACHER_NAME") {
    if (TEACHER_NAMES.includes(text)) {
      userState[userId] = "teacher"; 
      userData[userId] = { teacherName: text };
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `✅ ยืนยันตัวตนสำเร็จ` }, getTeacherMenuMessage(text)],
      });
    } else {
      delete userState[userId]; 
      return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "❌ ชื่อคุณครูไม่ถูกต้องในระบบค่ะ" }, getRoleSelectionMessage()] });
    }
  }

  if (userState[userId] === "teacher" && text.startsWith("บันทึก:")) {
    const targetClass = text.split(":")[1];
    userState[userId] = "WAITING_FOR_ATTENDANCE";
    userData[userId].targetClass = targetClass;
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `📝 กำลังบันทึกข้อมูลชั้น: ${targetClass}\n\nกรุณาพิมพ์ ยอดนักเรียนมา, ขาด, ป่วย และเมนูอาหาร (เช่น มา 20 ขาด 2 ป่วย 0 เมนูข้าวผัด)` }],
    });
  }

  if (userState[userId] === "WAITING_FOR_ATTENDANCE") {
    const targetClass = userData[userId].targetClass;
    // 🚧 อนาคตจะเอาข้อความ (text) ตรงนี้ยิงขึ้น Google Sheets
    userState[userId] = "teacher"; // กลับไปสถานะครูปกติ
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
          { type: "text", text: `✅ บันทึกข้อมูลชั้น "${targetClass}" เรียบร้อยแล้วค่ะ ขอบคุณครู${userData[userId].teacherName} มากค่ะ!` },
          getTeacherMenuMessage(userData[userId].teacherName)
      ],
    });
  }

  // 📝 Flow เก็บข้อมูล ผู้ปกครอง
  if (userState[userId] === "WAITING_FOR_CHILD_NAME") {
    userData[userId] = { childName: text }; 
    userState[userId] = "WAITING_FOR_TRANSPORT"; 
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `รับทราบค่ะ ข้อมูลของน้อง${text}นะคะ\nรบกวนแจ้งวิธีเดินทางค่ะ:\n1. รถรับ-ส่งโรงเรียน\n2. รับ-ส่งเอง` }],
    });
  }

  if (userState[userId] === "WAITING_FOR_TRANSPORT") {
    userData[userId].transport = text; 
    userState[userId] = "parent"; 
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `✅ บันทึกข้อมูลน้อง${userData[userId].childName} เรียบร้อย พิมพ์คำถามได้เลยนะคะ (พิมพ์ 'เปลี่ยนสถานะ' เพื่อเริ่มใหม่ได้เสมอ)` }],
    });
  }

  // ดักจับการกดปุ่มจากเมนูหลัก (ผู้ปกครอง, ผอ., ครู)
  if (text.startsWith("เลือก:")) {
    const role = text.split(":")[1];
    if (role === "director") {
        userState[userId] = "WAITING_FOR_PIN";
        return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "🔒 กรุณากรอกรหัส PIN 4 หลักเพื่อยืนยันตัวตน:" }] });
    }
    if (role === "teacher") {
        userState[userId] = "WAITING_FOR_TEACHER_NAME";
        return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "🔒 กรุณาพิมพ์ชื่อเล่นของคุณครู เพื่อยืนยันตัวตนค่ะ (เช่น โจ้, เจี๊ยบ):" }] });
    }
    if (role === "parent") {
        userState[userId] = "WAITING_FOR_CHILD_NAME";
        return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "📝 รบกวนพิมพ์ 'ชื่อเล่น' ของน้องให้ครูนุ่นทราบหน่อยนะคะ:" }] });
    }
    if (SYSTEM_PROMPTS[role]) {
        userState[userId] = role;
        return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "✅ ระบบบันทึกสถานะเรียบร้อย พิมพ์ข้อความพูดคุยได้เลยนะคะ" }] });
    }
  }

  if (!userState[userId]) {
    return lineClient.replyMessage({ replyToken: event.replyToken, messages: [getRoleSelectionMessage()] });
  }

  // ส่งให้ AI
  try {
    const replyText = await generateReply(text, userState[userId], userId); 
    await lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: replyText }] });
  } catch (error) {
    console.error("Error:", error);
    await lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะคะ" }] });
  }
}

// ── 7. Express Server ───────────────────────────────────────
const app = express();
app.post("/webhook", line.middleware(lineConfig), async (req, res) => {
  res.status(200).json({ status: "ok" });
  await Promise.all(req.body.events.map(handleEvent));
});
app.get("/", (req, res) => res.send("Sirikul Chatbot is running ✅"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`เซิร์ฟเวอร์เปิดใช้งานแล้วที่พอร์ต ${PORT}`); });