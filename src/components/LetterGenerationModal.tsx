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
import { generateLetterPDF, LetterData } from "@/lib/pdf/letterGenerator";
import { FileText, Award, Briefcase, Eye, Download, Sparkles, CheckCircle2, UserCheck } from "lucide-react";

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
  const [showLivePreview, setShowLivePreview] = useState(false);

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
  const [signatoryName, setSignatoryName] = useState<string>("Anmol Gadhave");
  const [signatoryTitle, setSignatoryTitle] = useState<string>("Project Manager / Authorized Signatory");
  const [customRemarks, setCustomRemarks] = useState<string>("");

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
      signatory_name: signatoryName,
      signatory_title: signatoryTitle,
      custom_remarks: customRemarks,
    };
  };

  const handleTestDownloadPreview = () => {
    if (!selectedUserId) {
      showWarning("Select Employee", "Please select an employee first to preview the letter.");
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
        `${letterType} for ${selectedEmployee?.name} has been generated, saved to their account, and downloaded.`
      );

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showError("Issuance Failed", err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Configure & Issue Official Letter
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate authentic Unitglo branded PDF certificates & letters with auto-filled employee records.
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* LETTER TYPE SWITCHER TABS */}
        <div className="grid grid-cols-3 gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => setLetterType("Joining Letter")}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              letterType === "Joining Letter"
                ? "border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm"
                : "border-slate-200 hover:bg-slate-50 text-slate-600"
            }`}
          >
            <Briefcase className="w-4 h-4 text-blue-600" />
            Joining Letter
          </button>

          <button
            type="button"
            onClick={() => setLetterType("Experience Letter")}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              letterType === "Experience Letter"
                ? "border-emerald-600 bg-emerald-50/70 text-emerald-700 shadow-sm"
                : "border-slate-200 hover:bg-slate-50 text-slate-600"
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            Experience Letter
          </button>

          <button
            type="button"
            onClick={() => setLetterType("Internship Completion")}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              letterType === "Internship Completion"
                ? "border-purple-600 bg-purple-50/70 text-purple-700 shadow-sm"
                : "border-slate-200 hover:bg-slate-50 text-slate-600"
            }`}
          >
            <Award className="w-4 h-4 text-purple-600" />
            Internship Certificate
          </button>
        </div>

        <form onSubmit={handleIssueLetter} className="space-y-4 pt-2">
          {/* SECTION 1: RECIPIENT SELECTION */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Select Recipient Employee
              </Label>
              {selectedEmployee && (
                <Badge variant="outline" className="bg-white text-[11px] text-blue-700 font-medium">
                  {selectedEmployee.role} • {selectedEmployee.email}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Employee *</Label>
                <Select value={selectedUserId} onValueChange={handleSelectEmployee}>
                  <SelectTrigger className="mt-1 bg-white border-slate-200 text-xs">
                    <SelectValue placeholder={loadingEmployees ? "Loading employees..." : "Choose an employee"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)} className="text-xs">
                        {emp.name} ({emp.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-600">Reference Number</Label>
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="mt-1 bg-white border-slate-200 text-xs font-mono"
                  placeholder="USPL/APPT/2026/001"
                  required
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: CORE DETAILS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-600">Official Designation *</Label>
              <Input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="mt-1 text-xs"
                placeholder="e.g. Senior Full Stack Engineer"
                required
              />
            </div>

            <div>
              <Label className="text-xs text-slate-600">Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 text-xs"
                placeholder="e.g. Engineering & Development"
              />
            </div>

            <div>
              <Label className="text-xs text-slate-600">Date of Issue *</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>
          </div>

          {/* SECTION 3: TYPE SPECIFIC FIELDS */}
          {letterType === "Joining Letter" && (
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-3">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Appointment & Compensation Terms
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-slate-600">Date of Joining</Label>
                  <Input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="mt-1 text-xs bg-white"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Annual CTC (INR)</Label>
                  <Input
                    type="text"
                    value={annualCTC}
                    onChange={(e) => setAnnualCTC(e.target.value)}
                    className="mt-1 text-xs bg-white"
                    placeholder="e.g. 6,00,000"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Monthly Gross (INR)</Label>
                  <Input
                    type="text"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    className="mt-1 text-xs bg-white"
                    placeholder="e.g. 50,000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <Label className="text-xs text-slate-600">Probation Period</Label>
                  <Input
                    value={probationPeriod}
                    onChange={(e) => setProbationPeriod(e.target.value)}
                    className="mt-1 text-xs bg-white"
                    placeholder="e.g. 3 Months"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Work Location</Label>
                  <Input
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    className="mt-1 text-xs bg-white"
                    placeholder="e.g. Pune / Hybrid"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600">Reporting Manager</Label>
                  <Input
                    value={reportingManager}
                    onChange={(e) => setReportingManager(e.target.value)}
                    className="mt-1 text-xs bg-white"
                    placeholder="e.g. Anmol Gadhave (PM)"
                  />
                </div>
              </div>
            </div>
          )}

          {(letterType === "Experience Letter" || letterType === "Internship Completion") && (
            <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-3">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Service Tenure & Completion Dates
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-600">
                    {letterType === "Internship Completion" ? "Internship Start Date *" : "Date of Joining *"}
                  </Label>
                  <Input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="mt-1 text-xs bg-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600">
                    {letterType === "Internship Completion" ? "Internship End Date *" : "Relieving / Last Working Date *"}
                  </Label>
                  <Input
                    type="date"
                    value={relievingDate}
                    onChange={(e) => setRelievingDate(e.target.value)}
                    className="mt-1 text-xs bg-white"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: AUTHORIZED SIGNATORY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-600">Authorized Signatory Name</Label>
              <Input
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                className="mt-1 text-xs"
                placeholder="e.g. Anmol Gadhave"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Signatory Designation / Title</Label>
              <Input
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                className="mt-1 text-xs"
                placeholder="e.g. Project Manager / Director"
              />
            </div>
          </div>

          {/* SECTION 5: CUSTOM REMARKS / PERFORMANCE NOTES */}
          <div>
            <Label className="text-xs text-slate-600">
              {letterType === "Internship Completion"
                ? "Projects & Performance Highlights (Optional)"
                : letterType === "Experience Letter"
                ? "Key Contributions / Conduct Evaluation (Optional)"
                : "Additional Terms / Special Clauses (Optional)"}
            </Label>
            <Textarea
              value={customRemarks}
              onChange={(e) => setCustomRemarks(e.target.value)}
              rows={2}
              className="mt-1 text-xs"
              placeholder="e.g. Successfully delivered core client modules, displayed exemplary discipline and technical leadership..."
            />
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestDownloadPreview}
                className="text-xs flex items-center gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                Preview PDF
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={submitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                {submitting ? "Generating..." : "Issue & Save Letter"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
