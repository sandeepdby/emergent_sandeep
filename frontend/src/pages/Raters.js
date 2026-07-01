import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, Download, FileText, FileSpreadsheet,
  Eye, X, ChevronDown, ChevronUp, Users
} from "lucide-react";

const fmt = (v) => `₹${(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const hdrs = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

/* ─── Sub-component: Single age-band row in editor ─── */
function BandRow({ band, index, onUpdate, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-stone-50 p-2 rounded-md" data-testid={`age-band-row-${index}`}>
      <span className="text-[10px] text-stone-400 w-5">{index + 1}.</span>
      <Input type="number" value={band.min_age} onChange={(e) => onUpdate(index, "min_age", e.target.value)} className="w-20 h-8 text-xs" placeholder="From" />
      <span className="text-stone-400 text-xs">–</span>
      <Input type="number" value={band.max_age} onChange={(e) => onUpdate(index, "max_age", e.target.value)} className="w-20 h-8 text-xs" placeholder="To" />
      <span className="text-stone-400 text-xs ml-2">₹</span>
      <Input type="number" value={band.per_life_rate} onChange={(e) => onUpdate(index, "per_life_rate", e.target.value)} className="w-32 h-8 text-xs" placeholder="Rate" />
      <Button type="button" size="icon" variant="ghost" onClick={() => onRemove(index)} className="h-7 w-7 text-red-400 hover:text-red-600 shrink-0">
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

/* ─── Sub-component: Age Band editor (list of BandRows) ─── */
function AgeBandEditor({ bands, onChange }) {
  const addBand = () => {
    const last = bands.length > 0 ? bands[bands.length - 1] : null;
    const nextMin = last ? last.max_age + 1 : 0;
    onChange([...bands, { min_age: nextMin, max_age: nextMin + 9, per_life_rate: 0 }]);
  };
  const removeBand = (idx) => onChange(bands.filter((_, i) => i !== idx));
  const updateBand = (idx, field, val) => {
    const updated = bands.slice();
    updated[idx] = { ...updated[idx], [field]: Number(val) || 0 };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-stone-600">Age Bands & Per Life Rates</Label>
        <Button type="button" size="sm" variant="outline" onClick={addBand} className="text-xs gap-1 h-7" data-testid="add-age-band-btn">
          <Plus className="w-3 h-3" /> Add Band
        </Button>
      </div>
      {bands.length === 0 && <p className="text-xs text-stone-400 text-center py-3">No age bands. Click "Add Band".</p>}
      {bands.map((b, i) => <BandRow key={i} band={b} index={i} onUpdate={updateBand} onRemove={removeBand} />)}
    </div>
  );
}

/* ─── Sub-component: HR user picker chip ─── */
function HRChip({ user, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(user.id)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        selected ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300"
      }`}
      data-testid={`hr-assign-${user.username}`}
    >
      {user.full_name || user.username}{selected ? " ✓" : ""}
    </button>
  );
}

/* ─── Sub-component: Policy option in select ─── */
function PolicyOption({ policy }) {
  return <SelectItem value={policy.policy_number}>{policy.policy_number} — {policy.policy_type || "Policy"}</SelectItem>;
}

