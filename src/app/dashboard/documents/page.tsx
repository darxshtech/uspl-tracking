"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { showError, showSuccess, showToast } from "@/lib/swal";
import {
  FolderArchive,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Link2,
  Paperclip,
  Download,
  ExternalLink,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit3,
  Lock,
  Globe,
  Briefcase,
  Layers,
  LayoutGrid,
  List,
  Copy,
  Check,
  Eye,
  AlertTriangle,
  FolderOpen,
  Sparkles,
  File
} from "lucide-react";

export default function DocumentsVaultPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const currentUserId = (session?.user as any)?.id;
  const canManage = ["Admin", "CEO", "PM"].includes(role);

  const [documents, setDocuments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFileType, setSelectedFileType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Create Modal State
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docCategory, setDocCategory] = useState("Project Document");
  const [docProjectId, setDocProjectId] = useState("standalone");
  const [docFileUrl, setDocFileUrl] = useState("");
  const [docFileName, setDocFileName] = useState("");
  const [docFileType, setDocFileType] = useState("pdf");
  const [docFileSize, setDocFileSize] = useState(0);
  const [docIsPublicAll, setDocIsPublicAll] = useState(false);
  const [docGrantedUsers, setDocGrantedUsers] = useState<number[]>([]);
  const [isExternalLinkMode, setIsExternalLinkMode] = useState(false);

  // Manage Access Modal State
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [activeDocForAccess, setActiveDocForAccess] = useState<any>(null);
  const [selectedAccessUsers, setSelectedAccessUsers] = useState<number[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("Project Document");
  const [editProjectId, setEditProjectId] = useState("standalone");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete State
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Copied State
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
    fetchProjects();
    if (canManage) {
      fetchEmployees();
    }
  }, [canManage]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (Array.isArray(data)) setDocuments(data);
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch (err) {
      console.error(err);
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

    const file = files[0];
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "unitglo_document_vault");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setDocFileUrl(data.url);
        setDocFileName(file.name);
        setDocFileSize(file.size);
        const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
        setDocFileType(ext);
        if (!docTitle) {
          // Set friendly title from filename without extension
          const cleanName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
          setDocTitle(cleanName);
        }
        showToast("File uploaded to CDN successfully!");
      } else {
        showError("Upload Failed", data.error || "Could not upload file.");
      }
    } catch (err) {
      console.error(err);
      showError("Upload Error", "Network error during Cloudinary upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docFileUrl) {
      showError("Validation Error", "Please provide a document title and uploaded file or link.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: docTitle,
        description: docDescription,
        category: docCategory,
        project_id: docProjectId === "standalone" ? null : parseInt(docProjectId, 10),
        file_url: docFileUrl,
        file_name: docFileName || docTitle,
        file_type: docFileType || "link",
        file_size: docFileSize || 0,
        is_public_all: docIsPublicAll,
        granted_users: docGrantedUsers,
      };

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setUploadOpen(false);
        resetCreateForm();
        fetchDocuments();
        showToast("Document saved to vault successfully!");
      } else {
        const data = await res.json();
        showError("Failed to Save", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Could not save document.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setDocTitle("");
    setDocDescription("");
    setDocCategory("Project Document");
    setDocProjectId("standalone");
    setDocFileUrl("");
    setDocFileName("");
    setDocFileType("pdf");
    setDocFileSize(0);
    setDocIsPublicAll(false);
    setDocGrantedUsers([]);
    setIsExternalLinkMode(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openAccessModal = (doc: any) => {
    setActiveDocForAccess(doc);
    const existingIds = (doc.granted_users || []).map((u: any) => u.id);
    setSelectedAccessUsers(existingIds);
    setAccessModalOpen(true);
  };

  const handleSaveAccess = async () => {
    if (!activeDocForAccess) return;
    setSavingAccess(true);
    try {
      const res = await fetch("/api/documents/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: activeDocForAccess.id,
          userIds: selectedAccessUsers,
        }),
      });

      if (res.ok) {
        setAccessModalOpen(false);
        fetchDocuments();
        showToast("Access permissions updated!");
      } else {
        const data = await res.json();
        showError("Failed to update access", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Could not update access permissions.");
    } finally {
      setSavingAccess(false);
    }
  };

  const toggleUserAccess = (userId: number) => {
    setSelectedAccessUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleCreateGrantedUser = (userId: number) => {
    setDocGrantedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const openEditModal = (doc: any) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditDesc(doc.description || "");
    setEditCategory(doc.category || "Project Document");
    setEditProjectId(doc.project_id ? doc.project_id.toString() : "standalone");
    setEditIsPublic(Boolean(doc.is_public_all));
    setEditOpen(true);
  };

  const handleUpdateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;

    setSavingEdit(true);
    try {
      const res = await fetch("/api/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDoc.id,
          title: editTitle,
          description: editDesc,
          category: editCategory,
          project_id: editProjectId === "standalone" ? null : parseInt(editProjectId, 10),
          is_public_all: editIsPublic,
        }),
      });

      if (res.ok) {
        setEditOpen(false);
        setEditingDoc(null);
        fetchDocuments();
        showToast("Document updated successfully!");
      } else {
        const data = await res.json();
        showError("Failed to update document", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Could not update document.");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteDoc = async () => {
    if (!deleteDocConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents?id=${deleteDocConfirm.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteDocConfirm(null);
        fetchDocuments();
        showToast("Document removed from vault.");
      } else {
        showError("Failed to delete", "Could not delete document.");
      }
    } catch (err) {
      console.error(err);
      showError("Error", "Could not delete document.");
    } finally {
      setDeleting(false);
    }
  };

  const copyDocLink = (doc: any) => {
    navigator.clipboard.writeText(doc.file_url);
    setCopiedId(doc.id);
    showToast("Link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for File Icon & Color
  const getFileBadge = (fileType: string) => {
    const t = (fileType || "").toLowerCase();
    if (["pdf"].includes(t)) {
      return { icon: FileText, color: "text-rose-600 bg-rose-50 border-rose-200", label: "PDF Document" };
    }
    if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(t)) {
      return { icon: ImageIcon, color: "text-purple-600 bg-purple-50 border-purple-200", label: "Image / Visual" };
    }
    if (["doc", "docx", "txt", "rtf", "md"].includes(t)) {
      return { icon: FileCode, color: "text-blue-600 bg-blue-50 border-blue-200", label: "Word / Document" };
    }
    if (["xls", "xlsx", "csv"].includes(t)) {
      return { icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "Spreadsheet" };
    }
    if (["link", "url"].includes(t)) {
      return { icon: Link2, color: "text-sky-600 bg-sky-50 border-sky-200", label: "External Resource" };
    }
    return { icon: File, color: "text-slate-600 bg-slate-50 border-slate-200", label: "File" };
  };

  // Category Color
  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "Marketing":
        return "bg-pink-50 text-pink-700 border-pink-200";
      case "Admin":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Technical":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Project Document":
        return "bg-sky-50 text-sky-700 border-sky-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Category Filter
      if (activeCategory !== "All" && doc.category !== activeCategory) {
        return false;
      }
      // Project Filter
      if (selectedProjectId !== "all") {
        if (selectedProjectId === "standalone" && doc.project_id !== null) {
          return false;
        }
        if (selectedProjectId !== "standalone" && doc.project_id?.toString() !== selectedProjectId) {
          return false;
        }
      }
      // File Type Filter
      if (selectedFileType !== "all") {
        const ext = (doc.file_type || "").toLowerCase();
        if (selectedFileType === "pdf" && ext !== "pdf") return false;
        if (selectedFileType === "image" && !["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext)) return false;
        if (selectedFileType === "docx" && !["doc", "docx", "txt", "md"].includes(ext)) return false;
        if (selectedFileType === "sheets" && !["xls", "xlsx", "csv"].includes(ext)) return false;
        if (selectedFileType === "link" && ext !== "link") return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(query);
        const matchDesc = (doc.description || "").toLowerCase().includes(query);
        const matchFile = (doc.file_name || "").toLowerCase().includes(query);
        const matchProj = (doc.project_name || "").toLowerCase().includes(query);
        const matchCreator = (doc.creator_name || "").toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchFile && !matchProj && !matchCreator) {
          return false;
        }
      }
      return true;
    });
  }, [documents, activeCategory, selectedProjectId, selectedFileType, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = documents.length;
    const marketing = documents.filter((d) => d.category === "Marketing").length;
    const admin = documents.filter((d) => d.category === "Admin").length;
    const projectDocs = documents.filter((d) => d.category === "Project Document").length;
    const standalone = documents.filter((d) => !d.project_id).length;
    return { total, marketing, admin, projectDocs, standalone };
  }, [documents]);

  const categories = ["All", "Marketing", "Admin", "Project Document", "Technical", "General"];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <FolderArchive className="h-8 w-8 text-sky-500" />
            Document Vault & Knowledge Repository
          </h1>
          <p className="text-slate-500 mt-1">
            {canManage
              ? "Upload, organize, and grant granular team access for Marketing, Admin, and Project specifications (PDF, Word, Images, Spreadsheets)."
              : "Access official company documentation, assets, and project specifications shared with you."}
          </p>
        </div>

        {canManage && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger render={<Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md flex items-center gap-2" />}>
              <Plus className="h-4 w-4" /> Upload Document / Link
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-sky-500" /> Upload Document into Vault
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateDocument} className="space-y-4 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="docTitle" className="font-semibold text-slate-700">Document Title *</Label>
                    <Input
                      id="docTitle"
                      placeholder="e.g. Brand Identity Kit, NDA Agreement..."
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Document Category *</Label>
                    <Select value={docCategory} onValueChange={setDocCategory}>
                      <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Marketing">📢 Marketing & Creative</SelectItem>
                        <SelectItem value="Admin">🛡️ Admin & Operational</SelectItem>
                        <SelectItem value="Project Document">💼 Project Document / PR</SelectItem>
                        <SelectItem value="Technical">⚙️ Technical Architecture / API</SelectItem>
                        <SelectItem value="General">📂 General Company Asset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Scope Assignment (Project or Standalone) */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 text-sky-500" /> Project Scope / Standalone
                  </Label>
                  <Select value={docProjectId} onValueChange={setDocProjectId}>
                    <SelectTrigger><SelectValue placeholder="Select Project or Standalone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standalone">⭐ Standalone / General Company Asset</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          💼 {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500">
                    If assigned to a project, team members on that project will have automatic access. Standalone files require explicit permission or public setting.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="docDesc" className="font-semibold text-slate-700">Description / Context</Label>
                  <textarea
                    id="docDesc"
                    rows={2}
                    placeholder="Brief description of the document purpose, version, or usage guidelines..."
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* File Upload vs External Link Switcher */}
                <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-slate-800 text-xs">File Attachment / Resource</Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsExternalLinkMode(false)}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          !isExternalLinkMode ? "bg-sky-600 text-white shadow-2xs" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsExternalLinkMode(true)}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          isExternalLinkMode ? "bg-sky-600 text-white shadow-2xs" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        External Link
                      </button>
                    </div>
                  </div>

                  {!isExternalLinkMode ? (
                    <div className="space-y-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="cursor-pointer text-xs bg-white"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.svg,.txt,.md,.ppt,.pptx"
                      />
                      {uploading && (
                        <p className="text-xs text-sky-600 font-semibold animate-pulse">
                          Uploading to secure Cloudinary CDN...
                        </p>
                      )}
                      {docFileUrl && (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs text-emerald-800">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium truncate max-w-md">{docFileName} (Uploaded)</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="url"
                        placeholder="https://docs.google.com/... or Figma / Notion URL"
                        value={docFileUrl}
                        onChange={(e) => {
                          setDocFileUrl(e.target.value);
                          setDocFileType("link");
                          setDocFileName("External Web Link");
                        }}
                        className="text-xs bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Visibility & Granular Permission Controls */}
                <div className="rounded-xl border border-indigo-200 p-3.5 bg-indigo-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <Globe className="h-4 w-4 text-indigo-600" />
                        Company-Wide Public Access
                      </Label>
                      <p className="text-[11px] text-indigo-700">
                        When enabled, all current and future developers & testers can view this document.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={docIsPublicAll}
                      onChange={(e) => setDocIsPublicAll(e.target.checked)}
                      className="h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Direct Employee Access Picker (if not public) */}
                  {!docIsPublicAll && (
                    <div className="space-y-2 pt-2 border-t border-indigo-200/70">
                      <Label className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                        Grant Direct Access to Specific Developers / Testers:
                      </Label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 rounded-lg bg-white border border-indigo-100">
                        {employees
                          .filter((e) => e.role === "Developer" || e.role === "Tester")
                          .map((emp) => {
                            const isSelected = docGrantedUsers.includes(emp.id);
                            return (
                              <div
                                key={emp.id}
                                onClick={() => toggleCreateGrantedUser(emp.id)}
                                className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer border transition-colors ${
                                  isSelected
                                    ? "bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold"
                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <div className={`h-3.5 w-3.5 rounded flex items-center justify-center border ${isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"}`}>
                                  {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                </div>
                                <span className="truncate">{emp.name} ({emp.role})</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={submitting || uploading || !docFileUrl}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 shadow-md"
                >
                  {submitting ? "Saving Document..." : "Save to Vault"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <FolderArchive className="h-4 w-4 text-sky-500" /> Total Documents
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
        </div>

        <div className="p-4 rounded-2xl bg-pink-50/50 border border-pink-200 shadow-xs">
          <div className="text-xs font-semibold text-pink-700 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-pink-600" /> Marketing Assets
          </div>
          <div className="text-2xl font-black text-pink-900 mt-1">{metrics.marketing}</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 shadow-xs">
          <div className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-amber-600" /> Admin Documents
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.admin}</div>
        </div>

        <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200 shadow-xs">
          <div className="text-xs font-semibold text-sky-700 flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-sky-600" /> Project Specs
          </div>
          <div className="text-2xl font-black text-sky-900 mt-1">{metrics.projectDocs}</div>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-indigo-600" /> Standalone Files
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1">{metrics.standalone}</div>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {cat === "All" ? "All Categories" : cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by document title, filename, or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Project Filter */}
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-9 text-xs min-w-[160px] bg-slate-50">
                <SelectValue placeholder="Filter by Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects & Scopes</SelectItem>
                <SelectItem value="standalone">Standalone Files Only</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* File Type Filter */}
            <Select value={selectedFileType} onValueChange={setSelectedFileType}>
              <SelectTrigger className="h-9 text-xs min-w-[130px] bg-slate-50">
                <SelectValue placeholder="File Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All File Formats</SelectItem>
                <SelectItem value="pdf">PDF Documents</SelectItem>
                <SelectItem value="image">Images / Visuals</SelectItem>
                <SelectItem value="docx">Word / Text</SelectItem>
                <SelectItem value="sheets">Spreadsheets</SelectItem>
                <SelectItem value="link">Web Links</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-slate-200 rounded-xl bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "grid" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "table" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Documents Content */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-sky-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600">Loading Document Vault...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
          <FolderArchive className="h-10 w-10 text-slate-400 mx-auto" />
          <div className="font-bold text-slate-800">No documents found</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {canManage
              ? "No documents match the current filter. Click 'Upload Document' above to add documents."
              : "No documents have been shared with your account yet."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const badgeInfo = getFileBadge(doc.file_type);
            const Icon = badgeInfo.icon;
            const categoryClass = getCategoryBadgeColor(doc.category);
            const isPublic = Boolean(doc.is_public_all);
            const grantedCount = (doc.granted_users || []).length;

            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-md transition-all p-5 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 ${categoryClass}`}>
                      {doc.category}
                    </Badge>

                    <div className="flex items-center gap-1.5">
                      {isPublic ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold" title="Public for all company employees">
                          <Globe className="h-3 w-3" /> Public
                        </span>
                      ) : doc.project_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-semibold" title={`Assigned to project: ${doc.project_name}`}>
                          <Briefcase className="h-3 w-3" /> Project
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold" title="Restricted / Standalone">
                          <Lock className="h-3 w-3" /> Restricted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & File Icon */}
                  <div className="flex items-start gap-3 pt-1">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${badgeInfo.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug truncate" title={doc.title}>
                        {doc.title}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                        {doc.file_name}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {doc.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      {doc.description}
                    </p>
                  )}

                  {/* Project Tag if assigned */}
                  {doc.project_name && (
                    <div className="text-[11px] font-semibold text-sky-700 flex items-center gap-1 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                      <Briefcase className="h-3 w-3 text-sky-600" />
                      <span className="truncate">Project: <strong>{doc.project_name}</strong></span>
                    </div>
                  )}

                  {/* Access details for managers */}
                  {canManage && !isPublic && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-indigo-500" />
                        {grantedCount > 0 ? `${grantedCount} Staff Granted Access` : "Managers Only"}
                      </span>
                      <button
                        type="button"
                        onClick={() => openAccessModal(doc)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                      >
                        Manage Access
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-400">
                    By {doc.creator_name || "Management"}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Copy Link */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyDocLink(doc)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-sky-600 hover:bg-sky-50"
                      title="Copy Document URL"
                    >
                      {copiedId === doc.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>

                    {/* View / Download */}
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
                      title="Open / Download Document"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Open</span>
                    </a>

                    {/* Manager Actions */}
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(doc)}
                          className="h-8 w-8 p-0 text-sky-600 hover:text-sky-800 hover:bg-sky-50"
                          title="Edit Document"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteDocConfirm(doc)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Delete Document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold">Document Title</TableHead>
                <TableHead className="font-bold">Category</TableHead>
                <TableHead className="font-bold">Project Scope</TableHead>
                <TableHead className="font-bold">Access</TableHead>
                <TableHead className="font-bold">Uploaded By</TableHead>
                <TableHead className="font-bold">Date</TableHead>
                <TableHead className="font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => {
                const badgeInfo = getFileBadge(doc.file_type);
                const Icon = badgeInfo.icon;
                const categoryClass = getCategoryBadgeColor(doc.category);
                const isPublic = Boolean(doc.is_public_all);

                return (
                  <TableRow key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg border shrink-0 ${badgeInfo.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{doc.title}</div>
                          <div className="text-[10px] font-mono text-slate-400 truncate max-w-xs">{doc.file_name}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-bold ${categoryClass}`}>
                        {doc.category}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs">
                      {doc.project_name ? (
                        <span className="font-medium text-sky-700">{doc.project_name}</span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">Standalone</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {isPublic ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Globe className="h-3 w-3" /> Public
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => canManage && openAccessModal(doc)}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            canManage ? "hover:underline cursor-pointer bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          <Lock className="h-3 w-3" />
                          <span>{(doc.granted_users || []).length > 0 ? `${doc.granted_users.length} Staff` : "Managers"}</span>
                        </button>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-slate-600">
                      {doc.creator_name || "Management"}
                    </TableCell>

                    <TableCell className="text-xs text-slate-500 font-mono">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
                          title="Open Document"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>

                        {canManage && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(doc)}
                              className="h-8 w-8 p-0 text-sky-600 hover:bg-sky-50"
                              title="Edit Document"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteDocConfirm(doc)}
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                              title="Delete Document"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
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

      {/* MANAGE ACCESS MODAL */}
      <Dialog open={accessModalOpen} onOpenChange={setAccessModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-indigo-600" /> Granular Access Control
            </DialogTitle>
          </DialogHeader>

          {activeDocForAccess && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-xs text-slate-900">{activeDocForAccess.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{activeDocForAccess.file_name}</div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700 text-xs">
                  Select Developers & Testers with Access:
                </Label>
                <div className="space-y-1.5 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                  {employees
                    .filter((e) => e.role === "Developer" || e.role === "Tester")
                    .map((emp) => {
                      const hasAccess = selectedAccessUsers.includes(emp.id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => toggleUserAccess(emp.id)}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                            hasAccess
                              ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded flex items-center justify-center border ${hasAccess ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"}`}>
                              {hasAccess && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <span>{emp.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {emp.role}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAccessModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAccess}
                  disabled={savingAccess}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {savingAccess ? "Updating..." : "Save Permissions"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Edit3 className="h-5 w-5 text-sky-600" /> Edit Document Details
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateDocument} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editTitle" className="font-semibold text-slate-700">Document Title *</Label>
              <Input
                id="editTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700">Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Marketing">Marketing & Creative</SelectItem>
                  <SelectItem value="Admin">Admin & Operational</SelectItem>
                  <SelectItem value="Project Document">Project Document / PR</SelectItem>
                  <SelectItem value="Technical">Technical Architecture</SelectItem>
                  <SelectItem value="General">General Company Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700">Project Scope</Label>
              <Select value={editProjectId} onValueChange={setEditProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standalone">Standalone / General Company Asset</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editDesc" className="font-semibold text-slate-700">Description</Label>
              <textarea
                id="editDesc"
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-semibold text-slate-700">Make Company-Wide Public</div>
              <input
                type="checkbox"
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
            </div>

            <Button
              type="submit"
              disabled={savingEdit}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 mt-2"
            >
              {savingEdit ? "Updating..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={!!deleteDocConfirm} onOpenChange={(open) => !open && setDeleteDocConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-red-600">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Confirm Document Deletion
            </DialogTitle>
          </DialogHeader>
          {deleteDocConfirm && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete <span className="font-bold text-slate-900">{deleteDocConfirm.title}</span> from the vault?
              </p>
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                ⚠️ This will revoke access for all assigned developers and remove the document from the company repository.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeleteDocConfirm(null)} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={confirmDeleteDoc}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Document"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
