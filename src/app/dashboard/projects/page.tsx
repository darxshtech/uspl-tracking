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
  Rocket
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
              ? "Create, edit, assign team members (CEO, PM, Developers, Testers), and manage project deliverables."
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

                {/* Primary Assignee Selector (Including CEO, PM, Developer, Tester) */}
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
                    You can assign any team member (CEO, PM, Developer, Tester) directly as the lead or developer on this project.
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
              {canManageProject && <TableHead className="font-bold text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={canManageProject ? 8 : 7} className="text-center py-8">Loading projects...</TableCell></TableRow>
            ) : projects.length === 0 ? (
              <TableRow><TableCell colSpan={canManageProject ? 8 : 7} className="text-center text-slate-500 py-10">No projects created yet. Click "Create New Project" to begin.</TableCell></TableRow>
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

                  <TableCell>
                    <div className="space-y-1 min-w-[130px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{completedTasks}/{totalTasks} Tasks</span>
                        <span className="text-[10px] font-bold text-sky-600">{taskPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full transition-all duration-300 ${
                            taskPct === 100 ? "bg-emerald-500" : taskPct > 0 ? "bg-sky-500" : "bg-slate-200"
                          }`}
                          style={{ width: `${taskPct}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {proj.members && proj.members.length > 0 ? (
                        proj.members.map((m: any) => (
                          <Badge key={m.id} variant="outline" className="text-[10px] bg-slate-50">
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

                  {canManageProject && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

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
