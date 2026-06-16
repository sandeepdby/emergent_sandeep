import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, FileCheck, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

const emptyForm = {
  policy_number: "",
  claim_number: "",
  claim_type: "Cashless",
  policy_type: "ESKP",
  claims_report_date: "",
  employee_name: "",
  patient_name: "",
  claimed_amount: 0,
  incurred_amount: 0,
  paid_amount: 0,
  status: "Submitted",
  remarks: "",
};

const fmt = (v) => (v || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function ClaimsManagement() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  const fetchClaims = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/claims`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      setClaims(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (claim) => {
    setEditingId(claim.id);
    setForm({
      policy_number: claim.policy_number || "",
      claim_number: claim.claim_number || "",
      claim_type: claim.claim_type || "Cashless",
      policy_type: claim.policy_type || "ESKP",
      claims_report_date: claim.claims_report_date || "",
      employee_name: claim.employee_name || "",
      patient_name: claim.patient_name || "",
      claimed_amount: claim.claimed_amount || 0,
      incurred_amount: claim.incurred_amount || 0,
      paid_amount: claim.paid_amount || 0,
      status: claim.status || "Submitted",
      remarks: claim.remarks || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.policy_number) {
      toast.error("Policy number is required");
      return;
    }
    setSaving(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const payload = {
        ...form,
        cashless_claims_count: parseInt(form.cashless_claims_count) || 0,
        reimbursement_claims_count: parseInt(form.reimbursement_claims_count) || 0,
        claimed_amount: parseFloat(form.claimed_amount) || 0,
        approved_amount: parseFloat(form.approved_amount) || 0,
        settled_amount: parseFloat(form.settled_amount) || 0,
      };
      if (editingId) {
        await axios.put(`${API}/claims/${editingId}`, payload, { headers });
        toast.success("Claim updated");
      } else {
        await axios.post(`${API}/claims`, payload, { headers });
        toast.success("Claim created");
      }
      setDialogOpen(false);
      fetchClaims();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save claim");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this claim?")) return;
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      await axios.delete(`${API}/claims/${id}`, { headers });
      toast.success("Claim deleted");
      fetchClaims();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/claims/template/download`, {
        headers: authHeaders,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "claims_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (err) {
      toast.error("Failed to download template");
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/claims/import`, formData, {
        headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
      });
      setImportResult(res.data);
      if (res.data.success_count > 0) {
        toast.success(`Imported ${res.data.success_count} claims successfully`);
        fetchClaims();
      }
      if (res.data.error_count > 0) {
        toast.error(`${res.data.error_count} rows had errors`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const statusBadge = (status) => {
    const v = { Settled: "default", Rejected: "destructive", "In Process": "secondary", Submitted: "outline", Closed: "secondary" };
    return <Badge variant={v[status] || "secondary"} className="text-xs">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="claims-mgmt-loading">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="claims-management">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-800">Claims Management</h2>
          <Badge variant="secondary" className="text-xs">{claims.length} claims</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="download-claims-template-btn">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Template
          </Button>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              className="hidden"
              data-testid="claims-excel-file-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              data-testid="import-claims-excel-btn"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
              {importing ? "Importing..." : "Import Excel"}
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} data-testid="add-claim-btn">
                <Plus className="w-4 h-4 mr-2" /> Add Claim
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Claim" : "Add New Claim"}</DialogTitle>
              <DialogDescription>Corporate claims synopsis - enter claim details below.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Policy Number *</Label>
                <Input value={form.policy_number} onChange={e => setForm({ ...form, policy_number: e.target.value })} data-testid="claim-policy-number" />
              </div>
              <div>
                <Label>Claim Number</Label>
                <Input value={form.claim_number} onChange={e => setForm({ ...form, claim_number: e.target.value })} placeholder="Auto-generated if empty" data-testid="claim-number" />
              </div>
              <div>
                <Label>Claim Type</Label>
                <Select value={form.claim_type} onValueChange={v => setForm({ ...form, claim_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cashless">Cashless</SelectItem>
                    <SelectItem value="Reimbursement">Reimbursement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Policy Type</Label>
                <Select value={form.policy_type} onValueChange={v => setForm({ ...form, policy_type: v })}>
                  <SelectTrigger data-testid="claim-policy-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESKP">ESKP</SelectItem>
                    <SelectItem value="ESK">ESK</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Claims Report Date</Label>
                <Input type="date" value={form.claims_report_date} onChange={e => setForm({ ...form, claims_report_date: e.target.value })} data-testid="claim-report-date" />
              </div>
              <div>
                <Label>Employee Name</Label>
                <Input value={form.employee_name} onChange={e => setForm({ ...form, employee_name: e.target.value })} data-testid="claim-employee-name" />
              </div>
              <div>
                <Label>Patient Name</Label>
                <Input value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })} data-testid="claim-patient-name" />
              </div>
              <div>
                <Label>Claimed Amount</Label>
                <Input type="number" value={form.claimed_amount} onChange={e => setForm({ ...form, claimed_amount: e.target.value })} data-testid="claim-claimed-amount" />
              </div>
              <div>
                <Label>Incurred Amount</Label>
                <Input type="number" value={form.incurred_amount} onChange={e => setForm({ ...form, incurred_amount: e.target.value })} data-testid="claim-incurred-amount" />
              </div>
              <div>
                <Label>Paid Amount</Label>
                <Input type="number" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: e.target.value })} data-testid="claim-paid-amount" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="claim-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="In Process">In Process</SelectItem>
                    <SelectItem value="Settled">Settled</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Remarks</Label>
                <Input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} data-testid="save-claim-btn">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {editingId ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Import Result Card */}
      {importResult && (
        <Card className={`border-l-4 ${importResult.error_count > 0 ? 'border-l-amber-500' : 'border-l-emerald-500'}`} data-testid="claims-import-result">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {importResult.error_count === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">Import Complete</span>
                  <Badge variant="default" className="text-xs">{importResult.success_count} imported</Badge>
                  {importResult.error_count > 0 && (
                    <Badge variant="destructive" className="text-xs">{importResult.error_count} errors</Badge>
                  )}
                  <span className="text-gray-400 text-xs">{importResult.total_rows} total rows</span>
                </div>
                {importResult.errors?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-xs text-red-600">Row {err.row}: {err.error}</p>
                    ))}
                    {importResult.errors.length > 5 && (
                      <p className="text-xs text-gray-400">...and {importResult.errors.length - 5} more errors</p>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setImportResult(null)} className="text-xs text-gray-400">
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {claims.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No claims yet. Click "Add Claim" to create one.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="admin-claims-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Claim #</TableHead>
                    <TableHead className="text-xs">Policy</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Claim Type</TableHead>
                    <TableHead className="text-xs">Report Date</TableHead>
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs">Patient</TableHead>
                    <TableHead className="text-xs text-right">Claimed</TableHead>
                    <TableHead className="text-xs text-right">Incurred</TableHead>
                    <TableHead className="text-xs text-right">Paid</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-medium">{c.claim_number}</TableCell>
                      <TableCell className="text-xs">{c.policy_number}</TableCell>
                      <TableCell className="text-xs"><Badge variant="secondary" className="text-xs">{c.policy_type || "-"}</Badge></TableCell>
                      <TableCell className="text-xs">{c.claim_type}</TableCell>
                      <TableCell className="text-xs">{c.claims_report_date || "-"}</TableCell>
                      <TableCell className="text-xs">{c.employee_name || "-"}</TableCell>
                      <TableCell className="text-xs">{c.patient_name || "-"}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(c.claimed_amount)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(c.incurred_amount || 0)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmt(c.paid_amount || 0)}</TableCell>
                      <TableCell className="text-xs">{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-xs text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(c)} data-testid={`edit-claim-${c.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(c.id)} data-testid={`delete-claim-${c.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
