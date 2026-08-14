"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UnitgloLogo from "@/components/UnitgloLogo";
import NotificationBell from "@/components/NotificationBell";
import AttendanceWidget from "@/components/AttendanceWidget";
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CheckSquare, 
  Activity, 
  CalendarDays, 
  Clock,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Shield
} from "lucide-react";
import { getRoleDisplayName, getRoleIconEmoji } from "@/lib/roleUtils";

interface DashboardClientShellProps {
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
    avatar_url?: string | null;
  };
}

export default function DashboardClientShell({ children, user }: DashboardClientShellProps) {
  const pathname = usePathname();
  const role = user.role || "Developer";

  // Sidebar collapse state (desktop)
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileOpen]);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    { name: "Employees", href: "/dashboard/employees", icon: Users, roles: ["Admin", "CEO", "PM"] },
    { name: "Projects", href: "/dashboard/projects", icon: Briefcase, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    { name: "Daily Tasks", href: "/dashboard/tasks", icon: CheckSquare, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    // Testing Queue ONLY appears for Tester role (and master Admin)
    { name: "Testing Queue", href: "/dashboard/testing", icon: Activity, roles: ["Tester", "Admin"] },
    { name: "Work Accomplishments", href: "/dashboard/work", icon: Clock, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    { name: "Attendance", href: "/dashboard/attendance", icon: CalendarDays, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    { name: "Profile & Tenure", href: "/dashboard/profile", icon: Users, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
  ];

  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans">
      {/* ========================================================================= */}
      {/* MOBILE DRAWER BACKDROP & SIDEBAR (Phone / Tablet < 768px)                */}
      {/* ========================================================================= */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile Drawer Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950">
          <UnitgloLogo size="sm" theme="dark" />
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Nav Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-300 hover:bg-slate-900 hover:text-sky-400"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span className="flex-1">{item.name}</span>
                {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
              </Link>
            );
          })}
        </div>

        {/* Mobile User Profile Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
          <Link
            href="/dashboard/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 truncate hover:opacity-85 transition-opacity"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || "User"}
                className="h-9 w-9 rounded-full object-cover border border-sky-400/40 shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold text-sm shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <div className="truncate">
              <p className="font-bold text-xs text-slate-100 truncate">{user.name}</p>
              <span className="inline-block text-[10px] font-semibold text-sky-400 uppercase tracking-wider">
                {getRoleIconEmoji(role)} {getRoleDisplayName(role)}
              </span>
            </div>
          </Link>
          <Link
            href="/api/auth/signout"
            className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (>= 768px) with Collapse / Unhide Toggle                   */}
      {/* ========================================================================= */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-800 bg-slate-950 text-white shadow-xl z-20 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Desktop Sidebar Header */}
        <div className="h-16 border-b border-slate-800/80 px-4 flex items-center justify-between bg-slate-950/60">
          {!isCollapsed && <UnitgloLogo size="sm" theme="dark" />}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors ${
              isCollapsed ? "mx-auto" : ""
            }`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-5 w-5 text-sky-400" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        {/* Desktop Nav Items */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/25 font-bold"
                    : "text-slate-300 hover:bg-slate-900 hover:text-sky-400"
                } ${isCollapsed ? "justify-center px-2" : ""}`}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-sky-400"
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </div>

        {/* Desktop User Profile Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <Link href="/dashboard/profile" className="flex items-center gap-2.5 truncate hover:opacity-85 transition-opacity">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name || "User"}
                    className="h-8 w-8 rounded-full object-cover border border-sky-400/40 shrink-0"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold text-xs shrink-0">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
                <div className="truncate text-xs">
                  <p className="font-bold text-slate-100 truncate">{user.name}</p>
                  <span className="inline-block text-[10px] font-semibold text-sky-400">
                    {getRoleIconEmoji(role)} {getRoleDisplayName(role)}
                  </span>
                </div>
              </Link>
              <Link
                href="/api/auth/signout"
                className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <Link
              href="/api/auth/signout"
              className="mx-auto text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN VIEWPORT & TOPBAR (Adaptive for Mobile & Global Devices)             */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 min-w-0">
        {/* Sticky Adaptive Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 z-10 shrink-0 gap-2">
          {/* Left: Mobile Hamburger & Desktop Status */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-1 rounded-lg text-slate-700 hover:text-sky-600 hover:bg-slate-100 md:hidden transition-colors"
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex items-center gap-2 truncate">
              <span className="hidden sm:inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight truncate">
                Unitglo Tracking Portal
              </h2>
            </div>
          </div>

          {/* Right: Actions, Attendance Widget, Notifications */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <AttendanceWidget />
            
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            
            <NotificationBell />

            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

            {/* Profile Avatar Pill */}
            <Link
              href="/dashboard/profile"
              className="hidden md:flex items-center gap-2.5 py-1 px-3 rounded-full bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200 transition-colors text-xs font-semibold text-slate-800 shadow-xs"
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name || "User"}
                  className="w-6 h-6 rounded-full object-cover border border-sky-400/40 shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[10px] shadow-xs shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              <div className="flex flex-col text-left leading-tight">
                <span className="truncate max-w-[130px] font-bold text-slate-900">{user.name}</span>
                <span className="text-[9px] text-slate-500 font-semibold">{getRoleDisplayName(role)}</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 animate-fade-in flex flex-col justify-between">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>

          {/* Security & Copyright Footer */}
          <footer className="mt-12 pt-6 border-t border-slate-200/80 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">© 2026 Unitglo Solutions Pvt. Ltd.</span>
              <span>•</span>
              <span>All rights reserved.</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              <Shield className="h-3.5 w-3.5 text-emerald-600" />
              <span>256-Bit SSL Encrypted • Internal Enterprise Portal</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
