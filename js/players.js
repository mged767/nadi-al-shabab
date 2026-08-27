// players.js — renders squad, coach card, filters, search

let allPlayers = [];
let currentGroup = "all";
let currentQuery = "";

async function loadPlayers() {
  try {
    const res = await fetch("data/players.json");
    const data = await res.json();
    allPlayers = data.players || [];

    const sub = document.getElementById("squadSubtitle");
    if (sub) sub.textContent = `الموسم ${data.season} · ${allPlayers.length} لاعبًا مسجلاً`;

    renderCoach(data.coach);
    renderSquad();
  } catch (err) {
    console.error("تعذر تحميل بيانات اللاعبين", err);
  }
}

function renderCoach(coach) {
  const card = document.getElementById("coachCard");
  if (!card || !coach) return;
  card.innerHTML = `
    ${coach.photo ? `<img src="${coach.photo}" alt="${coach.name}">` : `<div class="team-badge" style="width:56px;height:56px;font-size:1rem">TL</div>`}
    <div>
      <div class="role">المدير الفني</div>
      <h4>${coach.name}</h4>
      <span class="nat">${coach.nationality}</span>
    </div>
  `;
}

function playerCardHTML(p) {
  return `
    <div class="player-card">
      ${p.captain ? `<span class="cap-badge">C</span>` : ""}
      <span class="player-num-badge">${p.number}</span>
      <div class="player-photo-wrap">
        ${p.photo ? `<img src="${p.photo}" alt="${p.name}">` : `<span class="no-photo-num">${p.number}</span>`}
      </div>
      <div class="player-info">
        <h4>${p.name}</h4>
        <span>${p.position} · ${NATION_LABELS[p.nationality] || p.nationality}</span>
      </div>
    </div>
  `;
}

function renderSquad() {
  const container = document.getElementById("squadContainer");
  if (!container) return;

  let filtered = allPlayers;
  if (currentGroup !== "all") {
    filtered = filtered.filter(p => p.group === currentGroup);
  }
  if (currentQuery.trim()) {
    const q = currentQuery.trim();
    filtered = filtered.filter(p => p.name.includes(q));
  }

  if (!filtered.length) {
    container.innerHTML = `<p class="empty-note">لا يوجد لاعبون مطابقون.</p>`;
    return;
  }

  if (currentGroup !== "all") {
    container.innerHTML = `<div class="squad-grid">${filtered.map(playerCardHTML).join("")}</div>`;
    return;
  }

  // Group by position group when showing "all"
  const groups = ["حراس مرمى", "الدفاع", "الوسط", "الهجوم"];
  container.innerHTML = groups.map(g => {
    const players = filtered.filter(p => p.group === g);
    if (!players.length) return "";
    return `
      <div class="group-label">${g}</div>
      <div class="squad-grid">${players.map(playerCardHTML).join("")}</div>
    `;
  }).join("");
}

function initSquadFilters() {
  const chips = document.querySelectorAll("#squadFilters .chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentGroup = chip.dataset.group;
      renderSquad();
    });
  });

  const search = document.getElementById("squadSearch");
  search?.addEventListener("input", (e) => {
    currentQuery = e.target.value;
    renderSquad();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadPlayers();
  initSquadFilters();
});
