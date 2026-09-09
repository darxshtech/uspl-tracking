# Technical Design: Testing Queue Performance Optimization

**Date:** 2026-09-09  
**Status:** Approved  
**Target File:** `src/app/api/testing/route.ts` & `src/app/dashboard/testing/page.tsx`

---

## Executive Summary

The QA Verification & Testing Queue page (`/dashboard/testing`) was experiencing high latency (3–5 seconds) when loading for Management roles (Admin, CEO, PM). The root cause was identified as sequential $N+1$ database queries inside an asynchronous `for` loop over all testers, combined with 3 unindexed correlated subqueries per task row for resolving developer names, and repetitive DDL checks on every GET request.

This design eliminates the $N+1$ loops by replacing them with vectorized SQL queries, caches DDL column checks, and optimizes developer name resolution via `LEFT JOIN`s, reducing latency to <100ms.

---

## Problem Statement

1. **N+1 Database Loop:** `GET /api/testing` executed a sequential `for (const tester of testers)` loop, running two multi-table queries per tester on every request.
2. **Correlated Subqueries:** Each task row evaluated 3 subqueries in MySQL to resolve `developer_name`.
3. **DDL Overhead:** `ensureTestingColumns()` executed `SHOW COLUMNS FROM tasks...` on every request.

---

## Proposed Architecture & Changes

### 1. DDL Schema Check Caching
- Introduce a module-level initialization flag (`let isSchemaInitialized = false`).
- DDL statements (`CREATE TABLE IF NOT EXISTS testing_records` and `SHOW COLUMNS FROM tasks`) execute only once per server startup.

### 2. Direct Developer Name Resolution
- Replace correlated subqueries in task queries with `LEFT JOIN users u_dev ON t.created_by = u_dev.id`.
- Provide fallbacks via `LEFT JOIN projects p` and creator roles.

### 3. Vectorized SQL Aggregation for Tester Workload
- Fetch all active testers in a single query.
- Execute **one aggregated SQL query** using `GROUP BY user_id` for completed testing records.
- Execute **one aggregated SQL query** for today's active time log minutes.
- Build tester workload summaries in memory in $O(N)$ time instead of making $N \times 2$ database roundtrips.

### 4. API Payload Schema Preservation
- Retain the exact JSON schema (`tasks`, `testers`, `project_queue`, `projects_submitted`) to ensure zero breaking changes or regressions in frontend components.

---

## Verification & Testing Plan

1. **Latency Verification:** Confirm GET `/api/testing` returns in <150ms.
2. **TypeScript & Build Check:** Run `npx tsc --noEmit` and `npm run build` to verify 0 build errors.
3. **Data Integrity Check:** Verify that task lists, tester workload statistics, and project submission summaries match existing data accurately.
