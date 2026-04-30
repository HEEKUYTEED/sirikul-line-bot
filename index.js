const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

// 1. ตั้งค่ากุญแจ LINE สำหรับ Webhook
const middlewareConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// 2. ตั้งค่าสมอง Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: "คุณคือ AI ผู้ช่วยอัจฉริยะของโรงเรียนอนุบาลศิริกุล จังหวัดหนองคาย มีหน้าที่ตอบคำถามผู้ปกครองอย่างสุภาพ อ่อนโยน เข้าอกเข้าใจ และให้ข้อมูลที่ถูกต้องเกี่ยวกับการเรียนการสอน กิจกรรม และระเบียบการของโรงเรียน",
});

// 3. สร้างตัวส่งข้อความกลับของ LINE (อัปเดตเป็นโค้ดเวอร์ชันใหม่ล่าสุด)
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

// 4. สร้างจุดรับข้อความ (Webhook)
app.post('/webhook', line.middleware(middlewareConfig), (req, reqRes) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => reqRes.json(result))
    .catch((err) => {
      console.error(err);
      reqRes.status(500).end();
    });
});

// 5. ฟังก์ชันคิดและตอบกลับ
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  try {
    // ส่งข้อความไปให้ Gemini คิด
    const result = await model.generateContent(event.message.text);
    const response = await result.response;
    const replyText = response.text();

    // ส่งคำตอบกลับไปหาผู้ปกครองใน LINE (อัปเดตเป็นโค้ดเวอร์ชันใหม่ล่าสุด)
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: replyText,
      }],
    });
  } catch (error) {
    console.error("Error from Gemini:", error);
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: 'ขออภัยค่ะ ตอนนี้ระบบกำลังประมวลผลหนัก รบกวนพิมพ์ถามใหม่อีกครั้งนะคะ',
      }],
    });
  }
}

// 6. เปิดเครื่องเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`เซิร์ฟเวอร์โรงเรียนอนุบาลศิริกุล เปิดใช้งานแล้วที่พอร์ต ${PORT}`);
});