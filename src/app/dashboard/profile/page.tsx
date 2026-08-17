"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess, showToast } from "@/lib/swal";
import { 
  User, 
  Camera, 
  Calendar, 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  Award, 
  Phone, 
  Mail, 
  Save, 
  Sparkles 
} from "lucide-react";
import { getRoleDisplayName, getRoleBadgeClass, getRoleIconEmoji } from "@/lib/roleUtils";
import { formatHoursAndMinutes } from "@/lib/timeUtils";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Editable Form fields
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [joiningDate, setJoiningDate] = useState("2024-01-15");
  const [avatarUrl, setAvatarUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.user) {
        setProfile(data.user);
        setStats(data.stats);
        setName(data.user.name || "");
        setBio(data.user.bio || "");
        setPhone(data.user.phone || "");
        setAvatarUrl(data.user.avatar_url || "");
        if (data.user.joining_date) {
          setJoiningDate(new Date(data.user.joining_date).toISOString().split("T")[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "unitglo_avatars");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setAvatarUrl(data.url);
        // Automatically save avatar in profile
        await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar_url: data.url }),
        });
        setFeedback("Profile photo updated successfully!");
        showToast("Profile photo updated!");
      } else {
        showError("Upload Failed", data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      showError("Upload Error", "Error uploading photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio,
          phone,
          joining_date: joiningDate,
          avatar_url: avatarUrl,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback("✓ Profile details saved successfully!");
        fetchProfile();
        showToast("Profile saved successfully!");
      } else {
        showError("Failed to update profile", data.error || "Unknown server error");
      }
    } catch (err: any) {
      console.error(err);
      showError("Error saving profile", err.message || "Network error");
    } finally {
      setSaving(false);
    }
  };

  // Calculate Company Tenure
  const calculateTenure = (joinDateStr: string) => {
    if (!joinDateStr) return "1 Year at Unitglo Solutions";
    const start = new Date(joinDateStr);
    const now = new Date();

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    if (years === 0 && months === 0) return "Just Joined This Month";
    if (years === 0) return `${months} Month${months > 1 ? "s" : ""} at Unitglo Solutions`;
    if (months === 0) return `${years} Year${years > 1 ? "s" : ""} at Unitglo Solutions`;
    return `${years} Year${years > 1 ? "s" : ""}, ${months} Month${months > 1 ? "s" : ""} at Unitglo Solutions`;
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading profile...</div>;
  }

  const userRole = profile?.role || "Developer";
  const tenureText = calculateTenure(joiningDate);
  const joiningYear = joiningDate ? new Date(joiningDate).getFullYear() : 2024;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <User className="h-8 w-8 text-sky-500" />
          Employee Profile & Tenure
        </h1>
        <p className="text-slate-500 mt-1">Manage your personal details, profile avatar photo, and view company journey stats.</p>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {feedback}
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        {/* Avatar Upload Container */}
        <div className="relative group">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-slate-100 shadow-md bg-sky-50 flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-14 h-14 text-sky-400" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 p-2 bg-slate-900 hover:bg-sky-600 text-white rounded-full shadow-lg transition-colors"
            title="Upload Profile Photo"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        {/* User Identity & Tenure Overview */}
        <div className="space-y-1.5 text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900">{profile?.name || "Employee"}</h2>
            <Badge className={`${getRoleBadgeClass(userRole)} px-2.5 py-0.5 text-xs font-bold w-fit mx-auto sm:mx-0`}>
              {getRoleIconEmoji(userRole)} {getRoleDisplayName(userRole)}
            </Badge>
          </div>

          <div className="text-sm text-slate-500 flex items-center justify-center sm:justify-start gap-1.5">
            <Mail className="h-3.5 w-3.5" /> {profile?.email}
          </div>

          {/* Company Tenure Badge */}
          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold">
              <Award className="h-3.5 w-3.5 text-indigo-600" />
              {tenureText}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              (Member Since {joiningYear})
            </span>
          </div>
        </div>
      </div>

      {/* Activity Statistics Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <span className="text-xs font-bold text-slate-500 uppercase">Attendance Days</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats?.attendanceDays || 0} Days</div>
          <span className="text-[11px] text-slate-400">Total verified shifts</span>
        </div>

        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/60">
          <span className="text-xs font-bold text-sky-700 uppercase">Work Hours Logged</span>
          <div className="text-2xl font-black text-sky-900 mt-1">{formatHoursAndMinutes(stats?.workHours)}</div>
          <span className="text-[11px] text-sky-600 font-medium">In Daily Work Hub</span>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60">
          <span className="text-xs font-bold text-emerald-700 uppercase">Completed Tasks</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{stats?.completedTasks || 0} Tasks</div>
          <span className="text-[11px] text-emerald-600 font-medium">Passed QA audit</span>
        </div>

        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60">
          <span className="text-xs font-bold text-indigo-700 uppercase">Company Tenure</span>
          <div className="text-2xl font-black text-indigo-900 mt-1">{joiningYear}</div>
          <span className="text-[11px] text-indigo-600 font-medium">Year of Joining</span>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-sky-500" /> Edit Profile Details & Activities
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profName" className="font-semibold text-slate-700">Display Name</Label>
              <Input
                id="profName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profPhone" className="font-semibold text-slate-700">Contact Number</Label>
              <Input
                id="profPhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profJoin" className="font-semibold text-slate-700">Joining Date</Label>
              <Input
                id="profJoin"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
              <p className="text-[11px] text-slate-400">Used to compute your official company tenure & anniversary</p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-slate-700">Account Role</Label>
              <Input value={profile?.role || "Developer"} disabled className="bg-slate-100 font-semibold" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profBio" className="font-semibold text-slate-700">Professional Bio & Specialties</Label>
            <textarea
              id="profBio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Full stack engineer specializing in React, Next.js, MySQL, Cloud architecture..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 shadow-md flex items-center gap-2"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Profile Details"}
          </Button>
        </form>
      </div>
    </div>
  );
}
