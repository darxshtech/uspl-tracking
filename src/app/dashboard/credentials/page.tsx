"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  KeyRound, 
  Plus, 
  Trash2, 
  ExternalLink, 
  ShieldCheck, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Globe, 
  Users, 
  LogIn, 
  Search,
  Laptop,
  CheckSquare,
  Square,
  Sparkles
} from "lucide-react";
import { showError, showSuccess, showToast } from "@/lib/swal";

interface AccountCredential {
  role_name: string;
  username: string;
  password: string;
  notes: string;
}

function WebsitePreviewCard({ url, label, type }: { url: string; label: string; type: "live" | "demo" }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  let domain = "";
  try {
    const parsed = new URL(fullUrl);
    domain = parsed.hostname;
  } catch (e) {
    domain = url.replace(/^https?:\/\//, "").split("/")[0];
  }

  const isLive = type === "live";

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative block rounded-2xl border transition-all duration-300 overflow-hidden hover:shadow-xl hover:scale-[1.005] ${
        isLive
          ? "bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border-emerald-200/80 hover:border-emerald-400 hover:shadow-emerald-200/50"
          : "bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border-amber-200/80 hover:border-amber-400 hover:shadow-amber-200/50"
      }`}
    >
      {/* Browser Chrome Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
        </div>
        {/* URL Bar */}
        <div className="flex-1 mx-3 bg-slate-100/80 rounded-md px-2.5 py-1 flex items-center gap-1.5 border border-slate-200/60">
          <Globe className="h-3 w-3 text-slate-400 shrink-0" />
          <span className="text-[10px] font-mono text-slate-500 font-semibold truncate">
            {fullUrl}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className={`text-[9px] font-extrabold px-1.5 py-0.5 shadow-sm ${
            isLive ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
          }`}>
            {isLive ? "LIVE ●" : "DEMO ●"}
          </Badge>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-600 transition-colors" />
        </div>
      </div>

      {/* Live Website Iframe Preview */}
      <div className="relative w-full bg-white border-t border-slate-200/60" style={{ height: "220px" }}>
        {/* Loading Skeleton */}
        {!iframeLoaded && !iframeError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 animate-pulse">
            <div className="flex flex-col items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                isLive ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
              }`}>
                <Globe className="h-6 w-6 animate-spin" style={{ animationDuration: "3s" }} />
              </div>
              <div className="space-y-2 flex flex-col items-center">
                <div className="h-2 w-28 bg-slate-200 rounded-full" />
                <div className="h-2 w-20 bg-slate-200 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Loading preview...</span>
            </div>
          </div>
        )}

        {/* Error Fallback */}
        {iframeError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-white">
            <div className="flex flex-col items-center gap-2">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border-2 shadow-sm ${
                isLive ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
              }`}>
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
                  alt="icon" 
                  className="h-7 w-7 rounded-lg object-contain"
                  onError={(e: any) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <span className="text-xs font-bold text-slate-800">{label}</span>
              <span className="text-[10px] text-slate-400 font-medium">Preview restricted by website</span>
            </div>
          </div>
        )}

        {/* Actual Iframe — scaled down and non-interactive */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{ pointerEvents: "none" }}
        >
          <iframe
            src={fullUrl}
            title={`Preview of ${label}`}
            className="border-0"
            style={{
              width: "1280px",
              height: "900px",
              transform: "scale(0.29)",
              transformOrigin: "top left",
              pointerEvents: "none",
            }}
            sandbox="allow-same-origin allow-scripts"
            loading="lazy"
            onLoad={() => setIframeLoaded(true)}
            onError={() => setIframeError(true)}
          />
        </div>
      </div>

      {/* Footer Bar */}
      <div className="px-3.5 py-2.5 border-t border-slate-200/60 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
            isLive ? "bg-emerald-100/80 text-emerald-700" : "bg-amber-100/80 text-amber-700"
          }`}>
            <img 
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
              alt="" 
              className="h-4 w-4 rounded object-contain"
              onError={(e: any) => { e.currentTarget.replaceWith(document.createTextNode("🌐")); }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-800 truncate">{label}</div>
            <div className="text-[10px] text-slate-400 font-mono truncate">{domain}</div>
          </div>
        </div>
        <div className="text-[10px] font-bold text-sky-600 group-hover:underline flex items-center gap-1 shrink-0">
          Open in new tab <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </a>
  );
}