/* ─── Sub-component: Create / Edit dialog ─── */
function RaterFormDialog({ open, onClose, policies, hrUsers, editData, onSave }) {
  const [name, setName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [bands, setBands] = useState([]);
  const [selectedHR, setSelectedHR] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setName(editData.name || "");
      setPolicyNumber(editData.policy_number || "");
      setBands(editData.age_bands || []);
      setSelectedHR(editData.assigned_hr_users || []);
    } else {
      setName(""); setPolicyNumber(""); setBands([]); setSelectedHR([]);
    }
  }, [editData, open]);

  const toggleHR = (uid) => setSelectedHR((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);

  const handleSubmit = async () => {
    if (!name.trim() || !policyNumber) { toast.error("Name and Policy are required"); return; }
    if (bands.length === 0) { toast.error("Add at least one age band"); return; }
    for (const b of bands) {
      if (b.min_age > b.max_age) { toast.error(`Invalid age range: ${b.min_age}-${b.max_age}`); return; }
      if (b.per_life_rate < 0) { toast.error("Rate cannot be negative"); return; }
    }
    setSaving(true);
    try {
      const payload = { name, policy_number: policyNumber, age_bands: bands, assigned_hr_users: selectedHR };
      if (editData) {
        await axios.put(`${API}/raters/${editData.id}`, payload, { headers: hdrs() });
        toast.success("Rater updated");
      } else {
        await axios.post(`${API}/raters`, payload, { headers: hdrs() });
        toast.success("Rater created");
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save rater");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="rater-form-dialog">
        <DialogHeader><DialogTitle className="text-lg">{editData ? "Edit Rater" : "Create New Rater"}</DialogTitle><DialogDescription>Define age bands and per-life premium rates</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-stone-600">Rater Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GMC Standard 2026-27" className="mt-1" data-testid="rater-name-input" />
            </div>
            <div>
              <Label className="text-xs text-stone-600">Policy</Label>
              <Select value={policyNumber} onValueChange={setPolicyNumber}>
                <SelectTrigger className="mt-1" data-testid="rater-policy-select"><SelectValue placeholder="Select Policy" /></SelectTrigger>
                <SelectContent>
                  {policies.map((p) => <PolicyOption key={p.policy_number} policy={p} />)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AgeBandEditor bands={bands} onChange={setBands} />
          <div>
            <Label className="text-xs font-semibold text-stone-600 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Assign to HR Users</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {hrUsers.length === 0 && <p className="text-xs text-stone-400">No HR users found</p>}
              {hrUsers.map((u) => <HRChip key={u.id} user={u} selected={selectedHR.includes(u.id)} onToggle={toggleHR} />)}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="save-rater-btn">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {editData ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-component: View dialog (read-only) ─── */
function ViewBandRow({ band, index }) {
  return (
    <TableRow>
      <TableCell className="text-xs text-stone-400">{index + 1}</TableCell>
      <TableCell className="text-xs font-medium">{band.min_age} – {band.max_age} yrs</TableCell>
      <TableCell className="text-xs text-right font-semibold text-stone-800">{fmt(band.per_life_rate)}</TableCell>
    </TableRow>
  );
}

function RaterViewDialog({ open, onClose, rater }) {
  if (!rater) return null;
  const bands = rater.age_bands || [];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="rater-view-dialog">
        <DialogHeader><DialogTitle>{rater.name}</DialogTitle><DialogDescription>Rate card details</DialogDescription></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{rater.policy_number}</Badge>
            {rater.policy_type && <Badge variant="secondary">{rater.policy_type}</Badge>}
            {rater.insurer_name && <Badge variant="secondary">{rater.insurer_name}</Badge>}
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead className="text-xs font-semibold">#</TableHead>
                <TableHead className="text-xs font-semibold">Age Range</TableHead>
                <TableHead className="text-xs font-semibold text-right">Per Life Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bands.map((ab, i) => <ViewBandRow key={i} band={ab} index={i} />)}
            </TableBody>
          </Table>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-component: Expanded age-band table inside card ─── */
function ExpandedBandRow({ band, index }) {
  return (
    <TableRow className="hover:bg-stone-50/50">
      <TableCell className="text-xs text-stone-400 py-2">{index + 1}</TableCell>
      <TableCell className="text-xs font-medium py-2">{band.min_age} – {band.max_age} yrs</TableCell>
      <TableCell className="text-xs text-right font-semibold text-stone-800 py-2">{fmt(band.per_life_rate)}</TableCell>
    </TableRow>
  );
}

function HRNameBadge({ name }) {
  return <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{name}</Badge>;
}

/* ─── Sub-component: Single rater card ─── */
function RaterCard({ rater, isAdmin, isExpanded, onToggle, onView, onEdit, onDelete, onDownload }) {
  const bands = rater.age_bands || [];
  const hrNames = rater.assigned_hr_names || [];

  return (
    <Card className="hover:shadow-md transition-all" data-testid={`rater-card-${rater.id}`}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 cursor-pointer" onClick={onToggle} data-testid={`rater-toggle-${rater.id}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-stone-800 text-sm truncate">{rater.name}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{rater.policy_number}</Badge>
                {rater.policy_type && <Badge variant="secondary" className="text-[10px]">{rater.policy_type}</Badge>}
                <span className="text-[10px] text-stone-400">{bands.length} age bands</span>
                {isAdmin && hrNames.length > 0 && (
                  <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><Users className="w-3 h-3" />{hrNames.length} HR</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onView(); }} data-testid={`view-rater-${rater.id}`}><Eye className="w-4 h-4 text-stone-500" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Download Excel" onClick={(e) => { e.stopPropagation(); onDownload("xlsx"); }} data-testid={`download-xlsx-${rater.id}`}><FileSpreadsheet className="w-4 h-4 text-emerald-600" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Download PDF" onClick={(e) => { e.stopPropagation(); onDownload("pdf"); }} data-testid={`download-pdf-${rater.id}`}><Download className="w-4 h-4 text-red-500" /></Button>
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(); }} data-testid={`edit-rater-${rater.id}`}><Pencil className="w-4 h-4 text-blue-500" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onDelete(); }} data-testid={`delete-rater-${rater.id}`}><Trash2 className="w-4 h-4 text-red-400" /></Button>
              </>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
          </div>
        </div>
        {isExpanded && (
          <div className="border-t px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50/50">
                  <TableHead className="text-[10px] font-semibold w-12">#</TableHead>
                  <TableHead className="text-[10px] font-semibold">Age Range</TableHead>
                  <TableHead className="text-[10px] font-semibold text-right">Per Life Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bands.map((ab, i) => <ExpandedBandRow key={i} band={ab} index={i} />)}
              </TableBody>
            </Table>
            {isAdmin && hrNames.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1">Assigned HR Users</p>
                <div className="flex flex-wrap gap-1.5">
                  {hrNames.map((n, i) => <HRNameBadge key={i} name={n} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Raters Page ─── */
export default function Raters({ isAdmin = false }) {
  const [raters, setRaters] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchRaters = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/raters`, { headers: hdrs() });
      setRaters(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchRaters();
    if (isAdmin) {
      axios.get(`${API}/policies`, { headers: hdrs() }).then(r => setPolicies(r.data || [])).catch(() => {});
      axios.get(`${API}/users`, { headers: hdrs() }).then(r => setHrUsers((r.data || []).filter(u => u.role === "HR"))).catch(() => {});
    }
  }, [fetchRaters, isAdmin]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete rater "${name}"?`)) return;
    try {
      await axios.delete(`${API}/raters/${id}`, { headers: hdrs() });
      toast.success("Rater deleted");
      fetchRaters();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to delete"); }
  };

  const handleDownload = async (id, name, format) => {
    try {
      const res = await axios.get(`${API}/raters/${id}/download?format=${format}`, { headers: hdrs(), responseType: "blob" });
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name.replace(/\s+/g, "_")}_RateCard.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded as ${ext.toUpperCase()}`);
    } catch (err) { toast.error("Download failed"); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#E05A47]" /></div>;

  return (
    <div className="space-y-6" data-testid="raters-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Rate Cards</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {isAdmin ? "Manage per-life premium rates by age range for each policy" : "View rate cards assigned to your policies"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditData(null); setFormOpen(true); }} className="gap-1.5" data-testid="create-rater-btn">
            <Plus className="w-4 h-4" /> New Rater
          </Button>
        )}
      </div>

      {raters.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-stone-400">No rate cards found</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {raters.map((r) => (
            <RaterCard
              key={r.id}
              rater={r}
              isAdmin={isAdmin}
              isExpanded={expandedId === r.id}
              onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onView={() => { setViewData(r); setViewOpen(true); }}
              onEdit={() => { setEditData(r); setFormOpen(true); }}
              onDelete={() => handleDelete(r.id, r.name)}
              onDownload={(f) => handleDownload(r.id, r.name, f)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <RaterFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditData(null); }}
          policies={policies}
          hrUsers={hrUsers}
          editData={editData}
          onSave={fetchRaters}
        />
      )}
      <RaterViewDialog open={viewOpen} onClose={() => { setViewOpen(false); setViewData(null); }} rater={viewData} />
    </div>
  );
}
