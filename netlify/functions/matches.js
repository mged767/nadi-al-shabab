// المكان بالضبط: netlify/functions/matches.js
// Netlify يدعم JavaScript تلقائيًا بدون أي إعدادات أو requirements إضافية.

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";
const LEAGUE_ID = 307; // معرّف الدوري السعودي للمحترفين بناءً على توجيهات API
const SEASON = 2026; // الموسم الحالي

let cache = { teamId: null };

async function apiGet(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length) {
    throw new Error(JSON.stringify(data.errors));
  }
  return data.response || [];
}

async function resolveTeamId() {
  if (cache.teamId) return cache.teamId;
  
  // البحث عن الفريق داخل الدوري السعودي مباشرة لضمان الدقة وتجنب تشابه الأسماء
  const results = await apiGet("teams", { league: LEAGUE_ID, season: SEASON });
  const match = results.find(
    (r) => r.team.name.includes("Shabab")
  );
  
  cache.teamId = match?.team.id;
  if (!cache.teamId) throw new Error("Al-Shabab team not found in Saudi Pro League");
  
  return cache.teamId;
}

function fmtDate(iso) {
  return iso.slice(0, 10);
}

function fmtTime(iso) {
  return iso.slice(11, 16);
}

async function getStandings() {
  const raw = await apiGet("standings", { league: LEAGUE_ID, season: SEASON });
  if (!raw.length) return [];
  return raw[0].league.standings[0].map((row) => ({
    pos: row.rank,
    team: row.team.name,
    played: row.all.played,
    win: row.all.win,
    draw: row.all.draw,
    loss: row.all.lose,
    pts: row.points,
  }));
}

async function buildPayload() {
  const teamId = await resolveTeamId();
  
  // جلب المباريات باستخدام معرّف الفريق والموسم
  const fixturesRaw = await apiGet("fixtures", { team: teamId, season: SEASON });

  const results = [];
  const fixtures = [];

  for (const f of fixturesRaw) {
    const status = f.fixture.status.short;
    const home = f.teams.home;
    const away = f.teams.away;
    const isHome = home.id === teamId;
    const opponent = isHome ? away.name : home.name;
    const venue = f.fixture.venue?.name || "غير محدد";
    const round = f.league.round ? ` · ${f.league.round}` : "";
    const competition = f.league.name + round;

    if (["FT", "AET", "PEN"].includes(status)) {
      const gh = f.goals.home;
      const ga = f.goals.away;
      const teamGoals = isHome ? gh : ga;
      const oppGoals = isHome ? ga : gh;
      const result =
        teamGoals > oppGoals ? "win" : teamGoals < oppGoals ? "loss" : "draw";
      results.push({
        opponent,
        score: `${teamGoals} - ${oppGoals}`,
        result,
        date: fmtDate(f.fixture.date),
        competition,
        home: isHome,
        venue,
      });
    } else if (["NS", "TBD"].includes(status)) {
      fixtures.push({
        opponent,
        date: fmtDate(f.fixture.date),
        time: fmtTime(f.fixture.date),
        competition,
        home: isHome,
        venue,
      });
    }
  }

  // ترتيب النتائج والمباريات
  results.sort((a, b) => (a.date < b.date ? 1 : -1));
  fixtures.sort((a, b) => (a.date > b.date ? 1 : -1));

  return {
    standings: await getStandings(),
    results: results.slice(0, 10),
    fixtures: fixtures.slice(0, 10),
  };
}

export default async (req, context) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    if (!API_KEY) {
      throw new Error(
        "لم يتم ضبط API_FOOTBALL_KEY في Environment Variables على Netlify"
      );
    }
    const payload = await buildPayload();
    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
};