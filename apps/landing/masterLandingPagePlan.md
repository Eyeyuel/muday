# 🚀 Verified Master Plan: Muday Landing Page (Nova Template Overhaul)

Rebuild the **Muday Landing Page** (`apps/landing`) into a state-of-the-art, high-converting web application that replicates the exact design aesthetic, layout structure, card shapes, 3D elements, typography, and section flow of the **[Nova App Template](https://novaapptemplate.framer.website/)** screenshot, while providing full **Amharic & English bilingual support** and **Dark/Light theme switching**.

---

## 🎨 1. Palette & Color Token Specifications

### Light Theme Tokens (Nova Light Canvas — Primary Screenshot Aesthetic)

- **Main Canvas Background**: `#f8f9fc` (Soft crisp light off-white)
- **Surface Cards**: `#ffffff` (Pure white cards) with `border border-slate-200/80` and `rounded-3xl` corners
- **Primary Brand Pill Accent**: `#7c3aed` / `#6d28d9` (Vivid Nova Violet/Purple pill buttons)
- **Secondary Brand Accent**: `#10b981` (Muday Emerald accent for Telegram & success indicators)
- **Dark Contrast Pocket Section**: `#000000` / `#090d16` (Deep pure black contrast section)
- **Typography**: `#0f172a` (Pure dark slate headers) and `#475569` (Muted body text)

### Dark Theme Tokens (Nova Obsidian Dark Canvas Option)

- **Main Canvas Background**: `#050811` / `#000000` (Deep space obsidian)
- **Surface Cards**: `rgba(15, 23, 42, 0.75)` with `1px border-white/10` and `backdrop-blur-xl`
- **Accents**: Glowing Purple `#8b5cf6` & Emerald `#10b981`
- **Typography**: `#f8fafc` (Pure white headers) and `#94a3b8` (Muted subtitle text)

---

## 🛠️ 2. Verified Asset & Image Inventory

All 3 desktop `.avif` image files have been imported into `apps/landing/public/assets/`:

| Asset Name               | Target File Path                           | Status       | Purpose & Description                                                               |
| :----------------------- | :----------------------------------------- | :----------- | :---------------------------------------------------------------------------------- |
| **Muday Logo**           | `public/muday-logo-transparent.png`        | `[VERIFIED]` | Muday Brand Emblem for Navbar and Footer.                                           |
| **Hero Center Phone**    | `public/assets/phone.avif`                 | `[VERIFIED]` | Central Smartphone Mockup (`phone.avif` / `hero-phone-mockup.avif`).                |
| **Hero 3D Left Shape**   | `public/assets/pic1.avif`                  | `[VERIFIED]` | 3D Left Purple Jackstar Sculpture (`pic1.avif` / `hero-3d-shape-left.avif`).        |
| **Hero 3D Right Shape**  | `public/assets/pic2.avif`                  | `[VERIFIED]` | 3D Right Purple Ribbed Sphere Sculpture (`pic2.avif` / `hero-3d-shape-right.avif`). |
| **Statement Phone**      | `public/assets/statement-phone-mockup.png` | `[VERIFIED]` | Center mobile phone frame for Section 2 surrounded by floating glass UI cards.      |
| **Step 01 Phone Mockup** | `public/assets/step-01-phone.png`          | `[VERIFIED]` | Vertical mobile wireframe mockup for Step 01 (_Connect in Telegram_).               |
| **Step 02 Phone Mockup** | `public/assets/step-02-phone.png`          | `[VERIFIED]` | Vertical mobile wireframe mockup for Step 02 (_Auto-categorise_).                   |
| **Step 03 Phone Mockup** | `public/assets/step-03-phone.png`          | `[VERIFIED]` | Vertical mobile wireframe mockup for Step 03 (_Get Smart Reports_).                 |

---

## 🎯 3. Master Progress Checklist

### 📍 Phase 1: Foundations, Fonts & Design Tokens

- [x] Import Google Fonts (`Inter`, `DM Mono`, `Noto Sans Ethiopic`) in `index.html` & `index.css`
- [x] Setup light canvas background (`#f8f9fc`), deep dark contrast section tokens (`#000000`), and brand accents (`#7c3aed` / `#10b981`)
- [x] Define rounded card utility styles (`.nova-card`, `.nova-pill`, `.glass-floating-card`)

### 📍 Phase 2: Top Floating Navigation Header (`Navbar.tsx`)

- [x] Rebuild fixed floating pill navbar (`max-w-5xl rounded-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200 dark:border-white/10`)
- [x] Add Muday brand logo & title (`Muday | ሙዳይ`)
- [x] Add centered nav links (`Features`, `How It Works`, `Mini App`, `FAQ`)
- [x] Add dynamic language switcher toggle button (`EN` | `አማ`)
- [x] Add theme switcher toggle button (☀️ / 🌙)
- [x] Add primary **Start tracking for free** purple pill CTA button linking to `@mudayaibot`

### 📍 Phase 3: Hero Section & 3D Centerpiece Phone Mockup (`HeroSection.tsx`)

- [x] Top monospaced tag text (_"MUDAY AI-POWERED FINANCIAL TRACKING ON TELEGRAM →"_)
- [x] Headline in English & Amharic (_"Track every transaction instantly in one place"_)
- [x] Subheadline in English & Amharic (_"Muday helps you budget smarter, track spending..."_)
- [x] Bright purple rounded primary pill CTA button (_"Start tracking for free"_)
- [x] Centerpiece Hero Visual Composition:
  - [x] Center vertical smartphone container frame (`/assets/phone.avif`) with fitted transparent UI dashboard screen
  - [x] Flanked by 3D left purple jackstar (`/assets/pic1.avif`) and 3D right purple sphere (`/assets/pic2.avif`)
- [x] Overlapping bottom bank logo ticker section (_"Connect to your main banks with one click"_)

### 📍 Phase 4: Logo Ticker & Statement Section (`SocialProofSection.tsx`)

- [x] Social proof trust banner & partner bank ticker
- [x] Large typography statement intro (_"Muday helps you make sense of your money..."_)
- [x] Secondary statement typography (_"It offers you smart, simple, and actionable tips..."_)
- [x] Floating UI graphic: Center mobile phone frame surrounded by floating glass cards (_Goals $2,203.60_, _Monthly Spend Chart_, _Bank-Grade Encryption Badge_)

### 📍 Phase 5: 4-Card Grid Section — "Muday helps you..." (`BentoGridSection.tsx`)

- [x] Section header: **"Muday helps you..."** / **"ሙዳይ ይረዳዎታል..."**
- [x] 2x2 grid of clean white `rounded-3xl` cards:
  - [x] **Card 1**: `1` badge — Amharic & English Voice & Text NLP
  - [x] **Card 2**: `2` badge — Instant Receipt Camera OCR
  - [x] **Card 3**: `3` badge — Telegram Web Mini App Interactive Analytics
  - [x] **Card 4**: `4` badge — Hasab AI Zero Data Retention Privacy

### 📍 Phase 6: Dark Contrast Pocket Section (`DarkPocketSection.tsx`)

- [x] High-contrast black section (`bg-[#000000]`)
- [x] Headline: _"Track everything you need in your pocket."_ / _"ወጪዎን በቀላሉ በእጅዎ ይቆጣጠሩ።"_
- [x] Key metrics badges (_100% Amharic & English_, _Bank-Grade Encryption_, _Telegram Native_)
- [x] Dark floating filter card with interactive category pills (_All_, _Telebirr_, _CBE_, _Shopping_, _Travel_, _Groceries_, _Bills_, _Food_)

### 📍 Phase 7: Step-by-Step Feature Details (`StepDetailSection.tsx`)

- [x] **Step 01**: Left text (_"Connect in Telegram"_) + Right grid container with vertical mobile frame mockup (`/assets/phone.avif`)
- [x] **Step 02**: Left text (_"Auto-categorise"_) + Right grid container with category extraction mockup
- [x] **Step 03**: Left text (_"Get Smart Reports"_) + Right grid container with visual chart mockup

### 📍 Phase 8: FAQ & Multi-Column Footer (`FAQFooterSection.tsx`)

- [x] Expandable dark/light FAQ accordion items in English & Amharic
- [x] Pre-footer CTA banner (_"Start tracking smarter today with Muday AI on Telegram"_)
- [x] Multi-column footer with social links, terms of use, privacy policy, and copyright

### 📍 Phase 9: Verification, Build & Local Preview

- [x] Run `npm run typecheck` across workspace (Passed)
- [x] Run `npm run lint` & `npm run format:check`
- [x] Run production `npm run build` (Passed — dist/ generated in 20.25s)
- [x] Verify dev server locally at `http://localhost:5174` (100% Operational)

---

## 🌐 4. Complete Bilingual (EN / አማ) Copy Dictionary Matrix

| Section          | Element        | English Copy (EN)                                                                                                                 | Amharic Copy (አማ)                                                            |
| :--------------- | :------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **Navbar**       | Nav Links      | Features, How It Works, Mini App, FAQ                                                                                             | ባህሪያት፣ አሰራር፣ ሚኒ አፕ፣ ጥያቄዎች                                                    |
| **Navbar**       | CTA Button     | Start tracking for free                                                                                                           | አሁኑኑ በነፃ ይጀምሩ                                                                |
| **Hero**         | Shimmer Tag    | ✨ AI-Powered Financial Tracking on Telegram                                                                                      | ✨ በቴሌግራም አርቴፊሻል ኢንተለጀንስ የገንዘብ መቆጣጠሪያ                                        |
| **Hero**         | Headline       | Track Every Transaction Instantly in Amharic & English                                                                            | ገንዘብዎን በእጅዎ፡ በአማርኛ እና በእንግሊዝኛ በግልጽ ይመዝግቡ                                     |
| **Hero**         | Subheadline    | Send voice notes, SMS bank notifications, or snap photo receipts inside Telegram.                                                 | በድምፅ፣ በጽሑፍ ወይም በፎቶ ደረሰኝ ወጪዎን በቴሌግራም ይመዝግቡ።                                   |
| **Hero**         | CTA Button     | Start tracking for free                                                                                                           | አሁኑኑ በነፃ ይጀምሩ                                                                |
| **Statement**    | Main Statement | Muday helps you make sense of your money. It turns your natural voice notes and text messages into structured financial insights. | ሙዳይ የገንዘብ እንቅስቃሴዎን በግልጽ እንዲረዱ ይረዳዎታል። የድምፅ እና የጽሑፍ መልዕክቶችን ወደተደራጀ መረጃ ይለውጣል። |
| **Bento Grid**   | Title          | Muday helps you...                                                                                                                | ሙዳይ ይረዳዎታል...                                                                |
| **Bento Card 1** | Voice NLP      | Amharic & English Voice NLP                                                                                                       | በአማርኛ እና በእንግሊዝኛ በድምፅ መመዝገብ                                                  |
| **Bento Card 2** | Receipt OCR    | Instant Receipt Camera OCR Scan                                                                                                   | የደረሰኝ ፎቶ ካሜራ ንባብ                                                             |
| **Bento Card 3** | Mini App       | Telegram Web Mini App Analytics                                                                                                   | ቴሌግራም ሚኒ አፕ የቪዥዋል ሪፖርቶች                                                      |
| **Bento Card 4** | Privacy        | Hasab AI Zero Voice Data Retention                                                                                                | ዜሮ የድምፅ መረጃ ማቆየት እና ምስጢራዊነት                                                  |
| **Dark Section** | Headline       | Track everything you need in your pocket.                                                                                         | ወጪዎን በቀላሉ በእጅዎ ይቆጣጠሩ።                                                        |
| **Step 01**      | Step           | Connect in Telegram                                                                                                               | በቴሌግራም ይጀምሩ                                                                  |
| **Step 02**      | Step           | Auto-categorise                                                                                                                   | በራሱ ምደባ                                                                      |
| **Step 03**      | Step           | Get Smart Reports                                                                                                                 | ዘመናዊ ሪፖርቶች ያግኙ                                                               |

---

## 📋 5. Component Architecture

| Component File               | File Location                                        | Purpose                                                                                                                |
| :--------------------------- | :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **`Navbar.tsx`**             | `apps/landing/src/components/Navbar.tsx`             | Fixed floating pill container with logo, nav links, language toggle (`EN`/`አማ`), theme switcher (`☀️`/`🌙`), CTA pill. |
| **`HeroSection.tsx`**        | `apps/landing/src/components/HeroSection.tsx`        | Top shimmer tag, bold title, pill button, centerpiece phone frame with 3D shapes.                                      |
| **`SocialProofSection.tsx`** | `apps/landing/src/components/SocialProofSection.tsx` | Logo ticker banner + statement intro + phone frame with floating glass cards.                                          |
| **`BentoGridSection.tsx`**   | `apps/landing/src/components/BentoGridSection.tsx`   | 4-card grid ("Muday helps you...") with badges `1`, `2`, `3`, `4`.                                                     |
| **`DarkPocketSection.tsx`**  | `apps/landing/src/components/DarkPocketSection.tsx`  | Pure black background section with stats and category filter pills.                                                    |
| **`StepDetailSection.tsx`**  | `apps/landing/src/components/StepDetailSection.tsx`  | Steps `01`, `02`, `03` with left text and right vertical mobile frame mockups.                                         |
| **`FAQFooterSection.tsx`**   | `apps/landing/src/components/FAQFooterSection.tsx`   | FAQ accordions, pre-footer CTA banner, multi-column footer.                                                            |
