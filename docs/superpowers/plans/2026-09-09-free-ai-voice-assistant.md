# 100% Free Smart Scripting & Voice Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 100% free, in-code NLP scripting and voice assistant exclusively for Admin, CEO, and PM roles that understands queries, speaks executive summaries back, and automatically redirects the screen to the target view.

**Architecture:** An in-code NLP intent router (`src/lib/ai-scripting.ts`) coupled with browser-native Web Speech API (`src/lib/speech.ts`) and a floating global assistant drawer component (`src/components/VoiceScriptingAssistant.tsx`) mounted in `src/app/dashboard/layout.tsx`.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, HTML5 Web Speech API (`window.speechSynthesis`, `webkitSpeechRecognition`), Lucide React icons.

## Global Constraints

- Available ONLY for roles: `'Admin'`, `'CEO'`, `'PM'`
- 100% Free: No external AI API keys or third-party paid endpoints
- Clean fallback for browsers without speech recognition (keyboard prompt fallback)

---

### Task 1: Intent & Scripting Router (`src/lib/ai-scripting.ts`)

**Files:**
- Create: `src/lib/ai-scripting.ts`

**Interfaces:**
- Produces: `resolveIntent(query: string, role: string): IntentResult`
```ts
export interface IntentResult {
  matched: boolean;
  intent: string;
  redirectUrl: string;
  speechSummary: string;
  displayText: string;
}
```

- [ ] **Step 1: Write intent resolver module code**

```ts
export interface IntentResult {
  matched: boolean;
  intent: string;
  redirectUrl: string;
  speechSummary: string;
  displayText: string;
}

export function resolveIntent(query: string, role: string): IntentResult {
  const q = query.toLowerCase().trim();
  if (!q) {
    return {
      matched: false,
      intent: "empty",
      redirectUrl: "",
      speechSummary: "Please state your command or query.",
      displayText: "Please enter or speak a query."
    };
  }

  // 1. Testing Queue & QA Status
  if (
    q.includes("testing") || 
    q.includes("qa") || 
    q.includes("bug") || 
    q.includes("test sheet") || 
    q.includes("ready for testing")
  ) {
    return {
      matched: true,
      intent: "testing_queue",
      redirectUrl: "/dashboard/testing",
      speechSummary: "Opening QA Verification and Testing Queue.",
      displayText: "Redirecting to QA Verification & Testing Queue..."
    };
  }

  // 2. 3rd-Party Credentials
  if (
    q.includes("credential") || 
    q.includes("password") || 
    q.includes("api key") || 
    q.includes("cloudinary") || 
    q.includes("whatsapp") || 
    q.includes("secret")
  ) {
    return {
      matched: true,
      intent: "credentials",
      redirectUrl: "/dashboard/credentials",
      speechSummary: "Navigating to 3rd-Party Credentials vault.",
      displayText: "Redirecting to 3rd-Party Credentials Vault..."
    };
  }

  // 3. Projects Overview
  if (
    q.includes("project") || 
    q.includes("active project") || 
    q.includes("client project")
  ) {
    return {
      matched: true,
      intent: "projects",
      redirectUrl: "/dashboard/projects",
      speechSummary: "Opening Projects overview board.",
      displayText: "Redirecting to Projects..."
    };
  }

  // 4. Shift Warnings & Tardiness
  if (
    q.includes("shift warning") || 
    q.includes("warning") || 
    q.includes("late") || 
    q.includes("tardy")
  ) {
    return {
      matched: true,
      intent: "shift_warnings",
      redirectUrl: "/dashboard/shift-warnings",
      speechSummary: "Opening Shift Warnings and employee tardiness monitoring.",
      displayText: "Redirecting to Shift Warnings..."
    };
  }

  // 5. Attendance & Daily Check-in
  if (
    q.includes("attendance") || 
    q.includes("present") || 
    q.includes("absent") || 
    q.includes("check in")
  ) {
    return {
      matched: true,
      intent: "attendance",
      redirectUrl: "/dashboard/attendance",
      speechSummary: "Opening Employee Attendance records.",
      displayText: "Redirecting to Attendance Dashboard..."
    };
  }

  // 6. Daily Tasks & Developer Progress
  if (
    q.includes("daily task") || 
    q.includes("task") || 
    q.includes("developer task") || 
    q.includes("progress")
  ) {
    return {
      matched: true,
      intent: "daily_tasks",
      redirectUrl: "/dashboard/daily-tasks",
      speechSummary: "Opening Daily Tasks board.",
      displayText: "Redirecting to Daily Tasks..."
    };
  }

  // 7. Work Accomplishments
  if (
    q.includes("accomplishment") || 
    q.includes("work log") || 
    q.includes("completed today")
  ) {
    return {
      matched: true,
      intent: "accomplishments",
      redirectUrl: "/dashboard/accomplishments",
      speechSummary: "Opening Work Accomplishments history.",
      displayText: "Redirecting to Work Accomplishments..."
    };
  }

  // 8. Salary Payout Status
  if (
    q.includes("salary") || 
    q.includes("payout") || 
    q.includes("pay")
  ) {
    return {
      matched: true,
      intent: "payouts",
      redirectUrl: "/dashboard/salary-payout",
      speechSummary: "Opening Salary Payout Status report.",
      displayText: "Redirecting to Salary Payout Status..."
    };
  }

  // 9. Document Vault & Policies
  if (q.includes("policy") || q.includes("policies")) {
    return {
      matched: true,
      intent: "policies",
      redirectUrl: "/dashboard/company-policies",
      speechSummary: "Opening Company Policies.",
      displayText: "Redirecting to Company Policies..."
    };
  }

  if (q.includes("document") || q.includes("vault")) {
    return {
      matched: true,
      intent: "documents",
      redirectUrl: "/dashboard/document-vault",
      speechSummary: "Opening Document Vault.",
      displayText: "Redirecting to Document Vault..."
    };
  }

  // Fallback for unknown intent
  return {
    matched: false,
    intent: "unknown",
    redirectUrl: "",
    speechSummary: `I didn't recognize that command. Try asking about testing queue, credentials, projects, attendance, or daily tasks.`,
    displayText: `Unrecognized query. Try: "show testing queue", "open credentials", "show attendance"`
  };
}
```

- [ ] **Step 2: Commit file**
```bash
git add src/lib/ai-scripting.ts
git commit -m "feat(ai-scripting): add in-code intent and navigation scripting engine"
```

---

### Task 2: Web Speech API Manager (`src/lib/speech.ts`)

**Files:**
- Create: `src/lib/speech.ts`

- [ ] **Step 1: Write Web Speech manager module**

```ts
// Browser Text-to-Speech (window.speechSynthesis)
export function speakText(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any active audio
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("SpeechSynthesis error:", err);
    if (onEnd) onEnd();
  }
}

