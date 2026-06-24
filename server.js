const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Identity (hardcoded per spec) ───────────────────────────────────────────
const IDENTITY = {
  user_id: "prateekmalhotra_04012005",
  email_id: "prateek1388.be23@chitkarauniversity.edu.in",
  college_roll_number: "2311981388",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validates a trimmed entry against the pattern X->Y
 * where X and Y are each exactly one uppercase letter (A–Z), X !== Y.
 */
function isValidEdge(entry) {
  return /^[A-Z]->[A-Z]$/.test(entry);
}

/**
 * Builds a nested tree object from a root node given
 * an adjacency list (Map<parent, child[]>).
 * Returns an empty object {} if a cycle is detected during traversal.
 * Uses iterative DFS with a visited-path set to detect cycles.
 */
function buildTree(root, adjList) {
  // First, detect cycles in the whole connected component reachable from root
  if (hasCycleFromRoot(root, adjList)) {
    return null; // signal: cycle detected
  }
  return buildSubTree(root, adjList);
}

function buildSubTree(node, adjList) {
  const children = adjList.get(node) || [];
  const treeNode = {};
  for (const child of children) {
    treeNode[child] = buildSubTree(child, adjList);
  }
  return treeNode;
}

/**
 * DFS cycle detection from a given root using a recursion stack.
 */
function hasCycleFromRoot(root, adjList) {
  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    visited.add(node);
    stack.add(node);
    for (const neighbor of adjList.get(node) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (stack.has(neighbor)) {
        return true;
      }
    }
    stack.delete(node);
    return false;
  }

  return dfs(root);
}

/**
 * Calculates the depth (number of nodes on the longest root-to-leaf path)
 * of a nested tree object.
 */
function calcDepth(treeObj) {
  const children = Object.keys(treeObj);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((c) => calcDepth(treeObj[c])));
}

