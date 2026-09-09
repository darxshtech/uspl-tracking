"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { resolveIntent, IntentResult } from "@/lib/ai-scripting";
import { speakText, createSpeechRecognizer } from "@/lib/speech";
import { Bot, Mic, MicOff, Send, X, Sparkles, Navigation, Volume2, AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function VoiceScriptingAssistant() {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
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
          const errDetail = `Speech recognition error: ${err}. Please try typing or speak clearly.`;
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

  const processQuery = (inputQuery: string) => {
    const result = resolveIntent(inputQuery, userRole);
    setLastResult(result);

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
        // Redirection on speech end
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
      {/* Floating Trigger Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full text-white font-extrabold shadow-xl hover:scale-105 transition-all cursor-pointer border-2 border-white/20 ${
          isListening 
            ? "bg-gradient-to-r from-rose-600 to-red-600 animate-pulse ring-4 ring-rose-300/50" 
            : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/25"
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
                <p className="text-[10px] text-indigo-200 font-medium">100% Free • All Pages & Data Actions</p>
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
            <div className="bg-rose-600 text-white px-3 py-2 text-xs font-bold flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-amber-200 animate-ping" />
                <span>Listening live... speak now!</span>
              </div>
              <span className="text-[10px] bg-rose-800 px-1.5 py-0.5 rounded font-mono">
                {interimText ? "Detecting speech..." : "Speak command..."}
              </span>
            </div>
          )}

          {/* MIC ERROR BANNER */}
          {micError && (
            <div className="bg-amber-500 text-slate-950 px-3 py-2 text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{micError}</span>
            </div>
          )}

          {/* VOICE COMMAND SHORTCUTS LEGEND CHEAT SHEET */}
          {showLegend ? (
            <div className="p-3 bg-slate-900 text-white space-y-2.5 text-xs max-h-[280px] overflow-y-auto">
              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> All System Pages Voice Commands (Click to Run):
              </div>
              <div className="space-y-2 text-[11px]">
                <div>
                  <div className="font-bold text-indigo-300 mb-1">🧪 Testing & QA Queue:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("show testing queue")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"show testing queue"</button>
                    <button onClick={() => handleShortcutClick("show QA for car and bike")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"show QA for car and bike"</button>
                    <button onClick={() => handleShortcutClick("bug reports")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"bug reports"</button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-indigo-300 mb-1">👥 Employees & Staff:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("show employee list")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"show employee list"</button>
                    <button onClick={() => handleShortcutClick("find developer team")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"find developer team"</button>
                    <button onClick={() => handleShortcutClick("who works here")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"who works here"</button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-indigo-300 mb-1">🔑 Credentials & API Keys:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("open 3rd party credentials")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"3rd party credentials"</button>
                    <button onClick={() => handleShortcutClick("credentials for cloudinary")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"Cloudinary credentials"</button>
                    <button onClick={() => handleShortcutClick("project passwords")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"project passwords"</button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-indigo-300 mb-1">📊 Analytics & Productivity:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("show analytics")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"show analytics"</button>
                    <button onClick={() => handleShortcutClick("developer productivity")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"developer productivity"</button>
                    <button onClick={() => handleShortcutClick("executive summary")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"executive overview"</button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-indigo-300 mb-1">⏰ Attendance & Warnings:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("who is present today")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"who is present today"</button>
                    <button onClick={() => handleShortcutClick("show shift warnings")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"show shift warnings"</button>
                    <button onClick={() => handleShortcutClick("who was late")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"who was late"</button>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-indigo-300 mb-1">📁 Projects, Tasks & Docs:</div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleShortcutClick("show active projects")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"show active projects"</button>
                    <button onClick={() => handleShortcutClick("show daily tasks")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"show daily tasks"</button>
                    <button onClick={() => handleShortcutClick("salary payouts")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"salary payouts"</button>
                    <button onClick={() => handleShortcutClick("document vault")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"document vault"</button>
                    <button onClick={() => handleShortcutClick("company policies")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"company policies"</button>
                    <button onClick={() => handleShortcutClick("cron logs")} className="bg-slate-800 hover:bg-indigo-600 px-2 py-0.5 rounded text-[10px]">"cron logs"</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Response Output Panel */
            <div className="p-4 space-y-3 bg-slate-50/70 min-h-[140px] max-h-[220px] overflow-y-auto">
              {lastResult ? (
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-indigo-100 shadow-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[11px]">
                      <Volume2 className="h-3.5 w-3.5 text-purple-600" />
                      <span>Executive Response:</span>
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
                    <button onClick={() => handleShortcutClick("show testing queue")} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-0.5 rounded">"Testing Queue"</button>
                    <button onClick={() => handleShortcutClick("3rd party credentials")} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-0.5 rounded">"3rd Party Creds"</button>
                    <button onClick={() => handleShortcutClick("employees")} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-0.5 rounded">"Employees"</button>
                    <button onClick={() => handleShortcutClick("attendance")} className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-0.5 rounded">"Attendance"</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input & Voice Controls */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isListening ? (interimText || "Listening to speech...") : "Type or speak command..."}
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

