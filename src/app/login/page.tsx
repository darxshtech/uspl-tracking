"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UnitgloLogo from "@/components/UnitgloLogo";
import MoltenMetal from "@/components/MoltenMetal";
import BorderGlow from "@/components/BorderGlow";
import { Lock, Mail, ArrowRight, LogOut, Sparkles, UserCheck, AlertCircle } from "lucide-react";
import { getRoleDisplayName, getRoleIconEmoji } from "@/lib/roleUtils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const urlError = searchParams?.get("error");

  useEffect(() => {
    if (urlError === "AccountDeactivated") {
      signOut({ redirect: false });
      setError("Your account has been deactivated. Please contact your administrator.");
    }
  }, [urlError]);

  const isAuthenticated = status === "authenticated" && session?.user && !switchingAccount && urlError !== "AccountDeactivated";

  // Auto redirect after short delay if active session exists
  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

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
        if (res.error.toLowerCase().includes("deactivated") || res.error.toLowerCase().includes("inactive")) {
          setError("Your account has been deactivated. Please contact your administrator.");
        } else if (res.error === "CredentialsSignin") {
          setError("Invalid email or password. Please try again.");
        } else {
          setError(res.error);
        }
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    setSwitchingAccount(true);
    await signOut({ redirect: false });
    router.refresh();
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col items-center justify-center space-y-2">
        <UnitgloLogo size="lg" />
        <p className="text-xs font-medium text-slate-300/80 tracking-widest uppercase text-center pt-1">
          Employee Progress & Task Tracking
        </p>
      </div>

      {isAuthenticated ? (
        /* Active Session View */
        <div className="space-y-5 animate-fade-in">
          <div className="rounded-2xl bg-white/[0.06] border border-white/15 p-5 text-center space-y-3 backdrop-blur-md">
            <div className="relative inline-block">
              <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-sky-500/30 mx-auto border-2 border-white/20">
                {(session.user?.name || "U")[0].toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 border-2 border-slate-900" title="Active Session" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[11px] font-semibold text-sky-300">
                <Sparkles className="h-3 w-3" /> Active Session Found
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {session.user?.name}
              </h3>
              <p className="text-xs text-slate-300">
                {session.user?.email}
              </p>
              <div className="pt-1">
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-white/10 text-slate-200 border border-white/10 uppercase tracking-wider">
                  {getRoleIconEmoji((session.user as any)?.role)} {getRoleDisplayName((session.user as any)?.role)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500/90 via-blue-600/90 to-indigo-600/90 hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 active:scale-[0.99] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 border border-white/20 backdrop-blur-md focus:outline-none transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleSwitchAccount}
              className="w-full rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.1] px-4 py-2.5 text-xs font-medium text-slate-300 border border-white/10 backdrop-blur-md focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-400" />
              <span>Sign In with Another Account</span>
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-400/80 animate-pulse">
            Automatically continuing to workspace...
          </p>
        </div>
      ) : (
        /* Standard Login Form */
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl bg-red-500/15 backdrop-blur-md p-3 text-xs text-red-300 border border-red-500/30 text-center font-medium animate-shake flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-200 uppercase tracking-wider"
              >
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur-md pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-400/70 shadow-inner hover:bg-white/[0.09] focus:bg-white/[0.12] focus:border-sky-400/80 focus:outline-none focus:ring-2 focus:ring-sky-400/25 transition-all"
                  placeholder="name@unitglo.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-200 uppercase tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur-md pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-400/70 shadow-inner hover:bg-white/[0.09] focus:bg-white/[0.12] focus:border-sky-400/80 focus:outline-none focus:ring-2 focus:ring-sky-400/25 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-sky-500/90 via-blue-600/90 to-indigo-600/90 hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 active:scale-[0.99] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 border border-white/20 backdrop-blur-md focus:outline-none disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? "Authenticating..." : "Sign In to Workspace"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      )}

      <div className="pt-2 text-center space-y-1 border-t border-white/10">
        <p className="text-[11px] font-medium text-slate-400">
          © 2026 Unitglo Solutions Pvt. Ltd. All rights reserved.
        </p>
        <p className="text-[10px] text-slate-400/80">
          🔒 256-Bit SSL Encrypted • Internal Enterprise System
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 relative overflow-hidden selection:bg-sky-500/30 selection:text-white">
      {/* Interactive Molten Metal Canvas Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <MoltenMetal
          color1="#080d1a"
          color2="#7ca2c5"
          color3="#ffffff"
          speed={0.3}
          scale={3.8}
          detail={3}
          glow={1.8}
          coreSize={0.1}
          swirl={1.0}
          fold={-0.2}
          blackPoint={0.04}
          brightness={1.35}
          colorMode="frost"
          grain={true}
          grainIntensity={0.05}
          mouseInteraction={true}
          mouseStrength={0.35}
          opacity={1.0}
        />
      </div>

      {/* Apple-style Translucent Glassmorphic Card with BorderGlow */}
      <BorderGlow
        className="w-full max-w-md relative z-10 animate-fade-in"
        borderRadius={24}
        backgroundColor="rgba(10, 16, 30, 0.42)"
        glowColor="205 95 75"
        glowRadius={35}
        glowIntensity={1.2}
        edgeSensitivity={35}
        coneSpread={28}
        animated={true}
        colors={["#38bdf8", "#818cf8", "#e0e7ff"]}
        fillOpacity={0.2}
      >
        <Suspense fallback={<div className="p-12 text-center text-white text-sm">Loading login portal...</div>}>
          <LoginForm />
        </Suspense>
      </BorderGlow>
    </div>
  );
}
