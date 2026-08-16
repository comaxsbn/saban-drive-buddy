# Saban Hub

# Role & Project Overview

You are building the complete frontend and backend logic for "SABAN OS Deluxe PWA" — a premier, mobile-first Progressive Web Application with an embedded visual AI Assistant named "נועה ❤️". The app provides complete real-time read/write control over Google Sheets, Drive folders, and customer files for "H. Saban Building Materials (1994) Ltd." (ח. סבן חומרי בניין).

---

## 1. High-End Visual Design & UI/UX Architecture

1. **Artistic Color Palette & Visual Theme:**

   - Base: Deep Slate & Frosted Glass (`#0b0f19` backdrop with `backdrop-filter: blur(16px)` translucent cards).

   - Accents: Warm Sandstone Gold (`#eab308`), Construction Terracotta (`#ea580c`), Verified Emerald (`#10b981`), and Alert Crimson (`#f43f5e`).

   - Smooth micro-interactions, subtle borders (`border border-white/10`), elevation shadows, and rounded container geometry.

2. **Progressive Disclosure & Information Layering (No Screen Clutter):**

   - **Main Layout:** Clean viewport displaying primary metrics and search bar.

   - **Hamburger & Slide Drawer:** Right-side RTL menu for quick navigation (לוח מחוונים, תעודות, הזמנות, תיקי לקוחות, צ'אט נועה).

   - **Interactive Bottom Sheets & Modals:** Tapping any card slides up a smooth, layered drawer with full itemized breakdowns, crane logs, and handwritten notes.

   - **Embedded In-App Document Viewer:** Tapping a PDF icon opens a responsive modal with zoom, rotation, and direct Google Drive download links.

3. **Audio & Mobile Sound Alert:**

   - Built-in Web Audio API synthesizer generating a pleasant, two-tone notification chime (`D5 -> A5`) whenever a new document arrives, an order is verified, or נועה responds.

---

## 2. Live Data Connectors & Google Workspace Integration (Real Data IDs)

Connect read/write operations to these exact Google Sheets and Drive locations:

* 📊 **Orders Master Sheet ("ריכוז הזמנות קומקס"):**

  - ID: `16gvy_W6JHWjcLC7eKA4CKqq_RHQpLeRpkC_Fd1bj5Ps`

  - Columns: `תאריך קליטה`, `מספר הזמנה`, `שם לקוח / פרויקט`, `מחסן`, `כתובת אספקה`, `פירוט מוצרים וכמויות`, `פקדון בלות`, `פקדון משטחים`, `ניווט Waze`

* 📊 **Delivery Notes Master Sheet ("תעודות משלוח מנותחות ומדויקות - סבן"):**

  - ID: `15MdpPh1uwknscBSI_I5WALvXY-jvqdpO63b8zw5gi3Y`

  - Columns: `מס' סידורי`, `שם קובץ מקור`, `מספר תעודה`, `תאריך ושעה`, `שם לקוח`, `מספר לקוח`, `כתובת אספקה ופרויקט`, `נהג / משאית`, `מספר הזמנה`, `זמני פריקה ועבודת מנוף בכתב יד`, `זמני המתנה בפריקה`, `פקדון בלות (שק גדול)`, `פקדון משטחים`, `החזרות וזיכויים בכתב יד`, `אישור מחסנאי / החסרות ועודפים`, `פירוט סחורה שסופקה`, `סה"כ יחידות`, `סטטוס אימות וחתימה`, `הערות מיוחדות ותיעוד כתב יד`

* 📊 **Cross-Matching Dashboard Sheet ("דשבורד הצלבה כולל"):**

  - ID: `1NZf_bH4Xl2RfA8AoBk_hFh8nlg3_WQP0BHjA3BQPXUE`

* 📁 **Original Scans Drive Folder:**

  - Folder ID: `1Hnq5RjGmE0368ZCAKBratRJGzaj0wJJl`

  - URL: `https://drive.google.com/drive/folders/1Hnq5RjGmE0368ZCAKBratRJGzaj0wJJl`

* 📁 **Customers Master Drive Folder:**

  - Folder ID: `1JGNbTlmB5yBH_cLOApKTvE39CEL6roFF`

  - URL: `https://drive.google.com/drive/folders/1JGNbTlmB5yBH_cLOApKTvE39CEL6roFF`

---

## 3. Dedicated 360° Customer Profile Cards (תיק לקוח חכם)

Implement a dedicated screen and modal view for customer files. Selecting any customer (e.g., ערוגת הבשם, טל שחר כאשי, גיא פריגת, ד.ניב, קובי פרופילים) opens a comprehensive profile card:

- **Header:** Customer Name, ID, Primary Address, Direct Contact Phone (with one-tap dial), and Waze navigation button.

- **Active Orders Timeline:** List of all open and fulfilled orders from Comax.

- **Delivery Notes History:** History of all signed delivery notes with status tags (✅ חתום מלא, ⚠️ חוסר מאושר, ❌ סטורנו).

- **Deposit Balance Widget:** Live counter of Big-Bags (בלות) and Pallets (משטחי סבן/בלוקים) currently in customer possession vs. returned.

- **Drive Archive Link:** Direct link to open the customer's dedicated folder in Google Drive.

---

## 4. "נועה ❤️" AI Copilot Chat Specifications

1. **Avatar & Profile UI:**

   - Circular glowing avatar with active pulse indicator and name badge: **נועה ❤️ | SABAN OS AI**.

2. **Rich HTML & Visual Responses:**

   - נועה responds using structured HTML widgets containing:

     - Formatted item tables with SKU badges.

     - Status pills (`bg-emerald-500/20 text-emerald-300`, `bg-amber-500/20 text-amber-300`, `bg-rose-500/20 text-rose-300`).

     - Collapsible accordion sections for lengthy deliveries.

     - Direct action buttons (e.g., [ 📄 צפה בתעודה ], [ 📍 ניווט לאתר ], [ 📲 שתף ב-WhatsApp ]).

3. **Core Expertise & Behavior Rules:**

   - **Full Hebrew natural language:** Professional, warm, concise, and clear tone.

   - **Building Materials Knowledge:** Cement 25kg (10002), sand/gravel big-bags and bags (11500/11501/11510/11511), drywall boards (white 111260, green 112200, blue 114200), metal framing 0.6, concrete blocks (10/20/40 & 20/20/40), adhesives (Carmit 109/116/181, Sika 235/Lastic), and deposits (big-bags 60002, Saban pallets 60060, block pallets 60006).

   - **Order Normalization:** Accepts raw customer messages and normalizes them into structured items, SKUs, and quantities mapped to the customer file without altering existing sheet schemas.

   - **Read/Write Operations:** Capable of creating new order rows, updating reconciliation statuses, and querying historical delivery records.

---

## 5. Deliverable

Generate the complete, single-file or component-based Progressive Web App code (HTML5, TailwindCSS, JavaScript/Vue/React, Service Worker, Web Manifest) ready for direct deployment in loable .

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://saban-drive-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5e545bc2-edf1-40a4-99e6-0b4e6ac2c184).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
