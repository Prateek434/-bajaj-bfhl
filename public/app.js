/* ── app.js — BFHL Hierarchy Explorer ────────────────────────────────────── */

const API_URL = "/bfhl"; // relative → same server; change to full URL after deploy

// ── Quick example presets ──────────────────────────────────────────────────
const EXAMPLES = {
  tree: "A->B, A->C, B->D, C->E, E->F",
  cycle: "X->Y, Y->Z, Z->X, P->Q, Q->R",
  full: [
    "A->B", "A->C", "B->D", "C->E", "E->F",
    "X->Y", "Y->Z", "Z->X",
    "P->Q", "Q->R",
    "G->H", "G->H", "G->I",
    "hello", "1->2", "A->",
  ].join(", "),
};

function loadExample(key) {
  document.getElementById("node-input").value = EXAMPLES[key];
  document.getElementById("node-input").focus();
}

// Ctrl+Enter to submit
document.getElementById("node-input").addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") submitNodes();
});

// ── Submit Handler ─────────────────────────────────────────────────────────
async function submitNodes() {
  const raw = document.getElementById("node-input").value.trim();
  if (!raw) {
    showError("Please enter at least one node pair.");
    return;
  }

  // Parse comma/newline separated entries
  const data = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const btn = document.getElementById("submit-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API returned ${res.status}: ${errText}`);
    }

    const json = await res.json();
    renderResults(json);
  } catch (err) {
    showError(err.message || "Failed to reach the API. Make sure the server is running.");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

// ── Render Results ─────────────────────────────────────────────────────────
function renderResults(data) {
  const section = document.getElementById("results-section");
  section.innerHTML = "";

  const container = document.createElement("div");
  container.className = "results-content";

  // 1) Identity strip
  container.appendChild(
    makeIdentityStrip(data.user_id, data.email_id, data.college_roll_number)
  );

  // 2) Summary row
  container.appendChild(makeSummaryRow(data.summary));

  // 3) Hierarchies
  if (data.hierarchies && data.hierarchies.length > 0) {
    const label = makeLabel("Hierarchies");
    const grid = document.createElement("div");
    grid.className = "hierarchies-grid";
    data.hierarchies.forEach((h, i) => grid.appendChild(makeHierarchyCard(h, i)));
    container.appendChild(label);
    container.appendChild(grid);
  }

  // 4) Invalid entries
  {
    const label = makeLabel("Invalid Entries");
    const tags = makeTagsBlock(data.invalid_entries || [], "invalid", "✗");
    container.appendChild(label);
    container.appendChild(tags);
  }

  // 5) Duplicate edges
  {
    const label = makeLabel("Duplicate Edges");
    const tags = makeTagsBlock(data.duplicate_edges || [], "duplicate", "⟳");
    container.appendChild(label);
    container.appendChild(tags);
  }

  // 6) Raw JSON toggle
  container.appendChild(makeRawToggle(data));

  section.appendChild(container);
}

// ── Identity Strip ─────────────────────────────────────────────────────────
function makeIdentityStrip(userId, email, roll) {
  const strip = document.createElement("div");
  strip.className = "identity-strip";
  strip.innerHTML = `
    <div class="identity-item">
      <span class="identity-label">User ID</span>
      <span class="identity-value">${esc(userId)}</span>
    </div>
    <div class="identity-item">
      <span class="identity-label">Email</span>
      <span class="identity-value">${esc(email)}</span>
    </div>
    <div class="identity-item">
      <span class="identity-label">Roll Number</span>
      <span class="identity-value">${esc(roll)}</span>
    </div>
  `;
  return strip;
}

// ── Summary Row ────────────────────────────────────────────────────────────
function makeSummaryRow(summary = {}) {
  const row = document.createElement("div");
  row.className = "summary-row";
  row.innerHTML = `
    <div class="summary-card">
      <div class="summary-num trees">${summary.total_trees ?? 0}</div>
      <div class="summary-label">Total Trees</div>
    </div>
    <div class="summary-card">
      <div class="summary-num cycles">${summary.total_cycles ?? 0}</div>
      <div class="summary-label">Cyclic Groups</div>
    </div>
    <div class="summary-card">
      <div class="summary-num root">${esc(summary.largest_tree_root ?? "—")}</div>
      <div class="summary-label">Largest Tree Root</div>
    </div>
  `;
  return row;
}

// ── Hierarchy Card ─────────────────────────────────────────────────────────
function makeHierarchyCard(h, index) {
  const card = document.createElement("div");
  card.className = "hierarchy-card" + (h.has_cycle ? " cycle-card" : "");
  card.id = `hierarchy-card-${index}`;

  const header = document.createElement("div");
  header.className = "hierarchy-header";
  header.setAttribute("role", "button");
  header.setAttribute("aria-expanded", "false");
  header.setAttribute("aria-controls", `hierarchy-body-${index}`);
  header.tabIndex = 0;

  const metaChips = h.has_cycle
    ? `<span class="cycle-chip">⚠ Cycle Detected</span>`
    : `<span class="depth-chip">Depth: ${h.depth}</span>`;

  header.innerHTML = `
    <div class="hierarchy-root-label">
      <span class="root-badge">${esc(h.root)}</span>
      Root: <span>${esc(h.root)}</span>
    </div>
    <div class="hierarchy-meta">
      ${metaChips}
      <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "hierarchy-body";
  body.id = `hierarchy-body-${index}`;

  if (h.has_cycle) {
    body.innerHTML = `
      <p style="color:var(--clr-amber); font-size:13px; display:flex; align-items:center; gap:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        This group contains a cycle — tree structure cannot be rendered.
      </p>
    `;
  } else {
    const vis = document.createElement("div");
    vis.className = "tree-visualiser";
    // h.tree is { root: subtreeObj } — extract the subtree at root
    const subtree = h.tree[h.root] ?? {};
    renderTreeRows(vis, h.root, subtree, "", true);
    body.appendChild(vis);
  }

  // Toggle expand on click / keyboard
  const toggleCard = () => {
    card.classList.toggle("expanded");
    header.setAttribute("aria-expanded", card.classList.contains("expanded"));
  };
  header.addEventListener("click", toggleCard);
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCard(); }
  });

  // Auto-expand first card
  if (index === 0) {
    card.classList.add("expanded");
    header.setAttribute("aria-expanded", "true");
  }

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

/**
 * Recursively renders tree rows into a container element.
 * @param {HTMLElement} container
 * @param {string} nodeName
 * @param {object} subtree  — children sub-object
 * @param {string} prefix   — connector string built up recursively
 * @param {boolean} isRoot  — whether this is the root node
 */
function renderTreeRows(container, nodeName, subtree, prefix, isRoot) {
  const row = document.createElement("div");
  row.className = "tree-node-row";

  const children = Object.keys(subtree);
  const isLeaf = children.length === 0;

  let connectorText = "";
  if (!isRoot) {
    connectorText = prefix;
  }

  const connectorSpan = document.createElement("span");
  connectorSpan.className = "tree-connector";
  connectorSpan.textContent = connectorText;

  const nameSpan = document.createElement("span");
  nameSpan.className =
    "tree-node-name" + (isRoot ? " root-node" : isLeaf ? " leaf" : "");
  nameSpan.textContent = nodeName;

  row.appendChild(connectorSpan);
  row.appendChild(nameSpan);
  container.appendChild(row);

  children.forEach((child, idx) => {
    const isLast = idx === children.length - 1;
    const childPrefix = isRoot
      ? (isLast ? "└── " : "├── ")
      : prefix.replace(/[├└]── $/, isLast ? "    " : "│   ") + (isLast ? "└── " : "├── ");
    renderTreeRows(container, child, subtree[child], childPrefix, false);
  });
}

// ── Tags Block ─────────────────────────────────────────────────────────────
function makeTagsBlock(items, cls, icon) {
  const wrap = document.createElement("div");
  wrap.className = "tags-wrap";
  if (!items || items.length === 0) {
    wrap.innerHTML = `<span class="tag-empty">None</span>`;
  } else {
    items.forEach((item) => {
      const tag = document.createElement("span");
      tag.className = `tag ${cls}`;
      tag.textContent = `${icon} ${item}`;
      wrap.appendChild(tag);
    });
  }
  return wrap;
}

// ── Label ──────────────────────────────────────────────────────────────────
function makeLabel(text) {
  const el = document.createElement("div");
  el.className = "results-label";
  el.textContent = text;
  return el;
}

// ── Raw JSON Toggle ────────────────────────────────────────────────────────
function makeRawToggle(data) {
  const wrapper = document.createElement("div");

  const btn = document.createElement("button");
  btn.className = "raw-toggle-btn";
  btn.id = "raw-toggle-btn";
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
    View Raw JSON
  `;

  const block = document.createElement("pre");
  block.className = "raw-json-block";
  block.style.display = "none";
  block.textContent = JSON.stringify(data, null, 2);

  btn.addEventListener("click", () => {
    const isHidden = block.style.display === "none";
    block.style.display = isHidden ? "block" : "none";
    btn.innerHTML = isHidden
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <polyline points="16 18 22 12 16 6"></polyline>
           <polyline points="8 6 2 12 8 18"></polyline>
         </svg> Hide Raw JSON`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <polyline points="16 18 22 12 16 6"></polyline>
           <polyline points="8 6 2 12 8 18"></polyline>
         </svg> View Raw JSON`;
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(block);
  return wrapper;
}

// ── Error Banner ───────────────────────────────────────────────────────────
function showError(message) {
  const section = document.getElementById("results-section");
  section.innerHTML = `
    <div class="error-banner" role="alert">
      <svg class="error-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div>
        <strong>Error</strong><br/>
        <span>${esc(message)}</span>
      </div>
    </div>
  `;
}

// ── Utility ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
