import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Link2, UserCheck, Shield, Plus, Users } from "lucide-react";
import AssignmentTable from "./AssignmentTable";

export default function PolicyAssignment() {
  const [assignments, setAssignments] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedHr, setSelectedHr] = useState("");
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [assigning, setAssigning] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const hdrs = getHeaders();
      const [assignRes, policyRes, hrRes] = await Promise.all([
        axios.get(`${API}/policy-assignments`, { headers: hdrs }),
        axios.get(`${API}/policies`, { headers: hdrs }),
        axios.get(`${API}/users/hr`, { headers: hdrs }),
      ]);
      setAssignments(assignRes.data);
      setPolicies(policyRes.data);
      setHrUsers(hrRes.data);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAssign = async () => {
    if (!selectedHr || selectedPolicies.length === 0) {
      toast.error("Select an HR user and at least one policy");
      return;
    }
    setAssigning(true);
    try {
      const payload = selectedPolicies.map((pid) => ({
        policy_id: pid,
        hr_user_id: selectedHr,
      }));
      const res = await axios.post(`${API}/policy-assignments/bulk`, payload, { headers: getHeaders() });
      const assignedCount = res.data.results.filter((r) => r.status === "assigned").length;
      const skippedCount = res.data.results.filter((r) => r.status === "skipped").length;
      if (assignedCount > 0) toast.success(`${assignedCount} policy(ies) assigned`);
      if (skippedCount > 0) toast.info(`${skippedCount} already assigned (skipped)`);
      setDialogOpen(false);
      setSelectedHr("");
      setSelectedPolicies([]);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to assign");
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async (assignmentId, policyNumber, hrName) => {
    if (!window.confirm(`Revoke policy "${policyNumber}" from "${hrName}"?`)) return;
    try {
      await axios.delete(`${API}/policy-assignments/${assignmentId}`, { headers: getHeaders() });
      toast.success("Assignment revoked");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to revoke");
    }
  };

  const togglePolicy = (policyId) => {
    setSelectedPolicies((prev) =>
      prev.includes(policyId) ? prev.filter((id) => id !== policyId) : [...prev, policyId]
    );
  };

  // Compute derived data
  const alreadyAssigned = assignments.filter((a) => a.hr_user_id === selectedHr).map((a) => a.policy_id);
  const availablePolicies = policies.filter((p) => !alreadyAssigned.includes(p.id));

  // Build grouped data
  const hrGroupMap = {};
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    if (!hrGroupMap[a.hr_user_id]) {
      hrGroupMap[a.hr_user_id] = { hrName: a.hr_full_name, hrUsername: a.hr_username, list: [] };
    }
    hrGroupMap[a.hr_user_id].list.push(a);
  }
  const hrGroupEntries = Object.entries(hrGroupMap);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="policy-assignment-loading">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="policy-assignment-page">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Link2 className="w-8 h-8 text-indigo-200" />
            <div>
              <p className="text-xs text-gray-500">Total Assignments</p>
              <p className="text-2xl font-bold" data-testid="total-assignments-count">{assignments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-200" />
            <div>
              <p className="text-xs text-gray-500">Policies</p>
              <p className="text-2xl font-bold text-blue-600">{policies.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-emerald-200" />
            <div>
              <p className="text-xs text-gray-500">HR Users</p>
              <p className="text-2xl font-bold text-emerald-600">{hrUsers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-amber-200" />
            <div>
              <p className="text-xs text-gray-500">HR with Policies</p>
              <p className="text-2xl font-bold text-amber-600">{hrGroupEntries.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Policy Assignments</CardTitle>
            <CardDescription>Assign policies to HR users. HR can only view assigned policies and their claims.</CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)} data-testid="assign-policy-btn">
            <Plus className="w-4 h-4 mr-2" /> Assign Policy
          </Button>
        </CardHeader>
        <CardContent>
          {hrGroupEntries.length === 0 ? (
            <div className="text-center py-12 text-gray-400" data-testid="no-assignments">
              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No policy assignments yet</p>
              <p className="text-sm mt-1">Assign policies to HR users so they can view specific policy details and claims.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {hrGroupEntries.map(([hrId, data]) => (
                <AssignmentTable
                  key={hrId}
                  hrId={hrId}
                  hrName={data.hrName}
                  hrUsername={data.hrUsername}
                  items={data.list}
                  onRevoke={handleRevoke}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Policies to HR User</DialogTitle>
            <DialogDescription>Select an HR user and policies to assign. HR can only view assigned policies.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Select HR User</label>
              <Select value={selectedHr} onValueChange={(v) => { setSelectedHr(v); setSelectedPolicies([]); }}>
                <SelectTrigger data-testid="select-hr-user">
                  <SelectValue placeholder="Choose HR user..." />
                </SelectTrigger>
                <SelectContent>
                  {hrUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedHr && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Select Policies ({selectedPolicies.length} selected)
                </label>
                {availablePolicies.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">All policies already assigned to this HR user</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                    {availablePolicies.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPolicies.includes(p.id)}
                          onChange={() => togglePolicy(p.id)}
                          className="rounded border-gray-300"
                          data-testid={`policy-checkbox-${p.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.policy_number}</p>
                          <p className="text-xs text-gray-500 truncate">{p.policy_holder_name} - {p.policy_type}</p>
                        </div>
                        <Badge variant={p.status === "Active" ? "default" : "destructive"} className="text-xs shrink-0">
                          {p.status}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || !selectedHr || selectedPolicies.length === 0}
              data-testid="confirm-assign-btn"
            >
              {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
              Assign {selectedPolicies.length > 0 ? `(${selectedPolicies.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
