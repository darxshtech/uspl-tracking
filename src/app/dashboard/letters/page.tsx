"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LetterGenerationModal from "@/components/LetterGenerationModal";
import { generateLetterPDF, LetterData } from "@/lib/pdf/letterGenerator";
import { showSuccess, showError, showConfirm } from "@/lib/swal";
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
  RefreshCw 
} from "lucide-react";

interface LetterItem {
  id: number;
  user_id: number;
  letter_type: "Joining Letter" | "Experience Letter" | "Internship Completion";
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
  const isManagement = ["Admin", "CEO", "PM"].includes(currentRole);

  const [letters, setLetters] = useState<LetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      signatory_name: meta.signatory_name || "Anmol Gadhave",
      signatory_title: meta.signatory_title || "Project Manager / Authorized Signatory",
      custom_remarks: letter.custom_remarks,
    };

    generateLetterPDF(pdfData, true);
    showSuccess("Document Downloaded", `Downloaded PDF for ${letter.reference_no}`);
  };

  // Handle Delete / Revoke
  const handleDeleteLetter = async (id: number, refNo: string) => {
    const confirmed = await showConfirm(
      "Revoke Letter?",
      `Are you sure you want to delete and revoke official letter "${refNo}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/letters?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete letter.");
      }
      showSuccess("Letter Removed", `Official letter ${refNo} has been removed.`);
      fetchLetters();
    } catch (err: any) {
      showError("Delete Failed", err.message || "Failed to remove letter.");
    }
  };

  // Filter letters
  const filteredLetters = letters.filter((l) => {
    const matchesSearch =
      l.reference_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.user_role && l.user_role.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.title && l.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === "ALL" || l.letter_type === filterType;
    return matchesSearch && matchesType;
  });

  // Calculate stats
  const totalCount = letters.length;
  const joiningCount = letters.filter((l) => l.letter_type === "Joining Letter").length;
  const experienceCount = letters.filter((l) => l.letter_type === "Experience Letter").length;
  const internshipCount = letters.filter((l) => l.letter_type === "Internship Completion").length;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "Joining Letter":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-semibold text-[11px]">Joining Letter</Badge>;
      case "Experience Letter":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-semibold text-[11px]">Experience Letter</Badge>;
      case "Internship Completion":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 font-semibold text-[11px]">Internship Certificate</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Letters & Certificates
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isManagement
                  ? "Generate, configure, and issue official Unitglo Solutions appointment, experience, and internship certificates."
                  : "View and download your official Unitglo appointment, experience, and internship certificates."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLetters}
            disabled={loading}
            className="text-xs border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {isManagement && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Issue New Letter
            </Button>
          )}
        </div>
      </div>

      {/* STATS OVERVIEW CARDS (Management only) */}
      {isManagement && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Issued</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
                <FileText className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-blue-100 bg-blue-50/30 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Joining Letters</p>
                <h3 className="text-2xl font-bold text-blue-900 mt-1">{joiningCount}</h3>
              </div>
              <div className="p-3 rounded-xl bg-blue-100/80 text-blue-700">
                <Briefcase className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-emerald-100 bg-emerald-50/30 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Experience Letters</p>
                <h3 className="text-2xl font-bold text-emerald-900 mt-1">{experienceCount}</h3>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100/80 text-emerald-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-purple-100 bg-purple-50/30 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Internship Letters</p>
                <h3 className="text-2xl font-bold text-purple-900 mt-1">{internshipCount}</h3>
              </div>
              <div className="p-3 rounded-xl bg-purple-100/80 text-purple-700">
                <Award className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder={isManagement ? "Search by employee, ref, or title..." : "Search by ref or title..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs bg-slate-50/50 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="text-xs w-full sm:w-48 bg-slate-50/50 border-slate-200">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Letter Types</SelectItem>
              <SelectItem value="Joining Letter" className="text-xs">Joining Letters</SelectItem>
              <SelectItem value="Experience Letter" className="text-xs">Experience Letters</SelectItem>
              <SelectItem value="Internship Completion" className="text-xs">Internship Certificates</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* LETTERS TABLE / LIST */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-700">Reference No & Title</TableHead>
                {isManagement && (
                  <TableHead className="text-xs font-bold text-slate-700">Recipient Employee</TableHead>
                )}
                <TableHead className="text-xs font-bold text-slate-700">Type</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Issue Date</TableHead>
                {isManagement && (
                  <TableHead className="text-xs font-bold text-slate-700">Issued By</TableHead>
                )}
                <TableHead className="text-xs font-bold text-slate-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isManagement ? 6 : 4} className="text-center py-10 text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading official certificates...
                  </TableCell>
                </TableRow>
              ) : filteredLetters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isManagement ? 6 : 4} className="text-center py-12 text-slate-500">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Award className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No letters found</p>
                      <p className="text-xs text-slate-500">
                        {isManagement
                          ? "Get started by generating the first official Joining, Experience, or Internship letter."
                          : "No official letters or certificates have been issued to your account yet."}
                      </p>
                      {isManagement && (
                        <Button
                          size="sm"
                          onClick={() => setIsModalOpen(true)}
                          className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Issue Letter Now
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLetters.map((letter) => (
                  <TableRow key={letter.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Reference No & Title */}
                    <TableCell className="py-3.5">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-bold text-slate-800 tracking-tight">
                          {letter.reference_no}
                        </span>
                        <p className="text-xs text-slate-500 font-medium line-clamp-1">
                          {letter.title}
                        </p>
                      </div>
                    </TableCell>

                    {/* Employee info (Management view) */}
                    {isManagement && (
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {letter.user_name ? letter.user_name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{letter.user_name}</p>
                            <p className="text-[11px] text-slate-500">{letter.user_role || letter.user_email}</p>
                          </div>
                        </div>
                      </TableCell>
                    )}

                    {/* Type Badge */}
                    <TableCell className="py-3.5">
                      {getTypeBadge(letter.letter_type)}
                    </TableCell>

                    {/* Issue Date */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {letter.issue_date}
                      </div>
                    </TableCell>

                    {/* Issued By (Management view) */}
                    {isManagement && (
                      <TableCell className="py-3.5">
                        <div className="text-xs text-slate-600">
                          <p className="font-medium text-slate-700">{letter.issuer_name || "Admin"}</p>
                          <span className="text-[11px] text-slate-400">{letter.issuer_role}</span>
                        </div>
                      </TableCell>
                    )}

                    {/* Action buttons */}
                    <TableCell className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadPDF(letter)}
                          className="text-xs border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 flex items-center gap-1 h-8 px-2.5 font-medium"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </Button>

                        {isManagement && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteLetter(letter.id, letter.reference_no)}
                            className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 h-8 w-8 p-0"
                            title="Revoke / Delete Letter"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ISSUANCE MODAL (Management) */}
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
