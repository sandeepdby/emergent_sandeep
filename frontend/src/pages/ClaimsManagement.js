import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, FileCheck } from "lucide-react";

const emptyForm = {
  policy_number: "", employee_name: "", patient_name: "", relationship: "Self",
  claim_type: "Cashless", diagnosis: "", hospital_name: "",
  admission_date: "", discharge_date: "",
  claimed_amount: 0, approved_amount: 0, settled_amount: 0,
  status: "Submitted", remarks: "", policy_type: "Group Health",
};

export default function ClaimsManagement() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchClaims = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/claims`, { headers });
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
      employee_name: claim.employee_name || "",
      patient_name: claim.patient_name || "",
      relationship: claim.relationship || "Self",
      claim_type: claim.claim_type || "Cashless",
      diagnosis: claim.diagnosis || "",
      hospital_name: claim.hospital_name || "",
      admission_date: claim.admission_date || "",
      discharge_date: claim.discharge_date || "",
      claimed_amount: claim.claimed_amount || 0,
      approved_amount: claim.approved_amount || 0,
      settled_amount: claim.settled_amount || 0,
      status: claim.status || "Submitted",
      remarks: claim.remarks || "",
      policy_type: claim.policy_type || "Group Health",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.policy_number || !form.employee_name || !form.patient_name) {
      toast.error("Policy number, employee name and patient name are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
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
      await axios.delete(`${API}/claims/${id}`, { headers });
      toast.success("Claim deleted");
      fetchClaims();
    } catch (err) {
      toast.error("Failed to delete");
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-800">Claims Management</h2>
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
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Policy Number *</Label>
                <Input value={form.policy_number} onChange={e => setForm({ ...form, policy_number: e.target.value })} data-testid="claim-policy-number" />
              </div>
              <div>
                <Label>Policy Type</Label>
                <Select value={form.policy_type} onValueChange={v => setForm({ ...form, policy_type: v })}>
                  <SelectTrigger data-testid="claim-policy-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Group Health">Group Health (GMC)</SelectItem>
                    <SelectItem value="GTL">Group Term (GTL)</SelectItem>
                    <SelectItem value="GPA">Group Accident (GPA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Employee Name *</Label>
                <Input value={form.employee_name} onChange={e => setForm({ ...form, employee_name: e.target.value })} data-testid="claim-employee-name" />
              </div>
              <div>
                <Label>Patient Name *</Label>
                <Input value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })} data-testid="claim-patient-name" />
              </div>
              <div>
                <Label>Relationship</Label>
                <Select value={form.relationship} onValueChange={v => setForm({ ...form, relationship: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Self">Self</SelectItem>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label>Diagnosis</Label>
                <Input value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} />
              </div>
              <div>
                <Label>Hospital</Label>
                <Input value={form.hospital_name} onChange={e => setForm({ ...form, hospital_name: e.target.value })} />
              </div>
              <div>
                <Label>Admission Date</Label>
                <Input type="date" value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} />
              </div>
              <div>
                <Label>Discharge Date</Label>
                <Input type="date" value={form.discharge_date} onChange={e => setForm({ ...form, discharge_date: e.target.value })} />
              </div>
              <div>
                <Label>Claimed Amount</Label>
                <Input type="number" value={form.claimed_amount} onChange={e => setForm({ ...form, claimed_amount: e.target.value })} data-testid="claim-claimed-amount" />
              </div>
              <div>
                <Label>Approved Amount</Label>
                <Input type="number" value={form.approved_amount} onChange={e => setForm({ ...form, approved_amount: e.target.value })} />
              </div>
              <div>
                <Label>Settled Amount</Label>
                <Input type="number" value={form.settled_amount} onChange={e => setForm({ ...form, settled_amount: e.target.value })} />
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
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs">Patient</TableHead>
                    <TableHead className="text-xs">Claim Type</TableHead>
                    <TableHead className="text-xs text-right">Claimed</TableHead>
                    <TableHead className="text-xs text-right">Settled</TableHead>
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
                      <TableCell className="text-xs">{c.employee_name}</TableCell>
                      <TableCell className="text-xs">{c.patient_name}</TableCell>
                      <TableCell className="text-xs">{c.claim_type}</TableCell>
                      <TableCell className="text-xs text-right">{(c.claimed_amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{(c.settled_amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</TableCell>
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
