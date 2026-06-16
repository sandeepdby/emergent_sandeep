import React, { useState, useEffect, useCallback, useContext } from "react";
import axios from "axios";
import { API, AuthContext } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Wallet, TrendingUp, TrendingDown, RefreshCw, Eye, Pencil } from "lucide-react";

export default function CDLedger() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "Admin";
  const [entries, setEntries] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState("all");
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    reference: "", description: "", amount: "", policy_number: "",
  });

  // View/Edit dialog
  const [viewEntry, setViewEntry] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [editForm, setEditForm] = useState({ date: "", reference: "", description: "", amount: "", policy_number: "" });
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/policies`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      setPolicies(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchLedger = useCallback(async () => {
    try {
      let url = `${API}/cd-ledger`;
      if (selectedPolicy && selectedPolicy !== "all") url += `?policy_number=${encodeURIComponent(selectedPolicy)}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      setEntries(res.data.entries || []);
      setTotalBalance(res.data.total_balance || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedPolicy]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);
  useEffect(() => { setLoading(true); fetchLedger(); }, [fetchLedger]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.reference || !formData.amount) { toast.error("Reference and Amount are required"); return; }
    setAdding(true);
    try {
      await axios.post(`${API}/cd-ledger`, { ...formData, amount: parseFloat(formData.amount), policy_number: formData.policy_number || null }, { headers });
      toast.success("CD Ledger entry added");
      setFormData({ date: new Date().toISOString().split("T")[0], reference: "", description: "", amount: "", policy_number: "" });
      setShowForm(false);
      fetchLedger();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to add entry"); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await axios.delete(`${API}/cd-ledger/${id}`, { headers });
      toast.success("Entry deleted");
      fetchLedger();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to delete"); }
  };

  const openView = (entry) => { setViewEntry(entry); };
  const openEdit = (entry) => {
    setEditEntry(entry);
    setEditForm({
      date: entry.date || "", reference: entry.reference || "",
      description: entry.description || "", amount: entry.amount || 0,
      policy_number: entry.policy_number || "",
    });
  };

  const handleEdit = async () => {
    if (!editForm.reference || !editForm.amount) { toast.error("Reference and Amount are required"); return; }
    setSaving(true);
    try {
      await axios.put(`${API}/cd-ledger/${editEntry.id}`, {
        ...editForm, amount: parseFloat(editForm.amount), policy_number: editForm.policy_number || null,
      }, { headers });
      toast.success("Entry updated");
      setEditEntry(null);
      fetchLedger();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to update"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#E05A47]" /></div>;

  const totalDeposits = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalDeductions = Math.abs(entries.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0));
  const fmtAmt = (v) => `₹${(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6" data-testid="cd-ledger-page">
      {/* Policy Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium whitespace-nowrap">Filter by Policy:</Label>
          <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
            <SelectTrigger className="w-[260px]" data-testid="cd-policy-filter"><SelectValue placeholder="All Policies" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Policies</SelectItem>
              {policies.map((p) => <SelectItem key={p.id} value={p.policy_number}>{p.policy_number} — {p.policy_holder_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`border-l-4 ${totalBalance >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-500 font-medium">CD Balance{selectedPolicy !== "all" ? ` (${selectedPolicy})` : ""}</p>
                <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{totalBalance >= 0 ? '+' : ''}{fmtAmt(totalBalance)}</p>
              </div>
              <Wallet className={`w-10 h-10 ${totalBalance >= 0 ? 'text-emerald-200' : 'text-red-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-stone-500 font-medium">Total Deposits</p><p className="text-2xl font-bold text-blue-600">{fmtAmt(totalDeposits)}</p></div>
              <TrendingUp className="w-10 h-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-stone-500 font-medium">Total Deductions</p><p className="text-2xl font-bold text-amber-600">{fmtAmt(totalDeductions)}</p></div>
              <TrendingDown className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">CD Ledger Statement</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLedger} data-testid="refresh-ledger-btn"><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
            {isAdmin && <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-[#E05A47] hover:bg-[#C94837]" data-testid="add-entry-btn"><Plus className="w-4 h-4 mr-1" /> Add Deposit / Entry</Button>}
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="border-b bg-stone-50 pb-4">
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="space-y-1"><Label className="text-xs">Date *</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required data-testid="cd-date-input" /></div>
              <div className="space-y-1"><Label className="text-xs">Reference *</Label><Input placeholder="e.g. NEFT-123" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} required data-testid="cd-reference-input" /></div>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input placeholder="Cash deposit" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} data-testid="cd-description-input" /></div>
              <div className="space-y-1">
                <Label className="text-xs">Policy</Label>
                <Select value={formData.policy_number || "none"} onValueChange={(v) => setFormData({ ...formData, policy_number: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="cd-policy-select"><SelectValue placeholder="Select Policy" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No Policy</SelectItem>{policies.map((p) => <SelectItem key={p.id} value={p.policy_number}>{p.policy_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Amount (₹) *</Label><Input type="number" step="0.01" placeholder="+5000 or -1000" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required data-testid="cd-amount-input" /></div>
              <Button type="submit" disabled={adding} className="bg-[#E05A47] hover:bg-[#C94837]" data-testid="cd-submit-btn">{adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Entry"}</Button>
            </form>
          </CardContent>
        )}

        <CardContent className="pt-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <Wallet className="w-12 h-12 mx-auto mb-3 text-stone-300" />
              <p className="font-medium">No CD Ledger entries{selectedPolicy !== "all" ? ` for ${selectedPolicy}` : ""}</p>
              <p className="text-sm mt-1">Click "Add Deposit / Entry" to start tracking</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="cd-ledger-table">
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Reference</TableHead>
                    <TableHead className="text-xs font-semibold">Description</TableHead>
                    <TableHead className="text-xs font-semibold">Policy</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                    {isAdmin && <TableHead className="text-xs font-semibold text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-stone-50/50 transition-colors" data-testid={`cd-row-${entry.id}`}>
                      <TableCell className="whitespace-nowrap text-xs">{entry.date}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.reference}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">{entry.description || "—"}</TableCell>
                      <TableCell className="text-xs">{entry.policy_number || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={entry.entry_type === "Manual" ? "secondary" : entry.entry_type === "Refund Credit" ? "default" : "destructive"} className="text-[10px]">
                          {entry.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right text-xs font-medium ${entry.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {entry.amount >= 0 ? '+' : ''}{fmtAmt(entry.amount)}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-bold ${entry.running_balance >= 0 ? 'text-stone-800' : 'text-red-600'}`}>
                        {fmtAmt(entry.running_balance)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openView(entry)} title="View" data-testid={`cd-view-${entry.id}`}>
                              <Eye className="w-3.5 h-3.5 text-stone-500" />
                            </Button>
                            {entry.entry_type === "Manual" ? (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEdit(entry)} title="Edit" data-testid={`cd-edit-${entry.id}`}>
                                  <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)} title="Delete" className="text-red-500 hover:text-red-700" data-testid={`cd-delete-${entry.id}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-[10px] text-stone-400 px-2">Auto</span>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewEntry} onOpenChange={(open) => { if (!open) setViewEntry(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CD Ledger Entry Details</DialogTitle>
            <DialogDescription>View full details of this entry.</DialogDescription>
          </DialogHeader>
          {viewEntry && (
            <div className="space-y-3" data-testid="cd-view-dialog">
              <DetailRow label="Date" value={viewEntry.date} />
              <DetailRow label="Reference" value={viewEntry.reference} />
              <DetailRow label="Description" value={viewEntry.description || "—"} />
              <DetailRow label="Policy" value={viewEntry.policy_number || "—"} />
              <DetailRow label="Type" value={viewEntry.entry_type} />
              <DetailRow label="Amount" value={`${viewEntry.amount >= 0 ? '+' : ''}${fmtAmt(viewEntry.amount)}`} highlight={viewEntry.amount >= 0 ? "emerald" : "red"} />
              <DetailRow label="Running Balance" value={fmtAmt(viewEntry.running_balance)} />
              {viewEntry.endorsement_id && <DetailRow label="Endorsement ID" value={viewEntry.endorsement_id} />}
              <DetailRow label="Created By" value={viewEntry.created_by_name || "—"} />
              <DetailRow label="Created At" value={viewEntry.created_at ? new Date(viewEntry.created_at).toLocaleString() : "—"} />
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewEntry(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit CD Ledger Entry</DialogTitle>
            <DialogDescription>Modify the entry details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3" data-testid="cd-edit-dialog">
            <div><Label className="text-xs">Date *</Label><Input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} data-testid="cd-edit-date" /></div>
            <div><Label className="text-xs">Reference *</Label><Input value={editForm.reference} onChange={e => setEditForm({ ...editForm, reference: e.target.value })} data-testid="cd-edit-reference" /></div>
            <div><Label className="text-xs">Description</Label><Input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} data-testid="cd-edit-description" /></div>
            <div>
              <Label className="text-xs">Policy</Label>
              <Select value={editForm.policy_number || "none"} onValueChange={v => setEditForm({ ...editForm, policy_number: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="cd-edit-policy"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No Policy</SelectItem>{policies.map(p => <SelectItem key={p.id} value={p.policy_number}>{p.policy_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Amount (₹) *</Label><Input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} data-testid="cd-edit-amount" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving} className="bg-[#E05A47] hover:bg-[#C94837]" data-testid="cd-edit-save">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  const color = highlight === "emerald" ? "text-emerald-600" : highlight === "red" ? "text-red-600" : "text-stone-800";
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-stone-100 last:border-0">
      <span className="text-xs text-stone-500">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
  );
}
