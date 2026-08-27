// المكان بالضبط: netlify/functions/matches.js

const TEAM_ID = "101916"; // معرّف نادي الشباب
const LEAGUE_ID = "536"; // معرّف الدوري السعودي للمحترفين

// دالة لجلب البيانات عبر خدمات البروكسي لتخطي حظر السيرفرات السحابية
async function fetchFotmob(endpoint) {
  const targetUrl = `https://www.fotmob.com/api/${endpoint}`;
  
  // البروكسي الأساسي
  const primaryProxy = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
  // البروكسي الاحتياطي
  const backupProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
  };

  try {
    const res = await fetch(primaryProxy, { headers });
    if (!res.ok) throw new Error("Primary proxy failed");
    return await res.json();
  } catch (error) {
    // في حال فشل البروكسي الأول، يتم الانتقال للبروكسي الاحتياطي فوراً
    try {
      const res2 = await fetch(backupProxy, { headers });
      if (!res2.ok) throw new Error("Backup proxy failed");
      return await res2.json();
    } catch (finalError) {
      throw new Error(`فشل جلب البيانات من FotMob عبر جميع المنافذ المتاحة`);
    }
  }
}

async function buildPayload() {
  const [teamData, leagueData] = await Promise.all([
    fetchFotmob(`teams?id=${TEAM_ID}`),
    fetchFotmob(`leagues?id=${LEAGUE_ID}`)
  ]);

  const results = [];
  const fixtures = [];

  const allFixtures = teamData?.fixtures?.allFixtures?.fixtures || teamData?.fixtures || [];

  for (const f of allFixtures) {
    if (!f.home || !f.away) continue;

    const isHome = f.home.id?.toString() === TEAM_ID || f.home.name.includes("Shabab");
    const opponent = isHome ? f.away.name : f.home.name;
    const competition = f.tournament?.name || "الدوري السعودي";
    
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

    const isFinished = f.status?.finished === true;

    if (isFinished && f.status?.scoreStr) {
      const score = f.status.scoreStr;
      let result = "draw";
      
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

  results.sort((a, b) => (new Date(a.date) < new Date(b.date) ? 1 : -1));
  fixtures.sort((a, b) => (new Date(a.date) > new Date(b.date) ? 1 : -1));

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
  } catch(e) {}

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