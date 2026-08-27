// المكان بالضبط: netlify/functions/matches.js

const TEAM_ID = "8021"; // المعرّف الثابت لنادي الشباب في ESPN لتقليل وقت البحث
const LEAGUE_ID = "ksa.1"; 

// دالة ذكية تقطع الاتصال إذا استغرق أكثر من 4 ثوانٍ لمنع خطأ 502 Timeout
async function fetchWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: controller.signal 
    });
    clearTimeout(id);
    if (!response.ok) throw new Error("HTTP Error");
    return await response.json();
  } catch (error) {
    clearTimeout(id);
    throw error; // سيتم التقاط هذا الخطأ في الأسفل لتشغيل بيانات الطوارئ
  }
}

async function buildPayload() {
  const STANDINGS_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE_ID}/standings`;
  const SCHEDULE_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE_ID}/teams/${TEAM_ID}/schedule`;

  try {
    // جلب الترتيب والمباريات في نفس اللحظة (يستغرق عادة أقل من ثانية)
    const [standingsData, scheduleData] = await Promise.all([
      fetchWithTimeout(STANDINGS_URL),
      fetchWithTimeout(SCHEDULE_URL)
    ]);

    let standings = [];
    const entries = standingsData?.children?.[0]?.standings?.entries || [];
    
    for (const entry of entries) {
      const teamName = entry.team?.name || entry.team?.displayName || "";
      const stats = entry.stats || [];
      const getStat = (name) => {
        const stat = stats.find(s => s.name === name);
        return stat ? parseInt(stat.value) : 0;
      };

      standings.push({
        pos: 0,
        team: teamName.replace("Al ", "ال").replace("Shabab", "الشباب").replace("Nassr", "النصر").replace("Hilal", "الهلال").replace("Ahli", "الأهلي").replace("Ittihad", "الاتحاد"),
        played: getStat('gamesPlayed'),
        win: getStat('wins'),
        draw: getStat('ties'),
        loss: getStat('losses'),
        pts: getStat('points')
      });
    }

    standings.sort((a, b) => b.pts - a.pts);
    standings = standings.map((s, i) => ({ ...s, pos: i + 1 }));

    const results = [];
    const fixtures = [];
    const events = scheduleData?.events || [];

    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');

      const isHome = home?.team?.id === TEAM_ID;
      const opponentName = isHome ? away?.team?.displayName : home?.team?.displayName;
      const opponent = (opponentName || "غير محدد").replace("Al ", "ال");

      let dateStr = "TBD";
      let timeStr = "TBD";
      if (ev.date) {
        try {
          const d = new Date(ev.date);
          dateStr = d.toISOString().split("T")[0];
          timeStr = d.toTimeString().slice(0, 5);
        } catch (e) {}
      }

      const venue = comp.venue?.fullName || "غير محدد";
      const state = comp.status?.type?.state; 

      if (state === 'post') {
        const teamScore = isHome ? home?.score?.value : away?.score?.value;
        const oppScore = isHome ? away?.score?.value : home?.score?.value;
        let result = "draw";
        if (parseInt(teamScore) > parseInt(oppScore)) result = "win";
        if (parseInt(teamScore) < parseInt(oppScore)) result = "loss";

        results.push({
          opponent, score: `${teamScore} - ${oppScore}`, result, date: dateStr, competition: "دوري روشن", home: isHome, venue: "انتهت"
        });
      } else if (state === 'pre') {
        fixtures.push({
          opponent, date: dateStr, time: timeStr, competition: "دوري روشن", home: isHome, venue: "لم تبدأ بعد"
        });
      }
    }

    results.sort((a, b) => (new Date(a.date) < new Date(b.date) ? 1 : -1));
    fixtures.sort((a, b) => (new Date(a.date) > new Date(b.date) ? 1 : -1));

    return {
      standings: standings.length ? standings : getFallbackData().standings,
      results: results.slice(0, 10),
      fixtures: fixtures.slice(0, 10)
    };

  } catch (error) {
    // إذا تأخر الاتصال أو فشل، نعرض بيانات الطوارئ فوراً لمنع الانهيار
    return getFallbackData();
  }
}

// بيانات احتياطية تظهر في حال توقف الـ API العالمي لكي لا يتعطل موقعك
function getFallbackData() {
  return {
    standings: [
      { pos: 1, team: "الهلال", played: 2, win: 2, draw: 0, loss: 0, pts: 6 },
      { pos: 2, team: "القادسية", played: 2, win: 2, draw: 0, loss: 0, pts: 6 },
      { pos: 3, team: "الشباب", played: 2, win: 1, draw: 0, loss: 1, pts: 3 },
      { pos: 4, team: "النصر", played: 2, win: 1, draw: 1, loss: 0, pts: 4 }
    ],
    results: [
      { opponent: "الاتفاق", score: "0 - 1", result: "loss", date: "2026-08-24", competition: "دوري روشن", home: true, venue: "انتهت" }
    ],
    fixtures: [
      { opponent: "الخليج", date: "2026-08-29", time: "21:00", competition: "دوري روشن", home: false, venue: "لم تبدأ بعد" },
      { opponent: "القادسية", date: "2026-09-15", time: "18:20", competition: "دوري روشن", home: false, venue: "لم تبدأ بعد" }
    ]
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
    // حاجز أمان أخير يضمن رجوع كود 200 دائماً
    return new Response(JSON.stringify(getFallbackData()), { status: 200, headers });
  }
};