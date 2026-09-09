export interface IntentResult {
  matched: boolean;
  intent: string;
  redirectUrl: string;
  speechSummary: string;
  displayText: string;
  highlightKey?: string;
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

  // Helper to extract specific target search terms (e.g., "credentials for cloudinary" -> "cloudinary")
  const extractSearchTerm = (text: string, triggers: string[]) => {
    let cleaned = text;
    triggers.forEach((trig) => {
      cleaned = cleaned.replace(trig, "");
    });
    return cleaned.replace(/for|for project|project|key|keys|task|tasks|show|open/g, "").trim();
  };

  // 1. Testing Queue & QA Status
  if (
    q.includes("testing") || 
    q.includes("qa") || 
    q.includes("bug") || 
    q.includes("test sheet") || 
    q.includes("ready for testing")
  ) {
    const term = extractSearchTerm(q, ["testing queue", "qa queue", "testing", "qa", "ready for testing"]);
    const highlightQuery = term ? `?highlight=${encodeURIComponent(term)}` : "";
    return {
      matched: true,
      intent: "testing_queue",
      redirectUrl: `/dashboard/testing${highlightQuery}`,
      speechSummary: term 
        ? `Opening QA Verification for ${term}.`
        : "Opening QA Verification and Testing Queue.",
      displayText: term 
        ? `Redirecting to QA Queue (Highlighting "${term}")...`
        : "Redirecting to QA Verification & Testing Queue...",
      highlightKey: term
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
    const term = extractSearchTerm(q, ["credential", "credentials", "password", "api key", "secret"]);
    const highlightQuery = term ? `?highlight=${encodeURIComponent(term)}` : "";
    return {
      matched: true,
      intent: "credentials",
      redirectUrl: `/dashboard/credentials${highlightQuery}`,
      speechSummary: term 
        ? `Opening 3rd-Party Credentials vault for ${term}.`
        : "Navigating to 3rd-Party Credentials vault.",
      displayText: term 
        ? `Redirecting to Credentials (Highlighting "${term}")...`
        : "Redirecting to 3rd-Party Credentials Vault...",
      highlightKey: term
    };
  }

  // 3. Projects Overview
  if (
    q.includes("project") || 
    q.includes("active project") || 
    q.includes("client project")
  ) {
    const term = extractSearchTerm(q, ["active project", "client project", "project", "projects"]);
    const highlightQuery = term ? `?highlight=${encodeURIComponent(term)}` : "";
    return {
      matched: true,
      intent: "projects",
      redirectUrl: `/dashboard/projects${highlightQuery}`,
      speechSummary: term ? `Opening Project ${term}.` : "Opening Projects overview board.",
      displayText: term ? `Redirecting to Projects (Highlighting "${term}")...` : "Redirecting to Projects...",
      highlightKey: term
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
    speechSummary: "I didn't recognize that command. Try asking about testing queue, credentials, projects, attendance, or daily tasks.",
    displayText: "Unrecognized query. Try: \"show testing queue\", \"open credentials for Cloudinary\", \"show attendance\""
  };
}
