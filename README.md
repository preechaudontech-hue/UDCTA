# ระบบเช็คชื่อเข้าแถว + ตรวจเครื่องแต่งกาย นักเรียนทุน กสศ.

แผนกเทคโนโลยีสารสนเทศ วิทยาลัยเทคนิคอุดรธานี

## รันบนเครื่อง (development)

1. สมัครบัญชี Postgres ฟรีที่ [neon.tech](https://neon.tech) แล้วสร้างโปรเจกต์/ฐานข้อมูล คัดลอก connection string (เลือกแบบ "Pooled connection" ก็ได้)
2. คัดลอก `.env.example` เป็น `.env` แล้วนำ connection string ไปใส่ในตัวแปร `DATABASE_URL`
3. ติดตั้ง dependencies:
   ```bash
   npm install
   ```
4. รันเซิร์ฟเวอร์:
   ```bash
   npm start
   ```
5. เปิดเบราว์เซอร์ที่ `http://localhost:3000`

ระบบจะสร้างตารางที่จำเป็นในฐานข้อมูลให้อัตโนมัติเมื่อเริ่มรันครั้งแรก

ถ้าแก้ไฟล์ `views/*.ejs` หรือ `public/src/input.css` ต้องรันคำสั่งนี้เพื่อคอมไพล์ Tailwind ใหม่ก่อนดูผล (หรือใช้ `npm start` ซึ่งรันให้อัตโนมัติ):
```bash
npm run build
```

## Deploy ขึ้น Vercel (ฟรี) ผ่าน GitHub

1. Push โค้ดนี้ขึ้น GitHub repository (repo ควร private เพราะมีข้อมูลเกี่ยวกับนักเรียน)
2. ที่ [vercel.com](https://vercel.com) เลือก **Add New Project** แล้วเชื่อมกับ repo นี้ — Vercel จะตรวจพบ `vercel.json` และ `api/index.js` อัตโนมัติ ไม่ต้องตั้งค่า Build/Output เพิ่มเติม
3. ก่อน deploy ให้รัน `npm run build` ในเครื่องแล้ว commit ไฟล์ `public/style.css` ที่อัปเดตด้วยเสมอ (repo นี้ commit ไฟล์ที่ build แล้วไว้ เพราะการตั้งค่า `vercel.json` แบบ builds/routes ที่ใช้ที่นี่จะไม่รัน `npm run build` ให้อัตโนมัติ)
4. ใน Vercel ไปที่ **Settings → Environment Variables** ตั้งค่า `DATABASE_URL` เป็น connection string จาก Neon (แนะนำให้สร้างฐานข้อมูล Neon แยกสำหรับ production ไม่ใช้ตัวเดียวกับตอน dev)
5. Deploy — ข้อมูลเก็บอยู่ใน Neon (ภายนอก) ระบบจึงทำงานได้ปกติแม้ Vercel functions จะเป็นแบบ serverless (ไม่มี state ค้างในเครื่อง)

### ทางเลือก: Deploy ขึ้น Render แทน

1. Push โค้ดขึ้น GitHub เหมือนข้างต้น
2. ที่ [render.com](https://render.com) สร้าง **New Web Service** แล้วเชื่อมกับ repo นี้
   - Build Command: `npm install && npm run build`
   - Start Command: `node server.js`
3. ตั้งค่า `DATABASE_URL` ใน Environment Variables เหมือนกับขั้นตอน Vercel ด้านบน

## การใช้งาน

1. หน้า **นำเข้ารายชื่อ** — อัปโหลดไฟล์ Excel/CSV รายชื่อนักเรียนทุน กสศ. (คอลัมน์: รหัสนักศึกษา, ชื่อ-สกุล, ระดับชั้น/ห้อง, สาขาวิชา)
2. หน้า **หน้าแรก** — เลือกวันที่และห้อง เพื่อไปหน้าเช็คชื่อ
3. หน้า **เช็คชื่อ** — เลือกสถานะเข้าแถว (มา/สาย/ขาด) และผลตรวจเครื่องแต่งกายแต่ละรายการต่อคน แล้วกด "บันทึกทั้งหมด"
4. หน้า **รายงาน** — สรุปจำนวนวันมา/สาย/ขาด และจำนวนครั้งที่แต่งกายไม่ผ่าน ตามช่วงวันที่ที่เลือก พร้อมดาวน์โหลด CSV
