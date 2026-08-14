"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import UnitgloLogo from "@/components/UnitgloLogo";

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

  const setPreset = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword("password123");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
      {/* Background cyan glow effect */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur-xl border border-slate-100 animate-fade-in relative z-10">
        <div className="flex flex-col items-center justify-center space-y-3">
          <UnitgloLogo size="lg" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
            Employee Progress & Task Tracking System
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200 text-center font-medium">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="user@unitglo.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:from-sky-600 hover:to-blue-700 focus:outline-none disabled:opacity-50 transition-all duration-200"
          >
            {loading ? "Authenticating..." : "Sign In to Workspace"}
          </button>
        </form>

        {/* Quick Test Demo Presets */}
        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Quick Sign In Presets
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmail("admin@unitglo.com");
                setPassword("AdminPassword123!");
              }}
              className="px-2 py-1.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors border border-red-200"
            >
              🛡️ Master Admin
            </button>
            <button
              type="button"
              onClick={() => setPreset("ceo@unitglo.com")}
              className="px-2 py-1.5 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium transition-colors border border-purple-200"
            >
              👑 CEO
            </button>
            <button
              type="button"
              onClick={() => setPreset("pm@unitglo.com")}
              className="px-2 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors border border-emerald-200"
            >
              📊 Project Manager
            </button>
            <button
              type="button"
              onClick={() => setPreset("dev@unitglo.com")}
              className="px-2 py-1.5 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium transition-colors border border-sky-200"
            >
              💻 Developer
            </button>
            <button
              type="button"
              onClick={() => setPreset("tester@unitglo.com")}
              className="px-2 py-1.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors border border-amber-200"
            >
              🧪 QA Tester
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
