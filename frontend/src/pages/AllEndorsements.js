import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Edit, Trash2, Loader2, Filter, X, Eye, CheckCircle2, XCircle, CheckCheck } from "lucide-react";

const hdrs = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const REL_COLORS = {
  Employee: "bg-blue-100 text-blue-800", Spouse: "bg-pink-100 text-pink-800",
  Kids: "bg-green-100 text-green-800", Kids1: "bg-green-100 text-green-800",
  Kids2: "bg-teal-100 text-teal-800", Mother: "bg-purple-100 text-purple-800",
  Father: "bg-orange-100 text-orange-800",
};

/* ─── Sub: Endorsement Table Row ─── */
function EndorsementRow({ e, selected, onToggle, onView, onEdit, onDelete }) {
  const isPending = e.status === "Pending";
  return (
    <TableRow key={e.id} data-testid={`endorsement-row-${e.id}`} className={selected ? "bg-blue-50/50" : ""}>
      <TableCell className="w-10">
        {isPending ? (
          <Checkbox checked={selected} onCheckedChange={() => onToggle(e.id)} data-testid={`select-endorsement-${e.id}`} />
        ) : <div className="w-4" />}
      </TableCell>
      <TableCell className="font-medium text-xs">{e.policy_number}</TableCell>
      <TableCell className="text-xs">{e.employee_id || "-"}</TableCell>
      <TableCell className="text-xs">{e.member_name}</TableCell>
      <TableCell><Badge className={`text-[10px] ${REL_COLORS[e.relationship_type] || "bg-gray-100 text-gray-800"}`}>{e.relationship_type}</Badge></TableCell>
      <TableCell>
        <Badge variant={e.endorsement_type === "Addition" || e.endorsement_type === "Midterm addition" ? "default" : e.endorsement_type === "Deletion" ? "destructive" : "secondary"} className="text-[10px]">
          {e.endorsement_type}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={e.status === "Approved" ? "default" : e.status === "Rejected" ? "destructive" : "secondary"} className="text-[10px]">
          {e.status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs">{e.sum_insured ? `₹${e.sum_insured.toLocaleString()}` : "-"}</TableCell>
      <TableCell className="text-xs">{new Date(e.endorsement_date).toLocaleDateString()}</TableCell>
      <TableCell className="text-xs text-gray-600">₹{e.annual_premium_per_life?.toLocaleString() || "—"}</TableCell>
      <TableCell className={`text-xs font-semibold ${(e.prorata_premium || 0) < 0 ? "text-red-600" : "text-green-600"}`}>
        {(e.prorata_premium || 0) < 0 ? `₹${Math.abs(e.prorata_premium).toLocaleString()} (Refund)` : `₹${(e.prorata_premium || 0).toLocaleString()}`}
      </TableCell>
      <TableCell className="text-right space-x-0.5">
        <Button variant="ghost" size="sm" onClick={() => onView(e)} data-testid={`view-endorsement-${e.id}`}><Eye className="w-4 h-4 text-blue-600" /></Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(e)} data-testid={`edit-endorsement-${e.id}`}><Edit className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(e.id)} data-testid={`delete-endorsement-${e.id}`}><Trash2 className="w-4 h-4 text-red-600" /></Button>
      </TableCell>
    </TableRow>
  );
}

/* ─── Sub: Batch Action Bar ─── */
function BatchActionBar({ count, onApprove, onReject, onClear }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg" data-testid="batch-action-bar">
      <CheckCheck className="w-4 h-4 text-blue-600" />
      <span className="text-sm font-medium text-blue-800">{count} pending endorsement{count !== 1 ? "s" : ""} selected</span>
      <div className="flex-1" />
      <Button size="sm" onClick={onApprove} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" data-testid="batch-approve-btn">
        <CheckCircle2 className="w-3.5 h-3.5" /> Approve All
      </Button>
      <Button size="sm" variant="destructive" onClick={onReject} className="gap-1.5" data-testid="batch-reject-btn">
        <XCircle className="w-3.5 h-3.5" /> Reject All
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear} className="text-stone-500">Clear</Button>
    </div>
  );
}

