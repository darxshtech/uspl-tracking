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
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardShellProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
  children: ReactNode;
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const role = user?.role || "Developer";

  // Sidebar States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load collapse preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("unitglo_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch (_) {}
  }, []);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("unitglo_sidebar_collapsed", String(next));
      } catch (_) {}
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    { name: "Employees", href: "/dashboard/employees", icon: Users, roles: ["Admin", "CEO", "PM"] },
    { name: "Projects", href: "/dashboard/projects", icon: Briefcase, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    { name: "Daily Tasks", href: "/dashboard/tasks", icon: CheckSquare, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    // Testing Queue ONLY for Tester, Admin, CEO, PM (EXCLUDED FOR DEVELOPER ROLE)
    { name: "Testing Queue", href: "/dashboard/testing", icon: Activity, roles: ["Tester", "Admin", "CEO", "PM"] },
    { name: "Work Accomplishments", href: "/dashboard/work", icon: Clock, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    { name: "Attendance", href: "/dashboard/attendance", icon: CalendarDays, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
    { name: "Profile & Tenure", href: "/dashboard/profile", icon: Shield, roles: ["Admin", "CEO", "PM", "Developer", "Tester"] },
  ];

  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* MOBILE DRAWER BACKDROP */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* MOBILE SLIDE-OUT SIDEBAR DRAWER */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-slate-900 border-r border-slate-800 text-white flex flex-col z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <UnitgloLogo size="md" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-slate-400 hover:text-white p-1 h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                    : "text-slate-300 hover:bg-slate-800 hover:text-sky-400"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-sky-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <Link href="/dashboard/profile" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-sky-600 flex items-center justify-center font-bold text-white text-xs uppercase shadow-sm">
              {user.name ? user.name.slice(0, 2) : "UG"}
            </div>
            <div>
              <p className="font-bold text-slate-100 text-xs leading-tight truncate max-w-[130px]">{user.name}</p>
              <span className="inline-block mt-0.5 px-2 py-0.2 text-[9px] font-bold bg-sky-500/20 text-sky-300 rounded border border-sky-500/30 uppercase">
                {role}
              </span>
            </div>
          </Link>
          <Link
            href="/api/auth/signout"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </Link>
        </div>
      </aside>

      {/* DESKTOP COLLAPSIBLE SIDEBAR */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 text-white shadow-2xl z-20 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Sidebar Header with Logo & Collapse Toggle */}
        <div className="h-16 px-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          {!isSidebarCollapsed ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <UnitgloLogo size="sm" />
            </div>
          ) : (
            <div className="mx-auto">
              <img src="/logo.png" alt="Unitglo Logo" className="h-7 w-7 object-contain" />
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebarCollapse}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 h-7 w-7 rounded-md shrink-0"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Navigation Links */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                title={isSidebarCollapsed ? item.name : undefined}
                className={`flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-sky-400"
                } ${isSidebarCollapsed ? "justify-center px-2" : ""}`}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-sky-400"}`} />
                {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {!isSidebarCollapsed ? (
            <>
              <Link href="/dashboard/profile" className="flex items-center gap-2.5 overflow-hidden hover:opacity-80 transition-opacity">
                <div className="h-8 w-8 rounded-full bg-sky-600 flex items-center justify-center font-bold text-white text-xs uppercase shrink-0">
                  {user.name ? user.name.slice(0, 2) : "UG"}
                </div>
                <div className="truncate">
                  <p className="font-bold text-slate-100 text-xs truncate max-w-[110px]">{user.name}</p>
                  <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold bg-sky-500/20 text-sky-300 rounded border border-sky-500/30 uppercase">
                    {role}
                  </span>
                </div>
              </Link>
              <Link
                href="/api/auth/signout"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <div className="mx-auto flex flex-col items-center gap-2">
              <Link href="/dashboard/profile" title={user.name || "Profile"}>
                <div className="h-8 w-8 rounded-full bg-sky-600 flex items-center justify-center font-bold text-white text-xs uppercase">
                  {user.name ? user.name.slice(0, 2) : "UG"}
                </div>
              </Link>
              <Link
                href="/api/auth/signout"
                className="p-1 text-slate-400 hover:text-red-400"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN VIEWPORT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
        {/* TOP HEADER */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 z-30 shrink-0">
          {/* Mobile Left: Hamburger + Logo */}
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-slate-300 hover:text-white hover:bg-slate-800 p-2 h-9 w-9"
              title="Open Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Unitglo Logo" className="h-6 sm:h-7 w-auto md:hidden object-contain" />
              <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-100 tracking-tight truncate max-w-[140px] sm:max-w-xs md:max-w-none">
                Unitglo Solutions Tracking
              </h1>
            </div>
          </div>

          {/* Right Controls: Attendance Punch + Notifications + Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            <AttendanceWidget />
            <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>
            <NotificationBell />
            <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>
            <Link
              href="/dashboard/profile"
              className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate max-w-[100px]">{user.name}</span>
            </Link>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER (Mobile Touch Friendly & Fluid Scroll) */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-3 sm:p-6 md:p-8 space-y-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
