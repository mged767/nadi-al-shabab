# نادي الشباب — النشر على Netlify مع بيانات حية

## 📁 وين أضع الكود بالضبط

```
nadi-al-shabab/                    ← جذر المشروع (هذا اللي ترفعه لـ Netlify)
├── index.html
├── css/
├── js/
├── data/
├── images/
├── netlify.toml                   ← 1) ملف الإعدادات (جذر المشروع)
└── netlify/
    └── functions/
        ├── matches.py             ← 2) الدالة نفسها
        └── requirements.txt       ← 3) مكتبات بايثون المطلوبة للدالة
```

هذا كل شيء. لا تحتاج تشغّل أي سيرفر بنفسك — Netlify يشغّل `matches.py` تلقائيًا كـ Function عند الطلب.

## خطوات الربط (3 خطوات فقط)

### 1) ارفع المشروع لـ Netlify
اسحب المجلد كامل إلى Netlify (Drag & Drop) أو اربطه بـ Git — بنفس البنية أعلاه بالضبط، لا تغيّر أسماء المجلدات `netlify/functions`.

### 2) ضع مفتاح API-Football كمتغيّر بيئة (مو داخل الكود)
من لوحة تحكم Netlify:
**Site configuration → Environment variables → Add a variable**
- Key: `API_FOOTBALL_KEY`
- Value: مفتاحك من `https://dashboard.api-football.com`

ثم اعمل Redeploy للموقع حتى يقرأ المتغيّر الجديد.

### 3) خلاص — الموقع يشتغل تلقائيًا
بعد النشر، رابط الدالة يصير جاهز تلقائيًا على:
```
https://اسم-موقعك.netlify.app/.netlify/functions/matches
```
وملف `js/matches.js` عندي مضبوط مسبقًا على هذا المسار النسبي `/.netlify/functions/matches` — ما تحتاج تعدّل أي شيء فيه، يشتغل لوحده بعد الرفع.

## للتجربة محليًا قبل الرفع (اختياري)
```bash
npm install -g netlify-cli
netlify dev
```
هذا يشغّل الموقع + الـ Functions محليًا بنفس سلوك الإنتاج على `http://localhost:8888`.

## إذا الدالة ما اشتغلت
افتح مباشرة في المتصفح:
```
https://اسم-موقعك.netlify.app/.netlify/functions/matches
```
لو رجّع `{"error": "..."}` يعطيك سبب المشكلة (غالبًا المفتاح ناقص أو غلط). لو رجّع بيانات JSON فيها `standings` و`results` و`fixtures` فهو شغّال تمام، والموقع بيعرضها تلقائيًا.

إذا الدالة غير متاحة لأي سبب، الموقع يرجع تلقائيًا لبيانات `data/matches.json` المحلية بدون ما ينكسر.

---

## ⚠️ صور اللاعبين
لسه غير مؤكدة الاسم-للصورة 100% لأن الملفات الأصلية ما كانت معنونة. أرسل قائمة أسماء مقابل كل صورة عشان أصححها بدقة.

## تاريخ النادي والمعرض
`data/history.json` مبني من مصدرك الدقيق. `images/gallery/` فيها 8 صور حقيقية.
