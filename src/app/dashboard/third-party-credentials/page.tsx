"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  PlugZap,
  Plus,
  Search,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Edit3,
  Shield,
  Layers,
  MessageSquare,
  Cloud,
  CreditCard,
  Database,
  Bot,
  Mail,
  Smartphone,
  Globe,
  FileCode,
  Users,
  AlertCircle,
  Sparkles,
  Info,
  CheckCircle2,
  Lock,
  ChevronRight,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { showSuccess, showError, showToast } from "@/lib/swal";

// Service preset templates for rapid entry
interface ServicePreset {
  id: string;
  name: string;
  category: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultFields: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
  envPrefix?: string;
  docsUrl?: string;
}

const SERVICE_PRESETS: ServicePreset[] = [
  {
    id: "whatsapp",
    name: "WhatsApp Business API",
    category: "Messaging & SMS",
    icon: MessageSquare,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    defaultFields: [
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "e.g. 104829104829104" },
      { key: "waba_id", label: "WhatsApp Business Account ID (WABA)", placeholder: "e.g. 293840192830192" },
      { key: "access_token", label: "System User Access Token", placeholder: "EAAG...", isSecret: true },
      { key: "webhook_verify_token", label: "Webhook Verify Token", placeholder: "e.g. unitglo_whatsapp_secret", isSecret: true },
      { key: "webhook_callback_url", label: "Webhook Callback URL", placeholder: "https://api.yourdomain.com/api/webhooks/whatsapp" },
    ],
    envPrefix: "WHATSAPP",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api"
  },
  {
    id: "cloudinary",
    name: "Cloudinary Media Storage",
    category: "Media & Storage",
    icon: Cloud,
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/30",
    defaultFields: [
      { key: "cloud_name", label: "Cloud Name", placeholder: "e.g. unitglo-assets" },
      { key: "api_key", label: "API Key", placeholder: "e.g. 849204829104829" },
      { key: "api_secret", label: "API Secret", placeholder: "e.g. aBcdEfGhIjKlMnOpQrStUvWxYz", isSecret: true },
      { key: "upload_preset", label: "Upload Preset (Optional)", placeholder: "e.g. user_uploads_preset" },
      { key: "cloudinary_url", label: "Full CLOUDINARY_URL (Optional)", placeholder: "cloudinary://api_key:api_secret@cloud_name", isSecret: true },
    ],
    envPrefix: "CLOUDINARY",
    docsUrl: "https://cloudinary.com/documentation"
  },
  {
    id: "razorpay",
    name: "Razorpay Payment Gateway",
    category: "Payments",
    icon: CreditCard,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
    defaultFields: [
      { key: "key_id", label: "Key ID / Public Key", placeholder: "rzp_live_..." },
      { key: "key_secret", label: "Key Secret", placeholder: "e.g. abc123def456ghi789", isSecret: true },
      { key: "webhook_secret", label: "Webhook Secret (Optional)", placeholder: "e.g. whsec_...", isSecret: true },
      { key: "merchant_id", label: "Merchant ID (Optional)", placeholder: "e.g. M12345678" },
    ],
    envPrefix: "RAZORPAY",
    docsUrl: "https://razorpay.com/docs"
  },
  {
    id: "stripe",
    name: "Stripe Payments",
    category: "Payments",
    icon: CreditCard,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    defaultFields: [
      { key: "publishable_key", label: "Publishable Key", placeholder: "pk_live_..." },
      { key: "secret_key", label: "Secret Key", placeholder: "sk_live_...", isSecret: true },
      { key: "webhook_secret", label: "Webhook Signing Secret", placeholder: "whsec_...", isSecret: true },
    ],
    envPrefix: "STRIPE",
    docsUrl: "https://stripe.com/docs"
  },
  {
    id: "aws_s3",
    name: "AWS S3 / Cloudflare R2",
    category: "Media & Storage",
    icon: Database,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    defaultFields: [
      { key: "access_key_id", label: "AWS / R2 Access Key ID", placeholder: "AKIA..." },
      { key: "secret_access_key", label: "AWS / R2 Secret Access Key", placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", isSecret: true },
      { key: "bucket_name", label: "Bucket Name", placeholder: "e.g. project-production-assets" },
      { key: "region", label: "Region", placeholder: "e.g. ap-south-1 or auto" },
      { key: "endpoint_url", label: "Custom Endpoint / CDN URL (Optional)", placeholder: "https://<account_id>.r2.cloudflarestorage.com" },
    ],
    envPrefix: "AWS_S3",
    docsUrl: "https://aws.amazon.com/s3"
  },
  {
    id: "firebase",
    name: "Firebase / Supabase",
    category: "Database & Auth",
    icon: Sparkles,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    defaultFields: [
      { key: "project_id", label: "Project ID", placeholder: "e.g. my-app-prod" },
      { key: "api_key", label: "Web API Key / Anon Key", placeholder: "AIzaSy..." },
      { key: "auth_domain", label: "Auth Domain / URL", placeholder: "my-app-prod.firebaseapp.com" },
      { key: "database_url", label: "Database URL / Supabase URL", placeholder: "https://my-app.supabase.co" },
      { key: "service_account_json", label: "Service Account / Secret Key", placeholder: "Paste JSON or Secret Key...", isSecret: true },
    ],
    envPrefix: "FIREBASE",
    docsUrl: "https://firebase.google.com/docs"
  },
  {
    id: "email_smtp",
    name: "SendGrid / Resend / SMTP",
    category: "Email",
    icon: Mail,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    defaultFields: [
      { key: "api_key", label: "API Key / SMTP Password", placeholder: "SG. or re_...", isSecret: true },
      { key: "from_email", label: "From / Sender Email", placeholder: "notifications@yourdomain.com" },
      { key: "from_name", label: "From Sender Name", placeholder: "e.g. Unitglo Support" },
      { key: "smtp_host", label: "SMTP Host (Optional)", placeholder: "smtp.sendgrid.net" },
      { key: "smtp_port", label: "SMTP Port (Optional)", placeholder: "587" },
    ],
    envPrefix: "MAIL",
    docsUrl: "https://resend.com/docs"
  },
  {
    id: "twilio",
    name: "Twilio / SMS Gateway",
    category: "Messaging & SMS",
    icon: Smartphone,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    defaultFields: [
      { key: "account_sid", label: "Account SID", placeholder: "AC..." },
      { key: "auth_token", label: "Auth Token", placeholder: "e.g. 1a2b3c4d5e6f...", isSecret: true },
      { key: "sender_phone", label: "Sender Phone Number / Sender ID", placeholder: "+1234567890 or UNTGLE" },
    ],
    envPrefix: "TWILIO",
    docsUrl: "https://www.twilio.com/docs"
  },
  {
    id: "openai_ai",
    name: "OpenAI / Claude / Gemini API",
    category: "AI & ML",
    icon: Bot,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/30",
    defaultFields: [
      { key: "api_key", label: "API Secret Key", placeholder: "sk-proj-...", isSecret: true },
      { key: "org_id", label: "Organization ID (Optional)", placeholder: "org-..." },
      { key: "base_url", label: "Custom Base URL / Proxy (Optional)", placeholder: "https://api.openai.com/v1" },
    ],
    envPrefix: "AI",
    docsUrl: "https://platform.openai.com/docs"
  },
  {
    id: "google_maps",
    name: "Google Maps / Places API",
    category: "Other APIs",
    icon: Globe,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    defaultFields: [
      { key: "api_key", label: "Google Maps API Key", placeholder: "AIzaSy...", isSecret: true },
      { key: "allowed_referrers", label: "Allowed Referrers / Domains (Optional)", placeholder: "*.yourdomain.com/*" },
    ],
    envPrefix: "GOOGLE_MAPS",
    docsUrl: "https://developers.google.com/maps"
  },
  {
    id: "custom",
    name: "Custom 3rd-Party API / Webhook",
    category: "Other APIs",
    icon: PlugZap,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    defaultFields: [
      { key: "api_key", label: "API Key / Client ID", placeholder: "e.g. key_12345" },
      { key: "api_secret", label: "API Secret / Client Secret", placeholder: "e.g. secret_98765", isSecret: true },
      { key: "endpoint_url", label: "Base API Endpoint / URL", placeholder: "https://api.thirdparty.com/v1" },
    ],
    envPrefix: "CUSTOM_API"
  }
];

