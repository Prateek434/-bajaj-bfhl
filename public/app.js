/* ── app.js — BFHL Hierarchy Visualiser ── */

const API_URL = "/bfhl";

const EXAMPLES = {
  tree: "A->B, A->C\nB->D, C->E\nE->F",
  cycle: "X->Y, Y->Z, Z->X\nP->Q, Q->R",
  full: "A->B, A->C, B->D, C->E, E->F\nX->Y, Y->Z, Z->X\nP->Q, Q->R\nG->H, G->H, G->I\nhello, 1->2, A->",
};

function loadExample(key) {
  document.getElementById("node-input").value = EXAMPLES[key];
  document.getElementById("node-input").focus();
}

document.getElementById("node-input").addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "Enter") submitNodes();
});

async function submitNodes() {
  const raw = document.getElementById("node-input").value.trim();
  if (!raw) { showError("Please enter at least one node pair like A->B"); return; }

  const data = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  const btn = document.getElementById("submit-btn");
  const txt = document.getElementById("btn-text");
  const ldr = document.getElementById("btn-loader");

  btn.disabled = true;
  txt.style.display = "none";
  ldr.style.display = "inline-block";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    renderResults(await res.json());
  } catch (err) {
    showError(err.message || "Could not connect. Make sure the server is running.");
  } finally {
    btn.disabled = false;
    txt.style.display = "inline";
    ldr.style.display = "none";
  }
}

/* ═══════════════════════════════ RENDER ═══════════════════════════════ */

function renderResults(data) {
  const area = document.getElementById("results-area");
  area.innerHTML = "";

  const grid = make("div", "res-grid");

  // 1. Identity
  grid.appendChild(buildIdentity(data));

  // 2. Summary stats
  grid.appendChild(buildStats(data.summary || {}));

  // 3. Hierarchies
  if ((data.hierarchies || []).length) {
    const sec = make("div", "sec");
    sec.appendChild(txt("div", "sec-title", "Hierarchy Trees"));
    const list = make("div");
    data.hierarchies.forEach((h, i) => list.appendChild(buildHCard(h, i)));
    sec.appendChild(list);
    grid.appendChild(sec);
  }

  // 4. Invalid
  grid.appendChild(buildChips("Invalid Entries", data.invalid_entries || [], "inv"));

  // 5. Duplicates
  grid.appendChild(buildChips("Duplicate Edges", data.duplicate_edges || [], "dup"));

  // 6. Raw JSON
  grid.appendChild(buildRaw(data));

  area.appendChild(grid);
}

/* ── Identity ── */
function buildIdentity(data) {
  const d = make("div", "id-strip");
  d.innerHTML = `
    <div class="id-item">
      <span class="id-lbl">User ID</span>
      <span class="id-val">${esc(data.user_id)}</span>
    </div>
    <div class="id-item">
      <span class="id-lbl">Email</span>
      <span class="id-val">${esc(data.email_id)}</span>
    </div>
    <div class="id-item">
      <span class="id-lbl">Roll No.</span>
      <span class="id-val">${esc(data.college_roll_number)}</span>
    </div>`;
  return d;
}

/* ── Stats ── */
function buildStats(s) {
  const row = make("div", "stats-row");
  row.innerHTML = `
    <div class="stat-box trees">
      <div class="stat-num">${s.total_trees ?? 0}</div>
      <div class="stat-lbl">Valid Trees</div>
    </div>
    <div class="stat-box cycles">
      <div class="stat-num">${s.total_cycles ?? 0}</div>
      <div class="stat-lbl">Cycles Found</div>
    </div>
    <div class="stat-box root">
      <div class="stat-num">${esc(s.largest_tree_root ?? "—")}</div>
      <div class="stat-lbl">Biggest Root</div>
    </div>`;
  return row;
}

/* ── Hierarchy card ── */
function buildHCard(h, idx) {
  const card = make("div", "hcard" + (h.has_cycle ? " cycle" : ""));

  const hdr = make("div", "hcard-hdr");
  hdr.setAttribute("role", "button");
  hdr.tabIndex = 0;
  hdr.innerHTML = `
    <div class="hcard-left">
      <div class="root-bubble">${esc(h.root)}</div>
      <div class="hcard-name">
        Root node ${esc(h.root)}
        <span>— ${h.has_cycle ? "cyclic group" : `depth ${h.depth}`}</span>
      </div>
    </div>
    <div class="hcard-right">
      ${h.has_cycle
        ? `<span class="badge cyc">⚠ Cycle</span>`
        : `<span class="badge depth">depth: ${h.depth}</span>`}
      <span class="arrow">▼</span>
    </div>`;

  const body = make("div", "hcard-body");

  if (h.has_cycle) {
    body.innerHTML = `<div class="cycle-note">⚠️ A cycle is detected in this group — tree cannot be rendered.</div>`;
  } else {
    const tv = make("div", "tree");
    buildTree(tv, h.root, h.tree[h.root] ?? {}, "", true);
    body.appendChild(tv);
  }

  const toggle = () => card.classList.toggle("open");
  hdr.addEventListener("click", toggle);
  hdr.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });

  if (idx === 0) card.classList.add("open");

  card.appendChild(hdr);
  card.appendChild(body);
  return card;
}

function buildTree(container, name, subtree, prefix, isRoot) {
  const row  = make("div", "trow");
  const pre  = make("span", "tpre");
  pre.textContent = isRoot ? "" : prefix;

  const children = Object.keys(subtree);
  const isLeaf   = children.length === 0;
  const nodeEl   = make("span", `tnode ${isRoot ? "root" : isLeaf ? "leaf" : "mid"}`);
  nodeEl.textContent = name;

  row.appendChild(pre);
  row.appendChild(nodeEl);
  container.appendChild(row);

  children.forEach((child, i) => {
    const last = i === children.length - 1;
    let childPre;
    if (isRoot) {
      childPre = last ? "└── " : "├── ";
    } else {
      const base = prefix.replace(/[├└]── $/, last ? "    " : "│   ");
      childPre = base + (last ? "└── " : "├── ");
    }
    buildTree(container, child, subtree[child], childPre, false);
  });
}

/* ── Chips ── */
function buildChips(title, items, cls) {
  const sec = make("div", "sec");
  sec.appendChild(txt("div", "sec-title", title));
  const wrap = make("div", "tags");
  if (!items.length) {
    wrap.appendChild(txt("span", "none-txt", "None"));
  } else {
    items.forEach(item => wrap.appendChild(txt("span", `chip ${cls}`, item)));
  }
  sec.appendChild(wrap);
  return sec;
}

/* ── Raw JSON ── */
function buildRaw(data) {
  const wrap = make("div");
  const btn  = txt("button", "raw-btn", "{ } View Raw JSON");
  const pre  = make("pre", "raw-pre");
  pre.style.display = "none";
  pre.textContent   = JSON.stringify(data, null, 2);

  btn.addEventListener("click", () => {
    const h = pre.style.display === "none";
    pre.style.display = h ? "block" : "none";
    btn.textContent   = h ? "{ } Hide JSON" : "{ } View Raw JSON";
  });

  wrap.appendChild(btn);
  wrap.appendChild(pre);
  return wrap;
}

/* ── Error ── */
function showError(msg) {
  document.getElementById("results-area").innerHTML = `
    <div class="err-box">
      <span>✕</span>
      <div><strong>Error</strong><br/>${esc(msg)}</div>
    </div>`;
}

/* ── Helpers ── */
function make(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function txt(tag, cls, text) {
  const el = make(tag, cls);
  el.textContent = text;
  return el;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}