/* ─── MAIN ─── */
const EndorsementsPage = () => {
  const [endorsements, setEndorsements] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewEndorsement, setViewEndorsement] = useState(null);
  const [editingEndorsement, setEditingEndorsement] = useState(null);
  const [filters, setFilters] = useState({ policy_number: "all", relationship_type: "all", status: "all" });
  const [stats, setStats] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchAction, setBatchAction] = useState("Approved");
  const [batchRemarks, setBatchRemarks] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");

  const [formData, setFormData] = useState({
    policy_number: "", member_name: "", relationship_type: "", endorsement_type: "",
    endorsement_date: "", effective_date: "", annual_premium_per_life: "", prorata_premium: "", per_life_premium: "",
  });

  useEffect(() => {
    fetchPolicies();
    fetchEndorsements();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPolicies = async () => {
    try { const r = await axios.get(`${API}/policies`, { headers: hdrs() }); setPolicies(r.data); } catch {}
  };

  const fetchEndorsements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.policy_number && filters.policy_number !== "all") params.append("policy_number", filters.policy_number);
      if (filters.relationship_type && filters.relationship_type !== "all") params.append("relationship_type", filters.relationship_type);
      const url = params.toString() ? `${API}/endorsements?${params}` : `${API}/endorsements`;
      const r = await axios.get(url, { headers: hdrs() });
      setEndorsements(r.data);
      setSelectedIds(new Set());
    } catch { toast.error("Failed to fetch endorsements"); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try { const r = await axios.get(`${API}/endorsements/stats/summary`, { headers: hdrs() }); setStats(r.data); } catch {}
  };

  // Client-side status filter
  const displayed = useMemo(() => {
    if (filters.status === "all") return endorsements;
    return endorsements.filter(e => e.status === filters.status);
  }, [endorsements, filters.status]);

  const pendingIds = useMemo(() => displayed.filter(e => e.status === "Pending").map(e => e.id), [displayed]);
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every(id => selectedIds.has(id));

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const openBatchDialog = (action) => {
    setBatchAction(action);
    setBatchRemarks("");
    setBatchDialogOpen(true);
  };

  const executeBatch = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const r = await axios.post(`${API}/endorsements/bulk-approve`, {
        endorsement_ids: [...selectedIds],
        status: batchAction,
        remarks: batchRemarks || null,
      }, { headers: hdrs() });
      const d = r.data;
      if (batchAction === "Approved") {
        toast.success(`${d.success_count} endorsement${d.success_count !== 1 ? "s" : ""} approved`);
      } else {
        toast.success(`${d.success_count} endorsement${d.success_count !== 1 ? "s" : ""} rejected`);
      }
      if (d.failed_count > 0) toast.warning(`${d.failed_count} failed`);
      // Offer WhatsApp share
      const msg = encodeURIComponent(
        `*InsureHub — Endorsements ${batchAction}*\n\n` +
        `${d.success_count} endorsement(s) ${batchAction.toLowerCase()} by Admin.\n` +
        (batchRemarks ? `Remarks: ${batchRemarks}\n` : '') +
        `\nPlease review in the portal.`
      );
      setWhatsappMsg(msg);
      setWhatsappDialogOpen(true);
      setBatchDialogOpen(false);
      setSelectedIds(new Set());
      fetchEndorsements();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Batch operation failed");
    } finally { setBatchLoading(false); }
  };

  const handleFilterChange = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const applyFilters = () => fetchEndorsements();
  const clearFilters = () => { setFilters({ policy_number: "all", relationship_type: "all", status: "all" }); setTimeout(() => fetchEndorsements(), 100); };

  const handleEdit = (endorsement) => {
    setEditingEndorsement(endorsement);
    setFormData({
      policy_number: endorsement.policy_number, member_name: endorsement.member_name,
      relationship_type: endorsement.relationship_type, endorsement_type: endorsement.endorsement_type,
      endorsement_date: endorsement.endorsement_date, effective_date: endorsement.effective_date,
      annual_premium_per_life: endorsement.annual_premium_per_life ?? "",
      prorata_premium: endorsement.prorata_premium ?? "", per_life_premium: endorsement.per_life_premium ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEndorsement) {
        const updateData = {
          member_name: formData.member_name, relationship_type: formData.relationship_type,
          endorsement_type: formData.endorsement_type, endorsement_date: formData.endorsement_date,
          effective_date: formData.effective_date || formData.endorsement_date,
        };
        if (formData.annual_premium_per_life !== "" && formData.annual_premium_per_life != null) updateData.annual_premium_per_life = parseFloat(formData.annual_premium_per_life);
        if (formData.prorata_premium !== "" && formData.prorata_premium != null) updateData.prorata_premium = parseFloat(formData.prorata_premium);
        if (formData.per_life_premium !== "" && formData.per_life_premium != null) updateData.per_life_premium = parseFloat(formData.per_life_premium);
        await axios.put(`${API}/endorsements/${editingEndorsement.id}`, updateData, { headers: hdrs() });
        toast.success("Endorsement updated successfully");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchEndorsements();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save endorsement");
    }
  };

  const handleDelete = async (endorsementId) => {
    if (!window.confirm("Are you sure you want to delete this endorsement?")) return;
    try {
      await axios.delete(`${API}/endorsements/${endorsementId}`, { headers: hdrs() });
      toast.success("Endorsement deleted successfully");
      fetchEndorsements();
      fetchStats();
    } catch { toast.error("Failed to delete endorsement"); }
  };

  const resetForm = () => {
    setFormData({ policy_number: "", member_name: "", relationship_type: "", endorsement_type: "", endorsement_date: "", effective_date: "", annual_premium_per_life: "", prorata_premium: "", per_life_premium: "" });
    setEditingEndorsement(null);
  };

  return (
    <div className="space-y-6" data-testid="endorsements-page">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Total Endorsements</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold" data-testid="total-endorsements">{stats.total_endorsements}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Total Policies</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold" data-testid="total-policies">{stats.total_policies}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Additions</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{stats.by_endorsement_type?.find(t => t._id === "Addition")?.count || 0}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Deletions</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{stats.by_endorsement_type?.find(t => t._id === "Deletion")?.count || 0}</div></CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Policy Number</Label>
              <Select value={filters.policy_number} onValueChange={v => handleFilterChange("policy_number", v)}>
                <SelectTrigger data-testid="filter-policy-select"><SelectValue placeholder="All Policies" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Policies</SelectItem>
                  {policies.map(p => <SelectItem key={p.id} value={p.policy_number}>{p.policy_number} - {p.policy_holder_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Relationship Type</Label>
              <Select value={filters.relationship_type} onValueChange={v => handleFilterChange("relationship_type", v)}>
                <SelectTrigger data-testid="filter-relationship-select"><SelectValue placeholder="All Relationships" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Relationships</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Spouse">Spouse</SelectItem>
                  <SelectItem value="Kids">Kids</SelectItem>
                  <SelectItem value="Kids1">Kids1</SelectItem>
                  <SelectItem value="Kids2">Kids2</SelectItem>
                  <SelectItem value="Mother">Mother</SelectItem>
                  <SelectItem value="Father">Father</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={v => handleFilterChange("status", v)}>
                <SelectTrigger data-testid="filter-status-select"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={applyFilters} className="flex-1" data-testid="apply-filters-button"><Filter className="w-4 h-4 mr-2" />Apply</Button>
              <Button onClick={clearFilters} variant="outline" data-testid="clear-filters-button"><X className="w-4 h-4 mr-2" />Clear</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <BatchActionBar
          count={selectedIds.size}
          onApprove={() => openBatchDialog("Approved")}
          onReject={() => openBatchDialog("Rejected")}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* Endorsements Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Endorsements</CardTitle>
              <CardDescription>View and manage policy endorsements</CardDescription>
            </div>
            {pendingIds.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Badge variant="secondary" className="text-xs">{pendingIds.length} pending</Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No endorsements found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      {pendingIds.length > 0 && (
                        <Checkbox
                          checked={allPendingSelected}
                          onCheckedChange={toggleSelectAll}
                          data-testid="select-all-pending"
                          title="Select all pending"
                        />
                      )}
                    </TableHead>
                    <TableHead className="text-xs">Policy</TableHead>
                    <TableHead className="text-xs">Employee ID</TableHead>
                    <TableHead className="text-xs">Member Name</TableHead>
                    <TableHead className="text-xs">Relationship</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Coverage</TableHead>
                    <TableHead className="text-xs">Endorsement Date</TableHead>
                    <TableHead className="text-xs">Annual Premium</TableHead>
                    <TableHead className="text-xs">Pro-rata Premium</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayed.map(e => (
                    <EndorsementRow
                      key={e.id} e={e}
                      selected={selectedIds.has(e.id)}
                      onToggle={toggleSelect}
                      onView={en => { setViewEndorsement(en); setViewDialogOpen(true); }}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={() => { setIsDialogOpen(false); resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Endorsement</DialogTitle>
            <DialogDescription>Update the endorsement details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="member_name">Member Name</Label>
                <Input id="member_name" data-testid="edit-member-name-input" value={formData.member_name} onChange={e => setFormData({ ...formData, member_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="relationship_type">Relationship Type</Label>
                <Select value={formData.relationship_type} onValueChange={v => setFormData({ ...formData, relationship_type: v })}>
                  <SelectTrigger data-testid="edit-relationship-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employee">Employee</SelectItem><SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Kids">Kids</SelectItem><SelectItem value="Kids1">Kids1</SelectItem><SelectItem value="Kids2">Kids2</SelectItem>
                    <SelectItem value="Mother">Mother</SelectItem><SelectItem value="Father">Father</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-2"><Label htmlFor="endorsement_type">Endorsement Type</Label>
                <Select value={formData.endorsement_type} onValueChange={v => setFormData({ ...formData, endorsement_type: v })}>
                  <SelectTrigger data-testid="edit-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Addition">Addition</SelectItem><SelectItem value="Deletion">Deletion</SelectItem>
                    <SelectItem value="Correction">Correction</SelectItem><SelectItem value="Midterm addition">Midterm addition</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-2"><Label htmlFor="endorsement_date">Endorsement Date</Label>
                <Input id="endorsement_date" type="date" data-testid="edit-endorsement-date-input" value={formData.endorsement_date} onChange={e => setFormData({ ...formData, endorsement_date: e.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="effective_date">Effective Date</Label>
                <Input id="effective_date" type="date" data-testid="edit-effective-date-input" value={formData.effective_date} onChange={e => setFormData({ ...formData, effective_date: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="per_life_premium">Per Life Premium (₹)</Label>
                <Input id="per_life_premium" type="number" step="0.01" data-testid="edit-per-life-premium-input" value={formData.per_life_premium} onChange={e => setFormData({ ...formData, per_life_premium: e.target.value })} placeholder="Per life premium" /></div>
              <div className="space-y-2"><Label htmlFor="annual_premium_per_life">Annual Premium / Life (₹)</Label>
                <Input id="annual_premium_per_life" type="number" step="0.01" data-testid="edit-annual-premium-input" value={formData.annual_premium_per_life} onChange={e => setFormData({ ...formData, annual_premium_per_life: e.target.value })} placeholder="Annual premium per life" /></div>
              <div className="space-y-2"><Label htmlFor="prorata_premium">Prorated Premium (₹)</Label>
                <Input id="prorata_premium" type="number" step="0.01" data-testid="edit-prorata-premium-input" value={formData.prorata_premium} onChange={e => setFormData({ ...formData, prorata_premium: e.target.value })} placeholder="Prorated premium amount" />
                <p className="text-xs text-stone-500">Negative for refunds, positive for charges</p></div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" data-testid="save-endorsement-button">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={() => setViewDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Endorsement Details</DialogTitle>
            <DialogDescription>Full details of the selected endorsement</DialogDescription>
          </DialogHeader>
          {viewEndorsement && (
            <div className="grid grid-cols-2 gap-3 text-sm" data-testid="view-endorsement-dialog">
              <div><span className="text-gray-500 block text-xs">Policy Number</span><strong>{viewEndorsement.policy_number}</strong></div>
              <div><span className="text-gray-500 block text-xs">Employee ID</span><strong>{viewEndorsement.employee_id || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Member Name</span><strong>{viewEndorsement.member_name}</strong></div>
              <div><span className="text-gray-500 block text-xs">Relationship</span><strong>{viewEndorsement.relationship_type}</strong></div>
              <div><span className="text-gray-500 block text-xs">Endorsement Type</span><strong>{viewEndorsement.endorsement_type}</strong></div>
              <div><span className="text-gray-500 block text-xs">Status</span><Badge variant={viewEndorsement.status === "Approved" ? "default" : viewEndorsement.status === "Rejected" ? "destructive" : "secondary"}>{viewEndorsement.status}</Badge></div>
              <div><span className="text-gray-500 block text-xs">DOB</span><strong>{viewEndorsement.dob || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Age</span><strong>{viewEndorsement.age || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Gender</span><strong>{viewEndorsement.gender || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Sum Insured</span><strong>{viewEndorsement.sum_insured ? `₹${viewEndorsement.sum_insured.toLocaleString()}` : "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Endorsement Date</span><strong>{viewEndorsement.endorsement_date}</strong></div>
              <div><span className="text-gray-500 block text-xs">Effective Date</span><strong>{viewEndorsement.effective_date}</strong></div>
              <div><span className="text-gray-500 block text-xs">Date of Joining</span><strong>{viewEndorsement.date_of_joining || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Date of Leaving</span><strong>{viewEndorsement.date_of_leaving || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Annual Premium/Life</span><strong>₹{viewEndorsement.annual_premium_per_life?.toLocaleString() || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Pro-rata Premium</span><strong className={(viewEndorsement.prorata_premium || 0) < 0 ? "text-red-600" : "text-green-600"}>₹{viewEndorsement.prorata_premium?.toLocaleString()}</strong></div>
              <div className="col-span-2"><span className="text-gray-500 block text-xs">Remarks</span><strong>{viewEndorsement.remarks || "—"}</strong></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Approve/Reject Confirmation Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={() => setBatchDialogOpen(false)}>
        <DialogContent className="max-w-md" data-testid="batch-confirm-dialog">
          <DialogHeader>
            <DialogTitle className={batchAction === "Approved" ? "text-emerald-700" : "text-red-700"}>
              {batchAction === "Approved" ? "Batch Approve" : "Batch Reject"} Endorsements
            </DialogTitle>
            <DialogDescription>
              You are about to {batchAction === "Approved" ? "approve" : "reject"} <strong>{selectedIds.size}</strong> pending endorsement{selectedIds.size !== 1 ? "s" : ""}.
              {batchAction === "Approved" && " CD Ledger entries will be created for each."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Remarks (optional)</Label>
              <Textarea
                value={batchRemarks}
                onChange={e => setBatchRemarks(e.target.value)}
                placeholder={batchAction === "Approved" ? "e.g. Batch approved after HR verification" : "e.g. Incomplete documentation"}
                rows={3}
                data-testid="batch-remarks-input"
              />
            </div>
            <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
              <p className="font-medium mb-1">This will:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Set status to <strong>{batchAction}</strong> for {selectedIds.size} endorsement{selectedIds.size !== 1 ? "s" : ""}</li>
                {batchAction === "Approved" && <li>Create CD Ledger deduction/credit entries</li>}
                {batchAction === "Approved" && <li>Update policy lives covered counts</li>}
                <li>Send email notifications to submitting HR users</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)} disabled={batchLoading}>Cancel</Button>
            <Button
              onClick={executeBatch}
              disabled={batchLoading}
              className={batchAction === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              variant={batchAction === "Rejected" ? "destructive" : "default"}
              data-testid="batch-confirm-btn"
            >
              {batchLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {batchAction === "Approved" ? "Confirm Approve" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* WhatsApp Share Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="max-w-sm" data-testid="whatsapp-share-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share via WhatsApp
            </DialogTitle>
            <DialogDescription>Notify Admin, Master Admin, or HR users about this update</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => { window.open(`https://wa.me/?text=${whatsappMsg}`, '_blank'); setWhatsappDialogOpen(false); }}
              data-testid="whatsapp-open-btn"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Open WhatsApp
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setWhatsappDialogOpen(false)}>Skip</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EndorsementsPage;
