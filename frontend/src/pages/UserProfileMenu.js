import React, { useState, useRef } from "react";
import axios from "axios";
import { API, getAuthHeaders } from "../auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, LogOut, KeyRound, Loader2, Camera } from "lucide-react";

export default function UserProfileMenu({ user, onLogout }) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(user?.profile_photo || null);
  const fileRef = useRef(null);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/auth/change-password`, { current_password: currentPassword, new_password: newPassword }, { headers: getAuthHeaders() });
      toast.success("Password changed successfully");
      setShowChangePassword(false);
      resetForm();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to change password"); }
    finally { setSaving(false); }
  };

  const resetForm = () => { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/auth/profile-photo`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
      });
      setPhotoUrl(res.data.profile_photo);
      toast.success("Profile photo updated!");
    } catch (err) { toast.error(err.response?.data?.detail || "Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const initials = (user?.full_name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          data-testid="user-profile-btn"
        >
          {photoUrl ? (
            <img src={photoUrl} alt={user?.full_name} className="w-8 h-8 rounded-full object-cover border-2 border-stone-200" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E05A47] to-orange-400 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          )}
          <span className="text-sm font-medium text-stone-700 hidden sm:block">{user?.full_name}</span>
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-stone-200 z-50 overflow-hidden" data-testid="profile-dropdown">
            {/* Profile Header */}
            <div className="px-4 py-4 bg-gradient-to-br from-stone-50 to-stone-100 border-b border-stone-200">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  {photoUrl ? (
                    <img src={photoUrl} alt={user?.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E05A47] to-orange-400 flex items-center justify-center text-white text-base font-bold shadow-sm">
                      {initials}
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" data-testid="profile-photo-input" />
                  <button
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-white border border-stone-200 rounded-full flex items-center justify-center shadow-sm hover:bg-stone-50 transition-colors"
                    disabled={uploading}
                    data-testid="upload-photo-btn"
                  >
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin text-stone-400" /> : <Camera className="w-3 h-3 text-stone-500" />}
                  </button>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-800 truncate">{user?.full_name}</p>
                  <p className="text-xs text-stone-500 truncate">{user?.email}</p>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#E05A47]/10 text-[#E05A47] mt-0.5">{user?.role}</span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={() => { setMenuOpen(false); setShowChangePassword(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                data-testid="change-password-btn"
              >
                <KeyRound className="w-4 h-4 text-stone-400" />
                Change Password
              </button>
              <button
                onClick={() => { setMenuOpen(false); onLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </>
      )}

      <Dialog open={showChangePassword} onOpenChange={(open) => { setShowChangePassword(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Current Password</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" data-testid="current-password-input" />
            </div>
            <div>
              <Label className="text-xs">New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" data-testid="new-password-input" />
            </div>
            <div>
              <Label className="text-xs">Confirm New Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" data-testid="confirm-password-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowChangePassword(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={saving || !currentPassword || !newPassword} data-testid="save-password-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
