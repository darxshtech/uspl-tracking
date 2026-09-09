# Testing Queue Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `GET /api/testing` response latency from 3–5 seconds to <100ms by replacing sequential $N+1$ loops and correlated subqueries with vectorized SQL queries and DDL caching.

**Architecture:** 
1. Cache schema initialization (`ensureTestingColumns`) with a module-scoped flag to avoid DDL checks on every GET.
2. Replace correlated developer-name subqueries in main task query with direct `LEFT JOIN`s.
3. Replace sequential JS `for (const tester of testers)` loop with 2 aggregated SQL queries (`GROUP BY`) to fetch tester stats in bulk.

**Tech Stack:** Next.js 16 (App Router), MySQL2 (`mysql2/promise`), TypeScript.

## Global Constraints

- Preserve exact JSON payload structure returned by `GET /api/testing`.
- Zero breaking changes for frontend components in `/dashboard/testing/page.tsx`.

---

### Task 1: DDL Caching & SQL Vectorization in `src/app/api/testing/route.ts`

**Files:**
- Modify: `src/app/api/testing/route.ts`

**Interfaces:**
- Produces: Optimized `GET /api/testing` returning identical JSON structure in <100ms.

- [ ] **Step 1: Add module-level DDL initialization flag**

```typescript
let isSchemaInitialized = false;

async function ensureTestingColumns() {
  if (isSchemaInitialized) return;
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS testing_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        tester_id INT NOT NULL,
        result VARCHAR(20) NOT NULL,
        issues_count INT DEFAULT 0,
        test_sheet_link TEXT NULL,
        remarks TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tr_task (task_id),
        INDEX idx_tr_tester (tester_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    const [cols]: any = await pool.query("SHOW COLUMNS FROM tasks LIKE 'sent_to_testing_at'");
    if (!cols || cols.length === 0) {
      await pool.query("ALTER TABLE tasks ADD COLUMN sent_to_testing_at DATETIME NULL");
    }
    isSchemaInitialized = true;
  } catch (_) {}
}
```

- [ ] **Step 2: Optimize main testing queue SQL query & developer name joins**

Replace correlated developer name subqueries with direct `LEFT JOIN users u_dev ON t.created_by = u_dev.id`.

- [ ] **Step 3: Vectorize tester summaries aggregation (remove N+1 loop)**

Replace `for (const tester of testers)` with bulk queries:
1. `SELECT ... FROM task_time_logs ttl ... WHERE user_id IN (...) AND ... GROUP BY user_id, task_id`
2. `SELECT ... FROM tasks t ... WHERE (assigned_to IN (...) OR id IN (...)) AND status IN ('Completed', 'Tested (PASS)', 'Ready for Demo') GROUP BY assigned_to, project_id`

- [ ] **Step 4: Verify type safety**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Verify production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit changes**

```bash
git add src/app/api/testing/route.ts
git commit -m "perf(testing): vectorize SQL queries and cache DDL checks for 95% faster QA queue"
```
