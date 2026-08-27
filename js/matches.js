// matches.js — renders fixtures & results tabs

// عنوان دالة Netlify (Serverless Function). يعمل تلقائيًا بعد الرفع على Netlify
// بدون أي تعديل — لأنه مسار نسبي على نفس النطاق.
const MATCHES_API_URL = "/.netlify/functions/matches";

async function loadMatches() {
  try {
    const res = await fetch(MATCHES_API_URL);
    if (!res.ok) throw new Error("backend unavailable");
    const data = await res.json();
    renderFixtures(data.fixtures || []);
    renderResults(data.results || []);
    renderStandings(data.standings || []); // من نفس الاستجابة إذا توفرت
  } catch (err) {
    console.warn("تعذر الاتصال بالسيرفر المباشر، سيتم استخدام البيانات التجريبية المحلية:", err.message);
    try {
      const res = await fetch("data/matches.json");
      const data = await res.json();
      renderFixtures(data.fixtures || []);
      renderResults(data.results || []);
    } catch (err2) {
      console.error("تعذر تحميل بيانات المباريات نهائيًا", err2);
    }
  }
}

function matchCardHTML(m, isResult) {
  return `
    <div class="card match-card">
      <div class="comp-label">🏆 ${m.competition}</div>
      <div class="match-row">
        <div class="team-block">
          <div class="team-badge">شب</div>
          <span>الشباب</span>
        </div>
        <div class="match-center-block">
          ${isResult
            ? `<div class="match-score">${m.score}</div>
               <span class="result-tag ${m.result}">${m.result === 'win' ? 'فوز' : m.result === 'loss' ? 'خسارة' : 'تعادل'}</span>`
            : `<div class="match-time">${m.time}</div>
               <span class="match-date">${formatArabicDate(m.date)}</span>`
          }
        </div>
        <div class="team-block">
          <div class="team-badge">${m.opponent.charAt(0)}</div>
          <span>${m.opponent}</span>
        </div>
      </div>
      <div class="match-venue">📍 ${m.venue}${isResult ? " · " + formatArabicDate(m.date) : (m.home ? " · مباراة أرض" : " · مباراة خارج الديار")}</div>
    </div>
  `;
}

function renderFixtures(fixtures) {
  const panel = document.getElementById("fixturesPanel");
  if (!panel) return;
  if (!fixtures.length) {
    panel.innerHTML = `<p class="empty-note">لا توجد مباريات قادمة حاليًا.</p>`;
    return;
  }
  panel.innerHTML = fixtures.map(m => matchCardHTML(m, false)).join("");
}

function renderResults(results) {
  const panel = document.getElementById("resultsPanel");
  if (!panel) return;
  if (!results.length) {
    panel.innerHTML = `<p class="empty-note">لا توجد نتائج سابقة لعرضها.</p>`;
    return;
  }
  panel.innerHTML = results.map(m => matchCardHTML(m, true)).join("");
}

function initMatchTabs() {
  const btns = document.querySelectorAll("#screen-matches .tab-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll("#screen-matches .tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadMatches();
  initMatchTabs();
});
