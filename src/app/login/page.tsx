"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import UnitgloLogo from "@/components/UnitgloLogo";
import { Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("ceo@unitglo.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (presetEmail: string, presetPass: string = "password123") => {
    setEmail(presetEmail);
    setPassword(presetPass);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background cyan/blue glow effect matching logo colors */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md space-y-6 rounded-2xl bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl border border-slate-800 animate-fade-in relative z-10 text-slate-100">
        <div className="flex flex-col items-center justify-center space-y-3">
          <UnitgloLogo size="lg" />
          <p className="text-[11px] font-bold text-sky-400 uppercase tracking-widest text-center mt-1">
            Employee Progress & Task Tracking System
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl bg-red-950/60 p-3 text-xs text-red-300 border border-red-800 text-center font-semibold">
              {error}
            </div>
          )}
          <div className="space-y-3.5">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-500"
                placeholder="user@unitglo.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:from-sky-600 hover:to-blue-700 focus:outline-none disabled:opacity-50 transition-all duration-200"
          >
            {loading ? "Authenticating..." : "Sign In to Workspace"}
          </button>
        </form>

        {/* Quick Test Demo Presets */}
        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Quick Test Accounts
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setPreset("admin@unitglo.com", "AdminPassword123!")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-sky-950 hover:border-sky-500 hover:text-sky-300 font-medium transition-colors col-span-2 flex items-center justify-center gap-1.5"
            >
              <Shield className="h-3.5 w-3.5 text-sky-400" /> ⚡ Master Admin (admin@unitglo.com)
            </button>
            <button
              onClick={() => setPreset("ceo@unitglo.com")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-sky-950 hover:border-sky-500 hover:text-sky-300 font-medium transition-colors"
            >
              👑 CEO
            </button>
            <button
              onClick={() => setPreset("pm@unitglo.com")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-sky-950 hover:border-sky-500 hover:text-sky-300 font-medium transition-colors"
            >
              📊 PM
            </button>
            <button
              onClick={() => setPreset("dev@unitglo.com")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-sky-950 hover:border-sky-500 hover:text-sky-300 font-medium transition-colors"
            >
              💻 Developer
            </button>
            <button
              onClick={() => setPreset("tester@unitglo.com")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-sky-950 hover:border-sky-500 hover:text-sky-300 font-medium transition-colors"
            >
              🧪 Tester
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
