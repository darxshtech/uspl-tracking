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
  ArrowLeft,
  Filter,
  FileUp,
  Download,
  Upload,
  FolderLock,
  Sparkle
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
    id: "custom_new",
    name: "Custom Service / New API",
    category: "Other APIs",
    icon: Plus,
    color: "text-indigo-600",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
    defaultFields: [
      { key: "api_key", label: "API Key / Client ID", placeholder: "e.g. key_12345" },
      { key: "api_secret", label: "API Secret / Client Secret", placeholder: "e.g. secret_98765", isSecret: true },
      { key: "endpoint_url", label: "Base API Endpoint / URL (Optional)", placeholder: "https://api.yourprovider.com/v1" },
    ],
    envPrefix: "CUSTOM"
  },
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

// Parsed item structure for .env import
interface ParsedEnvService {
  serviceName: string;
  category: string;
  environment: string;
  credentialsData: Record<string, string>;
  selected: boolean;
}

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
  
  // WIZARD STATE: null = Project Cards Overview View, string = Selected Project Vault View
  const [selectedProjectVaultId, setSelectedProjectVaultId] = useState<string | null>(queryProjectId || null);

  // Add/Edit Modal State
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

  // .env Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importProjectId, setImportProjectId] = useState<string>("");
  const [importEnvironment, setImportEnvironment] = useState<string>("Production");
  const [rawEnvText, setRawEnvText] = useState<string>("");
  const [parsedEnvServices, setParsedEnvServices] = useState<ParsedEnvService[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Password visibility tracking per card field
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
    fetchCredentials();
  }, [selectedCategory]);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        if (data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(String(data[0].id));
          setImportProjectId(String(data[0].id));
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

  // Group credentials by project ID
  const credentialsByProject = useMemo(() => {
    const map: Record<number, any[]> = {};
    credentials.forEach((c) => {
      if (!map[c.project_id]) map[c.project_id] = [];
      map[c.project_id].push(c);
    });
    return map;
  }, [credentials]);

  // Synthesized combined list of projects (combines /api/projects with any project referenced in credentials)
  const allProjects = useMemo(() => {
    const projMap = new Map<number, any>();
    projects.forEach((p) => {
      if (p.id) projMap.set(Number(p.id), p);
    });

    credentials.forEach((c) => {
      if (c.project_id && !projMap.has(Number(c.project_id))) {
        projMap.set(Number(c.project_id), {
          id: c.project_id,
          name: c.project_title || `Project #${c.project_id}`,
          description: c.project_description || "Project Workspace",
          members: c.team_members || [],
        });
      }
    });

    return Array.from(projMap.values());
  }, [projects, credentials]);

  // Auto-sync project selection state when allProjects updates
  useEffect(() => {
    if (allProjects.length > 0) {
      if (!selectedProjectId) {
        setSelectedProjectId(String(allProjects[0].id));
      }
      if (!importProjectId) {
        setImportProjectId(String(allProjects[0].id));
      }
    }
  }, [allProjects, selectedProjectId, importProjectId]);

  // Selected project object for vault view
  const activeVaultProject = useMemo(() => {
    if (!selectedProjectVaultId) return null;
    return allProjects.find((p) => String(p.id) === String(selectedProjectVaultId)) || null;
  }, [allProjects, selectedProjectVaultId]);

  // Switch preset in modal
  const handleSelectPreset = (preset: ServicePreset) => {
    setSelectedPresetId(preset.id);
    if (preset.id === "custom_new") {
      setServiceName("");
      setServiceCategory("Other APIs");
      setFormFields(preset.defaultFields.map((f) => ({
        key: f.key,
        label: f.label,
        value: "",
        isSecret: f.isSecret || false,
      })));
    } else {
      setServiceName(preset.name);
      setServiceCategory(preset.category);
      setFormFields(preset.defaultFields.map((f) => ({
        key: f.key,
        label: f.label,
        value: "",
        isSecret: f.isSecret || false,
      })));
    }
  };

  const handleOpenAddModal = (presetId?: string, targetProjectId?: string) => {
    setEditingId(null);
    if (presetId === "custom_new") {
      setSelectedPresetId("custom_new");
      setServiceName("");
      setServiceCategory("Other APIs");
      setEnvironment("Production");
      setNotes("");
      setCustomKey("");
      setCustomVal("");
      setFormFields([
        { key: "api_key", label: "API Key / Client ID", value: "", isSecret: false },
        { key: "api_secret", label: "API Secret / Key", value: "", isSecret: true },
      ]);
    } else {
      const chosenPreset = SERVICE_PRESETS.find((p) => p.id === (presetId || "whatsapp")) || SERVICE_PRESETS[1];
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
    }

    const projId = targetProjectId || selectedProjectVaultId || (allProjects.length > 0 ? String(allProjects[0].id) : "");
    setSelectedProjectId(projId);
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

    const dataObj = cred.credentials_data || {};
    const matchedPreset = SERVICE_PRESETS.find((p) => p.name.toLowerCase() === cred.service_name.toLowerCase());
    setSelectedPresetId(matchedPreset ? matchedPreset.id : "custom_new");

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

  // =========================================================================
  // INTELLIGENT .ENV PARSER & IMPORT ENGINE
  // =========================================================================
  const handleOpenImportModal = (targetProjId?: string) => {
    setRawEnvText("");
    setParsedEnvServices([]);
    const projId = targetProjId || selectedProjectVaultId || (allProjects.length > 0 ? String(allProjects[0].id) : "");
    setImportProjectId(projId);
    setImportModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawEnvText(content);
        parseAndGroupEnvText(content);
      }
    };
    reader.readAsText(file);
  };

  const parseAndGroupEnvText = (text: string) => {
    if (!text.trim()) {
      setParsedEnvServices([]);
      return;
    }

    const lines = text.split("\n");
    const keyValues: { key: string; value: string }[] = [];

    lines.forEach((line) => {
      let trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      if (trimmed.startsWith("export ")) {
        trimmed = trimmed.substring(7).trim();
      }

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();

        if (!val.startsWith('"') && !val.startsWith("'")) {
          const commentIdx = val.indexOf(" #");
          if (commentIdx !== -1) {
            val = val.substring(0, commentIdx).trim();
          }
        }

        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }

        if (key && val) {
          keyValues.push({ key, value: val });
        }
      }
    });

    const groups: Record<string, { serviceName: string; category: string; data: Record<string, string> }> = {};

    const getPrefixService = (key: string) => {
      const u = key.toUpperCase();
      if (u.startsWith("CLOUDINARY_")) return { name: "Cloudinary Media Storage", category: "Media & Storage", prefix: "CLOUDINARY_" };
      if (u.startsWith("WHATSAPP_") || u.startsWith("WA_")) return { name: "WhatsApp Business API", category: "Messaging & SMS", prefix: u.startsWith("WHATSAPP_") ? "WHATSAPP_" : "WA_" };
      if (u.startsWith("RAZORPAY_")) return { name: "Razorpay Payment Gateway", category: "Payments", prefix: "RAZORPAY_" };
      if (u.startsWith("STRIPE_")) return { name: "Stripe Payments", category: "Payments", prefix: "STRIPE_" };
      if (u.startsWith("AWS_") || u.startsWith("S3_") || u.startsWith("R2_")) return { name: "AWS S3 / Cloudflare R2", category: "Media & Storage", prefix: u.includes("S3") ? "S3_" : "AWS_" };
      if (u.startsWith("FIREBASE_") || u.startsWith("SUPABASE_") || u.startsWith("NEXT_PUBLIC_SUPABASE_")) return { name: "Firebase / Supabase", category: "Database & Auth", prefix: u.includes("SUPABASE") ? "SUPABASE_" : "FIREBASE_" };
      if (u.startsWith("TWILIO_")) return { name: "Twilio / SMS Gateway", category: "Messaging & SMS", prefix: "TWILIO_" };
      if (u.startsWith("OPENAI_") || u.startsWith("ANTHROPIC_") || u.startsWith("GEMINI_")) return { name: "AI & ML API", category: "AI & ML", prefix: u.split("_")[0] + "_" };
      if (u.startsWith("MAIL_") || u.startsWith("SMTP_") || u.startsWith("SENDGRID_") || u.startsWith("RESEND_")) return { name: "SendGrid / Resend / SMTP", category: "Email", prefix: u.split("_")[0] + "_" };
      if (u.startsWith("GOOGLE_MAPS_") || u.startsWith("GMAPS_")) return { name: "Google Maps API", category: "Other APIs", prefix: "GOOGLE_MAPS_" };

      const match = u.match(/^([A-Z0-9]{3,})_/);
      if (match) {
        const prefix = match[1];
        const formattedName = prefix.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Service";
        return { name: formattedName, category: "Other APIs", prefix: prefix + "_" };
      }

      return { name: "Project Environment (.env)", category: "Other APIs", prefix: "" };
    };

    keyValues.forEach(({ key, value }) => {
      const match = getPrefixService(key);
      const groupKey = match.name;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          serviceName: match.name,
          category: match.category,
          data: {},
        };
      }

      let fieldKey = key.toLowerCase();
      if (match.prefix) {
        fieldKey = fieldKey.replace(match.prefix.toLowerCase(), "");
      }
      if (!fieldKey) fieldKey = key.toLowerCase();

      groups[groupKey].data[fieldKey] = value;
    });

    const parsedList: ParsedEnvService[] = Object.values(groups).map((g) => ({
      serviceName: g.serviceName,
      category: g.category,
      environment: importEnvironment,
      credentialsData: g.data,
      selected: true,
    }));

    setParsedEnvServices(parsedList);
  };

  const handleConfirmImport = async () => {
    if (!importProjectId) {
      showError("Please select a target project to import credentials to.");
      return;
    }
    const selectedServices = parsedEnvServices.filter((s) => s.selected && Object.keys(s.credentialsData).length > 0);
    if (selectedServices.length === 0) {
      showError("Please select at least one parsed service to import.");
      return;
    }

    setIsImporting(true);
    try {
      let importedCount = 0;
      for (const service of selectedServices) {
        const payload = {
          project_id: parseInt(importProjectId, 10),
          service_name: service.serviceName,
          service_category: service.category,
          environment: importEnvironment,
          credentials_data: service.credentialsData,
          notes: `Auto-imported from .env configuration file`,
        };

        const res = await fetch("/api/third-party-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) importedCount++;
      }

      showSuccess(
        "Import Successful",
        `Successfully auto-imported ${importedCount} service credential card(s) from .env!`
      );
      setImportModalOpen(false);
      fetchCredentials();
    } catch (err: any) {
      console.error(err);
      showError("Error importing credentials", err.message);
    } finally {
      setIsImporting(false);
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

  // Master Export: Copy ALL credentials for a specific project into one .env string!
  const handleExportFullProjectEnv = (projectId: number, projName: string) => {
    const projCreds = credentialsByProject[projectId] || [];
    if (projCreds.length === 0) {
      showError("No credentials configured for this project yet.");
      return;
    }

    let fullEnvStr = `# ========================================================\n# ${projName.toUpperCase()} - MASTER .ENV CONFIGURATION\n# Exported on ${new Date().toLocaleDateString()}\n# ========================================================\n\n`;

    projCreds.forEach((cred) => {
      const dataObj = cred.credentials_data || {};
      const matchedPreset = SERVICE_PRESETS.find((p) => p.name.toLowerCase() === cred.service_name.toLowerCase());
      const prefix = matchedPreset?.envPrefix || cred.service_name.toUpperCase().replace(/\s+/g, "_");

      fullEnvStr += `# --- ${cred.service_name} (${cred.environment || "Production"}) ---\n`;
      Object.entries(dataObj).forEach(([k, v]) => {
        const envKey = `${prefix}_${k.toUpperCase()}`;
        fullEnvStr += `${envKey}=${v}\n`;
      });
      fullEnvStr += `\n`;
    });

    navigator.clipboard.writeText(fullEnvStr.trim());
    setCopiedKey(`master-env-${projectId}`);
    showSuccess("Master .env Copied!", `All ${projCreds.length} service keys for "${projName}" copied to clipboard in .env format.`);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const toggleSecretVisibility = (fieldKey: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  // Active project vault credentials list
  const activeVaultCredentials = useMemo(() => {
    if (!selectedProjectVaultId) return [];
    const projCreds = credentialsByProject[parseInt(selectedProjectVaultId, 10)] || [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return projCreds;

    return projCreds.filter((c) => {
      const sName = (c.service_name || "").toLowerCase();
      const sCat = (c.service_category || "").toLowerCase();
      const cNotes = (c.notes || "").toLowerCase();
      const env = (c.environment || "").toLowerCase();
      const dataStr = JSON.stringify(c.credentials_data || {}).toLowerCase();

      return (
        sName.includes(q) ||
        sCat.includes(q) ||
        cNotes.includes(q) ||
        env.includes(q) ||
        dataStr.includes(q)
      );
    });
  }, [credentialsByProject, selectedProjectVaultId, searchQuery]);

  // Metric counts
  const totalCount = credentials.length;
  const projectCount = allProjects.length;
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
                  Project Scoped Vault
                </Badge>
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Select a project below to smoothly expand its dedicated credentials vault (WhatsApp, Cloudinary, Razorpay, S3, Firebase).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => handleOpenImportModal()}
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs shadow-2xs flex items-center gap-2 cursor-pointer h-10 px-3.5 rounded-xl"
          >
            <FileUp className="h-4 w-4 text-indigo-600" />
            <span>Import .env Config</span>
          </Button>

          <Button
            onClick={() => handleOpenAddModal("custom_new")}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-2xs flex items-center gap-2 cursor-pointer h-10 px-3.5 rounded-xl"
          >
            <Plus className="h-4 w-4 text-purple-600" />
            <span>Create Custom Name</span>
          </Button>

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
      {/* WIZARD MODE 1: PROJECT CARDS OVERVIEW (When no project is selected)      */}
      {/* ========================================================================= */}
      {selectedProjectVaultId === null ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <FolderLock className="h-5 w-5 text-indigo-600" /> Select a Project to Access its Credentials Vault
              </h2>
              <p className="text-xs text-slate-500">
                Click any project card below to smoothly open its configured 3rd-party API keys, tokens, and webhooks.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {allProjects.length} Assigned Project(s)
              </span>
            </div>
          </div>

          {loading ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
              <p className="text-sm font-bold text-slate-500">Loading project vaults...</p>
            </div>
          ) : allProjects.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                <Layers className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-extrabold text-slate-900 text-lg">No Assigned Projects Available</h3>
                <p className="text-xs text-slate-500">
                  You are not assigned to any projects yet. Ask your PM or Administrator to assign you to a project.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allProjects.map((proj) => {
                const projCreds = credentialsByProject[proj.id] || [];
                const serviceCount = projCreds.length;
                const members = proj.members || [];

                // Unique service categories present in this project
                const serviceTypes = Array.from(new Set(projCreds.map((c) => c.service_name)));

                return (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedProjectVaultId(String(proj.id))}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-indigo-400 hover:scale-[1.01] transition-all duration-300 cursor-pointer p-5 flex flex-col justify-between group space-y-4 relative overflow-hidden"
                  >
                    {/* Top gradient accent line */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500" />

                    <div className="space-y-3">
                      {/* Project Header */}
                      <div className="flex items-start justify-between gap-2 pt-1">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-base shadow-inner shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                            {proj.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-base text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1" title={proj.name}>
                              {proj.name}
                            </h3>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {proj.description || "Project Workspace"}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-xs font-bold shrink-0 ${
                            serviceCount > 0
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {serviceCount} {serviceCount === 1 ? "Service" : "Services"}
                        </Badge>
                      </div>

                      {/* Configured Service Type Badges Preview */}
                      {serviceCount > 0 ? (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Configured Integrations:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {serviceTypes.slice(0, 4).map((sType: string, idx: number) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1"
                              >
                                ⚡ {sType}
                              </span>
                            ))}
                            {serviceTypes.length > 4 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                                +{serviceTypes.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                          No 3rd-party services added yet
                        </div>
                      )}
                    </div>

                    {/* Footer Row: Team Avatars & Launch Button */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500">Team:</span>
                        <div className="flex items-center -space-x-1.5">
                          {members.slice(0, 3).map((m: any, idx: number) => (
                            <div
                              key={idx}
                              title={`${m.name} (${m.role})`}
                              className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold border border-white"
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {members.length > 3 && (
                            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold border border-white">
                              +{members.length - 3}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        <span>Open Vault</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* WIZARD MODE 2: SELECTED PROJECT VAULT VIEW (Smooth Transition Opening)   */
        /* ========================================================================= */
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Project Header Banner & Breadcrumb */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedProjectVaultId(null)}
                className="inline-flex items-center gap-2 text-xs font-bold text-indigo-300 hover:text-white bg-slate-800/80 hover:bg-indigo-600 px-3.5 py-1.5 rounded-xl border border-slate-700 transition cursor-pointer self-start"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>&larr; Back to All Project Vaults</span>
              </button>

              {/* Master Export Button */}
              {activeVaultCredentials.length > 0 && (
                <Button
                  onClick={() => handleExportFullProjectEnv(parseInt(selectedProjectVaultId, 10), activeVaultProject?.name || "Project")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md rounded-xl h-9 px-4 cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <FileCode className="h-4 w-4" />
                  <span>Copy Master Project .env ({activeVaultCredentials.length} Services)</span>
                </Button>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-md">
                    {activeVaultProject?.name.charAt(0).toUpperCase() || "P"}
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
                      {activeVaultProject?.name || "Project Credentials Vault"}
                      <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold">
                        {activeVaultCredentials.length} Active Services
                      </Badge>
                    </h2>
                    <p className="text-xs text-slate-300">
                      {activeVaultProject?.description || "Project 3rd-Party API Keys, Webhook Secrets & Credentials Vault"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Add Buttons for this specific Project */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleOpenImportModal(selectedProjectVaultId)}
                  variant="outline"
                  className="border-indigo-400 text-indigo-200 hover:bg-indigo-600 hover:text-white font-bold text-xs shadow-2xs h-9 px-3.5 rounded-xl cursor-pointer"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  <span>Import .env</span>
                </Button>
                <Button
                  onClick={() => handleOpenAddModal("whatsapp", selectedProjectVaultId)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md h-9 px-4 rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Service to {activeVaultProject?.name || "Project"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Vault Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder={`Search ${activeVaultProject?.name || "project"} credentials by key, service name or notes...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
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

          {/* Project Credentials Card Grid */}
          {activeVaultCredentials.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                <PlugZap className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-extrabold text-slate-900 text-lg">No Credentials in {activeVaultProject?.name}</h3>
                <p className="text-xs text-slate-500">
                  {searchQuery || selectedCategory !== "ALL"
                    ? "No services match your active search or category filter."
                    : `No 3rd-party API keys added for "${activeVaultProject?.name}" yet. Click below to add WhatsApp, Cloudinary, Razorpay or import from .env.`}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleOpenImportModal(selectedProjectVaultId)}
                  variant="outline"
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold text-xs rounded-xl h-9 px-4 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <FileUp className="h-4 w-4" /> Import from .env File
                </Button>
                <Button
                  onClick={() => handleOpenAddModal("whatsapp", selectedProjectVaultId)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md rounded-xl h-9 px-4 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add First Service
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeVaultCredentials.map((cred) => {
                const matchedPreset = SERVICE_PRESETS.find((p) => p.name.toLowerCase() === cred.service_name.toLowerCase()) || SERVICE_PRESETS.find((p) => p.id === "custom_new")!;
                const Icon = matchedPreset.icon || PlugZap;
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
                    {/* Card Header */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-2.5 rounded-xl ${matchedPreset.bgColor || 'bg-indigo-50'} ${matchedPreset.borderColor || 'border-indigo-200'} border shrink-0`}>
                            <Icon className={`h-5 w-5 ${matchedPreset.color || 'text-indigo-600'}`} />
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

                      {/* Key-Value Fields */}
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
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Service Presets Carousel / Badges (Only in Add Mode) */}
            {!editingId && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Service Template or Custom Name
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-600">
                    Can't find your service? Click Custom Service
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/60 scrollbar-thin">
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
                            : preset.id === "custom_new"
                            ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
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
                  Service / Credential Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. Algolia Search / WhatsApp"
                  required
                  className="text-xs h-9 rounded-xl font-bold text-slate-900"
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
                <span className="text-[10px] text-slate-400">Fill in keys, tokens, endpoints or secrets</span>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto p-2.5 border border-slate-200 rounded-xl bg-slate-50/40">
                {formFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-1/3 min-w-[120px]">
                      <span className="text-[11px] font-bold text-slate-700 truncate block" title={field.label}>
                        {field.label}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 truncate block">
                        {field.key}
                      </span>
                    </div>
                    <div className="flex-1 relative">
                      <Input
                        type="text"
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
                    placeholder="Custom key (e.g. webhook_secret)"
                    className="w-1/3 text-xs h-8 rounded-lg"
                  />
                  <Input
                    type="text"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    placeholder="Value (e.g. whsec_12345)"
                    className="flex-1 text-xs h-8 rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomField}
                    className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer shrink-0"
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

      {/* ========================================================================= */}
      {/* AUTOMATIC .ENV FILE / TEXT IMPORT MODAL                                   */}
      {/* ========================================================================= */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl p-6 bg-white shadow-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FileUp className="h-5 w-5 text-indigo-600" />
              <span>Auto-Import Credentials from .env Configuration</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Paste `.env` configuration file text or upload a `.env` file. Our parser will auto-detect WhatsApp, Cloudinary, Razorpay, S3, Firebase, and custom API keys.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Target Project & Environment Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Import to Project <span className="text-rose-500">*</span>
                </label>
                <select
                  value={importProjectId}
                  onChange={(e) => setImportProjectId(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-10"
                >
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Environment
                </label>
                <select
                  value={importEnvironment}
                  onChange={(e) => setImportEnvironment(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-10"
                >
                  <option value="Production">Production (Live)</option>
                  <option value="Staging">Staging (Sandbox)</option>
                  <option value="Development">Development (Local)</option>
                </select>
              </div>
            </div>

            {/* File Upload & Paste Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Paste .env Text or Upload File
                </label>

                <label className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition">
                  <Upload className="h-3.5 w-3.5" /> Upload .env File
                  <input
                    type="file"
                    accept=".env,.env.*,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                value={rawEnvText}
                onChange={(e) => {
                  setRawEnvText(e.target.value);
                  parseAndGroupEnvText(e.target.value);
                }}
                placeholder={`# Example .env File Content:\nWHATSAPP_PHONE_NUMBER_ID=104829104829104\nWHATSAPP_ACCESS_TOKEN=EAAG...\nCLOUDINARY_CLOUD_NAME=unitglo_assets\nCLOUDINARY_API_KEY=9284019284\nCLOUDINARY_API_SECRET=aBcdEfGhIjKl...\nRAZORPAY_KEY_ID=rzp_live_...\nRAZORPAY_KEY_SECRET=abc123def456`}
                rows={6}
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-950 text-emerald-400 placeholder:text-slate-600 resize-none leading-relaxed"
              />
            </div>

            {/* Detected Services Preview List */}
            {parsedEnvServices.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Detected Services ({parsedEnvServices.length}):
                  </span>
                  <span className="text-[11px] font-bold text-indigo-700">
                    Uncheck any service you wish to exclude
                  </span>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/70 scrollbar-thin">
                  {parsedEnvServices.map((service, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition ${
                        service.selected
                          ? "bg-white border-indigo-200 shadow-2xs"
                          : "bg-slate-100/60 border-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={service.selected}
                            onChange={(e) => {
                              const copy = [...parsedEnvServices];
                              copy[idx].selected = e.target.checked;
                              setParsedEnvServices(copy);
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={service.serviceName}
                            onChange={(e) => {
                              const copy = [...parsedEnvServices];
                              copy[idx].serviceName = e.target.value;
                              setParsedEnvServices(copy);
                            }}
                            className="font-extrabold text-xs text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-indigo-500 px-0.5"
                          />
                          <Badge variant="outline" className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                            {service.category}
                          </Badge>
                        </label>

                        <span className="text-[10px] font-bold text-slate-500">
                          {Object.keys(service.credentialsData).length} key(s) detected
                        </span>
                      </div>

                      {/* Display Key Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-slate-100">
                        {Object.entries(service.credentialsData).map(([k, v]) => (
                          <span key={k} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                            {k}: <span className="text-slate-900 font-bold">{v.length > 15 ? v.substring(0, 15) + "..." : v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportModalOpen(false)}
                className="h-9 text-xs font-semibold text-slate-600 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isImporting || parsedEnvServices.filter((s) => s.selected).length === 0}
                onClick={handleConfirmImport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isImporting ? "Importing..." : `Save (${parsedEnvServices.filter((s) => s.selected).length}) Services`}
              </Button>
            </div>
          </div>
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
