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
import { showError, showSuccess, showWarning, showToast } from "@/lib/swal";
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
  Plus, 
  UserCheck, 
  Edit3,
  AlertTriangle,
  Rocket,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Search,
  Sparkles,
  Percent,
  Eye,
  CheckCircle,
  Flame,
  ListTodo
} from "lucide-react";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canManageProject = ["Admin", "CEO", "PM"].includes(role);

  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  // Form State for Create
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [primaryDeveloperId, setPrimaryDeveloperId] = useState("");
  const [isFastTrack, setIsFastTrack] = useState(false);

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editDocUrl, setEditDocUrl] = useState("");
  const [editAttachments, setEditAttachments] = useState<any[]>([]);
  const [editMembers, setEditMembers] = useState<number[]>([]);
  const [editIsFastTrack, setEditIsFastTrack] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Team Tasks & Completion Ratio Breakdown Modal State
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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

  const openTeamBreakdown = async (projectId: number) => {
    setBreakdownLoading(true);
    setBreakdownOpen(true);
    setBreakdownData(null);
    setExpandedMemberId(null);
    setMemberSearchQuery("");
    setRoleFilter("all");

    try {
      const res = await fetch(`/api/projects/team-breakdown?projectId=${projectId}`);
      const data = await res.json();
      if (res.ok) {
        setBreakdownData(data);
        // Auto-expand the first member who has assigned tasks
        const firstWithTasks = data.members?.find((m: any) => m.tasks && m.tasks.length > 0);
        if (firstWithTasks) {
          setExpandedMemberId(firstWithTasks.id);
        }
      } else {
        showError("Failed to Load Breakdown", data.error || "Unknown error");
        setBreakdownOpen(false);
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Could not load team task breakdown.");
      setBreakdownOpen(false);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
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
          const newAttachment = {
            name: file.name,
            url: data.url,
            format: data.format || file.name.split(".").pop(),
            size: file.size,
          };
          if (isEdit) {
            setEditAttachments((prev) => [...prev, newAttachment]);
          } else {
            setAttachments((prev) => [...prev, newAttachment]);
          }
        } else {
          showError("Upload Failed", data.error || "Unknown error");
        }
      }
    } catch (err) {
      console.error(err);
      showError("Upload Error", "Error uploading file to Cloudinary.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number, isEdit = false) => {
    if (isEdit) {
      setEditAttachments((prev) => prev.filter((_, i) => i !== index));
    } else {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const toggleMemberSelection = (employeeId: number, isEdit = false) => {
    if (isEdit) {
      setEditMembers((prev) =>
        prev.includes(employeeId)
          ? prev.filter((id) => id !== employeeId)
          : [...prev, employeeId]
      );
    } else {
      setSelectedMembers((prev) =>
        prev.includes(employeeId)
          ? prev.filter((id) => id !== employeeId)
          : [...prev, employeeId]
      );
    }
  };

  const handleToggleFastTrack = async (projectId: number, currentVal: boolean) => {
    try {
      const nextVal = !currentVal;
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, is_fast_track: nextVal }),
      });
      if (res.ok) {
        showToast(nextVal ? "🚀 Fastest Development ON (Tasks show Fast-Track Demo)" : "Standard QA Mode (Tasks show Send to Testing)");
        fetchProjects();
      } else {
        showError("Failed to update Fastest Development mode");
      }
    } catch (err) {
      console.error(err);
      showError("Error updating Fastest Development mode");
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          target_date: targetDate || null,
          documentation_url: documentationUrl || null,
          attachments,
          members: selectedMembers,
          primary_developer_id: primaryDeveloperId ? parseInt(primaryDeveloperId) : null,
          is_fast_track: isFastTrack,
        }),
      });

      if (res.ok) {
        setCreateOpen(false);
        fetchProjects();
        setName("");
        setDescription("");
        setTargetDate("");
        setDocumentationUrl("");
        setAttachments([]);
        setSelectedMembers([]);
        setPrimaryDeveloperId("");
        setIsFastTrack(false);
        showToast("Project created successfully!");
      } else {
        const data = await res.json();
        showError("Failed to Create Project", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred while creating the project.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (proj: any) => {
    setEditingProject(proj);
    setEditName(proj.name || "");
    setEditDescription(proj.description || "");
    setEditTargetDate(proj.target_date ? proj.target_date.split("T")[0] : "");
    setEditDocUrl(proj.documentation_url || "");
    setEditAttachments(Array.isArray(proj.attachments) ? proj.attachments : []);
    const memberIds = (proj.members || []).map((m: any) => m.id);
    setEditMembers(memberIds);
    setEditIsFastTrack(Boolean(proj.is_fast_track));
    setEditOpen(true);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    setSavingEdit(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProject.id,
          name: editName,
          description: editDescription,
          target_date: editTargetDate || null,
          documentation_url: editDocUrl || null,
          attachments: editAttachments,
          members: editMembers,
          is_fast_track: editIsFastTrack,
        }),
      });

      if (res.ok) {
        setEditOpen(false);
        setEditingProject(null);
        fetchProjects();
        showToast("Project updated successfully!");
      } else {
        const data = await res.json();
        showError("Failed to Update Project", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("An error occurred while updating the project.");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!deleteConfirmProject) return;
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projects?id=${deleteConfirmProject.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteConfirmProject(null);
        fetchProjects();
        showToast("Project deleted successfully!");
      } else {
        showError("Failed to delete project.");
      }
    } catch (err) {
      console.error(err);
      showError("Error deleting project.");
    } finally {
      setDeletingProject(false);
    }
  };

  // Filtered members in team breakdown modal
  const filteredMembers = (breakdownData?.members || []).filter((m: any) => {
    const matchesSearch = 
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-sky-500" />
            Initiatives & Projects
          </h1>
          <p className="text-slate-500 mt-1">
            {canManageProject
              ? "Create, edit, assign team members (CEO, PM, Developers, Testers), inspect employee task completion ratios, and manage deliverables."
              : "Overview of company projects, assigned team members, and deliverables."}
          </p>
        </div>

        {canManageProject && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md flex items-center gap-2" />}>
              <Plus className="h-4 w-4" /> Create New Project
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-sky-500" /> Create New Project Initiative
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateProject} className="space-y-4 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="font-semibold text-slate-700">Project Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Employee Tracking Portal 2.0"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="targetDate" className="font-semibold text-slate-700">Target Delivery Date</Label>
                    <Input
                      id="targetDate"
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="font-semibold text-slate-700">Project Description & Scope</Label>
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the initiative, key milestones, and business goals..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Primary Assignee Selector */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-sky-500" /> Primary Lead / Developer Assignee
                  </Label>
                  <Select value={primaryDeveloperId} onValueChange={(val) => setPrimaryDeveloperId(val || "")}>
                    <SelectTrigger><SelectValue placeholder="Select Lead Developer / PM / CEO" /></SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>
                          {e.name} ({e.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500">
                    You can assign any team member directly as the lead or developer on this project.
                  </p>
                </div>

                {/* Multi-member Selection */}
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-sky-500" /> Additional Assigned Team Members
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                    {employees.map((emp) => {
                      const isSelected = selectedMembers.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleMemberSelection(emp.id, false)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                            isSelected
                              ? "bg-sky-50 border-sky-500 text-sky-900 shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className={`h-4 w-4 rounded flex items-center justify-center border ${isSelected ? "bg-sky-600 border-sky-600 text-white" : "border-slate-300"}`}>
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className="truncate">{emp.name} ({emp.role})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Documentation & File Uploads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="docUrl" className="font-semibold text-slate-700 flex items-center gap-1">
                      <FileText className="h-4 w-4 text-sky-500" /> Documentation / PR Link
                    </Label>
                    <Input
                      id="docUrl"
                      type="url"
                      value={documentationUrl}
                      onChange={(e) => setDocumentationUrl(e.target.value)}
                      placeholder="https://docs.google.com/... or Notion URL"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 flex items-center gap-1">
                      <UploadCloud className="h-4 w-4 text-sky-500" /> Attach Files / PDFs (Cloudinary)
                    </Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(e) => handleFileUpload(e, false)}
                      disabled={uploading}
                      className="cursor-pointer text-xs"
                    />
                    {uploading && <p className="text-xs text-sky-600 font-semibold animate-pulse">Uploading file to Cloudinary...</p>}
                  </div>
                </div>

                {/* Fastest Development Mode Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                  <div className="space-y-0.5 pr-2">
                    <Label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Rocket className="h-4 w-4 text-indigo-600" />
                      Fastest Development Mode (Direct Demo)
                    </Label>
                    <p className="text-[11px] text-indigo-700 leading-snug">
                      When enabled, developers working on this project will see <strong>🚀 Fast-Track to Demo</strong> instead of <strong>Send to Testing</strong>.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isFastTrack}
                    onChange={(e) => setIsFastTrack(e.target.checked)}
                    className="h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                </div>

                {/* Attachment list preview */}
                {attachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-bold text-slate-600">Attached Files:</Label>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                          <Paperclip className="h-3 w-3 text-slate-500" />
                          <span className="font-medium text-slate-800 truncate max-w-xs">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx, false)}
                            className="text-red-500 hover:text-red-700 ml-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || uploading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2"
                >
                  {submitting ? "Creating Project..." : "Save & Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* EDIT PROJECT MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-sky-500" /> Edit Project Initiative
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateProject} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editName" className="font-semibold text-slate-700">Project Name *</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editDesc" className="font-semibold text-slate-700">Description & Goals</Label>
              <textarea
                id="editDesc"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editTargetDate" className="font-semibold text-slate-700">Target Completion Date</Label>
              <Input
                id="editTargetDate"
                type="date"
                value={editTargetDate}
                onChange={(e) => setEditTargetDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editDocUrl" className="font-semibold text-slate-700">Documentation / PR Link</Label>
              <Input
                id="editDocUrl"
                type="url"
                value={editDocUrl}
                onChange={(e) => setEditDocUrl(e.target.value)}
              />
            </div>

            {/* Fastest Development Mode Toggle in Edit */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
              <div className="space-y-0.5 pr-2">
                <Label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Rocket className="h-4 w-4 text-indigo-600" />
                  Fastest Development Mode (Direct Demo)
                </Label>
                <p className="text-[11px] text-indigo-700 leading-snug">
                  When enabled, developers working on this project see <strong>🚀 Fast-Track to Demo</strong> instead of <strong>Send to Testing</strong>.
                </p>
              </div>
              <input
                type="checkbox"
                checked={editIsFastTrack}
                onChange={(e) => setEditIsFastTrack(e.target.checked)}
                className="h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>

            {/* Multi-member Selection */}
            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-sky-500" /> Assigned Team Members
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                {employees.map((emp) => {
                  const isSelected = editMembers.includes(emp.id);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => toggleMemberSelection(emp.id, true)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium cursor-pointer border transition-all ${
                        isSelected
                          ? "bg-sky-50 border-sky-500 text-sky-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded flex items-center justify-center border ${isSelected ? "bg-sky-600 border-sky-600 text-white" : "border-slate-300"}`}>
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{emp.name} ({emp.role})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* File Uploads */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700 flex items-center gap-1">
                <UploadCloud className="h-4 w-4 text-sky-500" /> Add More Attachments (Cloudinary)
              </Label>
              <Input
                ref={editFileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, true)}
                disabled={uploading}
                className="cursor-pointer text-xs"
              />
            </div>

            {/* Edit Attachment list */}
            {editAttachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-bold text-slate-600">Current Attachments:</Label>
                <div className="flex flex-wrap gap-2">
                  {editAttachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                      <Paperclip className="h-3 w-3 text-slate-500" />
                      <span className="font-medium text-slate-800 truncate max-w-xs">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx, true)}
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={savingEdit || uploading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2"
            >
              {savingEdit ? "Updating Project..." : "Save Project Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Projects Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-16 text-center font-bold">Sr. No.</TableHead>
              <TableHead className="font-bold">Project Name</TableHead>
              <TableHead className="font-bold">Dev Mode</TableHead>
              <TableHead className="font-bold">Tasks & Progress</TableHead>
              <TableHead className="font-bold">Assigned Team</TableHead>
              <TableHead className="font-bold">Target Date</TableHead>
              <TableHead className="font-bold">Documentation & Files</TableHead>
              <TableHead className="font-bold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">Loading projects...</TableCell></TableRow>
            ) : projects.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-10">No projects created yet. Click "Create New Project" to begin.</TableCell></TableRow>
            ) : (
              projects.map((proj, idx) => {
                const totalTasks = proj.total_tasks || 0;
                const completedTasks = proj.completed_tasks || 0;
                const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                const isFast = Boolean(proj.is_fast_track);

                return (
                <TableRow key={proj.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="text-center font-mono font-bold text-slate-500 text-xs">
                    #{idx + 1}
                  </TableCell>

                  <TableCell>
                    <div className="font-bold text-slate-900">{proj.name}</div>
                    {proj.description && (
                      <p className="text-xs text-slate-500 max-w-sm line-clamp-1 mt-0.5">{proj.description}</p>
                    )}
                    <div className="text-[11px] text-sky-700 font-semibold mt-1 flex items-center gap-1">
                      <UserCheck className="h-3 w-3 text-sky-500" />
                      <span>Assigned By: <strong>{proj.creator_name || "Management"} ({proj.creator_role || "PM"})</strong></span>
                    </div>
                  </TableCell>

                  {/* FASTEST DEV MODE TOGGLE SWITCH */}
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => canManageProject && handleToggleFastTrack(proj.id, isFast)}
                        disabled={!canManageProject}
                        aria-label="Toggle Fastest Development Mode"
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isFast ? "bg-indigo-600" : "bg-slate-300"
                        } ${!canManageProject ? "opacity-60 cursor-not-allowed" : ""}`}
                        title={canManageProject ? (isFast ? "Fastest Dev is ON: Tasks show 'Send for Demo'. Click to turn OFF." : "Standard QA is ON: Tasks show 'Send to Testing'. Click to turn ON Fastest Dev.") : undefined}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            isFast ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-bold ${isFast ? "text-indigo-700" : "text-slate-600"}`}>
                          {isFast ? "⚡ Fastest Dev" : "Standard QA"}
                        </span>
                        <span className={`text-[9px] font-semibold ${isFast ? "text-indigo-500" : "text-slate-400"}`}>
                          {isFast ? "Send for Demo" : "Send to Test"}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Tasks & Progress (Clickable for Team Breakdown) */}
                  <TableCell 
                    className="cursor-pointer group"
                    onClick={() => openTeamBreakdown(proj.id)}
                    title="Click to view employee task breakdown and completion ratios"
                  >
                    <div className="space-y-1 min-w-[140px] p-1.5 rounded-lg group-hover:bg-sky-50/70 transition-colors border border-transparent group-hover:border-sky-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 group-hover:text-sky-700 flex items-center gap-1">
                          <ListTodo className="h-3 w-3 text-sky-500" />
                          {completedTasks}/{totalTasks} Tasks
                        </span>
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded-full">{taskPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full transition-all duration-300 ${
                            taskPct === 100 ? "bg-emerald-500" : taskPct > 0 ? "bg-sky-500" : "bg-slate-200"
                          }`}
                          style={{ width: `${taskPct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-sky-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        <Eye className="h-2.5 w-2.5" /> View Breakdown
                      </div>
                    </div>
                  </TableCell>

                  {/* Assigned Team (Clickable for Team Breakdown) */}
                  <TableCell 
                    className="cursor-pointer group"
                    onClick={() => openTeamBreakdown(proj.id)}
                    title="Click to view employee task breakdown and completion ratios"
                  >
                    <div className="flex flex-wrap gap-1 max-w-xs p-1.5 rounded-lg group-hover:bg-sky-50/70 transition-colors border border-transparent group-hover:border-sky-200">
                      {proj.members && proj.members.length > 0 ? (
                        proj.members.map((m: any) => (
                          <Badge key={m.id} variant="outline" className="text-[10px] bg-slate-50 group-hover:border-sky-300">
                            {m.name} ({m.role})
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">No members assigned</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-700 font-medium">
                    {proj.target_date ? (
                      <div className="flex items-center gap-1">
                        <span>{new Date(proj.target_date).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">--</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      {proj.documentation_url && (
                        <a
                          href={proj.documentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline font-semibold"
                        >
                          <ExternalLink className="h-3 w-3" /> Docs Link
                        </a>
                      )}

                      {proj.attachments && proj.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {proj.attachments.map((file: any, i: number) => (
                            <a
                              key={i}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium transition-colors"
                            >
                              <Paperclip className="h-2.5 w-2.5" />
                              <span className="truncate max-w-[100px]">{file.name}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {!proj.documentation_url && (!proj.attachments || proj.attachments.length === 0) && (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Actions Column with Team Breakdown and Manager Controls */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTeamBreakdown(proj.id)}
                        className="bg-white hover:bg-sky-50 text-sky-700 border-sky-200 text-xs font-semibold px-2.5 py-1 h-8 flex items-center gap-1.5 shadow-2xs"
                        title="View employee task assignments and completion ratios"
                      >
                        <Users className="h-3.5 w-3.5 text-sky-600" />
                        <span className="hidden sm:inline">Team Tasks</span>
                      </Button>

                      {canManageProject && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(proj)}
                            className="text-sky-600 hover:text-sky-800 hover:bg-sky-50 p-1.5 h-8 w-8"
                            title="Edit Project"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmProject(proj);
                            }}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 h-8 w-8"
                            title="Delete Project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* TEAM BREAKDOWN & TASK COMPLETION RATIO MODAL */}
      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-slate-200 shadow-2xl">
          {breakdownLoading ? (
            <div className="p-12 text-center space-y-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
              <p className="text-sm font-semibold text-slate-600">Loading team tasks & completion metrics...</p>
            </div>
          ) : breakdownData ? (
            <div className="space-y-6">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 p-6 text-white rounded-t-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
                        Project Team Breakdown
                      </span>
                      {breakdownData.project.is_fast_track && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                          <Rocket className="h-3 w-3" /> Fastest Dev Mode
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black tracking-tight mt-1.5">{breakdownData.project.name}</h2>
                    {breakdownData.project.description && (
                      <p className="text-xs text-slate-300 mt-1 max-w-xl line-clamp-2">{breakdownData.project.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-center bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-300 font-medium">Overall Completion</div>
                      <div className="text-xl font-black text-emerald-400">{breakdownData.stats.completion_ratio}%</div>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                      <Percent className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                      <Users className="h-3 w-3 text-sky-400" /> Members
                    </div>
                    <div className="text-lg font-bold text-white mt-0.5">{breakdownData.stats.total_members}</div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1">
                      <ListTodo className="h-3 w-3 text-indigo-400" /> Total Tasks
                    </div>
                    <div className="text-lg font-bold text-white mt-0.5">{breakdownData.stats.total_tasks}</div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-emerald-300 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Completed
                    </div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{breakdownData.stats.completed_tasks}</div>
                  </div>

                  <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-sky-300 font-medium flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-sky-400" /> In Progress
                    </div>
                    <div className="text-lg font-bold text-sky-400 mt-0.5">{breakdownData.stats.in_progress_tasks}</div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center col-span-2 sm:col-span-1">
                    <div className="text-[11px] text-amber-300 font-medium flex items-center justify-center gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-400" /> In QA / Test
                    </div>
                    <div className="text-lg font-bold text-amber-400 mt-0.5">{breakdownData.stats.testing_tasks}</div>
                  </div>
                </div>
              </div>

              {/* Controls & Filter Bar */}
              <div className="px-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search employee name or email..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {["all", "Developer", "Tester", "PM", "Admin"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRoleFilter(r)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                          roleFilter === r
                            ? "bg-sky-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        {r === "all" ? "All Roles" : r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Employee Cards List */}
                <div className="space-y-3 pb-6">
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No team members match your filter.</p>
                      <p className="text-xs text-slate-400 mt-0.5">Try searching with a different keyword or resetting role filter.</p>
                    </div>
                  ) : (
                    filteredMembers.map((member: any) => {
                      const isExpanded = expandedMemberId === member.id;
                      const hasTasks = member.tasks && member.tasks.length > 0;

                      return (
                        <div
                          key={member.id}
                          className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs overflow-hidden"
                        >
                          {/* Member Summary Header Card */}
                          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                                {member.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-slate-900 text-sm">{member.name}</h3>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-semibold px-2 py-0.5 ${
                                      member.role === "Developer"
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : member.role === "Tester"
                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                        : member.role === "PM"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}
                                  >
                                    {member.role}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500">{member.email}</p>
                              </div>
                            </div>

                            {/* Task Breakdown Chips & Completion Ratio Progress Bar */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                              {/* Task Distribution Chips */}
                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60" title="Completed Tasks">
                                  ✓ {member.completed_tasks} Done
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-semibold border border-sky-200/60" title="In Progress Tasks">
                                  ⚡ {member.in_progress_tasks} Active
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200" title="Pending Tasks">
                                  ⏳ {member.pending_tasks} Pending
                                </span>
                                {member.testing_tasks > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold border border-purple-200/60" title="In Testing / QA">
                                    🧪 {member.testing_tasks} In QA
                                  </span>
                                )}
                              </div>

                              {/* Completion Ratio Progress Metric */}
                              <div className="min-w-[140px] space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-[11px] font-bold text-slate-600">{member.completed_tasks}/{member.total_tasks} Tasks</span>
                                  <span className="font-extrabold text-sky-600">{member.completion_ratio}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      member.completion_ratio === 100
                                        ? "bg-emerald-500"
                                        : member.completion_ratio > 0
                                        ? "bg-sky-500"
                                        : "bg-slate-300"
                                    }`}
                                    style={{ width: `${member.completion_ratio}%` }}
                                  />
                                </div>
                              </div>

                              {/* Accordion Toggle Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                                className="h-8 px-2 text-xs font-semibold text-slate-700 hover:text-sky-600 hover:bg-sky-50 flex items-center gap-1"
                              >
                                <span>{hasTasks ? `${member.tasks.length} Tasks` : "No Tasks"}</span>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>

                          {/* Collapsible Assigned Tasks Sub-panel */}
                          {isExpanded && (
                            <div className="p-4 border-t border-slate-200 bg-white space-y-2.5 animate-fade-in">
                              {!hasTasks ? (
                                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                  No tasks currently assigned to this employee on this project. You can assign tasks in the <strong>Daily Tasks Hub</strong>.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <ListTodo className="h-3.5 w-3.5 text-sky-500" />
                                    Assigned Task Details ({member.tasks.length}):
                                  </div>
                                  
                                  <div className="grid grid-cols-1 gap-2">
                                    {member.tasks.map((task: any) => {
                                      const isCompleted = ["Completed", "Tested (PASS)", "Ready for Demo"].includes(task.status);
                                      const isInTesting = ["Sent to Testing", "Tested (FAIL)"].includes(task.status);
                                      
                                      return (
                                        <div
                                          key={task.id}
                                          className={`p-3 rounded-xl border transition-all ${
                                            isCompleted
                                              ? "bg-emerald-50/40 border-emerald-200/80"
                                              : isInTesting
                                              ? "bg-purple-50/40 border-purple-200/80"
                                              : "bg-slate-50/80 border-slate-200 hover:border-slate-300"
                                          }`}
                                        >
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-900 text-xs">{task.title}</span>
                                                <Badge
                                                  variant="outline"
                                                  className={`text-[9px] px-1.5 py-0 font-bold uppercase ${
                                                    task.priority === "High"
                                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                                      : task.priority === "Medium"
                                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                                  }`}
                                                >
                                                  {task.priority} Priority
                                                </Badge>

                                                <Badge
                                                  className={`text-[10px] font-semibold ${
                                                    isCompleted
                                                      ? "bg-emerald-600 text-white"
                                                      : isInTesting
                                                      ? "bg-purple-600 text-white"
                                                      : task.status === "In Progress"
                                                      ? "bg-sky-600 text-white"
                                                      : "bg-slate-500 text-white"
                                                  }`}
                                                >
                                                  {task.status}
                                                </Badge>
                                              </div>

                                              {task.description && (
                                                <p className="text-[11px] text-slate-600 line-clamp-1">{task.description}</p>
                                              )}
                                            </div>

                                            {/* Progress & Due Date */}
                                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                              <div className="text-right">
                                                <div className="text-[10px] text-slate-500 font-medium">Self-Reported Progress</div>
                                                <div className="text-xs font-bold text-slate-800">{task.progress_percentage || 0}%</div>
                                              </div>

                                              {task.due_date && (
                                                <div className="text-right border-l pl-3 border-slate-200">
                                                  <div className="text-[10px] text-slate-500 font-medium">Due Date</div>
                                                  <div className="text-xs font-semibold text-slate-700">
                                                    {new Date(task.due_date).toLocaleDateString()}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Blocker Alert Banner if any */}
                                          {task.blockers && (
                                            <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-1.5">
                                              <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                                              <div>
                                                <strong>Blocker Reported:</strong> {task.blockers}
                                              </div>
                                            </div>
                                          )}

                                          {/* Task Links */}
                                          {((task.task_links && task.task_links.length > 0) || task.task_link) && (
                                            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-1 border-t border-slate-200/60">
                                              <span className="text-[10px] font-semibold text-slate-500">Deliverables:</span>
                                              {task.task_link && (
                                                <a
                                                  href={task.task_link}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:underline bg-white px-2 py-0.5 rounded border border-slate-200"
                                                >
                                                  <ExternalLink className="h-2.5 w-2.5" /> PR / Spec Link
                                                </a>
                                              )}
                                              {Array.isArray(task.task_links) && task.task_links.map((link: string, lIdx: number) => (
                                                <a
                                                  key={lIdx}
                                                  href={link}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:underline bg-white px-2 py-0.5 rounded border border-slate-200"
                                                >
                                                  <ExternalLink className="h-2.5 w-2.5" /> Link #{lIdx + 1}
                                                </a>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={!!deleteConfirmProject} onOpenChange={(open) => !open && setDeleteConfirmProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-red-600">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Confirm Project Deletion
            </DialogTitle>
          </DialogHeader>
          {deleteConfirmProject && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete <span className="font-bold text-slate-900">{deleteConfirmProject.name}</span>?
              </p>
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                ⚠️ This will remove all associated tasks, documentation links, and work logs for this initiative. This action cannot be undone.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmProject(null)}
                  disabled={deletingProject}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={confirmDeleteProject}
                  disabled={deletingProject}
                >
                  {deletingProject ? "Deleting..." : "Delete Project"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
