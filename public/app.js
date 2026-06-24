/* ── app.js — BFHL Node Analyser ── */

const API_URL = "/bfhl";

const EXAMPLES = {
  tree: "A->B, A->C, B->D, C->E, E->F",
  cycle: "X->Y, Y->Z, Z->X, P->Q, Q->R",
  full: "A->B, A->C, B->D, C->E, E->F, X->Y, Y->Z, Z->X, P->Q, Q->R, G->H, G->H, G->I, hello, 1->2, A->",
};

function loadExample(key) {
  document.getElementById("node-input").value = EXAMPLES[key];
}

// Ctrl+Enter shortcut
document.getElementById("node-input").addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") submitNodes();
});

async function submitNodes() {
  const raw = document.getElementById("node-input").value.trim();
  if (!raw) { showError("Please enter at least one node pair."); return; }

  const data = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  const btn  = document.getElementById("submit-btn");
  const txt  = document.getElementById("btn-text");
  const ldr  = document.getElementById("btn-loader");

  btn.disabled = true;
  txt.textContent = "Analysing...";
  ldr.style.display = "inline-block";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const json = await res.json();
    renderResults(json);
  } catch (err) {
    showError(err.message || "Could not connect to the API.");
  } finally {
    btn.disabled = false;
    txt.textContent = "Analyse";
    ldr.style.display = "none";
  }
}

/* ── Render ── */
function renderResults(data) {
  const area = document.getElementById("results-area");
  area.innerHTML = "";

  const grid = el("div", "results-grid");

  // Identity
  grid.appendChild(makeIdentity(data));

  // Summary
  grid.appendChild(makeSummary(data.summary || {}));

  // Hierarchies
  if (data.hierarchies?.length) {
    const wrap = el("div", "card");
    wrap.appendChild(elText("div", "section-title", "Hierarchies"));
    const list = el("div", "");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "10px";
    data.hierarchies.forEach((h, i) => list.appendChild(makeHCard(h, i)));
    wrap.appendChild(list);
    grid.appendChild(wrap);
  }

  // Invalid
  grid.appendChild(makeTagsCard("Invalid Entries", data.invalid_entries || [], "inv"));

  // Duplicates
  grid.appendChild(makeTagsCard("Duplicate Edges", data.duplicate_edges || [], "dup"));

  // Raw JSON
  grid.appendChild(makeRaw(data));

  area.appendChild(grid);
}

function makeIdentity(data) {
  const d = el("div", "identity-card");
  d.innerHTML = `
    <div class="id-item"><span class="id-label">User ID</span><span class="id-value">${esc(data.user_id)}</span></div>
    <div class="id-item"><span class="id-label">Email</span><span class="id-value">${esc(data.email_id)}</span></div>
    <div class="id-item"><span class="id-label">Roll No.</span><span class="id-value">${esc(data.college_roll_number)}</span></div>
  `;
  return d;
}

function makeSummary(s) {
  const d = el("div", "summary-row");
  d.innerHTML = `
    <div class="sum-card"><div class="sum-num t">${s.total_trees ?? 0}</div><div class="sum-label">Trees</div></div>
    <div class="sum-card"><div class="sum-num c">${s.total_cycles ?? 0}</div><div class="sum-label">Cycles</div></div>
    <div class="sum-card"><div class="sum-num r">${esc(s.largest_tree_root ?? "—")}</div><div class="sum-label">Largest Root</div></div>
  `;
  return d;
}

function makeHCard(h, idx) {
  const card = el("div", "h-card" + (h.has_cycle ? " is-cycle" : ""));
  card.id = `hc-${idx}`;

  const hdr = el("div", "h-header");
  hdr.setAttribute("role", "button");
  hdr.tabIndex = 0;
  hdr.innerHTML = `
    <div class="h-root">
      <span class="root-tag">${esc(h.root)}</span>
      Root: ${esc(h.root)}
    </div>
    <div class="h-badges">
      ${h.has_cycle ? `<span class="cycle-tag">⚠ Cycle</span>` : `<span class="depth-tag">depth ${h.depth}</span>`}
      <span class="chevron">▼</span>
    </div>
  `;

  const body = el("div", "h-body");

  if (h.has_cycle) {
    body.innerHTML = `<div class="cycle-msg">⚠ Cycle detected — tree structure cannot be displayed.</div>`;
  } else {
    const tv = el("div", "tree-view");
    buildTreeRows(tv, h.root, h.tree[h.root] ?? {}, "", true);
    body.appendChild(tv);
  }

  const toggle = () => {
    card.classList.toggle("open");
  };
  hdr.addEventListener("click", toggle);
  hdr.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") toggle(); });

  if (idx === 0) card.classList.add("open");

  card.appendChild(hdr);
  card.appendChild(body);
  return card;
}

function buildTreeRows(container, name, subtree, prefix, isRoot) {
  const row = el("div", "tree-row");
  const pre = el("span", "tree-pre");
  pre.textContent = isRoot ? "" : prefix;

  const children = Object.keys(subtree);
  const isLeaf = children.length === 0;
  const pill = el("span", "node-pill" + (isRoot ? " root" : isLeaf ? " leaf" : ""));
  pill.textContent = name;

  row.appendChild(pre);
  row.appendChild(pill);
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
    buildTreeRows(container, child, subtree[child], childPre, false);
  });
}

function makeTagsCard(title, items, cls) {
  const card = el("div", "card");
  card.appendChild(elText("div", "section-title", title));
  const wrap = el("div", "tags-wrap");
  if (!items.length) {
    wrap.appendChild(elText("span", "empty-text", "None"));
  } else {
    items.forEach(item => {
      const t = elText("span", `tag ${cls}`, item);
      wrap.appendChild(t);
    });
  }
  card.appendChild(wrap);
  return card;
}

function makeRaw(data) {
  const wrap = el("div", "card");
  const btn = elText("button", "raw-toggle", "{ } View Raw JSON Response");
  const block = el("pre", "raw-block");
  block.style.display = "none";
  block.textContent = JSON.stringify(data, null, 2);

  btn.addEventListener("click", () => {
    const hidden = block.style.display === "none";
    block.style.display = hidden ? "block" : "none";
    btn.textContent = hidden ? "{ } Hide Raw JSON" : "{ } View Raw JSON Response";
  });

  wrap.appendChild(btn);
  wrap.appendChild(block);
  return wrap;
}

function showError(msg) {
  const area = document.getElementById("results-area");
  area.innerHTML = `
    <div class="error-box">
      <span>✕</span>
      <div><strong>Error</strong><br/>${esc(msg)}</div>
    </div>
  `;
}

/* ── Helpers ── */
function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function elText(tag, cls, text) {
  const e = el(tag, cls);
  e.textContent = text;
  return e;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