// Browser Speech Recognition (webkitSpeechRecognition)
export function createSpeechRecognizer(
  onResult: (text: string) => void,
  onError: (err: any) => void
) {
  if (typeof window === "undefined") return null;

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      onError(event.error);
    };

    return recognition;
  } catch (err) {
    onError(err);
    return null;
  }
}
```

- [ ] **Step 2: Commit file**
```bash
git add src/lib/speech.ts
git commit -m "feat(speech): add browser native text-to-speech and speech recognition manager"
```

---

### Task 3: Global Assistant Drawer Component (`src/components/VoiceScriptingAssistant.tsx`)

**Files:**
- Create: `src/components/VoiceScriptingAssistant.tsx`

- [ ] **Step 1: Write VoiceScriptingAssistant UI Component**

```tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { resolveIntent, IntentResult } from "@/lib/ai-scripting";
import { speakText, createSpeechRecognizer } from "@/lib/speech";
import { Bot, Mic, MicOff, Send, X, Sparkles, Navigation, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function VoiceScriptingAssistant() {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [lastResult, setLastResult] = useState<IntentResult | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognizerRef = useRef<any>(null);

  // Restrict feature to Admin, CEO, PM
  const isExecutive = ["Admin", "CEO", "PM"].includes(userRole);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(Boolean(SpeechRecognition));
    }
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K to toggle assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isExecutive) return null;

  const handleStartListening = () => {
    if (isListening) {
      if (recognizerRef.current) recognizerRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognizer = createSpeechRecognizer(
      (transcript) => {
        setQuery(transcript);
        setIsListening(false);
        processQuery(transcript);
      },
      (err) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
      }
    );

    if (recognizer) {
      recognizerRef.current = recognizer;
      setIsListening(true);
      recognizer.start();
    } else {
      setSpeechSupported(false);
    }
  };

  const processQuery = (inputQuery: string) => {
    const result = resolveIntent(inputQuery, userRole);
    setLastResult(result);

    // Speak response using Web Speech synthesis
    if (result.speechSummary) {
      speakText(result.speechSummary, () => {
        // Redirection on speech end or immediately
        if (result.matched && result.redirectUrl) {
          router.push(result.redirectUrl);
          setIsOpen(false);
        }
      });
    }

    if (result.matched && result.redirectUrl && !result.speechSummary) {
      router.push(result.redirectUrl);
      setIsOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    processQuery(query);
  };

  return (
    <>
      {/* Floating Trigger Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold shadow-xl hover:scale-105 transition-all cursor-pointer border-2 border-white/20"
        title="Open Executive AI Voice Assistant (Ctrl+K)"
      >
        <Bot className="h-5 w-5 text-amber-300 animate-pulse" />
        <span className="text-xs tracking-wide">AI Assistant</span>
        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+K</span>
      </button>

      {/* Floating Assistant Drawer */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-indigo-500/30 flex items-center justify-center border border-indigo-400/40">
                <Sparkles className="h-4 w-4 text-amber-300" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                  Executive Voice Assistant
                </h3>
                <p className="text-[10px] text-indigo-200 font-medium">100% Free • Voice & Navigation</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Response Output Panel */}
          <div className="p-4 space-y-3 bg-slate-50/70 min-h-[140px] max-h-[220px] overflow-y-auto">
            {lastResult ? (
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-indigo-100 shadow-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[11px]">
                    <Volume2 className="h-3.5 w-3.5 text-purple-600" />
                    <span>Executive Summary:</span>
                  </div>
                  <p className="text-slate-800 font-medium leading-relaxed">
                    {lastResult.displayText}
                  </p>
                </div>

                {lastResult.redirectUrl && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <Navigation className="h-3.5 w-3.5" />
                    Target: {lastResult.redirectUrl}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs space-y-2">
                <Bot className="h-8 w-8 text-indigo-400 mx-auto opacity-70" />
                <p className="font-bold text-slate-700">Ask or speak any command:</p>
                <div className="flex flex-wrap gap-1 justify-center text-[10px] text-indigo-600">
                  <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">"Show testing queue"</span>
                  <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">"Open credentials"</span>
                  <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">"Shift warnings"</span>
                </div>
              </div>
            )}
          </div>

          {/* Input & Voice Controls */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isListening ? "Listening to your voice..." : "Type or speak command..."}
              className="text-xs flex-1 h-9 rounded-xl focus-visible:ring-indigo-500"
            />

            {speechSupported && (
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={handleStartListening}
                className={`h-9 w-9 rounded-xl shrink-0 ${isListening ? "animate-pulse" : "hover:bg-indigo-50 text-indigo-700 border-indigo-200"}`}
                title={isListening ? "Stop listening" : "Click to speak"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}

            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              title="Submit command"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit file**
```bash
git add src/components/VoiceScriptingAssistant.tsx
git commit -m "feat(ui): add VoiceScriptingAssistant floating widget for Admin, CEO, PM"
```

---

### Task 4: Mount Assistant in Dashboard Layout (`src/app/dashboard/layout.tsx`)

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Import and render `VoiceScriptingAssistant` inside dashboard shell**

```tsx
// Add import:
import VoiceScriptingAssistant from "@/components/VoiceScriptingAssistant";

// Inside layout JSX before return closing tag:
<VoiceScriptingAssistant />
```

- [ ] **Step 2: Commit changes**
```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat(layout): mount VoiceScriptingAssistant globally in dashboard layout"
```

---

### Task 5: Verification & Typecheck

- [ ] **Step 1: Run TypeScript typecheck**
```bash
npx tsc --noEmit
```
Expected: PASS (0 errors)

- [ ] **Step 2: Push changes to branch `darsh`**
```bash
git push origin darsh
```