// ─── POST /bfhl ──────────────────────────────────────────────────────────────
app.post("/bfhl", (req, res) => {
  const { data } = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "data must be an array of strings" });
  }

  const invalidEntries = [];
  const duplicateEdges = [];
  const seenEdges = new Set();          // tracks first-seen valid edges
  const duplicateTracked = new Set();   // ensures each dup is added once

  // Adjacency list: parent → [children] (ordered by first encounter)
  const adjList = new Map();
  // All nodes that appear as children (to find roots later)
  const childNodes = new Set();
  // All nodes encountered in valid edges
  const allNodes = new Set();

  // ── Step 1: Parse & categorise entries ───────────────────────────────────
  for (const rawEntry of data) {
    if (typeof rawEntry !== "string") {
      invalidEntries.push(String(rawEntry));
      continue;
    }

    const entry = rawEntry.trim();

    // Validate format
    if (!isValidEdge(entry)) {
      invalidEntries.push(rawEntry); // push original (trimmed below? spec says trim first then validate)
      // Actually spec says trim whitespace first, then validate — so push entry (trimmed)
      continue;
    }

    const [parent, child] = entry.split("->");

    // Self-loop check (already covered by regex since X !== Y when both are [A-Z] only
    // — actually regex allows A->A, so check explicitly)
    if (parent === child) {
      invalidEntries.push(entry);
      continue;
    }

    const edgeKey = `${parent}->${child}`;

    if (seenEdges.has(edgeKey)) {
      // Duplicate — push only the first repeated occurrence per edge key
      if (!duplicateTracked.has(edgeKey)) {
        duplicateEdges.push(edgeKey);
        duplicateTracked.add(edgeKey);
      }
      continue;
    }

    // Valid, non-duplicate edge
    seenEdges.add(edgeKey);
    allNodes.add(parent);
    allNodes.add(child);
    childNodes.add(child);

    // Diamond / multi-parent rule: if child already has a parent, silently discard
    // We track this by checking if child is already in adjList values
    // Actually the spec says "first-encountered parent edge wins; subsequent parent edges for that child are silently discarded"
    // We handle this by checking our childParent map
    if (!adjList.has(parent)) {
      adjList.set(parent, []);
    }
    adjList.get(parent).push(child);
  }

  // ── Multi-parent (diamond) resolution ─────────────────────────────────────
  // Remove subsequent parent edges for children that already have a parent
  const assignedParent = new Map(); // child -> first parent
  // We need to rebuild adjList respecting the diamond rule
  // Re-process seenEdges in insertion order
  const cleanAdjList = new Map();
  const cleanChildNodes = new Set();
  const cleanAllNodes = new Set();

  for (const edgeKey of seenEdges) {
    const [parent, child] = edgeKey.split("->");
    // If child already has a parent assigned, silently discard
    if (assignedParent.has(child)) continue;

    assignedParent.set(child, parent);
    if (!cleanAdjList.has(parent)) cleanAdjList.set(parent, []);
    cleanAdjList.get(parent).push(child);
    cleanChildNodes.add(child);
    cleanAllNodes.add(parent);
    cleanAllNodes.add(child);
  }

  // ── Step 2: Find connected components ─────────────────────────────────────
  // Roots: nodes that never appear as children in valid edges
  const roots = [...cleanAllNodes].filter((n) => !cleanChildNodes.has(n));

  // Build full node set per component via BFS/DFS
  function getComponent(startNode) {
    const visited = new Set();
    const queue = [startNode];
    while (queue.length) {
      const node = queue.shift();
      if (visited.has(node)) continue;
      visited.add(node);
      for (const child of cleanAdjList.get(node) || []) {
        queue.push(child);
      }
    }
    return visited;
  }

  const hierarchies = [];
  const processedNodes = new Set();

  // Process trees starting from explicit roots
  for (const root of roots.sort()) {
    const component = getComponent(root);
    component.forEach((n) => processedNodes.add(n));

    const treeResult = buildTree(root, cleanAdjList);
    if (treeResult === null) {
      // Cycle detected (shouldn't happen for rooted trees, but handle gracefully)
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const depth = calcDepth(treeResult);
      hierarchies.push({ root, tree: { [root]: treeResult }, depth });
    }
  }

  // Detect cyclic groups: any valid nodes not yet processed
  // (pure cycles have no root — every node appears as a child)
  const unprocessed = [...cleanAllNodes].filter((n) => !processedNodes.has(n));

  if (unprocessed.length > 0) {
    // Find connected components among unprocessed nodes
    // Build an undirected adjacency for component finding
    const undirected = new Map();
    for (const node of unprocessed) {
      undirected.set(node, new Set());
    }
    for (const [parent, children] of cleanAdjList) {
      if (!unprocessed.includes(parent)) continue;
      for (const child of children) {
        if (!unprocessed.includes(child)) continue;
        if (!undirected.has(parent)) undirected.set(parent, new Set());
        if (!undirected.has(child)) undirected.set(child, new Set());
        undirected.get(parent).add(child);
        undirected.get(child).add(parent);
      }
    }

    const cycleVisited = new Set();

    for (const startNode of unprocessed.sort()) {
      if (cycleVisited.has(startNode)) continue;

      // BFS to get this cyclic component
      const cycleQueue = [startNode];
      const cycleComponent = new Set();
      while (cycleQueue.length) {
        const node = cycleQueue.shift();
        if (cycleComponent.has(node)) continue;
        cycleComponent.add(node);
        cycleVisited.add(node);
        for (const neighbor of undirected.get(node) || []) {
          if (!cycleComponent.has(neighbor)) cycleQueue.push(neighbor);
        }
      }

      // Use lexicographically smallest node as root for pure cycles
      const cycleRoot = [...cycleComponent].sort()[0];
      hierarchies.push({ root: cycleRoot, tree: {}, has_cycle: true });
    }
  }

  // ── Step 3: Build summary ─────────────────────────────────────────────────
  const nonCyclicTrees = hierarchies.filter((h) => !h.has_cycle);
  const cyclicGroups = hierarchies.filter((h) => h.has_cycle);

  let largestTreeRoot = null;
  if (nonCyclicTrees.length > 0) {
    let maxDepth = -1;
    for (const h of nonCyclicTrees) {
      if (
        h.depth > maxDepth ||
        (h.depth === maxDepth && h.root < largestTreeRoot)
      ) {
        maxDepth = h.depth;
        largestTreeRoot = h.root;
      }
    }
  }

  const summary = {
    total_trees: nonCyclicTrees.length,
    total_cycles: cyclicGroups.length,
    largest_tree_root: largestTreeRoot,
  };

  // ── Response ──────────────────────────────────────────────────────────────
  return res.status(200).json({
    ...IDENTITY,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary,
  });
});

// ─── GET /bfhl (health check) ─────────────────────────────────────────────────
app.get("/bfhl", (req, res) => {
  res.status(200).json({ status: "ok", message: "BFHL API is running" });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  BFHL server running at http://localhost:${PORT}`);
});
