# Design Spec: Team Credentials Editing & Multi-Folder .env Management

**Date:** 2026-09-11  
**Status:** Approved  
**Author:** Antigravity Team  

---

## 1. Objectives

1. **Project Team URL & Credentials Editing**: Enable any assigned team member (Developer, Tester, PM, Admin, CEO) of a project to edit and update project links (`Live Website Link`, `Demo / Testing Link`, `Direct Login Portal URL`) and credential logins for their assigned projects.
2. **Multi-Folder `.env` Management**: Support projects with multi-service/monorepo architectures (e.g. `hub`, `tenant-backend`, `tenant-frontend`, `mobile-app`, `admin-portal`) by introducing folder-wise `.env` importing, folder tab filtering, and 1-click folder-specific `.env` export in 3rd-Party Credentials Vault.

---

## 2. Architecture & Design

### 2.1 Backend Permissions (`/api/credentials`)
* In `PUT /api/credentials`:
  * Check if the user is an executive (`Admin`, `CEO`, `PM`).
  * If not executive, check if the user is assigned to the project via:
    * `project_members` (`project_id` & `user_id`)
    * `tasks` (`assigned_to = user_id` or in `task_assignees`)
    * `credentials.user_id = currentUserId`
  * If authorized, permit updating `project_id`, `live_link`, `demo_link`, and `credentials_text`.
  * Non-executives can update project links and credential text, while executive managers maintain full multi-assignment authority to assign/reassign other team members.

### 2.2 Multi-Folder Schema & API (`/api/third-party-credentials`)
* **Database Enhancement**:
  * Add `folder_name` column to `project_third_party_credentials` (`VARCHAR(100) DEFAULT 'root' NOT NULL`).
  * Ensure `folder_name` is returned in `GET`, handled in `POST` and `PUT`.
* **Folder Structure**:
  * Default folder: `'root'` (or `'main'`).
  * Custom folder names: e.g. `'hub'`, `'tenant-backend'`, `'frontend'`, `'mobile-app'`, `'admin'`.

### 2.3 3rd-Party Credentials UI Enhancements (`/dashboard/third-party-credentials`)
* **Folder Tabs in Project Vault**:
  * Displays quick folder filter tabs at the top of the project vault: `All Folders`, `📁 root`, `📁 hub`, `📁 tenant-backend`, etc.
  * Shows service count badges on each folder tab.
* **Folder Tagging in Add/Edit Modals**:
  * Includes a Folder Name field (dropdown of existing project folders + ability to type a new folder name).
* **Multi-Folder `.env` Import Modal**:
  * Add **Target Folder Name** selection (e.g., select or enter `hub`, `tenant-backend`, `frontend`, `root`).
  * Support multi-file upload or multi-section `.env` parsing with folder header comments (`# [folder: hub]`).
* **Folder-Specific & Monorepo `.env` Export**:
  * Master Export button dropdown/options:
    1. **Copy Full Monorepo `.env`** (structured by folder headings: `# === FOLDER: hub ===`, `# === FOLDER: tenant-backend ===`).
    2. **Copy Active Folder `.env`** (e.g., copy only `hub/.env` or `tenant-backend/.env` in 1-click).

---

## 3. Verification Plan

1. **Automated Tests & Build**:
   * TypeScript typecheck: `npx tsc --noEmit`
   * Next.js build: `npm run build`
2. **Permission Verification**:
   * Test Developer/Tester updating Live/Demo URLs on an assigned project.
   * Verify non-assigned users are forbidden.
3. **Multi-Folder Verification**:
   * Import `.env` into folder `hub` and another into `tenant-backend`.
   * Verify folder tabs filter services accurately.
   * Verify 1-click folder-specific and master monorepo export produce exact `.env` strings.
