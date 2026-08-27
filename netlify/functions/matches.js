// المكان بالضبط: netlify/functions/matches.js
// هذا الملف يستخدم API شبكة ESPN المفتوح والمجاني بالكامل

async function buildPayload() {
  // معرّف الدوري السعودي في شبكة ESPN
  const STANDINGS_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/ksa.1/standings";
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json"
  };

  // 1. جلب جدول الترتيب والبحث عن معرّف نادي الشباب تلقائياً
  const standingsRes = await fetch(STANDINGS_URL, { headers });
  if (!standingsRes.ok) throw new Error("فشل جلب بيانات الدوري من ESPN");
  const standingsData = await standingsRes.json();

  let standings = [];
  let teamId = null;

  // استخراج قائمة الفرق
  const entries = standingsData.children?.[0]?.standings?.entries || [];

  for (const entry of entries) {
    const teamName = entry.team?.name || entry.team?.displayName || "";
    const stats = entry.stats || [];

    // دالة لاستخراج الإحصائيات (فوز، تعادل، خسارة، نقاط)
    const getStat = (name) => {
      const stat = stats.find(s => s.name === name);
      return stat ? parseInt(stat.value) : 0;
    };

    standings.push({
      pos: 0, 
      team: teamName,
      played: getStat('gamesPlayed'),
      win: getStat('wins'),
      draw: getStat('ties'),
      loss: getStat('losses'),
      pts: getStat('points')
    });

    // البحث عن نادي الشباب لاستخراج الـ ID الخاص به في ESPN
    if (teamName.toLowerCase().includes("shabab")) {
      teamId = entry.team.id;
    }
  }

  // ترتيب الفرق حسب النقاط لتكوين جدول الترتيب وإعطاء المراكز
  standings.sort((a, b) => b.pts - a.pts);
  standings = standings.map((s, index) => ({ ...s, pos: index + 1 }));

  const results = [];
  const fixtures = [];

  // 2. جلب مباريات ونتائج نادي الشباب باستخدام المعرّف الذي وجدناه
  if (teamId) {
    const TEAM_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/ksa.1/teams/${teamId}/schedule`;
    const scheduleRes = await fetch(TEAM_URL, { headers });
    
    if (scheduleRes.ok) {
      const scheduleData = await scheduleRes.json();
      const events = scheduleData.events || [];

      for (const ev of events) {
        const comp = ev.competitions?.[0];
        if (!comp) continue;

        const home = comp.competitors.find(c => c.homeAway === 'home');
        const away = comp.competitors.find(c => c.homeAway === 'away');

        const isHome = home?.team?.id === teamId;
        const opponent = isHome ? away?.team?.displayName : home?.team?.displayName;

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
        const state = comp.status?.type?.state; // حالة المباراة

        // إذا كانت المباراة منتهية (post)
        if (state === 'post') {
          const teamScore = isHome ? home?.score?.value || home?.score : away?.score?.value || away?.score;
          const oppScore = isHome ? away?.score?.value || away?.score : home?.score?.value || home?.score;

          let result = "draw";
          if (parseInt(teamScore) > parseInt(oppScore)) result = "win";
          if (parseInt(teamScore) < parseInt(oppScore)) result = "loss";

          results.push({
            opponent: opponent || "غير معروف",
            score: `${teamScore} - ${oppScore}`,
            result,
            date: dateStr,
            competition: "دوري روشن السعودي",
            home: isHome,
            venue
          });
        } 
        // إذا كانت المباراة قادمة (pre)
        else if (state === 'pre') {
          fixtures.push({
            opponent: opponent || "غير معروف",
            date: dateStr,
            time: timeStr,
            competition: "دوري روشن السعودي",
            home: isHome,
            venue
          });
        }
      }
    }
  }

  // فرز النتائج (الأحدث أولاً) والمباريات (الأقرب أولاً)
  results.sort((a, b) => (new Date(a.date) < new Date(b.date) ? 1 : -1));
  fixtures.sort((a, b) => (new Date(a.date) > new Date(b.date) ? 1 : -1));

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