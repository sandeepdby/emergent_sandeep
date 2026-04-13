import React, { useState } from "react";
import axios from "axios";
import { API, getAuthHeaders } from "../auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, LogOut, KeyRound, Loader2 } from "lucide-react";

export default function UserProfileMenu({ user, onLogout }) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      }, { headers: getAuthHeaders() });
      toast.success("Password changed successfully");
      setShowChangePassword(false);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          data-testid="user-profile-btn"
        >
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.full_name}</span>
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1" data-testid="profile-dropdown">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
              <p className="text-[10px] text-gray-400 uppercase">{user?.role}</p>
            </div>
            <button
              onClick={() => { setMenuOpen(false); setShowChangePassword(true); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="change-password-btn"
            >
              <KeyRound className="w-4 h-4 text-gray-400" />
              Change Password
            </button>
            <button
              onClick={() => { setMenuOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
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
