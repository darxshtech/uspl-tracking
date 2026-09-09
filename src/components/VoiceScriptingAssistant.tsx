"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { resolveIntentAsync, IntentResult, EmployeeData, ComparativeData } from "@/lib/ai-scripting";
import { speakText, createSpeechRecognizer } from "@/lib/speech";
import { 
  Bot, 
  Mic, 
  MicOff, 
  Send, 
  X, 
  Sparkles, 
  Navigation, 
  Volume2, 
  AlertCircle, 
  User, 
  Briefcase, 
  CreditCard, 
  CheckCircle2, 
  Mail, 
  Phone, 
  Calendar,
  ExternalLink,
  ChevronRight,
  Swords,
  Trophy,
  TrendingUp,
  ArrowRightLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function VoiceScriptingAssistant() {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [lastResult, setLastResult] = useState<IntentResult | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  const recognizerRef = useRef<any>(null);

  // Restrict feature exclusively to Admin, CEO, PM
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

  const handleStartListening = async () => {
    setMicError(null);
    if (isListening) {
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    // Explicitly request microphone access to trigger browser permission prompt
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err: any) {
      console.error("Microphone access error:", err);
      const errMsg = "Microphone access denied. Please allow microphone permissions in your browser.";
      setMicError(errMsg);
      setLastResult({
        matched: false,
        intent: "error",
        redirectUrl: "",
        speechSummary: errMsg,
        displayText: "🎤 Microphone permission denied. Please allow mic access in browser settings."
      });
      return;
    }

    const recognizer = createSpeechRecognizer(
      (transcript, isFinal) => {
        if (isFinal) {
          setQuery(transcript);
          setInterimText("");
          setIsListening(false);
          processQuery(transcript);
        } else {
          setInterimText(transcript);
          setQuery(transcript);
        }
      },
      (err) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
        if (err !== "no-speech" && err !== "aborted") {
          const errDetail = `Speech error: ${err}. Try typing or speak clearly.`;
          setMicError(errDetail);
        }
      },
      () => {
        setIsListening(false);
      }
    );

    if (recognizer) {
      recognizerRef.current = recognizer;
      setIsListening(true);
      setInterimText("");
      try {
        recognizer.start();
      } catch (e: any) {
        console.error("Failed to start recognizer:", e);
        setIsListening(false);
      }
    } else {
      setSpeechSupported(false);
    }
  };

  const processQuery = async (inputQuery: string) => {
    setIsProcessing(true);
    const result = await resolveIntentAsync(inputQuery, userRole);
    setLastResult(result);
    setIsProcessing(false);

    // Cache last successful query in localStorage for offline availability
    try {
      if (result.matched) {
        localStorage.setItem("unitglo_ai_last_intent", JSON.stringify({
          query: inputQuery,
          intent: result,
          timestamp: Date.now()
        }));
      }
    } catch (_) {}

    // Speak response using Web Speech synthesis
    if (result.speechSummary) {
      speakText(result.speechSummary, () => {
        // Automatically redirect on speech end if not an detailed data card view
        if (result.matched && result.redirectUrl && result.intent !== "employee_data" && result.intent !== "employee_comparison") {
          router.push(result.redirectUrl);
          setIsOpen(false);
        }
      });
    }

    if (result.matched && result.redirectUrl && !result.speechSummary && result.intent !== "employee_data" && result.intent !== "employee_comparison") {
      router.push(result.redirectUrl);
      setIsOpen(false);
    }
  };

  const handleShortcutClick = (cmd: string) => {
    setQuery(cmd);
    processQuery(cmd);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    processQuery(query);
  };

  return (
    <>
      {/* Floating Trigger Badge - Responsive for mobile & desktop */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full text-white font-extrabold shadow-2xl hover:scale-105 transition-all cursor-pointer border-2 border-white/20 ${
          isListening 
            ? "bg-gradient-to-r from-rose-600 to-red-600 animate-pulse ring-4 ring-rose-300/50" 
            : "bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:shadow-indigo-500/30"
        }`}
        title="Open Executive AI Voice Assistant (Ctrl+K)"
      >
        {isListening ? (
          <Mic className="h-5 w-5 text-amber-200 animate-spin" />
        ) : (
          <Bot className="h-5 w-5 text-amber-300 animate-pulse" />
        )}
        <span className="text-xs tracking-wide">
          {isListening ? "Listening..." : "AI Assistant"}
        </span>
        <span className="hidden sm:inline-block text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+K</span>
      </button>

      {/* Floating Assistant Drawer - Fully Responsive Bottom Sheet on Mobile */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-20 sm:right-5 z-50 w-full sm:w-[440px] rounded-t-3xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 max-h-[88vh] sm:max-h-[640px] flex flex-col">
          
          {/* Mobile Handle Bar */}
          <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-1.5 sm:hidden shrink-0" />

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-3.5 sm:p-4 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-indigo-500/30 flex items-center justify-center border border-indigo-400/40">
                <Sparkles className="h-4 w-4 text-amber-300" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5">
                  Executive Voice Assistant
                </h3>
                <p className="text-[10px] text-indigo-200 font-medium">100% Free • Multi-Employee Speech Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowLegend(!showLegend)}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                  showLegend ? "bg-amber-400 text-slate-950" : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title="Toggle Voice Command Cheat Sheet"
              >
                {showLegend ? "Hide Guide" : "Voice Guide"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ACTIVE LISTENING BANNER */}
          {isListening && (
            <div className="bg-rose-600 text-white px-3 py-2 text-xs font-bold flex items-center justify-between animate-pulse shrink-0">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-amber-200 animate-ping" />
                <span>Listening live... speak now!</span>
              </div>
              <span className="text-[10px] bg-rose-800 px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
                {interimText || "Speak command..."}
              </span>
            </div>
          )}

          {/* PROCESSING BANNER */}
          {isProcessing && (
            <div className="bg-indigo-600 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-2 shrink-0 animate-pulse">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-spin" />
              <span>Analyzing comparative performance...</span>
            </div>
          )}

          {/* MIC ERROR BANNER */}
          {micError && (
            <div className="bg-amber-500 text-slate-950 px-3 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{micError}</span>
            </div>
          )}

          {/* VOICE COMMAND SHORTCUTS LEGEND CHEAT SHEET */}
          {showLegend ? (
            <div className="p-3 bg-slate-900 text-white space-y-2.5 text-xs flex-1 overflow-y-auto max-h-[320px]">
              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> All Voice Commands (Click to Run):
              </div>
              <div className="space-y-2 text-[11px]">
                <div>
                  <div className="font-bold text-indigo-300 mb-1">⚔️ Multi-Employee Comparison Speech:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("compare Alex and John")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"compare Alex and John"</button>
                    <button onClick={() => handleShortcutClick("compare productivity of Alex and Sarah")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"compare productivity of Alex and Sarah"</button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-indigo-300 mb-1">🗣️ Single Employee Data Briefing:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("tell me data of Alex")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"tell me data of Alex"</button>
                    <button onClick={() => handleShortcutClick("salary of John")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"salary of John"</button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-indigo-300 mb-1">🧪 Testing & QA Queue:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("show testing queue")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"show testing queue"</button>
                    <button onClick={() => handleShortcutClick("show QA for car and bike")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"QA for car and bike"</button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-indigo-300 mb-1">🔑 Credentials & Analytics:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("open 3rd party credentials")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"3rd party credentials"</button>
                    <button onClick={() => handleShortcutClick("who is present today")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"who is present today"</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Response Output Panel */
            <div className="p-3.5 sm:p-4 space-y-3 bg-slate-50/70 flex-1 overflow-y-auto max-h-[360px] sm:max-h-[340px]">
              {lastResult ? (
                <div className="space-y-3 text-xs">
                  
                  {/* VERBAL SPEECH SUMMARY DISPLAY */}
                  <div className="p-3 rounded-xl bg-white border border-indigo-100 shadow-sm space-y-1.5">
                    <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold text-[11px]">
                      <Volume2 className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
                      <span>Executive Speech Output:</span>
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {lastResult.speechSummary || lastResult.displayText}
                    </p>
                  </div>

                  {/* MULTI-EMPLOYEE COMPARATIVE PERFORMANCE CARD */}
                  {lastResult.comparativeData && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white shadow-md border border-indigo-500/30 space-y-3 animate-in fade-in zoom-in-95">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-400/30 text-amber-300">
                            <Swords className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-black text-xs text-white">Side-by-Side Comparison</div>
                            <div className="text-[10px] text-indigo-200">Task Completion & Efficiency Rates</div>
                          </div>
                        </div>
                        {lastResult.comparativeData.leaderName && (
                          <Badge className="bg-amber-400 text-slate-950 font-extrabold text-[9px] px-2 py-0.5 shadow-sm shrink-0">
                            🏆 Leader: {lastResult.comparativeData.leaderName}
                          </Badge>
                        )}
                      </div>

                      {/* Side by Side Grid */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {/* Employee 1 Column */}
                        <div className={`p-2.5 rounded-lg border space-y-2 ${
                          lastResult.comparativeData.leaderName === lastResult.comparativeData.emp1.name
                            ? "bg-indigo-900/40 border-amber-400/50 ring-1 ring-amber-400/30"
                            : "bg-white/5 border-white/10"
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-[10px]">
                              {lastResult.comparativeData.emp1.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-white text-[11px] truncate">{lastResult.comparativeData.emp1.name}</div>
                              <div className="text-[9px] text-indigo-300 truncate">{lastResult.comparativeData.emp1.role}</div>
                            </div>
                          </div>

                          <div className="space-y-1 text-[10px]">
                            <div className="flex items-center justify-between text-slate-300">
                              <span>Efficiency:</span>
                              <span className="font-bold text-amber-300">{lastResult.comparativeData.emp1.efficiency}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-gradient-to-r from-indigo-400 to-amber-400 h-full rounded-full" style={{ width: `${Math.min(100, lastResult.comparativeData.emp1.efficiency || 0)}%` }} />
                            </div>

                            <div className="flex items-center justify-between text-slate-300 pt-1">
                              <span>Tasks:</span>
                              <span className="font-bold text-emerald-300">{lastResult.comparativeData.emp1.completedTasks}/{lastResult.comparativeData.emp1.totalTasks}</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span>Salary:</span>
                              <span className="font-bold text-sky-300">₹{Number(lastResult.comparativeData.emp1.monthly_salary || 0).toLocaleString("en-IN")}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/dashboard/employees?highlight=${encodeURIComponent(lastResult.comparativeData!.emp1.name)}`);
                              setIsOpen(false);
                            }}
                            className="w-full text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white py-1 rounded transition-colors text-center cursor-pointer"
                          >
                            View Record
                          </button>
                        </div>

                        {/* Employee 2 Column */}
                        <div className={`p-2.5 rounded-lg border space-y-2 ${
                          lastResult.comparativeData.leaderName === lastResult.comparativeData.emp2.name
                            ? "bg-indigo-900/40 border-amber-400/50 ring-1 ring-amber-400/30"
                            : "bg-white/5 border-white/10"
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center font-bold text-[10px]">
                              {lastResult.comparativeData.emp2.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-white text-[11px] truncate">{lastResult.comparativeData.emp2.name}</div>
                              <div className="text-[9px] text-indigo-300 truncate">{lastResult.comparativeData.emp2.role}</div>
                            </div>
                          </div>

                          <div className="space-y-1 text-[10px]">
                            <div className="flex items-center justify-between text-slate-300">
                              <span>Efficiency:</span>
                              <span className="font-bold text-amber-300">{lastResult.comparativeData.emp2.efficiency}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-gradient-to-r from-purple-400 to-amber-400 h-full rounded-full" style={{ width: `${Math.min(100, lastResult.comparativeData.emp2.efficiency || 0)}%` }} />
                            </div>

                            <div className="flex items-center justify-between text-slate-300 pt-1">
                              <span>Tasks:</span>
                              <span className="font-bold text-emerald-300">{lastResult.comparativeData.emp2.completedTasks}/{lastResult.comparativeData.emp2.totalTasks}</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-300">
                              <span>Salary:</span>
                              <span className="font-bold text-sky-300">₹{Number(lastResult.comparativeData.emp2.monthly_salary || 0).toLocaleString("en-IN")}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/dashboard/employees?highlight=${encodeURIComponent(lastResult.comparativeData!.emp2.name)}`);
                              setIsOpen(false);
                            }}
                            className="w-full text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white py-1 rounded transition-colors text-center cursor-pointer"
                          >
                            View Record
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SINGLE VIP EMPLOYEE DATA CARD */}
                  {lastResult.employeeData && !lastResult.comparativeData && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white shadow-md border border-indigo-500/30 space-y-3 animate-in fade-in zoom-in-95">
                      {/* Card Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-black text-sm text-white shadow-inner border border-white/20">
                            {lastResult.employeeData.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-white flex items-center gap-1.5">
                              {lastResult.employeeData.name}
                            </div>
                            <div className="text-[10px] text-indigo-200 flex items-center gap-1 font-mono">
                              <Mail className="h-3 w-3 text-indigo-300 shrink-0" />
                              <span className="truncate max-w-[160px]">{lastResult.employeeData.email}</span>
                            </div>
                          </div>
                        </div>

                        <Badge className={`text-[9px] font-extrabold px-2 py-0.5 ${
                          lastResult.employeeData.role === "Admin" ? "bg-purple-500 text-white" :
                          lastResult.employeeData.role === "CEO" ? "bg-amber-500 text-slate-950" :
                          lastResult.employeeData.role === "PM" ? "bg-indigo-500 text-white" :
                          lastResult.employeeData.role === "QA" || lastResult.employeeData.role === "Tester" ? "bg-emerald-500 text-white" :
                          "bg-sky-500 text-white"
                        }`}>
                          {lastResult.employeeData.role}
                        </Badge>
                      </div>

                      {/* Card Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-white/10 p-2 rounded-lg border border-white/10 space-y-0.5">
                          <div className="text-[10px] text-indigo-200 flex items-center gap-1">
                            <CreditCard className="h-3 w-3 text-emerald-400" /> Monthly Salary
                          </div>
                          <div className="font-bold text-emerald-300">
                            {lastResult.employeeData.monthly_salary 
                              ? `₹${Number(lastResult.employeeData.monthly_salary).toLocaleString("en-IN")}`
                              : "N/A"}
                          </div>
                        </div>

                        <div className="bg-white/10 p-2 rounded-lg border border-white/10 space-y-0.5">
                          <div className="text-[10px] text-indigo-200 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-amber-400" /> Tasks / Efficiency
                          </div>
                          <div className="font-bold text-amber-300">
                            {lastResult.employeeData.completedTasks || 0}/{lastResult.employeeData.totalTasks || 0} ({lastResult.employeeData.efficiency || 0}%)
                          </div>
                        </div>

                        <div className="bg-white/10 p-2 rounded-lg border border-white/10 space-y-0.5">
                          <div className="text-[10px] text-indigo-200 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-sky-400" /> Leaves Allowed
                          </div>
                          <div className="font-bold text-sky-300">
                            {lastResult.employeeData.total_leaves_allowed || 2} days / mo
                          </div>
                        </div>

                        <div className="bg-white/10 p-2 rounded-lg border border-white/10 space-y-0.5">
                          <div className="text-[10px] text-indigo-200 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-purple-400" /> Phone
                          </div>
                          <div className="font-bold text-purple-200 truncate">
                            {lastResult.employeeData.phone || "N/A"}
                          </div>
                        </div>
                      </div>

                      {/* Direct Page Action Button */}
                      {lastResult.redirectUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            router.push(lastResult.redirectUrl);
                            setIsOpen(false);
                          }}
                          className="w-full mt-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <span>Open Employee Profile Record</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* NAV TARGET LINK BUTTON */}
                  {lastResult.redirectUrl && !lastResult.employeeData && !lastResult.comparativeData && (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(lastResult.redirectUrl);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center justify-between text-xs text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 p-2.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Navigation className="h-3.5 w-3.5 text-emerald-600" />
                        Go to: {lastResult.redirectUrl}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs space-y-2.5">
                  <Bot className="h-9 w-9 text-indigo-500 mx-auto opacity-80" />
                  <div>
                    <p className="font-bold text-slate-800 text-xs">Speak or ask about any employee or comparative data:</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">"compare Alex and John", "tell me data of Sarah"</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center text-[10px]">
                    <button onClick={() => handleShortcutClick("compare Alex and John")} className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-2 py-1 rounded font-bold">"compare Alex and John"</button>
                    <button onClick={() => handleShortcutClick("tell me data of Alex")} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-1 rounded font-medium">"data of Alex"</button>
                    <button onClick={() => handleShortcutClick("show testing queue")} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-1 rounded font-medium">"Testing Queue"</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input & Voice Controls Footer */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isListening ? (interimText || "Listening to your voice...") : "Ask 'compare Alex and John'..."}
              className={`text-xs flex-1 h-9 rounded-xl focus-visible:ring-indigo-500 ${
                isListening ? "bg-rose-50 border-rose-300 text-rose-900 font-medium animate-pulse" : ""
              }`}
            />

            {speechSupported && (
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={handleStartListening}
                className={`h-9 w-9 rounded-xl shrink-0 ${
                  isListening 
                    ? "animate-pulse bg-rose-600 hover:bg-rose-700 text-white" 
                    : "hover:bg-indigo-50 text-indigo-700 border-indigo-200"
                }`}
                title={isListening ? "Stop listening" : "Click to speak"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}

            <Button
              type="submit"
              size="icon"
              disabled={isProcessing}
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



