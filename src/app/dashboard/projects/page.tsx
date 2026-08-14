"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Briefcase, 
  ShieldAlert, 
  ExternalLink, 
  FileText, 
  FileSpreadsheet, 
  UploadCloud, 
  Users, 
  Paperclip, 
  Trash2, 
  Check, 
  Plus 
} from "lucide-react";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canManageProject = role === "CEO" || role === "PM";

  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState("Planning");
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjects();
    if (canManageProject) {
      fetchEmployees();
    }
  }, [canManageProject]);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (Array.isArray(data)) setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "unitglo_project_docs");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          setAttachments((prev) => [
            ...prev,
            {
              name: data.name || file.name,
              url: data.url,
              size: data.size || file.size,
              type: data.type || file.type,
              storage: data.storage,
            },
          ]);
        } else {
          alert(`Failed to upload ${file.name}: ${data.error || "Unknown error"}`);
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("An error occurred during file upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleMember = (memberId: number) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProject) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          target_date: targetDate || null,
          status,
          documentation_url: documentationUrl,
          attachments,
          members: selectedMembers,
        }),
      });

      if (res.ok) {
        setOpen(false);
        fetchProjects();
        // Reset form
        setName("");
        setDescription("");
        setTargetDate("");
        setStatus("Planning");
        setDocumentationUrl("");
        setAttachments([]);
        setSelectedMembers([]);
      } else {
        const data = await res.json();
        alert(`Failed to create project: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit project.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-sky-500" />
            Projects & Documentation Hub
          </h1>
          <p className="text-slate-500 mt-1">
            {canManageProject
              ? "Create projects, upload Cloudinary documentation (PDF/Excel), and assign development teams."
              : "Access assigned projects, technical specifications, and downloadable project documentation."}
          </p>
        </div>

        {canManageProject ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md flex items-center gap-2" />}>
              <Plus className="h-4 w-4" /> Create New Project
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-sky-500" /> Create New Project
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateProject} className="space-y-5 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="projName" className="font-semibold text-slate-700">Project Name *</Label>
                    <Input
                      id="projName"
                      placeholder="e.g. Unitglo Core Banking API"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="projStatus" className="font-semibold text-slate-700">Initial Status</Label>
                    <Select value={status} onValueChange={(val) => setStatus(val || "Planning")}>
                      <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Planning">Planning</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Not Started">Not Started</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="projDesc" className="font-semibold text-slate-700">Project Overview & Objectives</Label>
                  <Input
                    id="projDesc"
                    placeholder="Brief description of the deliverables and scope"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="projDate" className="font-semibold text-slate-700">Target Delivery Date</Label>
                    <Input
                      id="projDate"
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="projDocs" className="font-semibold text-slate-700">Project Documentation Link (URL)</Label>
                    <Input
                      id="projDocs"
                      placeholder="https://docs.unitglo.com/specs or Google Docs URL"
                      value={documentationUrl}
                      onChange={(e) => setDocumentationUrl(e.target.value)}
                    />
                  </div>
                </div>

                {/* Cloudinary File Uploads (PDF, Excel, Docs) */}
                <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-bold text-slate-900 flex items-center gap-1.5">
                        <UploadCloud className="h-4 w-4 text-sky-500" /> Project Specifications & Files (Cloudinary)
                      </Label>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Upload Architecture PDF, Excel Requirements, or Technical Docs.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white font-semibold text-xs gap-1.5"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {uploading ? "Uploading..." : "Add Files"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs shadow-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv") ? (
                              <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-sky-600 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-900 truncate">{file.name}</span>
                            <span className="text-slate-400 text-[11px]">({formatFileSize(file.size)})</span>
                            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                              {file.storage === "cloudinary" ? "Cloudinary Cloud" : "Local Storage"}
                            </Badge>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove attachment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team Member Assignment (Developers & Testers) */}
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <Label className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-indigo-500" /> Assign Team Members (Developers & Testers)
                  </Label>
                  <p className="text-xs text-slate-500">
                    Assigned employees will receive instant notification alerts and immediate access to this project.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 max-h-40 overflow-y-auto">
                    {employees
                      .filter((e) => e.role === "Developer" || e.role === "Tester")
                      .map((emp) => {
                        const isSelected = selectedMembers.includes(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => toggleMember(emp.id)}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? "bg-sky-50 border-sky-300 text-sky-900 font-semibold shadow-xs"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border ${
                                  isSelected ? "bg-sky-600 border-sky-600 text-white" : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <span className="truncate">{emp.name}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold">
                              {emp.role}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting || uploading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 shadow-md"
                >
                  {submitting ? "Saving Project..." : "Create Project & Notify Team"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
            <Users className="h-4 w-4 text-sky-600" />
            Showing Projects Assigned to Your Profile
          </div>
        )}
      </div>

      {/* Projects Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Project Name</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold">Target Date</TableHead>
              <TableHead className="font-bold">Documentation & Cloudinary Files</TableHead>
              <TableHead className="font-bold">Assigned Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading projects...</TableCell></TableRow>
            ) : projects.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-10">No active projects assigned.</TableCell></TableRow>
            ) : (
              projects.map((proj) => (
                <TableRow key={proj.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="align-top">
                    <div className="font-bold text-slate-900 text-sm">{proj.name}</div>
                    {proj.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 max-w-sm">{proj.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className="font-bold text-xs bg-slate-50">{proj.status}</Badge>
                  </TableCell>
                  <TableCell className="align-top text-xs text-slate-700 font-medium">
                    {proj.target_date ? new Date(proj.target_date).toLocaleDateString() : "No Deadline"}
                  </TableCell>

                  {/* Documentation Links & Attachments */}
                  <TableCell className="align-top space-y-1.5">
                    {proj.documentation_url ? (
                      <a
                        href={proj.documentation_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-800 hover:underline bg-sky-50 px-2 py-1 rounded-md border border-sky-200"
                      >
                        <ExternalLink className="h-3 w-3" /> Project Docs Link
                      </a>
                    ) : (
                      !proj.attachments?.length && <span className="text-xs text-slate-400 italic">No docs linked</span>
                    )}

                    {proj.attachments && proj.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {proj.attachments.map((file: any, fIdx: number) => (
                          <a
                            key={fIdx}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 transition-colors"
                            title={`Download ${file.name}`}
                          >
                            {file.name?.endsWith(".xlsx") || file.name?.endsWith(".xls") ? (
                              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <FileText className="h-3 w-3 text-sky-600" />
                            )}
                            <span className="truncate max-w-[130px]">{file.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </TableCell>

                  {/* Assigned Members */}
                  <TableCell className="align-top">
                    {proj.members && proj.members.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {proj.members.map((m: any, mIdx: number) => (
                          <Badge
                            key={mIdx}
                            variant="secondary"
                            className="text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200"
                          >
                            {m.name} ({m.role})
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
