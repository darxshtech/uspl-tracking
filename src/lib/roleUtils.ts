// Standardized role display names and styles for Unitglo Tracking System
export function getRoleDisplayName(role: string): string {
  switch (role) {
    case "Admin":
      return "Company (Master Admin)";
    case "CEO":
      return "Owner (Boss)";
    case "PM":
      return "Project Manager (PM)";
    case "Developer":
      return "Developer";
    case "Tester":
      return "QA Tester";
    default:
      return role || "Employee";
  }
}

export function getShortRoleName(role: string): string {
  switch (role) {
    case "Admin":
      return "Company";
    case "CEO":
      return "Owner";
    case "PM":
      return "Project Manager";
    case "Developer":
      return "Developer";
    case "Tester":
      return "QA Tester";
    default:
      return role || "Employee";
  }
}

export function getRoleBadgeClass(role: string): string {
  switch (role) {
    case "Admin":
      return "bg-purple-600 text-white font-bold border-purple-700 shadow-xs";
    case "CEO":
      return "bg-amber-600 text-white font-bold border-amber-700 shadow-xs";
    case "PM":
      return "bg-blue-600 text-white font-bold border-blue-700 shadow-xs";
    case "Tester":
      return "bg-emerald-600 text-white font-bold border-emerald-700 shadow-xs";
    case "Developer":
      return "bg-sky-600 text-white font-medium border-sky-700 shadow-xs";
    default:
      return "bg-slate-700 text-white font-medium border-slate-800 shadow-xs";
  }
}

export function getRoleIconEmoji(role: string): string {
  switch (role) {
    case "Admin":
      return "🏢";
    case "CEO":
      return "👑";
    case "PM":
      return "📋";
    case "Tester":
      return "🧪";
    case "Developer":
      return "💻";
    default:
      return "👤";
  }
}
