// main.js — navigation between screens, standings, news, promo strip

function formatArabicDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

const NATION_LABELS = {
  SA: "السعودية", SN: "السنغال", NL: "هولندا", BE: "بلجيكا",
  FR: "فرنسا", GH: "غانا", GB: "إنجلترا", CO: "كولومبيا", RS: "صربيا"
};

/* ---------- Navigation ---------- */
function goToScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(`screen-${name}`)?.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.nav === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNav() {
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      goToScreen(el.dataset.nav);
    });
  });
}

function initPromoStrip() {
  const btn = document.getElementById("closePromo");
  const strip = document.getElementById("promoStrip");
  btn?.addEventListener("click", () => strip.style.display = "none");
}

/* ---------- Standings ---------- */
async function loadStandings() {
  try {
    const res = await fetch(MATCHES_API_URL);
    if (!res.ok) throw new Error("backend unavailable");
    const data = await res.json();
    renderStandings(data.standings || []);
    return;
  } catch (err) {
    // السيرفر المباشر غير متاح - نستخدم البيانات التجريبية المحلية
  }
  try {
    const res = await fetch("data/matches.json");
    const data = await res.json();
    renderStandings(data.standings || []);
  } catch (err) {
    console.error("تعذر تحميل جدول الترتيب", err);
  }
}

function renderStandings(standings) {
  const body = document.getElementById("standingsBody");
  if (!body) return;

  body.innerHTML = standings.slice(0, 10).map(t => `
    <tr class="${t.team === 'الشباب' ? 'highlight' : ''}">
      <td>
        <div class="team-cell">
          <span class="pos-num">${t.pos}</span>
          <span class="team-badge">${t.team.charAt(0)}</span>
          <span>${t.team}</span>
        </div>
      </td>
      <td>${t.played}</td>
      <td>${t.win}</td>
      <td>${t.loss}</td>
      <td><strong>${t.pts}</strong></td>
    </tr>
  `).join("");
}

/* ---------- News (home preview + full list) ---------- */
async function loadNews() {
  try {
    const res = await fetch("data/news.json");
    const news = await res.json();
    const sorted = [...news].sort((a, b) => new Date(b.date) - new Date(a.date));

    renderHomeNews(sorted.slice(0, 2));
    renderFullNews(sorted);
  } catch (err) {
    console.error("تعذر تحميل الأخبار", err);
  }
}

function newsCardHTML(n) {
  return `
    <article class="card news-card">
      <div class="thumb">الشباب</div>
      <div class="body">
        <span class="news-cat">${n.category}</span>
        <h3>${n.title}</h3>
        <p>${n.excerpt}</p>
        <span class="news-date">${formatArabicDate(n.date)}</span>
      </div>
    </article>
  `;
}

function renderHomeNews(items) {
  const wrap = document.getElementById("homeNews");
  if (!wrap) return;
  wrap.innerHTML = items.map(newsCardHTML).join("");
}

function renderFullNews(items) {
  const wrap = document.getElementById("newsContainer");
  if (!wrap) return;
  wrap.innerHTML = items.map(newsCardHTML).join("");
}

/* ---------- Transfers ---------- */
async function loadTransfers() {
  try {
    const res = await fetch("data/transfers.json");
    const data = await res.json();
    renderTransfers("inPanel", data.in || [], "in", "قادم من");
    renderTransfers("outPanel", data.out || [], "out", "ذاهب إلى");
  } catch (err) {
    console.error("تعذر تحميل الانتقالات", err);
  }
}

function renderTransfers(panelId, list, tagType, label) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  if (!list.length) {
    panel.innerHTML = `<p class="empty-note">لا توجد بيانات لعرضها.</p>`;
    return;
  }

  panel.innerHTML = list.map(t => `
    <div class="card transfer-item">
      <div class="avatar">${t.name.split(" ")[0].charAt(0)}</div>
      <div class="info">
        <h4>${t.name}</h4>
        <span>${label}: ${t.from || t.to}</span>
        <div class="transfer-date">${formatArabicDate(t.date)}</div>
      </div>
      <span class="transfer-tag ${tagType}">${t.type}</span>
    </div>
  `).join("");
}

function initTransferTabs() {
  const btns = document.querySelectorAll("[data-ttab]");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll("#screen-transfers .tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.ttab).classList.add("active");
    });
  });
}

/* ---------- Club history / honors / gallery ---------- */
async function loadHistory() {
  try {
    const res = await fetch("data/history.json");
    const data = await res.json();
    renderHonorGrid(data.honors || []);
    renderHonorsList(data.honors || []);
    renderMilestones(data.milestones || []);
  } catch (err) {
    console.error("تعذر تحميل بيانات تاريخ النادي", err);
  }
}

function renderHonorGrid(honors) {
  const grid = document.getElementById("honorGrid");
  if (!grid) return;
  const top3 = honors.slice(0, 3);
  grid.innerHTML = top3.map(h => `
    <div class="honor-pill"><strong>${h.count}</strong><span>${h.title}</span></div>
  `).join("");
}

function renderHonorsList(honors) {
  const wrap = document.getElementById("honorsList");
  if (!wrap) return;
  wrap.innerHTML = honors.map(h => `
    <div class="honor-list-item">
      <div>
        <div>${h.title}</div>
        ${h.years.length ? `<span class="years">${h.years.join(" · ")}</span>` : ""}
      </div>
      <span class="honor-count">${h.count}</span>
    </div>
  `).join("");
}

function renderMilestones(milestones) {
  const wrap = document.getElementById("milestonesList");
  if (!wrap) return;
  wrap.innerHTML = milestones.map(m => `
    <div class="milestone-item">
      <span class="my">${m.year}</span>
      <span>${m.text}</span>
    </div>
  `).join("");
}

function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  const photos = [
    { src: "images/gallery/yalla-shabab.jpg", alt: "جماهير الشباب" },
    { src: "images/gallery/roma-trophy.jpg", alt: "احتفال أمام روما" },
    { src: "images/gallery/founding-day.jpg", alt: "يوم التأسيس" },
    { src: "images/gallery/team-photo-black.jpg", alt: "صورة جماعية للفريق" },
    { src: "images/gallery/lineup-anthem.jpg", alt: "الفريق قبل المباراة" },
    { src: "images/gallery/celebration.jpg", alt: "احتفال بالفوز" },
    { src: "images/gallery/community.jpg", alt: "المسؤولية المجتمعية" },
    { src: "images/gallery/board.jpg", alt: "مجلس إدارة النادي" }
  ];
  grid.innerHTML = photos.map(p => `<img src="${p.src}" alt="${p.alt}" loading="lazy">`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initPromoStrip();
  loadStandings();
  loadNews();
  loadTransfers();
  initTransferTabs();
  loadHistory();
  renderGallery();
});
