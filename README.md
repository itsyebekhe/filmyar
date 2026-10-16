<div align="center">

# 🎬 فیلمیار | Filmyar
### سامانه جامع سینما، ربات تلگرام و مینی‌اپلیکیشن پخش آنلاین

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare_D1-0051C3?style=for-the-badge&logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot_API-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/gpl-3.0)

<p align="center">
  <b>فیلمیار</b> یک پلتفرم دوگانه، مدرن و Serverless برای آرشیو، تماشای آنلاین و دانلود مستقیم فیلم و سریال است که با زیرساخت پرسرعت <b>Cloudflare Workers Edge</b>، دیتابیس <b>Cloudflare D1</b> و معماری ماژولار بدون سرور (Serverless) توسعه یافته است.
</p>

[ویژگی‌ها](#-ویژگی‌های-کلیدی) •
[ساختار پروژه](#-ساختار-ماژولار-پروژه) •
[نصب و راه‌اندازی](#-نصب-و-راه‌اندازی-سریع) •
[گیت‌هاب اکشنز](#-استقرار-خودکار-با-github-actions) •
[دستورات ربات](#-دستورات-ربات-تلگرام)

</div>

---

## ✨ ویژگی‌های کلیدی

### 🌐 وب‌اپلیکیشن و مینی‌اپ (Standalone & Telegram Mini App)
- **پخش آنلاین درون‌برنامه‌ای (In-App Player):** امکان تماشای مستقیم فیلم و قسمت‌های سریال بدون نیاز به دانلود فایل با پلیر HTML5 واکنش‌گرا.
- **عملکرد مستقل در مرورگر:** قابل اجرا در تمام مرورگرها (کروم، سافاری، موبایل و دسکتاپ) بدون وابستگی اجباری به تلگرام.
- **ورود سریع و بدون محدودیت دامنه با تلگرام:** احراز هویت یک‌کلیکه از طریق ربات تلگرام بدون خطای دامنه (`Bot domain invalid`) بر روی تمامی دامنه‌ها و `*.workers.dev`.
- **دانلود آزاد برای مهمانان:** امکان استریم و دانلود مستقیم بدون نیاز به ورود (ورود فقط برای ثبت تاریخچه و نشان‌شده‌ها).
- **دیپ‌لینک و اشتراک‌گذاری هوشمند (`#/tt...`):** باز شدن مستقیم مدال فیلم با اشتراک‌گذاری لینک به همراه پشتیبانی از Web Share API.
- **دسته‌بندی و فیلتر ژانرها:** اسلایدر افقی انتخاب ژانر (اکشن، کمدی، ترسناک، علمی‌تخیلی، درام، انیمیشن و...).
- **جستجوی آنی با Debounce:** جستجوی پرسرعت در کسری از ثانیه در میان هزاران فیلم و سریال.

### 🤖 ربات تلگرام هوشمند
- **طراحی شیشه‌ای و اینلاین مدرن:** ناوبری روان با کیبوردهای شیشه‌ای بدون ارسال پیام‌های تکراری و مزاحم.
- **موتور خزنده هوشمند (Dual Scraper Engine):** واکشی خودکار لینک‌های مستقیم از سرورهای آرشیو و Film2Media همراه با اعتبارسنجی سخت‌گیرانه نام فایل، سال ساخت و نوع مدیا (جلوگیری ۱۰۰٪ از لینک‌های اشتباه).
- **اتصال به پایگاه داده جهانی TMDb:** دریافت تصاویر پوستر، بک‌دراپ، امتیاز دقیق، ژانر، اسامی ستارگان، خلاصه داستان فارسی و تریلر رسمی.
- **دسته‌بندی نسخه‌ها:** پشتیبانی هوشمند از نسخه‌های دوبله فارسی، زیرنویس چسبیده (SoftSub/HardSub) و زبان اصلی.
- **قفل عضویت اجباری کانال (Force Join):** مدیریت آسان کانال‌های اسپانسر از طریق دستورات اختصاصی ادمین.
- **جستجوی اینلاین در چت‌ها:** امکان پیشنهاد و ارسال فیلم در هر گفتگویی با تایپ `@BotUsername`.

---

## 📁 ساختار ماژولار پروژه

```text
├── .github/
│   └── workflows/
│       └── deploy.yml        # پایپ‌لاین استقرار خودکار بر روی Cloudflare
├── schema.sql                # ساختار جداول دیتابیس Cloudflare D1
├── package.json              # مدیریت وابستگی‌ها و اسکریپت‌ها
├── wrangler.toml             # پیکربندی سرویس Cloudflare Workers
└── src/
    ├── config/
    │   └── constants.js      # تعاریف ثابت، نگاشت‌ها و متغیرهای عمومی
    ├── db/
    │   └── database.js       # کوئری‌های تعامل با پایگاه داده D1
    ├── services/
    │   ├── tmdb.js           # ارتباط با API پایگاه بین‌المللی TMDb
    │   └── scraper.js        # موتور استخراج هوشمند لینک‌های مستقیم
    ├── telegram/
    │   ├── api.js            # فراخوانی متدهای رسمی تلگرام و بررسی عضویت
    │   └── bot.js            # کنترلر دستورات، پیام‌ها و کالبک‌های ربات
    ├── utils/
    │   └── helpers.js        # توابع اعتبارسنجی هش تلگرام، پالایش لینک و تمیزکاری
    ├── views/
    │   └── webApp.js         # فرانت‌اند کامل تک‌صفحه‌ای (Tailwind CSS + JS)
    └── index.js              # ورودی وب‌هووک تلگرام و REST API وب‌اپ
```

---

## 🚀 نصب و راه‌اندازی سریع

### ۱. پیش‌نیازها
- نصب [Node.js](https://nodejs.org/) نسخه 20 یا بالاتر
- حساب کاربری در [Cloudflare](https://dash.cloudflare.com/)
- دریافت توکن ربات تلگرام از [@BotFather](https://t.me/BotFather)
- دریافت کلید API رایگان از [TMDb](https://www.themoviedb.org/settings/api)

### ۲. کلون و نصب وابستگی‌ها
```bash
git clone https://github.com/YOUR_USERNAME/filmyar.git
cd filmyar
npm install
```

### ۳. ساخت پایگاه داده D1 در کلودفلر
```bash
npx wrangler d1 create filmyar_db
```
شناسه `database_id` نمایش داده‌شده را بردارید و ساختار اولیه جداول را ایجاد کنید:
```bash
npm run db:init:remote
```

### ۴. اجرای محلی (Local Development)
فایل `.dev.vars` را در ریشه پروژه بسازید:
```ini
BOT_TOKEN="توکن_ربات_تلگرام"
TMDB_API_KEY="کلید_tmdb"
BOT_USERNAME="IrFilmyarBot"
ADMIN_CHAT_ID="1035839739"
REQUEST_GROUP_ID="-1003799745191"
```
سپس اجرا کنید:
```bash
npm run dev
```

---

## 🔒 استقرار خودکار با GitHub Actions

این مخزن به گونه‌ای امن طراحی شده که **هیچ کلید، شناسه یا رمزی در کد منبع یا گیت عمومی قرار نمی‌گیرد**.

در مخزن گیت‌هاب خود به مسیر **Settings > Secrets and variables > Actions** بروید و سکرت‌های زیر را اضافه کنید:

| نام سکرت (Secret Name) | توضیح |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | توکن دسترسی کلودفلر با دسترسی‌های Workers و D1 |
| `CLOUDFLARE_ACCOUNT_ID` | شناسه حساب Cloudflare Account ID |
| `D1_DATABASE_ID` | شناسه UUID دیتابیس ساخته‌شده `filmyar_db` |
| `BOT_TOKEN` | توکن دریافتی از BotFather |
| `BOT_USERNAME` | یوزرنیم ربات بدون @ (مثلاً: `IrFilmyarBot`) |
| `TMDB_API_KEY` | کلید API وبسایت TMDb |
| `ADMIN_CHAT_ID` | شناسه عددی ادمین اصلی ربات |
| `REQUEST_GROUP_ID` | شناسه گروه تلگرام پشتیبانی / درخواست فیلم |

با هر بار `git push` به شاخه `main`، گیت‌هاب اکشنز به صورت کامپایل‌شده و با امنیت کامل پروژه شما را در سرورهای لبه کلودفلر مستقر می‌کند.

### تنظیم وب‌هووک تلگرام
پس از استقرار اولیه، یک بار دستور زیر را در ترمینال اجرا کنید:
```bash
curl -F "url=https://YOUR_WORKER_SUBDOMAIN.workers.dev" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

## 📄 لایسنس (پروانه انتشار)

این پروژه تحت پروانه نرم‌افزار آزاد **[GNU General Public License v3.0 (GPL-3.0)](LICENSE)** منتشر شده است. شما آزاد هستید که این نرم‌افزار را مطالعه، ویرایش و بازتوزیع فرمایید، مشروط بر اینکه هرگونه نسخه مشتق‌شده نیز به صورت آزاد و تحت همین پروانه (GPL v3) منتشر شود.