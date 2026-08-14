import { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
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
  LogOut
} from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as any).role;

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["CEO", "PM", "Developer", "Tester"] },
    { name: "Employees", href: "/dashboard/employees", icon: Users, roles: ["CEO", "PM"] },
    { name: "Projects", href: "/dashboard/projects", icon: Briefcase, roles: ["CEO", "PM", "Developer", "Tester"] },
    { name: "Tasks", href: "/dashboard/tasks", icon: CheckSquare, roles: ["CEO", "PM", "Developer"] },
    { name: "Testing Queue", href: "/dashboard/testing", icon: Activity, roles: ["CEO", "PM", "Developer", "Tester"] },
    { name: "Daily Work", href: "/dashboard/work", icon: Clock, roles: ["CEO", "PM", "Developer", "Tester"] },
    { name: "Attendance", href: "/dashboard/attendance", icon: CalendarDays, roles: ["CEO", "PM", "Developer", "Tester"] },
    { name: "Profile & Tenure", href: "/dashboard/profile", icon: Users, roles: ["CEO", "PM", "Developer", "Tester"] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(role));

  return (
    <div className="flex h-screen w-full bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-slate-900 text-white flex flex-col hidden md:flex shadow-xl z-20">
        <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-center">
          <UnitgloLogo size="md" theme="dark" />
        </div>
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="space-y-1.5 px-4">
            {visibleNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-sky-500/10 hover:text-sky-400 transition-all duration-150 group"
              >
                <item.icon className="h-4 w-4 text-slate-400 group-hover:text-sky-400 transition-colors" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <Link href="/dashboard/profile" className="text-xs hover:opacity-80 transition-opacity">
            <p className="font-bold text-slate-100">{session.user.name}</p>
            <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold bg-sky-500/20 text-sky-300 rounded border border-sky-500/30">
              {role}
            </span>
          </Link>
          <Link href="/api/auth/signout" className="text-slate-400 hover:text-red-400 transition-colors p-2" title="Sign Out">
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              Unitglo Solutions Tracking Portal
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <AttendanceWidget />
            <div className="h-8 w-px bg-slate-200"></div>
            <NotificationBell />
            <div className="h-8 w-px bg-slate-200"></div>
            <Link href="/dashboard/profile" className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium text-slate-700">{session.user.name}</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
