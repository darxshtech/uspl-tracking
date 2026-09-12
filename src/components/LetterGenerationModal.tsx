"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError, showWarning } from "@/lib/swal";
import { generateLetterPDF, LetterData, formatDateString } from "@/lib/pdf/letterGenerator";
import { DEFAULT_LETTER_POLICIES, buildLetterPolicies, syncPoliciesWithTerms } from "@/lib/constants/policies";
import { 
  FileText, 
  Award, 
  Briefcase, 
  Eye, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  UserCheck, 
  Stamp, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  FileSignature, 
  DollarSign, 
  Clock, 
  MapPin, 
  User,
  Layers,
  ChevronRight,
  Send
} from "lucide-react";

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  joining_date?: string;
  monthly_salary?: number | string;
  is_active?: number;
}

interface LetterGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type LetterType = "Joining Letter" | "Experience Letter" | "Internship Completion";

export default function LetterGenerationModal({
  isOpen,
  onClose,
  onSuccess,
}: LetterGenerationModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"form" | "preview">("form");

  // Form State
  const [letterType, setLetterType] = useState<LetterType>("Joining Letter");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [designation, setDesignation] = useState<string>("");
  const [department, setDepartment] = useState<string>("Engineering & Technology");
  const [joiningDate, setJoiningDate] = useState<string>("");
  const [relievingDate, setRelievingDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [monthlySalary, setMonthlySalary] = useState<string>("");
  const [annualCTC, setAnnualCTC] = useState<string>("");
  const [probationPeriod, setProbationPeriod] = useState<string>("3 Months");
  const [workLocation, setWorkLocation] = useState<string>("Pune, Maharashtra / Hybrid");
  const [reportingManager, setReportingManager] = useState<string>("Anmol Gadhave (Project Manager)");
  const [workingDays, setWorkingDays] = useState<string>("Monday to Friday");
  const [workTiming, setWorkTiming] = useState<string>("10:00 AM - 7:00 PM (IST)");
  const [signatoryName, setSignatoryName] = useState<string>("Anmol Gadhave");
  const [signatoryTitle, setSignatoryTitle] = useState<string>("Project Manager / Authorized Signatory");
  const [customRemarks, setCustomRemarks] = useState<string>("");
  const [companyPolicies, setCompanyPolicies] = useState<string>(DEFAULT_LETTER_POLICIES);
  const [defaultCompanyPolicies, setDefaultCompanyPolicies] = useState<string>(DEFAULT_LETTER_POLICIES);
  const [sendToEmployee, setSendToEmployee] = useState<boolean>(true);

  // List of available reporting managers derived strictly from actual company database members
  const managerOptions = useMemo(() => {
    if (!employees || employees.length === 0) {
      return ["Anmol Gadhave (Project Manager)", "Akash Kulkarni (Project Manager)"];
    }

    // List Project Managers and Admins first
    const leaders = employees.filter((e) => ["PM", "Admin", "CEO"].includes(e.role));
    const team = employees.filter((e) => !["PM", "Admin", "CEO"].includes(e.role));

    const list: string[] = [];

    leaders.forEach((m) => {
      const roleLabel = m.role === "PM" ? "Project Manager" : m.role;
      list.push(`${m.name} (${roleLabel})`);
    });

    team.forEach((t) => {
      list.push(`${t.name} (${t.role})`);
    });

    return Array.from(new Set(list));
  }, [employees]);

  // Load active employees and default letter policies
  useEffect(() => {
    if (!isOpen) return;
    async function loadEmployees() {
      setLoadingEmployees(true);
      try {
        const res = await fetch("/api/employees");
        if (res.ok) {
          const data = await res.json();
          const emps = Array.isArray(data) ? data : (data.employees || []);
          setEmployees(emps);
        }
      } catch (err) {
        console.error("Failed to load employees for letters:", err);
      } finally {
        setLoadingEmployees(false);
      }
    }
    loadEmployees();

    // Fetch official configured letter policies from system settings
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.letter_policies_text) {
          setCompanyPolicies(data.letter_policies_text);
          setDefaultCompanyPolicies(data.letter_policies_text);
        }
      })
      .catch((err) => console.error("Failed to load letter policies:", err));
  }, [isOpen]);

  // Update default reference prefix when type changes
  useEffect(() => {
    const year = new Date().getFullYear();
    let prefix = "APPT";
    if (letterType === "Experience Letter") prefix = "EXP";
    if (letterType === "Internship Completion") prefix = "INT";
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setReferenceNo(`USPL/${prefix}/${year}/${randomSuffix}`);
  }, [letterType]);

  // Synchronize company policies in Annexure A whenever appointment terms & compensation change
  useEffect(() => {
    if (letterType !== "Joining Letter") return;
    setCompanyPolicies((prev) => {
      return syncPoliciesWithTerms(prev, {
        working_days: workingDays,
        work_timing: workTiming,
        probation_period: probationPeriod,
        designation: designation || "Software Professional",
        work_location: workLocation,
        reporting_manager: reportingManager,
        annual_ctc: annualCTC,
        monthly_salary: monthlySalary,
      });
    });
  }, [workingDays, workTiming, probationPeriod, designation, workLocation, reportingManager, annualCTC, monthlySalary, letterType]);

  // Handle employee selection
  const handleSelectEmployee = (userIdStr: string) => {
    setSelectedUserId(userIdStr);
    const emp = employees.find((e) => String(e.id) === userIdStr);
    if (!emp) return;

    // Smart auto-fill
    let defaultRole = emp.role || "Software Developer";
    if (letterType === "Internship Completion" && !defaultRole.toLowerCase().includes("intern")) {
      defaultRole = `${defaultRole} Intern`;
    }
    setDesignation(defaultRole);

    if (emp.joining_date) {
      try {
        const d = new Date(emp.joining_date);
        if (!isNaN(d.getTime())) {
          setJoiningDate(d.toISOString().split("T")[0]);
        }
      } catch {
        setJoiningDate("");
      }
    }

    if (emp.monthly_salary) {
      const mSal = Number(emp.monthly_salary);
      if (!isNaN(mSal) && mSal > 0) {
        setMonthlySalary(String(mSal));
        setAnnualCTC(String(mSal * 12));
      }
    }
  };

  const selectedEmployee = employees.find((e) => String(e.id) === selectedUserId);

  const getLetterDataForPreview = (): LetterData => {
    return {
      reference_no: referenceNo || "USPL/REF/2026/001",
      letter_type: letterType,
      title: `${letterType} - ${selectedEmployee?.name || "Employee"}`,
      issue_date: issueDate,
      user_name: selectedEmployee?.name || "Employee Name",
      user_email: selectedEmployee?.email,
      user_phone: selectedEmployee?.phone,
      designation: designation || "Software Engineer",
      joining_date: joiningDate || issueDate,
      relieving_date: relievingDate,
      department: department || "Engineering",
      reporting_manager: reportingManager,
      annual_ctc: annualCTC,
      monthly_salary: monthlySalary,
      probation_period: probationPeriod,
      work_location: workLocation,
      working_days: workingDays,
      work_timing: workTiming,
      signatory_name: signatoryName,
      signatory_title: signatoryTitle,
      custom_remarks: customRemarks,
      company_policies: companyPolicies,
    };
  };

  const handleTestDownloadPreview = () => {
    if (!selectedUserId) {
      showWarning("Select Employee", "Please select an employee first to test PDF download.");
      return;
    }
    const data = getLetterDataForPreview();
    generateLetterPDF(data, true);
  };

  const handleIssueLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      showWarning("Missing Employee", "Please choose the recipient employee.");
      return;
    }
    if (!designation.trim()) {
      showWarning("Missing Designation", "Please provide the official designation.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id: parseInt(selectedUserId, 10),
        letter_type: letterType,
        title: `${letterType} - ${selectedEmployee?.name || "Employee"}`,
        reference_no: referenceNo,
        issue_date: issueDate,
        custom_remarks: customRemarks,
        send_to_employee: sendToEmployee,
        metadata: {
          designation,
          department,
          joining_date: joiningDate,
          relieving_date: relievingDate,
          monthly_salary: monthlySalary,
          annual_ctc: annualCTC,
          probation_period: probationPeriod,
          work_location: workLocation,
          working_days: workingDays,
          work_timing: workTiming,
          reporting_manager: reportingManager,
          signatory_name: signatoryName,
          signatory_title: signatoryTitle,
          employee_email: selectedEmployee?.email,
          employee_phone: selectedEmployee?.phone,
          company_policies: companyPolicies,
          is_sent_to_employee: sendToEmployee,
        },
      };

      const res = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to issue official letter.");
      }

      // Automatically generate & download the PDF
      const pdfData = getLetterDataForPreview();
      pdfData.reference_no = data.reference_no || referenceNo;
      generateLetterPDF(pdfData, true);

      showSuccess(
        sendToEmployee ? "Letter Issued & Sent to Employee!" : "Letter Saved as Draft",
        sendToEmployee
          ? `${letterType} for ${selectedEmployee?.name} has been issued, sent directly to their employee portal, and downloaded.`
          : `${letterType} has been saved as a management draft. It will not be visible to ${selectedEmployee?.name} until sent.`
      );

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showError("Issuance Failed", err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const previewData = getLetterDataForPreview();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] h-[90vh] flex flex-col p-0 rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        {/* TOP BRANDING STRIP */}
        <div className="shrink-0 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-6 py-4 text-white flex items-center justify-between border-b border-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
              <Stamp className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                Official Document Studio
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Unitglo HR
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                Generate authentic corporate letters with dynamic data, reference codes, and seal verification.
              </p>
            </div>
          </div>

          {/* Modal Header Tabs: Form vs Live Preview */}
          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15">
            <button
              type="button"
              onClick={() => setActiveModalTab("form")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModalTab === "form"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <FileSignature className="w-3.5 h-3.5" />
              Configure
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModalTab === "preview"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Live Preview
            </button>
          </div>
        </div>

        {/* LETTER TYPE SWITCHER BAR */}
        <div className="shrink-0 px-6 pt-4 bg-slate-50/60 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-3 pb-4">
            <button
              type="button"
              onClick={() => setLetterType("Joining Letter")}
              className={`flex items-center justify-center gap-2.5 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                letterType === "Joining Letter"
                  ? "border-blue-600 bg-white text-blue-700 shadow-md ring-2 ring-blue-500/20"
                  : "border-slate-200 hover:bg-white text-slate-600"
              }`}
            >
              <div className={`p-1.5 rounded-lg ${letterType === "Joining Letter" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                <Briefcase className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block font-bold">Joining Letter</span>
                <span className="text-[10px] font-medium text-slate-400">Appointment offer</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLetterType("Experience Letter")}
              className={`flex items-center justify-center gap-2.5 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                letterType === "Experience Letter"
                  ? "border-emerald-600 bg-white text-emerald-700 shadow-md ring-2 ring-emerald-500/20"
                  : "border-slate-200 hover:bg-white text-slate-600"
              }`}
            >
              <div className={`p-1.5 rounded-lg ${letterType === "Experience Letter" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block font-bold">Experience Letter</span>
                <span className="text-[10px] font-medium text-slate-400">Tenure &amp; relieving</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLetterType("Internship Completion")}
              className={`flex items-center justify-center gap-2.5 p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                letterType === "Internship Completion"
                  ? "border-purple-600 bg-white text-purple-700 shadow-md ring-2 ring-purple-500/20"
                  : "border-slate-200 hover:bg-white text-slate-600"
              }`}
            >
              <div className={`p-1.5 rounded-lg ${letterType === "Internship Completion" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                <Award className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block font-bold">Internship Certificate</span>
                <span className="text-[10px] font-medium text-slate-400">Completion proof</span>
              </div>
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE WITH AMPLE BOTTOM ROOM) */}
        <div className="flex-1 overflow-y-auto p-6 pb-28">
          {activeModalTab === "form" ? (
            <form id="letter-issue-form" onSubmit={handleIssueLetter} className="space-y-5">
              {/* EMPLOYEE SELECTION & REFERENCE CARD */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    Recipient Team Member
                  </Label>
                  {selectedEmployee && (
                    <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                      {selectedEmployee.role} • {selectedEmployee.email}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Choose Employee *</Label>
                    <Select value={selectedUserId} onValueChange={handleSelectEmployee}>
                      <SelectTrigger className="bg-white border-slate-200 text-xs rounded-xl h-10">
                        <SelectValue placeholder={loadingEmployees ? "Loading team members..." : "Choose an employee"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={String(emp.id)} className="text-xs">
                            {emp.name} ({emp.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Reference Number</Label>
                    <Input
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="bg-white border-slate-200 text-xs font-mono rounded-xl h-10"
                      placeholder="USPL/APPT/2026/001"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* CORE DETAILS ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Official Designation *</Label>
                  <Input
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="text-xs rounded-xl h-10"
                    placeholder="e.g. Senior Software Engineer"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Department</Label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="text-xs rounded-xl h-10"
                    placeholder="e.g. Engineering & Technology"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Date of Issue *</Label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="text-xs rounded-xl h-10"
                    required
                  />
                </div>
              </div>

              {/* DYNAMIC SUBSECTION: JOINING LETTER */}
              {letterType === "Joining Letter" && (
                <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-3.5">
                  <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Appointment Terms &amp; Compensation
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Date of Joining</Label>
                      <Input
                        type="date"
                        value={joiningDate}
                        onChange={(e) => setJoiningDate(e.target.value)}
                        className="text-xs bg-white rounded-xl h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Annual CTC (INR)</Label>
                      <Input
                        type="text"
                        value={annualCTC}
                        onChange={(e) => setAnnualCTC(e.target.value)}
                        className="text-xs bg-white rounded-xl h-9"
                        placeholder="e.g. 6,00,000"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Monthly Gross (INR)</Label>
                      <Input
                        type="text"
                        value={monthlySalary}
                        onChange={(e) => setMonthlySalary(e.target.value)}
                        className="text-xs bg-white rounded-xl h-9"
                        placeholder="e.g. 50,000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Probation Duration</Label>
                      <Input
                        value={probationPeriod}
                        onChange={(e) => setProbationPeriod(e.target.value)}
                        className="text-xs bg-white rounded-xl h-9"
                        placeholder="e.g. 3 Months"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Work Location</Label>
                      <Input
                        value={workLocation}
                        onChange={(e) => setWorkLocation(e.target.value)}
                        className="text-xs bg-white rounded-xl h-9"
                        placeholder="e.g. Pune / Hybrid"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600">Reporting Manager *</Label>
                      <Select value={reportingManager} onValueChange={setReportingManager}>
                        <SelectTrigger className="text-xs bg-white rounded-xl h-9">
                          <SelectValue placeholder="Select reporting manager" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {managerOptions.map((mgr) => (
                            <SelectItem key={mgr} value={mgr} className="text-xs">
                              {mgr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* ROW 3: WORKING DAYS & TIMING */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        Working Days Schedule *
                      </Label>
                      <Select value={workingDays} onValueChange={setWorkingDays}>
                        <SelectTrigger className="text-xs bg-white rounded-xl h-9">
                          <SelectValue placeholder="Select working days" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monday to Friday" className="text-xs">Monday to Friday (5 Days/Week)</SelectItem>
                          <SelectItem value="Monday to Friday (Alternate Saturdays)" className="text-xs">Monday to Friday (Alternate Saturdays)</SelectItem>
                          <SelectItem value="Monday to Saturday" className="text-xs">Monday to Saturday (6 Days/Week)</SelectItem>
                          <SelectItem value="Monday to Saturday (1st & 3rd Sat Off)" className="text-xs">Monday to Saturday (1st & 3rd Sat Off)</SelectItem>
                          <SelectItem value="Flexible Working Days" className="text-xs">Flexible Working Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Working Hours / Shift Timing *
                      </Label>
                      <Select value={workTiming} onValueChange={setWorkTiming}>
                        <SelectTrigger className="text-xs bg-white rounded-xl h-9">
                          <SelectValue placeholder="Select shift timing" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10:00 AM - 7:00 PM (IST)" className="text-xs">10:00 AM - 7:00 PM (IST) [Standard Shift]</SelectItem>
                          <SelectItem value="9:30 AM - 6:30 PM (IST)" className="text-xs">9:30 AM - 6:30 PM (IST)</SelectItem>
                          <SelectItem value="9:00 AM - 6:00 PM (IST)" className="text-xs">9:00 AM - 6:00 PM (IST)</SelectItem>
                          <SelectItem value="11:00 AM - 8:00 PM (IST)" className="text-xs">11:00 AM - 8:00 PM (IST)</SelectItem>
                          <SelectItem value="10:00 AM - 6:00 PM (IST)" className="text-xs">10:00 AM - 6:00 PM (IST)</SelectItem>
                          <SelectItem value="Flexible Schedule (8 Hours/Day)" className="text-xs">Flexible Schedule (8 Hours/Day)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* DYNAMIC SUBSECTION: EXPERIENCE & INTERNSHIP */}
              {(letterType === "Experience Letter" || letterType === "Internship Completion") && (
                <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-3.5">
                  <h4 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Tenure Period &amp; Relieving Dates
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">
                        {letterType === "Internship Completion" ? "Internship Commencement Date *" : "Date of Joining *"}
                      </Label>
                      <Input
                        type="date"
                        value={joiningDate}
                        onChange={(e) => setJoiningDate(e.target.value)}
                        className="text-xs bg-white rounded-xl h-10"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">
                        {letterType === "Internship Completion" ? "Internship Completion Date *" : "Relieving / Last Working Date *"}
                      </Label>
                      <Input
                        type="date"
                        value={relievingDate}
                        onChange={(e) => setRelievingDate(e.target.value)}
                        className="text-xs bg-white rounded-xl h-10"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SIGNATORY INFO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Authorized Signatory Name</Label>
                  <Input
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    className="text-xs rounded-xl h-10"
                    placeholder="e.g. Anmol Gadhave"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Signatory Designation / Title</Label>
                  <Input
                    value={signatoryTitle}
                    onChange={(e) => setSignatoryTitle(e.target.value)}
                    className="text-xs rounded-xl h-10"
                    placeholder="e.g. Project Manager / Director"
                  />
                </div>
              </div>

              {/* REMARKS & HIGHLIGHTS */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  {letterType === "Internship Completion"
                    ? "Projects & Performance Evaluation (Optional)"
                    : letterType === "Experience Letter"
                    ? "Conduct Assessment & Contributions (Optional)"
                    : "Special Clauses / Terms (Optional)"}
                </Label>
                <Textarea
                  value={customRemarks}
                  onChange={(e) => setCustomRemarks(e.target.value)}
                  rows={2}
                  className="text-xs rounded-xl"
                  placeholder="e.g. Exhibited commendable leadership, problem-solving skills, and contributed diligently to sprint deliverables..."
                />
              </div>

              {/* COMPANY POLICIES & ANNEXURE CLAUSES */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                      Company Policies &amp; Regulations (Annexure A)
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-white border-indigo-200 text-indigo-700 font-bold">
                      {letterType === "Joining Letter" ? "Page 2 Annexure" : "Enclosed Policies"}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCompanyPolicies(
                          buildLetterPolicies({
                            working_days: workingDays,
                            work_timing: workTiming,
                            probation_period: probationPeriod,
                            designation: designation || "Software Professional",
                            work_location: workLocation,
                            reporting_manager: reportingManager,
                            annual_ctc: annualCTC,
                            monthly_salary: monthlySalary,
                          })
                        )
                      }
                      className="h-6 px-2 text-[10px] text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100/60 font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      Re-sync Terms
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCompanyPolicies(defaultCompanyPolicies)}
                      className="h-6 px-2 text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 font-semibold cursor-pointer"
                    >
                      Default
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  These official clauses will appear on Page 2 (Annexure A) of the appointment letter. Management (PM &amp; Admin) can customize or edit these clauses for this specific recipient.
                </p>
                <Textarea
                  value={companyPolicies}
                  onChange={(e) => setCompanyPolicies(e.target.value)}
                  rows={6}
                  className="text-xs rounded-xl bg-white border-indigo-200 focus:border-indigo-500 font-sans"
                  placeholder="Enter company policies and regulations..."
                />
              </div>

              {/* SEND TO EMPLOYEE PORTAL TOGGLE */}
              <div
                onClick={() => setSendToEmployee(!sendToEmployee)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 select-none ${
                  sendToEmployee
                    ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200/80 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                      sendToEmployee
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        Send to Employee Login Portal
                      </span>
                      {sendToEmployee ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] py-0 px-2 font-semibold">
                          Visible in Employee Account
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px] py-0 px-2 font-semibold">
                          Management Draft Only
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {sendToEmployee
                        ? "The employee will immediately see this document in their personal dashboard under Letters & Certificates, and receive an instant notification."
                        : "Saved privately for management review. The employee will not see or be notified of this letter until you click 'Send to Employee'."}
                    </p>
                  </div>
                </div>

                {/* Animated Pill Toggle */}
                <div className="shrink-0 flex items-center pr-1">
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                      sendToEmployee ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        sendToEmployee ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* ===================================================================== */
            /* TAB 2: LIVE DOCUMENT PREVIEW MOCKUP                                  */
            /* ===================================================================== */
            <div className="p-6 rounded-2xl bg-slate-100/90 border border-slate-200">
              <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-200 space-y-5 text-slate-800 font-sans text-xs">
                {/* Official Letterhead with Real Logo */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <img
                      src="/unitglo.jpeg"
                      alt="Unitglo Solutions"
                      className="h-11 w-auto object-contain"
                    />
                  </div>
                  <div className="text-right text-[10px]">
                    <h2 className="text-xs font-black text-slate-900">UNITGLO SOLUTIONS PRIVATE LIMITED</h2>
                    <p className="text-[9px] text-slate-500">CIN: U72900PN2016PTC165210 | GSTIN: 27AABCU9538R1ZD</p>
                    <p className="text-[9px] text-slate-500">Flat No 9, Shri Sai Samarth Heights, A wing, Mohan Nagar,</p>
                    <p className="text-[9px] text-slate-500">MIDC, Chinchwad, Pimpri-Chinchwad, Maharashtra 411019</p>
                    <p className="text-[9px] text-slate-400">info@unitglo.com | www.unitglo.com | +91 73875 11539</p>
                  </div>
                </div>

                {/* Reference No & Date */}
                <div className="flex items-center justify-between text-[11px] font-semibold border-b border-slate-100 pb-2">
                  <span className="font-mono text-slate-800 font-bold">Ref. No: {previewData.reference_no}</span>
                  <span className="text-slate-600">Date: {formatDateString(previewData.issue_date)}</span>
                </div>

                {/* Recipient */}
                {letterType === "Joining Letter" ? (
                  <div className="space-y-0.5 text-[11px]">
                    <p className="font-bold text-slate-500">To,</p>
                    <p className="font-extrabold text-xs text-slate-900">{previewData.user_name}</p>
                    <p className="text-slate-600">{previewData.designation}</p>
                    {previewData.user_email && <p className="text-slate-400">{previewData.user_email}</p>}
                  </div>
                ) : (
                  <div className="text-center py-1">
                    <h3 className="font-extrabold text-xs text-slate-900 tracking-wider uppercase">TO WHOMSOEVER IT MAY CONCERN</h3>
                  </div>
                )}

                {/* Subject Banner */}
                <div className="p-2 rounded-lg bg-slate-900 text-white font-bold text-center text-xs tracking-wide">
                  {letterType === "Joining Letter"
                    ? `OFFER & APPOINTMENT LETTER - ${previewData.designation?.toUpperCase()}`
                    : letterType === "Experience Letter"
                    ? "EXPERIENCE & RELIEVING CERTIFICATE"
                    : "CERTIFICATE OF INTERNSHIP COMPLETION"}
                </div>

                {/* Body Paragraphs & Structured Terms Table */}
                <div className="space-y-3 text-slate-700 leading-relaxed text-[11px]">
                  {letterType === "Joining Letter" ? (
                    <>
                      <p>Dear {previewData.user_name},</p>
                      <p>
                        With reference to your application and the subsequent technical evaluation rounds, we are pleased to offer you the position of <strong>{previewData.designation}</strong> with Unitglo Solutions Private Limited. We believe your skills and professional expertise will contribute significantly to our organization.
                      </p>

                      {/* Structured 2-Column Terms Table */}
                      <div className="rounded-xl border border-slate-200 overflow-hidden text-[10px]">
                        <div className="bg-slate-50 px-3 py-1.5 font-bold text-slate-900 border-b border-slate-200">
                          Terms of Employment &amp; Compensation
                        </div>
                        <div className="divide-y divide-slate-200">
                          <div className="grid grid-cols-3 p-2 bg-white">
                            <span className="font-bold text-slate-700">Designation &amp; Dept</span>
                            <span className="col-span-2 text-slate-900">{previewData.designation} ({previewData.department || "Engineering"})</span>
                          </div>
                          <div className="grid grid-cols-3 p-2 bg-slate-50/50">
                            <span className="font-bold text-slate-700">Date of Commencement</span>
                            <span className="col-span-2 text-slate-900">{formatDateString(previewData.joining_date)}</span>
                          </div>
                          <div className="grid grid-cols-3 p-2 bg-white">
                            <span className="font-bold text-slate-700">Total Compensation (CTC)</span>
                            <span className="col-span-2 font-bold text-blue-700">
                              {previewData.annual_ctc ? `INR ${previewData.annual_ctc}/- Per Annum` : "As mutually agreed"}
                              {previewData.monthly_salary ? ` (Gross: INR ${previewData.monthly_salary}/- PM)` : ""}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 p-2 bg-slate-50/50">
                            <span className="font-bold text-slate-700">Working Days Schedule</span>
                            <span className="col-span-2 text-slate-900">{previewData.working_days || "Monday to Friday (5 Days/Week)"}</span>
                          </div>
                          <div className="grid grid-cols-3 p-2 bg-white">
                            <span className="font-bold text-slate-700">Working Hours / Shift</span>
                            <span className="col-span-2 text-slate-900">{previewData.work_timing || "10:00 AM - 7:00 PM (IST)"}</span>
                          </div>
                          <div className="grid grid-cols-3 p-2 bg-slate-50/50">
                            <span className="font-bold text-slate-700">Work Location</span>
                            <span className="col-span-2 text-slate-900">{previewData.work_location || "Pune, Maharashtra / Hybrid"}</span>
                          </div>
                          <div className="grid grid-cols-3 p-2 bg-white">
                            <span className="font-bold text-slate-700">Reporting Authority</span>
                            <span className="col-span-2 text-slate-900">{previewData.reporting_manager || "Project Manager"}</span>
                          </div>
                          <div className="grid grid-cols-3 p-2 bg-slate-50/50">
                            <span className="font-bold text-slate-700">Probation Duration</span>
                            <span className="col-span-2 text-slate-900">{previewData.probation_period || "3 Months from joining date"}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500">
                        * This appointment is subject to the comprehensive Company Policies, Attendance Guidelines, and Code of Conduct set forth in Annexure A attached hereto.
                      </p>
                    </>
                  ) : letterType === "Experience Letter" ? (
                    <>
                      <p>
                        This is to formally certify that <strong>{previewData.user_name}</strong> was employed with Unitglo Solutions Private Limited as <strong>{previewData.designation}</strong> in the {previewData.department || "Engineering"} department from <strong>{formatDateString(previewData.joining_date)}</strong> to <strong>{formatDateString(previewData.relieving_date)}</strong>.
                      </p>

                      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px]">
                        <div>
                          <span className="text-slate-400 block">Joining Date:</span>
                          <span className="font-bold text-slate-900">{formatDateString(previewData.joining_date)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Relieving Date:</span>
                          <span className="font-bold text-slate-900">{formatDateString(previewData.relieving_date)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Conduct &amp; Character:</span>
                          <span className="font-bold text-emerald-700">Exemplary</span>
                        </div>
                      </div>

                      <p>
                        During their employment tenure, they contributed diligently to core software deliveries, demonstrated high problem-solving competence, and maintained exemplary professional discipline. All company assets and project transitions have been completed in order.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        This is to formally certify that <strong>{previewData.user_name}</strong> has successfully completed their professional internship program as <strong>{previewData.designation}</strong> at Unitglo Solutions Private Limited from <strong>{formatDateString(previewData.joining_date)}</strong> to <strong>{formatDateString(previewData.relieving_date)}</strong>.
                      </p>

                      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px]">
                        <div>
                          <span className="text-slate-400 block">Start Date:</span>
                          <span className="font-bold text-slate-900">{formatDateString(previewData.joining_date)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">End Date:</span>
                          <span className="font-bold text-slate-900">{formatDateString(previewData.relieving_date)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Mentor / Lead:</span>
                          <span className="font-bold text-slate-900">{previewData.reporting_manager || "Project Manager"}</span>
                        </div>
                      </div>

                      <p>
                        Throughout this internship tenure, they exhibited outstanding technical curiosity, quick learning aptitude, and actively contributed to team sprint deliverables under senior engineering supervision.
                      </p>
                    </>
                  )}

                  {previewData.custom_remarks && (
                    <p className="italic text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      &quot;{previewData.custom_remarks}&quot;
                    </p>
                  )}
                </div>

                {/* Signatory & Official Seal */}
                <div className="pt-4 flex items-end justify-between border-t border-slate-200">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500">Sincerely,</p>
                    <p className="text-[10px] font-bold text-slate-800">For Unitglo Solutions Private Limited,</p>
                    <p className="font-extrabold text-sm text-slate-900 mt-4">{previewData.signatory_name || "Anmol Gadhave"}</p>
                    <p className="text-[10px] text-slate-500">{previewData.signatory_title || "Project Manager / Authorized Signatory"}</p>
                  </div>

                  <div className="border-2 border-dashed border-blue-600 p-2.5 rounded-xl text-center bg-blue-50/50">
                    <p className="font-extrabold text-[9px] text-blue-900">UNITGLO SOLUTIONS PVT. LTD.</p>
                    <p className="text-[8px] text-blue-600 font-bold uppercase tracking-wider">Official Corporate Seal</p>
                    <p className="text-[8px] font-bold text-emerald-600">✔ VERIFIED &amp; AUTHENTIC</p>
                    <p className="text-[7px] text-slate-400">PUNE, MAHARASHTRA</p>
                  </div>
                </div>

                {/* Candidate Acceptance Slip (Joining Letter only) */}
                {letterType === "Joining Letter" && (
                  <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] space-y-1">
                    <p className="font-bold text-slate-800">CANDIDATE ACCEPTANCE:</p>
                    <p className="text-slate-600">I confirm that I have read, understood, and accept the terms and conditions outlined in this Appointment Letter and Annexure A.</p>
                    <p className="font-semibold text-slate-800 pt-1">
                      Candidate Signature: _______________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: _________________
                    </p>
                  </div>
                )}

                {/* Page 2 Sheet for Joining Letter */}
                {letterType === "Joining Letter" && (
                  <div className="mt-8 pt-8 border-t-4 border-dashed border-slate-300 space-y-5">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
                      <span>--- PAGE 2 OF 2 ---</span>
                      <span>ANNEXURE A ENCLOSURE</span>
                    </div>

                    {/* Letterhead on Page 2 */}
                    <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <img
                          src="/unitglo.jpeg"
                          alt="Unitglo Solutions"
                          className="h-11 w-auto object-contain"
                        />
                      </div>
                      <div className="text-right text-[10px]">
                        <h2 className="text-xs font-black text-slate-900">UNITGLO SOLUTIONS PRIVATE LIMITED</h2>
                        <p className="text-[9px] text-slate-500">CIN: U72900PN2016PTC165210 | GSTIN: 27AABCU9538R1ZD</p>
                        <p className="text-[9px] text-slate-500">Flat No 9, Shri Sai Samarth Heights, A wing, Mohan Nagar,</p>
                        <p className="text-[9px] text-slate-500">MIDC, Chinchwad, Pimpri-Chinchwad, Maharashtra 411019</p>
                        <p className="text-[9px] text-slate-400">info@unitglo.com | www.unitglo.com | +91 73875 11539</p>
                      </div>
                    </div>

                    {/* Reference & Annexure Header */}
                    <div className="flex items-center justify-between text-[11px] font-semibold border-b border-slate-100 pb-2">
                      <span className="font-mono text-slate-800 font-bold">Ref. No: {previewData.reference_no} | Annexure A</span>
                      <span className="text-slate-600">Candidate: {previewData.user_name}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900 text-white font-bold text-center text-xs tracking-wide">
                      ANNEXURE A — OFFICIAL COMPANY POLICIES, REGULATIONS &amp; CODE OF CONDUCT
                    </div>

                    {/* Formatted Policy Items */}
                    <div className="space-y-2.5 text-[10.5px] text-slate-700 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                      {companyPolicies.split(/\n{2,}|\r\n\r\n/).map((item, idx) => {
                        const colonIdx = item.indexOf(":");
                        if (colonIdx > 0 && colonIdx < 60) {
                          const title = item.substring(0, colonIdx + 1);
                          const desc = item.substring(colonIdx + 1);
                          return (
                            <div key={idx} className="space-y-0.5">
                              <p className="font-bold text-slate-900">{title}</p>
                              <p className="text-slate-600 text-[10px] pl-2">{desc}</p>
                            </div>
                          );
                        }
                        return <p key={idx}>{item}</p>;
                      })}
                    </div>

                    {/* Employee Undertaking Signature Block */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-[10px]">
                      <p className="font-extrabold text-slate-900 uppercase">EMPLOYEE ACKNOWLEDGEMENT &amp; COMPLIANCE UNDERTAKING:</p>
                      <p className="text-slate-600 leading-snug">
                        I hereby confirm that I have received, thoroughly reviewed, and agree to strictly comply with all the company policies, attendance guidelines, code of conduct, and confidentiality obligations stated in this Annexure.
                      </p>
                      <div className="pt-2 flex justify-between text-slate-700 font-semibold border-t border-slate-200">
                        <span>Employee Signature: ___________________________</span>
                        <span>Date: ________________________</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* DIALOG FOOTER (FIXED PINNED AT BOTTOM) */}
        <DialogFooter className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestDownloadPreview}
              className="text-xs flex items-center gap-1.5 border-slate-200 hover:bg-white text-slate-700 rounded-xl h-9 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              Test PDF Export
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="text-xs rounded-xl h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="letter-issue-form"
              disabled={submitting}
              className={`text-xs text-white font-bold flex items-center gap-2 rounded-xl h-9 px-4 shadow-md cursor-pointer transition-all ${
                sendToEmployee
                  ? "bg-slate-900 hover:bg-slate-800"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {sendToEmployee ? <Stamp className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {submitting
                ? "Processing..."
                : sendToEmployee
                ? "Issue & Send to Employee"
                : "Save as Management Draft"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
