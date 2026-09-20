import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Trash2, Loader2, Users, ShieldCheck, User, ArrowUpCircle, KeyRound, Pencil, AlertTriangle } from "lucide-react";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: "", password: "", full_name: "", email: "", phone: "", role: "HR",
  });
  const [resetUser, setResetUser] = useState(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetting, setResetting] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ full_name: u.full_name || "", email: u.email || "", phone: u.phone || "" });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(`${API}/users/${editUser.id}`, editForm, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Updated ${editUser.username}`);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (resetPwd.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setResetting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/reset-password`, { user_id: resetUser.id, new_password: resetPwd }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Password reset for ${resetUser.username}`);
      setResetUser(null);
      setResetPwd("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!resetUser?.email) { toast.error("This user has no email on file"); return; }
    setResetting(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: resetUser.email });
      toast.success(`Reset code emailed to ${resetUser.email}`);
      setResetUser(null);
      setResetPwd("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send reset link");
    } finally {
      setResetting(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.full_name || !formData.email) {
      toast.error("Username, password, full name and email are required");
      return;
    }
    setCreating(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/users/create`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`${formData.role} user "${formData.username}" created`);
      setFormData({ username: "", password: "", full_name: "", email: "", phone: "", role: "HR" });
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`User "${username}" deleted`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete user");
    }
  };

  const handlePromote = async (userId, username) => {
    if (!window.confirm(`Promote "${username}" to Admin? This grants full admin access.`)) return;
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/users/${userId}/promote`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`"${username}" promoted to Admin`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to promote user");
    }
  };

  const admins = users.filter(u => u.role === "Admin");
  const hrs = users.filter(u => u.role === "HR");
  const missingPhone = users.filter(u => !u.phone);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="user-management-page">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-200" />
            <div><p className="text-xs text-gray-500">Total Users</p><p className="text-2xl font-bold">{users.length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-200" />
            <div><p className="text-xs text-gray-500">Admins</p><p className="text-2xl font-bold text-indigo-600">{admins.length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center gap-3">
            <User className="w-8 h-8 text-emerald-200" />
            <div><p className="text-xs text-gray-500">HR Users</p><p className="text-2xl font-bold text-emerald-600">{hrs.length}</p></div>
          </CardContent>
        </Card>
      </div>

      {missingPhone.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50" data-testid="missing-phone-banner">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>{missingPhone.length}</strong> account{missingPhone.length > 1 ? "s are" : " is"} missing a phone number — SMS & WhatsApp alerts won't reach {missingPhone.length > 1 ? "them" : "them"}. Add numbers via the edit (pencil) action: {missingPhone.slice(0, 6).map(u => u.username).join(", ")}{missingPhone.length > 6 ? "…" : ""}.
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Create and manage Admin & HR user accounts. One email per login.</CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)} data-testid="create-user-btn">
            <UserPlus className="w-4 h-4 mr-2" /> Create User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table data-testid="users-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                    <TableCell className="font-mono text-sm">{u.username}</TableCell>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm">
                      {u.phone ? u.phone : <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">No phone</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={u.role === "Admin" ? "default" : "secondary"}>{u.role}</Badge>
                        {u.is_master_admin && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">Master</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800" data-testid={`edit-user-${u.id}`} title="Edit user">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setResetUser(u); setResetPwd(""); }} className="text-amber-600 hover:text-amber-800" data-testid={`reset-pwd-${u.id}`} title="Reset Password">
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        {u.role === "HR" && (
                          <Button variant="ghost" size="sm" onClick={() => handlePromote(u.id, u.username)} className="text-indigo-600 hover:text-indigo-800" data-testid={`promote-user-${u.id}`} title="Promote to Admin">
                            <ArrowUpCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {!u.is_master_admin && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id, u.username)} className="text-red-500 hover:text-red-700" data-testid={`delete-user-${u.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Username *</Label>
                <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required data-testid="new-username" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password *</Label>
                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required data-testid="new-password" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Full Name *</Label>
              <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required data-testid="new-fullname" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email * (unique per account)</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required data-testid="new-email" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} data-testid="new-phone" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role *</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger data-testid="new-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HR">HR User</SelectItem>
                    <SelectItem value="Admin">Admin User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating} data-testid="confirm-create-user">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(open) => { if (!open) { setResetUser(null); setResetPwd(""); } }}>
        <DialogContent className="max-w-md" data-testid="reset-password-dialog">
          <DialogHeader>
            <DialogTitle>Reset Password{resetUser ? ` — ${resetUser.full_name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              User: <span className="font-mono">{resetUser?.username}</span>
              {resetUser?.email ? <> · {resetUser.email}</> : null}
            </p>

            <div className="space-y-2 p-3 rounded-lg border">
              <Label className="text-xs font-semibold">Option 1 — Set a new password directly</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  data-testid="reset-new-password-input"
                />
                <Button onClick={handleResetPassword} disabled={resetting || resetPwd.length < 6} className="bg-[#E05A47] hover:bg-[#c94a38] whitespace-nowrap" data-testid="reset-set-password-btn">
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Password"}
                </Button>
              </div>
            </div>

            <div className="space-y-2 p-3 rounded-lg border">
              <Label className="text-xs font-semibold">Option 2 — Email a reset link to the user</Label>
              <Button variant="outline" onClick={handleSendResetLink} disabled={resetting || !resetUser?.email} className="w-full" data-testid="reset-send-link-btn">
                {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Send reset code to {resetUser?.email || "email"}
              </Button>
              <p className="text-[11px] text-amber-600">The emailed reset code is valid for 1 hour — let the user know to use it promptly.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetUser(null); setResetPwd(""); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="max-w-md" data-testid="edit-user-dialog">
          <DialogHeader>
            <DialogTitle>Edit User{editUser ? ` — ${editUser.username}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} data-testid="edit-fullname-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="user@company.com" data-testid="edit-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (for SMS & WhatsApp)</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+91 98765 43210" data-testid="edit-phone-input" />
              <p className="text-[11px] text-gray-400">10-digit numbers default to +91. Required for SMS/WhatsApp alerts.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="bg-[#E05A47] hover:bg-[#c94a38]" data-testid="edit-save-btn">
              {savingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
