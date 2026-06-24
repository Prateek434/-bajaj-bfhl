# BFHL Hierarchy Explorer

**Chitkara Full Stack Engineering Challenge — Round 1**

> Built by **Prateek Malhotra** | Roll: 2311981388 | Chitkara University

---

## Live Links

| | URL |
|---|---|
| 🌐 **Frontend** | *(add after deploy)* |
| 🔌 **API Base URL** | *(add after deploy)* |

---

## API Usage

### `POST /bfhl`

```bash
curl -X POST https://<your-url>/bfhl \
  -H "Content-Type: application/json" \
  -d '{"data": ["A->B", "A->C", "B->D", "C->E"]}'
```

### Response
```json
{
  "user_id": "prateekmalhotra_04012005",
  "email_id": "prateek1388.be23@chitkarauniversity.edu.in",
  "college_roll_number": "2311981388",
  "hierarchies": [...],
  "invalid_entries": [],
  "duplicate_edges": [],
  "summary": {
    "total_trees": 1,
    "total_cycles": 0,
    "largest_tree_root": "A"
  }
}
```

---

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML / CSS / JavaScript
- **Hosting**: Render.com

## Run Locally

```bash
npm install
npm start
# → http://localhost:3000
```