export default function CredentialsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "User";
  const currentUserId = (session?.user as any)?.id;
  const isExecutive = ["Admin", "CEO", "PM"].includes(role);

  const [credentials, setCredentials] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [projectId, setProjectId] = useState("0");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [liveLink, setLiveLink] = useState("");
  const [demoLink, setDemoLink] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role Accounts in Modal
  const [accounts, setAccounts] = useState<AccountCredential[]>([
    { role_name: "Super Admin", username: "", password: "", notes: "" }
  ]);
  const [customNotes, setCustomNotes] = useState("");

  // UI state for password visibility & copy feedback
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
    fetchProjects();
    if (isExecutive) fetchEmployees();
  }, [isExecutive]);

  useEffect(() => {
    if (currentUserId && selectedUserIds.length === 0) {
      setSelectedUserIds([currentUserId]);
    }
  }, [currentUserId]);

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/credentials");
      const data = await res.json();
      if (Array.isArray(data)) setCredentials(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch (err) {}
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {}
  };

  const toggleSelectAllDevelopers = () => {
    const devIds = employees.map((e: any) => e.id);
    if (selectedUserIds.length === devIds.length) {
      setSelectedUserIds(currentUserId ? [currentUserId] : []);
    } else {
      setSelectedUserIds(devIds);
    }
  };

  const toggleDeveloperSelection = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleAddAccountRow = () => {
    setAccounts([...accounts, { role_name: "User", username: "", password: "", notes: "" }]);
  };

  const handleRemoveAccountRow = (index: number) => {
    if (accounts.length > 1) {
      setAccounts(accounts.filter((_, i) => i !== index));
    }
  };

  const handleAccountChange = (index: number, field: keyof AccountCredential, value: string) => {
    const updated = [...accounts];
    updated[index][field] = value;
    setAccounts(updated);
  };

  const handleCopyText = (text: string, keyName: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showToast(`${label} copied to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDirectLogin = (targetUrl: string, credItem: any) => {
    const cleanUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
    // Copy credentials summary to clipboard for immediate paste
    const fullText = credItem.credentials_text || "";
    if (fullText) {
      navigator.clipboard.writeText(fullText);
      showToast("Credentials copied! Opening login portal...", "info");
    }
    window.open(cleanUrl, "_blank", "noopener,noreferrer");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      showError("Please select at least one team member to assign credentials to.");
      return;
    }

    // Build structured credentials text
    let formattedText = "";
    if (loginUrl) {
      formattedText += `Login Portal: ${loginUrl}\n\n`;
    }

    accounts.forEach((acc) => {
      if (acc.username || acc.password || acc.role_name) {
        formattedText += `[${acc.role_name || "Account"}]\n`;
        if (acc.username) formattedText += `Username/Email: ${acc.username}\n`;
        if (acc.password) formattedText += `Password: ${acc.password}\n`;
        if (acc.notes) formattedText += `Notes: ${acc.notes}\n`;
        formattedText += `\n`;
      }
    });

    if (customNotes) {
      formattedText += `Additional Notes:\n${customNotes.trim()}`;
    }

    if (!formattedText.trim()) {
      showError("Please enter at least username/password or notes.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId === "0" ? null : parseInt(projectId),
          user_ids: selectedUserIds,
          live_link: liveLink,
          demo_link: demoLink,
          credentials_text: formattedText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess("Credentials Added", data.message || "Project credentials assigned successfully.");
        setModalOpen(false);
        fetchCredentials();
        setLiveLink("");
        setDemoLink("");
        setLoginUrl("");
        setCustomNotes("");
        setAccounts([{ role_name: "Super Admin", username: "", password: "", notes: "" }]);
      } else {
        showError("Failed to Add Credentials", data.error);
      }
    } catch (err) {
      showError("Error adding credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ids: number | number[]) => {
    if (!confirm("Are you sure you want to delete these credentials?")) return;
    try {
      const idStr = Array.isArray(ids) ? ids.join(",") : String(ids);
      const res = await fetch(`/api/credentials?id=${idStr}`, { method: "DELETE" });
      if (res.ok) fetchCredentials();
      else showError("Failed to delete credentials");
    } catch (err) {
      console.error(err);
    }
  };

  // Extract structured role entries from credentials_text
  const parseCredentialSections = (text: string, defaultRole: string = "General Access") => {
    if (!text) return [];
    const lines = text.split("\n");
    const sections: { role: string; username?: string; password?: string; notes?: string; raw: string }[] = [];
    
    let currentSection: any = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const roleHeaderMatch = trimmed.match(/^\[(.*?)\]$/);

      if (roleHeaderMatch) {
        if (currentSection) sections.push(currentSection);
        currentSection = { role: roleHeaderMatch[1], raw: line };
      } else {
        if (!currentSection) {
          currentSection = { role: defaultRole, raw: line };
        } else {
          currentSection.raw += "\n" + line;
        }

        const colonIdx = trimmed.indexOf(":");
        if (colonIdx !== -1) {
          const field = trimmed.substring(0, colonIdx).trim().toLowerCase();
          const val = trimmed.substring(colonIdx + 1).trim();
          if (field.includes("user") || field.includes("email") || field.includes("login")) {
            currentSection.username = val;
          } else if (field.includes("pass") || field.includes("pwd") || field.includes("key")) {
            currentSection.password = val;
          } else if (field.includes("role")) {
            currentSection.role = val;
          }
        }
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }
    return sections;
  };

  const filteredCredentials = credentials.filter((cred: any) => {
    const q = searchQuery.toLowerCase();
    const pTitle = (cred.project_title || "").toLowerCase();
    const uName = (cred.user_name || "").toLowerCase();
    const cText = (cred.credentials_text || "").toLowerCase();
    return pTitle.includes(q) || uName.includes(q) || cText.includes(q);
  });

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading credentials...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
            <KeyRound className="h-4 w-4" /> Secure Access Management
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Project Credentials & Live Previews
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Multi-assign project credentials to developers, copy logins in 1-click, and preview live/demo links.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger render={
              <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold gap-2 shadow-sm">
                <Plus className="h-4 w-4" /> Add Project Credentials
              </Button>
            } />
            <DialogContent className="w-[94vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <KeyRound className="h-5 w-5 text-sky-600" />
                  Add Project Credentials & Multi-Assign
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-5 pt-2">
                {/* 1. Related Project */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase">Related Project</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">General / No Project</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name || p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Multi-Select Assign to Developers (PM / CEO / Admin) */}
                {isExecutive && (
                  <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-sky-600" />
                        Assign To Developers ({selectedUserIds.length} selected) *
                      </Label>
                      <button
                        type="button"
                        onClick={toggleSelectAllDevelopers}
                        className="text-xs text-sky-600 hover:underline font-bold"
                      >
                        {selectedUserIds.length === employees.length ? "Deselect All" : "Select All Team"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1 pt-1">
                      {employees.map((emp: any) => {
                        const isSelected = selectedUserIds.includes(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => toggleDeveloperSelection(emp.id)}
                            className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center gap-2 transition-colors ${
                              isSelected
                                ? "bg-sky-50 border-sky-300 text-sky-950 font-bold"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-sky-600 shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{emp.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Live & Demo URLs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5 text-emerald-600" /> Live Website Link
                    </Label>
                    <Input
                      value={liveLink}
                      onChange={(e) => setLiveLink(e.target.value)}
                      placeholder="https://app.example.com"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                      <Laptop className="h-3.5 w-3.5 text-amber-600" /> Demo / Testing Link
                    </Label>
                    <Input
                      value={demoLink}
                      onChange={(e) => setDemoLink(e.target.value)}
                      placeholder="https://demo.example.com"
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* 4. Direct Login Portal URL */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                    <LogIn className="h-3.5 w-3.5 text-sky-600" /> Direct Login Portal URL (Optional)
                  </Label>
                  <Input
                    value={loginUrl}
                    onChange={(e) => setLoginUrl(e.target.value)}
                    placeholder="https://demo.example.com/login"
                    className="text-xs"
                  />
                </div>

                {/* 5. Role Credentials Builder */}
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-indigo-600" />
                      Role-Based Login Credentials
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddAccountRow}
                      className="text-xs h-7 gap-1 font-bold bg-white text-indigo-600 border-indigo-200"
                    >
                      <Plus className="h-3 w-3" /> Add Another Role
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {accounts.map((acc, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            placeholder="Role (e.g. Super Admin, Admin, Tester, User)"
                            value={acc.role_name}
                            onChange={(e) => handleAccountChange(idx, "role_name", e.target.value)}
                            className="font-bold text-xs max-w-[200px]"
                          />
                          {accounts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAccountRow(idx)}
                              className="text-red-500 hover:text-red-700 p-1 text-xs font-bold"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            placeholder="Username / Email"
                            value={acc.username}
                            onChange={(e) => handleAccountChange(idx, "username", e.target.value)}
                            className="text-xs font-mono"
                          />
                          <Input
                            placeholder="Password"
                            value={acc.password}
                            onChange={(e) => handleAccountChange(idx, "password", e.target.value)}
                            className="text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Custom Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase">Additional Notes / API Keys</Label>
                  <Textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="API keys, database access, port, or special instructions..."
                    rows={3}
                    className="text-xs font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 shadow-sm"
                >
                  {isSubmitting ? "Saving & Assigning..." : "Save & Multi-Assign Credentials"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by project, developer, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white text-xs font-medium"
        />
      </div>

      {/* Credentials Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredCredentials.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 border-dashed space-y-2">
            <KeyRound className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No project credentials found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add project credentials to securely share login access and website previews across your team.
            </p>
          </div>
        ) : (
          filteredCredentials.map((cred: any) => {
            const sections = parseCredentialSections(cred.credentials_text, cred.role);
            const loginUrlMatch = (cred.credentials_text || "").match(/Login Portal:\s*([^\n]+)/);
            const primaryLoginUrl = loginUrlMatch ? loginUrlMatch[1].trim() : cred.demo_link || cred.live_link;

            return (
              <div
                key={cred.id}
                className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-[11px] font-extrabold tracking-wide border border-sky-200/60">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-600" /> {cred.role || "Team"} Access
                    </div>

                    {(isExecutive || cred.user_id === currentUserId) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(cred.all_ids || [cred.id])}
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                        title="Delete Credentials"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-xl leading-tight">
                    {cred.project_title || "General Project Access"}
                  </h3>

                  {/* Assigned Team Members */}
                  {isExecutive && cred.assigned_users && cred.assigned_users.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Team</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {cred.assigned_users.map((u: any) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200/60 text-[10px] font-bold text-sky-800"
                          >
                            <Users className="h-2.5 w-2.5 text-sky-500" />
                            {u.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Live & Demo Website Previews */}
                {(cred.live_link || cred.demo_link) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cred.live_link && (
                      <WebsitePreviewCard
                        url={cred.live_link}
                        label={`${cred.project_title || "Project"} (Live Website)`}
                        type="live"
                      />
                    )}

                    {cred.demo_link && (
                      <WebsitePreviewCard
                        url={cred.demo_link}
                        label={`${cred.project_title || "Project"} (Demo & Testing)`}
                        type="demo"
                      />
                    )}
                  </div>
                )}

                {/* Role Accounts & Multi-Buttons */}
                {sections.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Login Accounts & Quick Actions
                      </Label>
                      {primaryLoginUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDirectLogin(primaryLoginUrl, cred)}
                          className="h-6 text-[10px] font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200 px-2 gap-1"
                        >
                          <LogIn className="h-3 w-3 text-sky-600" /> Direct Login Portal
                        </Button>
                      )}
                    </div>

                    {sections.map((sec, idx) => {
                      const passKey = `${cred.id}-${idx}`;
                      const isPassVisible = visiblePasswords[passKey];

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <Badge className="bg-slate-900 text-white font-bold text-[10px] px-2 py-0.5">
                              {sec.role}
                            </Badge>

                            {primaryLoginUrl && (
                              <button
                                onClick={() => handleDirectLogin(primaryLoginUrl, cred)}
                                className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1"
                              >
                                <span>Launch & Paste</span> &rarr;
                              </button>
                            )}
                          </div>

                          {/* Username / Email */}
                          {sec.username && (
                            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
                              <span className="text-slate-600 font-mono text-[11px] truncate pr-2 font-semibold">
                                {sec.username}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyText(sec.username!, `u-${passKey}`, "Username")}
                                className="h-6 px-2 text-[10px] font-bold text-sky-700 hover:bg-sky-50 shrink-0 gap-1"
                              >
                                {copiedKey === `u-${passKey}` ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" /> Copy User
                                  </>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Password with View/Hide & Copy */}
                          {sec.password && (
                            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
                              <span className="font-mono text-[11px] text-slate-800 truncate pr-2 font-semibold">
                                {isPassVisible ? sec.password : "••••••••••••"}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    setVisiblePasswords({
                                      ...visiblePasswords,
                                      [passKey]: !isPassVisible,
                                    })
                                  }
                                  className="text-slate-400 hover:text-slate-700 p-1"
                                  title={isPassVisible ? "Hide Password" : "Show Password"}
                                >
                                  {isPassVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-slate-500" />}
                                </button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyText(sec.password!, `p-${passKey}`, "Password")}
                                  className="h-6 px-2 text-[10px] font-bold text-sky-700 hover:bg-sky-50 gap-1"
                                >
                                  {copiedKey === `p-${passKey}` ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" /> Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" /> Copy Pass
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 1-Click Copy All Quick Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyText(cred.credentials_text, `card-${cred.id}`, "Full Credentials")}
                    className="w-full text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200 gap-1.5"
                  >
                    {copiedKey === `card-${cred.id}` ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied All Credentials!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> 1-Click Copy Full Credentials
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
