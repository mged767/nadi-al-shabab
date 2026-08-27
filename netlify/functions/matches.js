// المكان بالضبط: netlify/functions/matches.js
// هذا الملف يستخدم API مجاني تماماً (FotMob) ولا يحتاج لأي مفتاح (API Key) ولا اشتراكات!

const TEAM_ID = "101916"; // معرّف نادي الشباب
const LEAGUE_ID = "536"; // معرّف الدوري السعودي للمحترفين

// دالة لجلب البيانات من FotMob بطريقة تحاكي المتصفح
async function fetchFotmob(endpoint) {
  const url = `https://www.fotmob.com/api/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Accept-Language": "ar,en-US;q=0.9,en;q=0.8" // لطلب البيانات باللغة العربية إن أمكن
    }
  });
  
  if (!res.ok) throw new Error("فشل جلب البيانات من الخادم المجاني FotMob");
  return await res.json();
}

async function buildPayload() {
  // جلب مباريات الفريق وترتيب الدوري في نفس الوقت لتقليل وقت التحميل
  const [teamData, leagueData] = await Promise.all([
    fetchFotmob(`teams?id=${TEAM_ID}`),
    fetchFotmob(`leagues?id=${LEAGUE_ID}`)
  ]);

  const results = [];
  const fixtures = [];

  // البحث عن قائمة المباريات في مسارات FotMob 
  const allFixtures = teamData?.fixtures?.allFixtures?.fixtures || teamData?.fixtures || [];

  for (const f of allFixtures) {
    if (!f.home || !f.away) continue;

    const isHome = f.home.id?.toString() === TEAM_ID || f.home.name.includes("Shabab");
    const opponent = isHome ? f.away.name : f.home.name;
    const competition = f.tournament?.name || "الدوري السعودي";
    
    // استخراج التاريخ والوقت
    const matchTime = f.status?.utcTime || f.time || f.status?.startTimeStr;
    let dateStr = "TBD";
    let timeStr = "TBD";
    
    if (matchTime) {
      try {
        const d = new Date(matchTime);
        dateStr = d.toISOString().split("T")[0]; 
        timeStr = d.toTimeString().slice(0, 5);  
      } catch (e) {}
    }

    // تحديد حالة المباراة (منتهية أو قادمة)
    const isFinished = f.status?.finished === true;

    if (isFinished && f.status?.scoreStr) {
      const score = f.status.scoreStr; // مثال: "2 - 1"
      let result = "draw";
      
      // تحليل النتيجة لمعرفة الفائز
      try {
        const [homeG, awayG] = score.split(" - ").map(Number);
        const teamGoals = isHome ? homeG : awayG;
        const oppGoals = isHome ? awayG : homeG;
        if (teamGoals > oppGoals) result = "win";
        else if (teamGoals < oppGoals) result = "loss";
      } catch(e) {}

      results.push({
        opponent,
        score,
        result,
        date: dateStr,
        competition,
        home: isHome,
        venue: "انتهت"
      });
    } else {
      // إذا لم تنتهِ المباراة فهي في جدول المباريات القادمة
      fixtures.push({
        opponent,
        date: dateStr,
        time: timeStr,
        competition,
        home: isHome,
        venue: "لم تبدأ بعد"
      });
    }
  }

  // فرز النتائج (الأحدث أولاً) والمباريات (الأقرب أولاً)
  results.sort((a, b) => (new Date(a.date) < new Date(b.date) ? 1 : -1));
  fixtures.sort((a, b) => (new Date(a.date) > new Date(b.date) ? 1 : -1));

  // استخراج جدول الترتيب
  let standings = [];
  try {
    const tableData = leagueData?.table?.[0]?.data?.table?.all || [];
    standings = tableData.map((row, index) => ({
      pos: row.idx || index + 1,
      team: row.name,
      played: row.played || 0,
      win: row.wins || 0,
      draw: row.draws || 0,
      loss: row.losses || 0,
      pts: row.pts || 0,
    }));
  } catch(e) {
    console.error("تعذر جلب الترتيب", e);
  }

  return {
    standings,
    results: results.slice(0, 10),
    fixtures: fixtures.slice(0, 10)
  };
}

export default async (req, context) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const payload = await buildPayload();
    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
};