const CATEGORIES = [
  "ALL",
  "Messaging & SMS",
  "Media & Storage",
  "Payments",
  "Database & Auth",
  "AI & ML",
  "Email",
  "Other APIs"
];

function ThirdPartyCredentialsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const role = (session?.user as any)?.role || "User";
  const currentUserId = (session?.user as any)?.id;
  const isExecutive = ["Admin", "CEO", "PM"].includes(role);

  const queryProjectId = searchParams.get("projectId") || searchParams.get("project_id");

  // Main state
  const [credentials, setCredentials] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState(queryProjectId || "ALL");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("whatsapp");
  const [serviceName, setServiceName] = useState<string>("WhatsApp Business API");
  const [serviceCategory, setServiceCategory] = useState<string>("Messaging & SMS");
  const [environment, setEnvironment] = useState<string>("Production");
  const [notes, setNotes] = useState<string>("");
  const [formFields, setFormFields] = useState<{ key: string; label: string; value: string; isSecret?: boolean }[]>([]);
  const [customKey, setCustomKey] = useState("");
  const [customVal, setCustomVal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password visibility tracking per card field
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
    fetchCredentials();
  }, [selectedProjectFilter, selectedCategory]);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        if (data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(String(data[0].id));
        }
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      let url = "/api/third-party-credentials?";
      if (selectedProjectFilter && selectedProjectFilter !== "ALL") {
        url += `project_id=${selectedProjectFilter}&`;
      }
      if (selectedCategory && selectedCategory !== "ALL") {
        url += `category=${encodeURIComponent(selectedCategory)}&`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.credentials)) {
        setCredentials(data.credentials);
      } else {
        setCredentials([]);
      }
    } catch (err) {
      console.error("Failed to fetch 3rd party credentials:", err);
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  };

  // Switch preset in modal
  const handleSelectPreset = (preset: ServicePreset) => {
    setSelectedPresetId(preset.id);
    setServiceName(preset.name);
    setServiceCategory(preset.category);
    setFormFields(preset.defaultFields.map((f) => ({
      key: f.key,
      label: f.label,
      value: "",
      isSecret: f.isSecret || false,
    })));
  };

  const handleOpenAddModal = (presetId?: string) => {
    setEditingId(null);
    const chosenPreset = SERVICE_PRESETS.find((p) => p.id === (presetId || "whatsapp")) || SERVICE_PRESETS[0];
    setSelectedPresetId(chosenPreset.id);
    setServiceName(chosenPreset.name);
    setServiceCategory(chosenPreset.category);
    setEnvironment("Production");
    setNotes("");
    setCustomKey("");
    setCustomVal("");
    setFormFields(chosenPreset.defaultFields.map((f) => ({
      key: f.key,
      label: f.label,
      value: "",
      isSecret: f.isSecret || false,
    })));
    if (projects.length > 0) {
      if (selectedProjectFilter !== "ALL") {
        setSelectedProjectId(selectedProjectFilter);
      } else {
        setSelectedProjectId(String(projects[0].id));
      }
    }
    setModalOpen(true);
  };

  const handleOpenEditModal = (cred: any) => {
    setEditingId(cred.id);
    setSelectedProjectId(String(cred.project_id));
    setServiceName(cred.service_name);
    setServiceCategory(cred.service_category || "API / Service");
    setEnvironment(cred.environment || "Production");
    setNotes(cred.notes || "");
    setCustomKey("");
    setCustomVal("");

    // Reconstruct fields from credentials_data
    const dataObj = cred.credentials_data || {};
    const matchedPreset = SERVICE_PRESETS.find((p) => p.name.toLowerCase() === cred.service_name.toLowerCase());
    setSelectedPresetId(matchedPreset ? matchedPreset.id : "custom");

    const fields: { key: string; label: string; value: string; isSecret?: boolean }[] = [];
    Object.entries(dataObj).forEach(([k, v]) => {
      const presetField = matchedPreset?.defaultFields.find((df) => df.key === k);
      const isSecretKey = k.toLowerCase().includes("secret") || k.toLowerCase().includes("token") || k.toLowerCase().includes("key") || k.toLowerCase().includes("pass");
      fields.push({
        key: k,
        label: presetField ? presetField.label : k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: String(v || ""),
        isSecret: presetField?.isSecret ?? isSecretKey,
      });
    });

    setFormFields(fields);
    setModalOpen(true);
  };

  const handleAddCustomField = () => {
    if (!customKey.trim()) return;
    const cleanKey = customKey.trim().toLowerCase().replace(/\s+/g, "_");
    setFormFields((prev) => [
      ...prev,
      {
        key: cleanKey,
        label: customKey.trim(),
        value: customVal.trim(),
        isSecret: cleanKey.includes("secret") || cleanKey.includes("token") || cleanKey.includes("key") || cleanKey.includes("pass"),
      }
    ]);
    setCustomKey("");
    setCustomVal("");
  };

  const handleRemoveField = (index: number) => {
    setFormFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, val: string) => {
    setFormFields((prev) => {
      const copy = [...prev];
      copy[index].value = val;
      return copy;
    });
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      showError("Please select a project.");
      return;
    }
    if (!serviceName.trim()) {
      showError("Service name is required.");
      return;
    }

    // Build credentials_data object
    const credentialsData: Record<string, string> = {};
    formFields.forEach((f) => {
      if (f.key && f.value.trim()) {
        credentialsData[f.key] = f.value.trim();
      }
    });

    if (Object.keys(credentialsData).length === 0) {
      showError("Please enter at least one credential value or API key.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        project_id: parseInt(selectedProjectId, 10),
        service_name: serviceName.trim(),
        service_category: serviceCategory,
        environment,
        credentials_data: credentialsData,
        notes: notes.trim(),
      };

      const url = "/api/third-party-credentials";
      const method = editingId ? "PUT" : "POST";
      if (editingId) payload.id = editingId;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        showSuccess(
          editingId ? "Credentials Updated" : "Credentials Added",
          data.message || "3rd-Party credentials saved successfully."
        );
        setModalOpen(false);
        fetchCredentials();
      } else {
        showError("Failed to save credentials", data.error || "An error occurred");
      }
    } catch (err: any) {
      console.error(err);
      showError("Error saving credentials", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, sName: string) => {
    if (!confirm(`Are you sure you want to delete "${sName}" credentials? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/third-party-credentials?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showSuccess("Deleted", "3rd-Party credential removed.");
        fetchCredentials();
      } else {
        showError("Failed to delete", data.error);
      }
    } catch (err: any) {
      showError("Error deleting credential", err.message);
    }
  };

  const handleCopyValue = (val: string, keyIdentifier: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(keyIdentifier);
    showToast(`${label} copied to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyEnvFormat = (cred: any) => {
    const dataObj = cred.credentials_data || {};
    const matchedPreset = SERVICE_PRESETS.find((p) => p.name.toLowerCase() === cred.service_name.toLowerCase());
    const prefix = matchedPreset?.envPrefix || cred.service_name.toUpperCase().replace(/\s+/g, "_");

    let envStr = `# ==========================================\n# ${cred.service_name} (${cred.environment || "Production"}) - ${cred.project_title}\n# ==========================================\n`;
    Object.entries(dataObj).forEach(([k, v]) => {
      const envKey = `${prefix}_${k.toUpperCase()}`;
      envStr += `${envKey}=${v}\n`;
    });

    navigator.clipboard.writeText(envStr.trim());
    setCopiedKey(`env-${cred.id}`);
    showToast(`All ${cred.service_name} keys copied in .env format!`, "success");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const toggleSecretVisibility = (fieldKey: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  // Filtered credentials based on search query
  const filteredCredentials = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return credentials;

    return credentials.filter((c) => {
      const pTitle = (c.project_title || "").toLowerCase();
      const sName = (c.service_name || "").toLowerCase();
      const sCat = (c.service_category || "").toLowerCase();
      const cNotes = (c.notes || "").toLowerCase();
      const env = (c.environment || "").toLowerCase();
      const dataStr = JSON.stringify(c.credentials_data || {}).toLowerCase();

      return (
        pTitle.includes(q) ||
        sName.includes(q) ||
        sCat.includes(q) ||
        cNotes.includes(q) ||
        env.includes(q) ||
        dataStr.includes(q)
      );
    });
  }, [credentials, searchQuery]);

  // Metric counts
  const totalCount = credentials.length;
  const projectCount = new Set(credentials.map((c) => c.project_id)).size;
  const storageCount = credentials.filter((c) => (c.service_category || "").includes("Storage") || (c.service_name || "").includes("Cloudinary") || (c.service_name || "").includes("S3")).length;
  const messagingCount = credentials.filter((c) => (c.service_category || "").includes("Messaging") || (c.service_name || "").includes("WhatsApp") || (c.service_name || "").includes("Twilio")).length;
  const paymentsCount = credentials.filter((c) => (c.service_category || "").includes("Payment") || (c.service_name || "").includes("Razorpay") || (c.service_name || "").includes("Stripe")).length;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ========================================================================= */}
      {/* HEADER & ACTION BAR                                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <PlugZap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                3rd-Party Project Credentials
                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                  Team Scoped
                </Badge>
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Manage WhatsApp, Cloudinary, Razorpay, S3, Firebase & third-party API keys securely scoped to your assigned project teams.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => handleOpenAddModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer h-10 px-4 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            <span>Add 3rd-Party Service</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* METRIC COUNTER CARDS                                                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 font-black">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Services</div>
            <div className="text-xl font-black text-slate-900">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 font-black">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Projects</div>
            <div className="text-xl font-black text-purple-900">{projectCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 font-black">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Messaging & SMS</div>
            <div className="text-xl font-black text-emerald-900">{messagingCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-50 text-sky-600 font-black">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Media & Storage</div>
            <div className="text-xl font-black text-sky-900">{storageCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-violet-50 text-violet-600 font-black">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payments</div>
            <div className="text-xl font-black text-violet-900">{paymentsCount}</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* QUICK PRESET LAUNCH BAR                                                   */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 rounded-2xl text-white shadow-md border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Quick Add Popular 3rd-Party Integrations:
          </span>
          <span className="text-[10px] text-slate-400">Click a template to configure</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {SERVICE_PRESETS.slice(0, 7).map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                onClick={() => handleOpenAddModal(preset.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/80 border border-slate-700/80 hover:border-indigo-400 text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 text-slate-200 hover:text-white shadow-2xs"
              >
                <Icon className={`h-3.5 w-3.5 ${preset.color}`} />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTERS & SEARCH                                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Project Selector & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Assigned Project Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-indigo-600" /> Project:
            </span>
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[160px]"
            >
              <option value="ALL">All Assigned Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by service name, key, project or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-800"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CREDENTIAL CARDS GRID                                                     */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-bold text-slate-500">Loading 3rd-party credentials...</p>
        </div>
      ) : filteredCredentials.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
            <PlugZap className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-extrabold text-slate-900 text-lg">No 3rd-Party Credentials Found</h3>
            <p className="text-xs text-slate-500">
              {searchQuery || selectedProjectFilter !== "ALL" || selectedCategory !== "ALL"
                ? "No credentials match your active search or filters. Try adjusting them."
                : "No third-party API keys or services configured yet. Click below to add WhatsApp, Cloudinary, Razorpay or other project credentials."}
            </p>
          </div>
          <Button
            onClick={() => handleOpenAddModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md rounded-xl h-9 px-4 cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add First 3rd-Party Service
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCredentials.map((cred) => {
            const matchedPreset = SERVICE_PRESETS.find((p) => p.name.toLowerCase() === cred.service_name.toLowerCase()) || SERVICE_PRESETS.find((p) => p.id === "custom")!;
            const Icon = matchedPreset.icon;
            const dataObj = cred.credentials_data || {};
            const teamMembers = cred.team_members || [];

            const envColor = cred.environment === "Production" 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
              : cred.environment === "Staging"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-sky-50 text-sky-700 border-sky-200";

            return (
              <div
                key={cred.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top Header */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2.5 rounded-xl ${matchedPreset.bgColor} ${matchedPreset.borderColor} border shrink-0`}>
                        <Icon className={`h-5 w-5 ${matchedPreset.color}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-slate-900 truncate" title={cred.service_name}>
                          {cred.service_name}
                        </h4>
                        <p className="text-[11px] font-bold text-indigo-600 truncate flex items-center gap-1">
                          <Layers className="h-3 w-3 shrink-0" /> {cred.project_title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[10px] font-bold ${envColor}`}>
                        {cred.environment || "Production"}
                      </Badge>
                    </div>
                  </div>

                  {/* Team Members Tag */}
                  {teamMembers.length > 0 && (
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                      <div className="flex items-center gap-1 font-semibold text-slate-700">
                        <Users className="h-3 w-3 text-indigo-600 shrink-0" />
                        <span>Project Team ({teamMembers.length}):</span>
                      </div>
                      <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {teamMembers.slice(0, 4).map((m: any, idx: number) => (
                          <div
                            key={idx}
                            title={`${m.name} (${m.role})`}
                            className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold border border-white shadow-2xs"
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {teamMembers.length > 4 && (
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold border border-white">
                            +{teamMembers.length - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Key-Value Fields Display */}
                  <div className="space-y-2 pt-1">
                    {Object.entries(dataObj).map(([k, v]: [string, any]) => {
                      const strVal = String(v || "");
                      const isSecret = k.toLowerCase().includes("secret") || k.toLowerCase().includes("token") || k.toLowerCase().includes("key") || k.toLowerCase().includes("pass");
                      const fieldKeyId = `${cred.id}-${k}`;
                      const isVisible = visibleSecrets[fieldKeyId] || false;
                      const formattedLabel = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

                      return (
                        <div key={k} className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <span>{formattedLabel}</span>
                            <div className="flex items-center gap-1">
                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() => toggleSecretVisibility(fieldKeyId)}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                  title={isVisible ? "Hide secret" : "Show secret"}
                                >
                                  {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyValue(strVal, fieldKeyId, formattedLabel)}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer transition"
                                title="Copy to clipboard"
                              >
                                {copiedKey === fieldKeyId ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="font-mono text-xs text-slate-900 break-all select-all font-semibold">
                            {isSecret && !isVisible ? "••••••••••••••••••••" : strVal}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes / Documentation */}
                  {cred.notes && (
                    <div className="p-2 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-slate-600 space-y-0.5">
                      <span className="font-bold text-indigo-900 block text-[10px] uppercase">Notes / Setup:</span>
                      <p className="whitespace-pre-wrap leading-relaxed">{cred.notes}</p>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyEnvFormat(cred)}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[10px] font-bold text-slate-700 hover:text-indigo-700 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                      title="Copy all keys formatted for .env file"
                    >
                      {copiedKey === `env-${cred.id}` ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>.env Copied!</span>
                        </>
                      ) : (
                        <>
                          <FileCode className="h-3 w-3 text-indigo-600" />
                          <span>Copy as .env</span>
                        </>
                      )}
                    </button>

                    {matchedPreset.docsUrl && (
                      <a
                        href={matchedPreset.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-indigo-600 transition"
                        title="Open Official Documentation"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(cred)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white transition cursor-pointer"
                      title="Edit Service Credentials"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cred.id, cred.service_name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition cursor-pointer"
                      title="Delete Service"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT SERVICE CREDENTIALS MODAL                                      */}
      {/* ========================================================================= */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl p-6 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-indigo-600" />
              <span>{editingId ? "Edit 3rd-Party Service Credentials" : "Add 3rd-Party Service Credentials"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure 3rd-party API keys, webhook secrets, or service parameters. Strictly visible only to the team assigned to this project.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitModal} className="space-y-4 pt-2">
            {/* Step 1: Assigned Project Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Assigned Project <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" disabled>-- Select Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Service Presets Carousel / Badges (Only in Add Mode) */}
            {!editingId && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Service Template
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/60 scrollbar-thin">
                  {SERVICE_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`flex items-center gap-2 p-2 rounded-xl text-left border text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-white" : preset.color}`} />
                        <span className="truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Service Name & Category & Environment */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. WhatsApp Business API"
                  required
                  className="text-xs h-9 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-9"
                >
                  {CATEGORIES.filter((c) => c !== "ALL").map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Environment
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-9"
                >
                  <option value="Production">Production (Live)</option>
                  <option value="Staging">Staging (Testing / Sandbox)</option>
                  <option value="Development">Development (Local)</option>
                </select>
              </div>
            </div>

            {/* Step 4: Credential Key-Value Inputs */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5 text-indigo-600" /> API Keys & Parameter Fields
                </span>
                <span className="text-[10px] text-slate-400">Fill in the fields required for your integration</span>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/40">
                {formFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-1/3 min-w-[120px]">
                      <span className="text-[11px] font-bold text-slate-600 truncate block" title={field.label}>
                        {field.label}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 truncate block">
                        {field.key}
                      </span>
                    </div>
                    <div className="flex-1 relative">
                      <Input
                        type={field.isSecret ? "text" : "text"}
                        value={field.value}
                        onChange={(e) => handleFieldChange(idx, e.target.value)}
                        placeholder={`Enter ${field.label}...`}
                        className="text-xs h-8 rounded-lg font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                      title="Remove field"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Add Custom Field Inline Row */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <Input
                    type="text"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="Custom key (e.g. app_secret)"
                    className="w-1/3 text-xs h-8 rounded-lg"
                  />
                  <Input
                    type="text"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    placeholder="Value (e.g. 12345)"
                    className="flex-1 text-xs h-8 rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomField}
                    className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                  >
                    + Add Field
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 5: Notes & Integration Documentation */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Integration Notes & Documentation (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Webhook callback path is /api/webhooks/whatsapp. Test with phone number +91 9876543210."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-800"
              />
            </div>

            {/* Step 6: Security Notice & Submit Buttons */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
              <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Team Security Notice:</strong> These credentials will only be viewable by members assigned to the selected project and executive managers (PM, CEO, Admin).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="h-9 text-xs font-semibold text-slate-600 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-md cursor-pointer"
              >
                {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Save Credentials"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ThirdPartyCredentialsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading 3rd-Party Credentials...</div>}>
      <ThirdPartyCredentialsContent />
    </Suspense>
  );
}
