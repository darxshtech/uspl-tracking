"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError, showWarning } from "@/lib/swal";
import { generateLetterPDF, LetterData, formatDateString } from "@/lib/pdf/letterGenerator";
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
  ChevronRight
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

  // List of available reporting managers for dropdown
  const managerOptions = [
    "Anmol Gadhave (Project Manager)",
    "Ganesh Nagargoje (Chief Executive Officer)",
    "Anmol Gadhave (Director)",
    "Management / Board of Directors",
    ...employees
      .map((e) => `${e.name} (${e.role})`)
      .filter((opt) => !["Anmol Gadhave (Project Manager)", "Ganesh Nagargoje (Chief Executive Officer)", "Anmol Gadhave (Director)", "Management / Board of Directors"].includes(opt))
  ];

  // Load active employees
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
        "Letter Issued Successfully!",
        `${letterType} for ${selectedEmployee?.name} has been issued, saved to registry, and downloaded.`
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
            </form>
          ) : (
            /* ===================================================================== */
            /* TAB 2: LIVE DOCUMENT PREVIEW MOCKUP                                  */
            /* ===================================================================== */
            <div className="p-6 rounded-2xl bg-slate-100/90 border border-slate-200">
              <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-slate-200 space-y-5 text-slate-800 font-sans text-xs">
                {/* Header Mockup */}
                <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">UNITGLO SOLUTIONS</h2>
                    <p className="text-[10px] text-slate-500">Empowering Digital Innovation &amp; Technology Excellence</p>
                    <p className="text-[9px] text-slate-400">Pune, Maharashtra, India | contact@unitglo.com</p>
                  </div>
                  <div className="text-right text-[10px] font-mono">
                    <p className="font-bold text-slate-800">Ref: {previewData.reference_no}</p>
                    <p className="text-slate-500">Date: {formatDateString(previewData.issue_date)}</p>
                  </div>
                </div>

                {/* Recipient */}
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-600">To,</p>
                  <p className="font-extrabold text-sm text-slate-900">{previewData.user_name}</p>
                  <p className="text-slate-600">{previewData.designation}</p>
                  {previewData.user_email && <p className="text-slate-400">{previewData.user_email}</p>}
                </div>

                {/* Subject */}
                <div className="p-2 rounded bg-slate-50 font-bold text-slate-900 border-l-4 border-blue-600">
                  Subject: {letterType === "Joining Letter" ? `Letter of Appointment - ${previewData.designation}` : letterType === "Experience Letter" ? `Experience & Relieving Certificate - ${previewData.user_name}` : `Certificate of Internship Completion - ${previewData.user_name}`}
                </div>

                {/* Body Paragraphs */}
                <div className="space-y-2.5 text-slate-700 leading-relaxed text-[11px]">
                  <p>Dear {previewData.user_name},</p>
                  {letterType === "Joining Letter" ? (
                    <>
                      <p>
                        We are pleased to offer you the position of <strong>{previewData.designation}</strong> at Unitglo Solutions Private Limited. Your joining date is effective from <strong>{formatDateString(previewData.joining_date)}</strong>.
                      </p>
                      <div className="p-2.5 rounded bg-blue-50/50 border border-blue-100 space-y-1 text-[10px]">
                        <p><strong>Compensation (CTC):</strong> {previewData.annual_ctc ? `₹${previewData.annual_ctc} / year` : "As agreed"}</p>
                        <p><strong>Probation Period:</strong> {previewData.probation_period || "3 Months"}</p>
                        <p><strong>Working Schedule:</strong> {previewData.working_days || "Monday to Friday"} ({previewData.work_timing || "10:00 AM - 7:00 PM IST"})</p>
                        <p><strong>Work Location:</strong> {previewData.work_location || "Pune / Hybrid"}</p>
                        <p><strong>Reporting Line:</strong> {previewData.reporting_manager || "Project Manager"}</p>
                      </div>
                    </>
                  ) : letterType === "Experience Letter" ? (
                    <p>
                      This is to certify that <strong>{previewData.user_name}</strong> was formally employed with Unitglo Solutions Private Limited as <strong>{previewData.designation}</strong> from <strong>{formatDateString(previewData.joining_date)}</strong> to <strong>{formatDateString(previewData.relieving_date)}</strong>. They have been relieved of all responsibilities on {formatDateString(previewData.relieving_date)}.
                    </p>
                  ) : (
                    <p>
                      This is to certify that <strong>{previewData.user_name}</strong> has successfully completed their professional internship program as <strong>{previewData.designation}</strong> at Unitglo Solutions Private Limited from <strong>{formatDateString(previewData.joining_date)}</strong> to <strong>{formatDateString(previewData.relieving_date)}</strong>.
                    </p>
                  )}

                  {previewData.custom_remarks && (
                    <p className="italic text-slate-600 bg-slate-50 p-2 rounded">
                      &quot;{previewData.custom_remarks}&quot;
                    </p>
                  )}
                </div>

                {/* Signatory & Official Seal */}
                <div className="pt-4 flex items-end justify-between border-t border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-500">For Unitglo Solutions Private Limited,</p>
                    <p className="font-extrabold text-slate-900 mt-5">{previewData.signatory_name || "Anmol Gadhave"}</p>
                    <p className="text-[10px] text-slate-500">{previewData.signatory_title || "Project Manager"}</p>
                  </div>

                  <div className="border-2 border-dashed border-emerald-600 p-2 rounded-lg text-center bg-emerald-50/50">
                    <p className="font-extrabold text-[9px] text-emerald-800">UNITGLO SOLUTIONS</p>
                    <p className="text-[8px] text-emerald-600 font-bold uppercase">Official HR Seal</p>
                    <p className="text-[7px] text-slate-400">Verified &amp; Authentic</p>
                  </div>
                </div>
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
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-2 rounded-xl h-9 px-4 shadow-md cursor-pointer transition-all"
            >
              <Stamp className="w-3.5 h-3.5" />
              {submitting ? "Processing..." : "Issue & Download Official PDF"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
