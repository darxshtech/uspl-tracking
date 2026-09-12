"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LetterGenerationModal from "@/components/LetterGenerationModal";
import { generateLetterPDF, LetterData, formatDateString } from "@/lib/pdf/letterGenerator";
import { showSuccess, showError, showConfirm } from "@/lib/swal";
import { getRoleBadgeClass, getRoleDisplayName, getRoleIconEmoji } from "@/lib/roleUtils";
import { 
  Award, 
  Plus, 
  Download, 
  Search, 
  FileText, 
  Briefcase, 
  Trash2, 
  Sparkles, 
  Calendar, 
  User, 
  ShieldCheck, 
  RefreshCw,
  LayoutGrid,
  List,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Building2,
  Clock,
  Stamp,
  Send
} from "lucide-react";

interface LetterItem {
  id: number;
  user_id: number;
  letter_type: "Joining Letter" | "Internship Offer Letter" | "Experience Letter" | "Internship Completion";
  title: string;
  reference_no: string;
  issue_date: string;
  metadata: any;
  custom_remarks?: string;
  status: string;
  issued_by: number;
  created_at: string;
  user_name: string;
  user_email: string;
  user_role: string;
  issuer_name: string;
  issuer_role: string;
}

export default function LettersPage() {
  const { data: session } = useSession();
  const currentRole = (session?.user as any)?.role || "Developer";
  const currentUserId = (session?.user as any)?.id;
  const isManagement = ["Admin", "CEO", "PM"].includes(currentRole);

  const [letters, setLetters] = useState<LetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedRefId, setCopiedRefId] = useState<number | null>(null);

  // Fetch letters
  const fetchLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/letters");
      if (res.ok) {
        const data = await res.json();
        setLetters(Array.isArray(data.letters) ? data.letters : []);
      }
    } catch (err) {
      console.error("Failed to load letters:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchLetters();
    }
  }, [session]);

  // Copy reference number to clipboard
  const handleCopyRef = (id: number, refNo: string) => {
    navigator.clipboard.writeText(refNo);
    setCopiedRefId(id);
    setTimeout(() => setCopiedRefId(null), 2000);
  };

  // Handle Download PDF
  const handleDownloadPDF = (letter: LetterItem) => {
    const meta = letter.metadata || {};
    const pdfData: LetterData = {
      reference_no: letter.reference_no,
      letter_type: letter.letter_type,
      title: letter.title,
      issue_date: letter.issue_date,
      user_name: letter.user_name || meta.employee_name || "Employee",
      user_email: letter.user_email || meta.employee_email,
      user_phone: meta.employee_phone,
      designation: meta.designation || letter.user_role || "Software Engineer",
      joining_date: meta.joining_date,
      relieving_date: meta.relieving_date,
      department: meta.department || "Engineering & Development",
      reporting_manager: meta.reporting_manager,
      annual_ctc: meta.annual_ctc,
      monthly_salary: meta.monthly_salary,
      probation_period: meta.probation_period,
      work_location: meta.work_location,
      working_days: meta.working_days,
      work_timing: meta.work_timing,
      signatory_name: meta.signatory_name || "Anmol Gadhave",
      signatory_title: meta.signatory_title || "Project Manager / Authorized Signatory",
      custom_remarks: letter.custom_remarks,
      company_policies: meta.company_policies,
    };

    generateLetterPDF(pdfData, true);
    showSuccess("Document Downloaded", `Official PDF for ${letter.reference_no} has been downloaded.`);
  };

  // Handle Send to Employee
  const handleSendToEmployee = async (id: number, refNo: string, empName: string) => {
    const confirmed = await showConfirm(
      "Send Letter to Employee?",
      `Are you sure you want to officially publish and send "${refNo}" to ${empName}? It will immediately appear in their personal login under Letters & Certificates and trigger an in-app notification.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/letters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "send_to_employee" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send letter to employee.");
      }
      showSuccess("Letter Sent to Employee!", data.message || `Letter ${refNo} has been delivered to ${empName}'s account.`);
      fetchLetters();
    } catch (err: any) {
      showError("Dispatch Failed", err.message || "Failed to dispatch letter to employee.");
    }
  };

  // Handle Delete / Revoke
  const handleDeleteLetter = async (id: number, refNo: string) => {
    const confirmed = await showConfirm(
      "Revoke Official Document?",
      `Are you sure you want to delete and revoke document "${refNo}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/letters?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete letter.");
      }
      showSuccess("Document Removed", `Letter ${refNo} has been removed from the registry.`);
      fetchLetters();
    } catch (err: any) {
      showError("Delete Failed", err.message || "Failed to remove letter.");
    }
  };

  // Unique list of employees for filter dropdown
  const uniqueEmployees = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    letters.forEach((l) => {
      if (l.user_id && l.user_name) {
        map.set(l.user_id, { id: l.user_id, name: l.user_name });
      }
    });
    return Array.from(map.values());
  }, [letters]);

  // Filter letters
  const filteredLetters = useMemo(() => {
    return letters.filter((l) => {
      // Type Tab Filter
      if (activeTab !== "ALL" && l.letter_type !== activeTab) {
        return false;
      }
      // Employee Filter
      if (selectedEmployeeFilter !== "all" && String(l.user_id) !== selectedEmployeeFilter) {
        return false;
      }
      // Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchRef = l.reference_no.toLowerCase().includes(query);
        const matchName = (l.user_name || "").toLowerCase().includes(query);
        const matchRole = (l.user_role || "").toLowerCase().includes(query);
        const matchTitle = (l.title || "").toLowerCase().includes(query);
        const matchRemarks = (l.custom_remarks || "").toLowerCase().includes(query);
        if (!matchRef && !matchName && !matchRole && !matchTitle && !matchRemarks) {
          return false;
        }
      }
      return true;
    });
  }, [letters, activeTab, selectedEmployeeFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = letters.length;
    const joining = letters.filter((l) => l.letter_type === "Joining Letter").length;
    const internshipOffer = letters.filter((l) => l.letter_type === "Internship Offer Letter").length;
    const experience = letters.filter((l) => l.letter_type === "Experience Letter").length;
    const internship = letters.filter((l) => l.letter_type === "Internship Completion").length;
    return { total, joining, internshipOffer, experience, internship };
  }, [letters]);

  const getTypeTheme = (type: string) => {
    switch (type) {
      case "Joining Letter":
        return {
          badge: "bg-blue-50 text-blue-700 border-blue-200/80 font-bold",
          border: "border-blue-200/70 hover:border-blue-300",
          cardBg: "from-blue-50/40 via-white to-white",
          accentColor: "text-blue-600",
          iconBg: "bg-blue-100 text-blue-700",
          icon: Briefcase,
          label: "Joining Letter",
        };
      case "Internship Offer Letter":
        return {
          badge: "bg-indigo-50 text-indigo-700 border-indigo-200/80 font-bold",
          border: "border-indigo-200/70 hover:border-indigo-300",
          cardBg: "from-indigo-50/40 via-white to-white",
          accentColor: "text-indigo-600",
          iconBg: "bg-indigo-100 text-indigo-700",
          icon: Sparkles,
          label: "Internship Offer Letter",
        };
      case "Experience Letter":
        return {
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold",
          border: "border-emerald-200/70 hover:border-emerald-300",
          cardBg: "from-emerald-50/40 via-white to-white",
          accentColor: "text-emerald-600",
          iconBg: "bg-emerald-100 text-emerald-700",
          icon: ShieldCheck,
          label: "Experience Letter",
        };
      case "Internship Completion":
        return {
          badge: "bg-purple-50 text-purple-700 border-purple-200/80 font-bold",
          border: "border-purple-200/70 hover:border-purple-300",
          cardBg: "from-purple-50/40 via-white to-white",
          accentColor: "text-purple-600",
          iconBg: "bg-purple-100 text-purple-700",
          icon: Award,
          label: "Internship Certificate",
        };
      default:
        return {
          badge: "bg-slate-50 text-slate-700 border-slate-200 font-bold",
          border: "border-slate-200",
          cardBg: "from-white to-white",
          accentColor: "text-slate-600",
          iconBg: "bg-slate-100 text-slate-700",
          icon: FileText,
          label: type,
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto">
      {/* EXECUTIVE HERO BANNER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden border border-indigo-950/50">
        {/* Subtle decorative glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-16 w-56 h-56 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
              <Stamp className="w-3.5 h-3.5 text-indigo-400" />
              Official HR Documents &amp; Certificates
            </span>
            <span className="text-xs text-slate-400 font-medium">Unitglo Solutions Pvt. Ltd.</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Award className="h-8 w-8 text-sky-400 shrink-0" />
            Letters &amp; Certificates Vault
          </h1>

          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            {isManagement
              ? "Generate, configure, and issue authentic Unitglo Solutions appointment letters, experience records, and internship certificates with verifiable reference codes and official seal stamps."
              : "Review and download your official Unitglo Solutions appointment letters, experience certificates, and internship credentials with instant PDF export."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLetters}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs gap-1.5 shadow-sm h-10 px-4 cursor-pointer backdrop-blur-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {isManagement && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs gap-2 shadow-lg shadow-sky-500/25 h-10 px-5 cursor-pointer rounded-xl transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Issue New Letter
            </Button>
          )}
        </div>
      </div>

      {/* KPI STATS RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Documents</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Recorded in registry</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-100 text-slate-800">
              <FileText className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/60 to-white shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Joining Letters</p>
              <h3 className="text-2xl font-black text-blue-950 mt-1">{metrics.joining}</h3>
              <p className="text-[10px] text-blue-600/80 mt-0.5">Appointment offers</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-100 text-blue-700">
              <Briefcase className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 to-white shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Experience Letters</p>
              <h3 className="text-2xl font-black text-emerald-950 mt-1">{metrics.experience}</h3>
              <p className="text-[10px] text-emerald-600/80 mt-0.5">Relieving &amp; tenure proof</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50/60 to-white shadow-xs hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Internship Letters</p>
              <h3 className="text-2xl font-black text-purple-950 mt-1">{metrics.internship}</h3>
              <p className="text-[10px] text-purple-600/80 mt-0.5">Completion certificates</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-100 text-purple-700">
              <Award className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTER & CONTROLS TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Type Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>All Documents</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "ALL" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"}`}>
                {metrics.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("Joining Letter")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "Joining Letter"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              <span>Joining Letters</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "Joining Letter" ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800"}`}>
                {metrics.joining}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("Internship Offer Letter")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "Internship Offer Letter"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Internship Offers</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "Internship Offer Letter" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-800"}`}>
                {metrics.internshipOffer}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("Experience Letter")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "Experience Letter"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Experience Letters</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "Experience Letter" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"}`}>
                {metrics.experience}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("Internship Completion")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === "Internship Completion"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Award className="w-3.5 h-3.5 text-purple-600" />
              <span>Internships</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "Internship Completion" ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-800"}`}>
                {metrics.internship}
              </span>
            </button>
          </div>

          {/* View Mode Switcher (Grid vs Table) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Grid View (Visual Cards)"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Table View (Data Grid)"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Table</span>
            </button>
          </div>
        </div>

        {/* Search & Employee Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder={isManagement ? "Search by employee, ref code, or title..." : "Search by ref code or certificate title..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all"
            />
          </div>

          {isManagement && uniqueEmployees.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
                <SelectTrigger className="h-9 text-xs w-[180px] bg-slate-50 border-slate-200 rounded-xl">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all" className="text-xs">All Employees</SelectItem>
                  {uniqueEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)} className="text-xs">
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT: LOADING, EMPTY STATE, GRID OR TABLE */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-500 mb-3" />
          <p className="text-sm font-bold text-slate-800">Loading Certificate Registry...</p>
          <p className="text-xs text-slate-400 mt-1">Fetching official company records and verification signatures.</p>
        </div>
      ) : filteredLetters.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600 shadow-sm">
            <Award className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No official certificates found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {isManagement
              ? "There are no letters matching your active filter criteria. Click 'Issue New Letter' to generate an authentic Joining, Experience, or Internship document."
              : "No official certificates or letters have been issued to your profile yet. Please check back later or contact your Project Manager if you are awaiting appointment papers."}
          </p>
          {isManagement && (
            <div className="pt-2">
              <Button
                onClick={() => setIsModalOpen(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-2 rounded-xl shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Issue First Letter
              </Button>
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ========================================================================= */
        /* GRID VIEW: LUXURIOUS CERTIFICATE CARDS                                    */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLetters.map((letter) => {
            const theme = getTypeTheme(letter.letter_type);
            const IconComponent = theme.icon;
            const meta = letter.metadata || {};

            return (
              <div
                key={letter.id}
                className={`rounded-3xl border ${theme.border} bg-gradient-to-b ${theme.cardBg} p-5 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between space-y-4 group relative overflow-hidden`}
              >
                {/* Top Reference & Type Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleCopyRef(letter.id, letter.reference_no)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-semibold transition-colors cursor-pointer"
                      title="Click to copy reference code"
                    >
                      <span>{letter.reference_no}</span>
                      {copiedRefId === letter.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                      )}
                    </button>

                    <Badge className={`${theme.badge} text-[10px] px-2.5 py-0.5 rounded-full`}>
                      {theme.label}
                    </Badge>
                  </div>

                  {/* Recipient info & title */}
                  <div className="pt-3.5 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 text-white flex items-center justify-center text-sm font-extrabold shadow-sm shrink-0">
                        {letter.user_name ? letter.user_name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-extrabold text-slate-900 truncate">
                          {letter.user_name}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          {meta.designation || letter.user_role || "Team Member"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                        {letter.title}
                      </h4>
                      {meta.department && (
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{meta.department}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Highlight Specs Pill Box */}
                  <div className="mt-3.5 p-3 rounded-2xl bg-white/90 border border-slate-100 shadow-xs space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Date of Issue:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDateString(letter.issue_date)}
                      </span>
                    </div>

                    {meta.joining_date && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">
                          {letter.letter_type === "Internship Completion" ? "Tenure Start:" : "Joining Date:"}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatDateString(meta.joining_date)}
                        </span>
                      </div>
                    )}

                    {meta.relieving_date && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">
                          {letter.letter_type === "Internship Completion" ? "Tenure End:" : "Relieved On:"}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatDateString(meta.relieving_date)}
                        </span>
                      </div>
                    )}

                    {letter.letter_type === "Joining Letter" && meta.annual_ctc && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Compensation:</span>
                        <span className="font-bold text-blue-700">
                          ₹{meta.annual_ctc} / yr
                        </span>
                      </div>
                    )}

                    {letter.letter_type === "Joining Letter" && (meta.working_days || meta.work_timing) && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Schedule:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[170px]" title={`${meta.working_days || "Mon - Fri"} (${meta.work_timing || "10 AM - 7 PM"})`}>
                          {meta.working_days || "Mon - Fri"} • {meta.work_timing || "10:00 AM - 7:00 PM"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Signatory & Verified Stamp Indicator */}
                  <div className="mt-3 flex items-center justify-between pt-1 text-[11px]">
                    <div className="flex items-center gap-1 text-slate-500 truncate">
                      <span className="text-slate-400">{letter.letter_type === "Joining Letter" ? "Reports To:" : "Signed:"}</span>
                      <span className="font-semibold text-slate-700 truncate">
                        {letter.letter_type === "Joining Letter" && meta.reporting_manager ? meta.reporting_manager : (meta.signatory_name || "Anmol Gadhave")}
                      </span>
                    </div>

                    {letter.status === "Draft" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <Clock className="w-2.5 h-2.5 text-amber-600" />
                        Management Draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        Sent to Employee
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    onClick={() => handleDownloadPDF(letter)}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1.5 h-9 rounded-xl shadow-xs cursor-pointer transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Official PDF
                  </Button>

                  {isManagement && letter.status === "Draft" && (
                    <Button
                      onClick={() => handleSendToEmployee(letter.id, letter.reference_no, letter.user_name)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 h-9 px-3 rounded-xl shadow-xs cursor-pointer transition-all shrink-0"
                      title="Send directly to employee login portal"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </Button>
                  )}

                  {isManagement && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLetter(letter.id, letter.reference_no)}
                      className="h-9 w-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Revoke & Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* TABLE VIEW: COMPACT ENTERPRISE AUDIT LIST                                */
        /* ========================================================================= */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-slate-50/90 border-b border-slate-200">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-700 py-3.5">Reference Code &amp; Title</TableHead>
                {isManagement && (
                  <TableHead className="text-xs font-bold text-slate-700 py-3.5">Recipient Employee</TableHead>
                )}
                <TableHead className="text-xs font-bold text-slate-700 py-3.5">Certificate Type</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 py-3.5">Date of Issue</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 py-3.5">Status</TableHead>
                {isManagement && (
                  <TableHead className="text-xs font-bold text-slate-700 py-3.5">Authorized Signatory</TableHead>
                )}
                <TableHead className="text-xs font-bold text-slate-700 py-3.5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLetters.map((letter) => {
                const theme = getTypeTheme(letter.letter_type);
                const meta = letter.metadata || {};

                return (
                  <TableRow key={letter.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Reference & Title */}
                    <TableCell className="py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {letter.reference_no}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyRef(letter.id, letter.reference_no)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Copy reference code"
                          >
                            {copiedRefId === letter.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 line-clamp-1">
                          {letter.title}
                        </p>
                      </div>
                    </TableCell>

                    {/* Employee Profile (Management) */}
                    {isManagement && (
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {letter.user_name ? letter.user_name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{letter.user_name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{meta.designation || letter.user_role}</p>
                          </div>
                        </div>
                      </TableCell>
                    )}

                    {/* Type Badge */}
                    <TableCell className="py-3.5">
                      <Badge className={`${theme.badge} text-[10px] px-2.5 py-0.5 rounded-full`}>
                        {theme.label}
                      </Badge>
                    </TableCell>

                    {/* Issue Date */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateString(letter.issue_date)}
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-3.5">
                      {letter.status === "Draft" ? (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 font-bold flex items-center gap-1 w-fit">
                          <Clock className="w-2.5 h-2.5 text-amber-600" /> Draft
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 font-bold flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Sent
                        </Badge>
                      )}
                    </TableCell>

                    {/* Signatory */}
                    {isManagement && (
                      <TableCell className="py-3.5">
                        <div className="text-xs">
                          <p className="font-bold text-slate-800">{meta.signatory_name || "Anmol Gadhave"}</p>
                          <span className="text-[11px] text-slate-400">{meta.signatory_title || "Project Manager"}</span>
                        </div>
                      </TableCell>
                    )}

                    {/* Action Buttons */}
                    <TableCell className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isManagement && letter.status === "Draft" && (
                          <Button
                            size="sm"
                            onClick={() => handleSendToEmployee(letter.id, letter.reference_no, letter.user_name)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1 h-8 px-2.5 rounded-lg shadow-xs cursor-pointer"
                            title="Send to employee login portal"
                          >
                            <Send className="w-3 h-3" />
                            Send
                          </Button>
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleDownloadPDF(letter)}
                          className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold gap-1.5 h-8 px-3 rounded-lg shadow-xs cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          Download PDF
                        </Button>

                        {isManagement && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteLetter(letter.id, letter.reference_no)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Revoke Certificate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ISSUANCE MODAL (Management only) */}
      {isManagement && (
        <LetterGenerationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchLetters}
        />
      )}
    </div>
  );
}
