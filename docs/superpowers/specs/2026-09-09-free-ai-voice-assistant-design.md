# Design Document: 100% Free Smart Scripting & Voice Assistant for Executive Roles

**Date:** 2026-09-09  
**Target Roles:** Admin, CEO, PM  
**Cost Model:** 100% Free (In-code NLP intent parser + Browser-native Web Speech API)

---

## 1. Executive Summary

This feature adds a global **Smart Voice & Scripting Assistant** exclusively for leadership roles (`Admin`, `CEO`, `PM`) across the entire tracking portal. 

The assistant allows executive users to ask questions or speak commands about system data (testing queue, active projects, credentials, attendance, shift warnings, daily tasks, payouts) via voice or text prompt. The assistant parses the intent, speaks back an executive summary using browser-native Text-to-Speech (`window.speechSynthesis`), and automatically redirects the user's browser screen to the target view/modal (`router.push`).

---

## 2. System Architecture & Components

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Dashboard Layout Shell                           │
│   (Rendered globally for session.user.role IN ['Admin', 'CEO', 'PM'])  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │    VoiceScriptingAssistant (UI)      │
                 │ - Floating trigger button & drawer  │
                 │ - Voice wave animation               │
                 │ - Speech-to-Text & Input Prompt      │
                 └──────────────────┬───────────────────┘
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
      ┌───────────────────────────┐    ┌───────────────────────────┐
      │   Speech Engine (Web Audio)│    │   Intent Scripting Router │
      │ - webkitSpeechRecognition │    │   (src/lib/ai-scripting.ts)│
      │ - window.speechSynthesis  │    │ - Fuzzy intent matcher    │
      └───────────────────────────┘    │ - Screen redirect mapper  │
                                       │ - Executive voice summary │
                                       └─────────────┬─────────────┘
                                                     │
                                                     ▼
                                       ┌───────────────────────────┐
                                       │  Next.js App Navigation   │
                                       │ - router.push(targetUrl)  │
                                       │ - Target tab/filter state │
                                       └───────────────────────────┘
```

### Key Modules:

1. **`src/lib/ai-scripting.ts` (Smart Intent & Scripting Router):**
   - Implements zero-cost intent resolution and command routing.
   - Maps user query strings to target routes, quick status summaries, and voice speech responses.
   - **Supported System Intent Domains:**
     - **Testing Queue:** `/dashboard/testing` ("testing queue", "qa queue", "tasks ready for testing", "bugs reported")
     - **3rd-Party Credentials:** `/dashboard/credentials` ("credentials", "passwords", "cloudinary", "whatsapp api", "project credentials")
     - **Projects Overview:** `/dashboard/projects` ("projects list", "active projects", "project status")
     - **Attendance & Shift Warnings:** `/dashboard/attendance`, `/dashboard/shift-warnings` ("attendance", "who is present", "late arrivals", "shift warnings")
     - **Daily Tasks & Work Accomplishments:** `/dashboard/daily-tasks`, `/dashboard/accomplishments` ("daily tasks", "accomplishments", "what dev completed")
     - **Salary & Payouts:** `/dashboard/salary-payout` ("salary status", "payouts")
     - **Documents & Policy:** `/dashboard/document-vault`, `/dashboard/company-policies` ("document vault", "company policies")

2. **`src/lib/speech.ts` (Browser Native Web Speech Manager):**
   - Manages browser `SpeechSynthesisUtterance` for speaking back summaries to the user.
   - Manages `webkitSpeechRecognition` / `SpeechRecognition` for listening to user voice input.
   - Provides text keyboard input fallback when microphone is unavailable.

3. **`src/components/VoiceScriptingAssistant.tsx` (Global Assistant Drawer):**
   - Floating AI assistant icon in bottom-right corner of dashboard layout.
   - Accessible via keyboard shortcut `Ctrl+K` or clicking the widget.
   - Displays real-time voice speech transcription, executive spoken summary response, and automatic screen redirection notice.

4. **`src/app/dashboard/layout.tsx` Integration:**
   - Wraps dashboard layout so the assistant is available seamlessly on every page.
   - Restricts rendering to authorized roles: `Admin`, `CEO`, `PM`.

---

## 3. Intent Routing Specification

| Input Intent Pattern | Target Screen / Route | Spoken Executive Response | Action Triggered |
| :--- | :--- | :--- | :--- |
| *"show testing queue"*, *"how many tasks in QA?"* | `/dashboard/testing` | *"Navigating to QA Verification & Testing Queue."* | Screen Redirect |
| *"show 3rd party credentials"*, *"project keys"* | `/dashboard/credentials` | *"Opening 3rd-Party Credentials vault for assigned projects."* | Screen Redirect |
| *"who is present today?"*, *"attendance"* | `/dashboard/attendance` | *"Opening Employee Attendance & Daily Check-in records."* | Screen Redirect |
| *"show shift warnings"*, *"late check-ins"* | `/dashboard/shift-warnings` | *"Navigating to Shift Warnings and tardiness monitoring."* | Screen Redirect |
| *"show active projects"* | `/dashboard/projects` | *"Opening Projects overview board."* | Screen Redirect |
| *"show daily tasks"*, *"developer progress"* | `/dashboard/daily-tasks` | *"Navigating to Daily Tasks board."* | Screen Redirect |
| *"salary status"*, *"payouts"* | `/dashboard/salary-payout` | *"Opening Salary Payout Status report."* | Screen Redirect |

---

## 4. Security & Access Control

- **Role Verification:** Client and component level checks verify `session?.user?.role` is one of `['Admin', 'CEO', 'PM']`.
- **System Isolation:** Non-executive roles (`Developer`, `Tester`) will not have access to or see the assistant component.

---

## 5. Verification Plan

1. **Unit & Type Safety Check:** Run `npx tsc --noEmit` to verify type safety across new NLP router and speech modules.
2. **Intent Engine Verification:** Test intent resolution for all 7 primary dashboard route domains.
3. **UI Integration:** Ensure component mounts in `src/app/dashboard/layout.tsx` for Admin, CEO, PM.
