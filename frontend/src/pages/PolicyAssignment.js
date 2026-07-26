import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Link2, UserCheck, Shield, Plus, Users, Mail, Send, Sparkles } from "lucide-react";
import AssignmentTable from "./AssignmentTable";

const hdrs = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export default function PolicyAssignment() {
  const [assignments, setAssignments] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedHr, setSelectedHr] = useState("");
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [assigning, setAssigning] = useState(false);

  // Email preview state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailHrName, setEmailHrName] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [assignRes, policyRes, hrRes] = await Promise.all([
        axios.get(`${API}/policy-assignments`, { headers: hdrs() }),
        axios.get(`${API}/policies`, { headers: hdrs() }),
        axios.get(`${API}/users/hr`, { headers: hdrs() }),
      ]);
      setAssignments(assignRes.data);
      setPolicies(policyRes.data);
      setHrUsers(hrRes.data);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      const res = await axios.post(`${API}/policy-assignments/bulk`, payload, { headers: hdrs() });
      const assignedCount = res.data.results.filter((r) => r.status === "assigned").length;
      const skippedCount = res.data.results.filter((r) => r.status === "skipped").length;
      if (assignedCount > 0) toast.success(`${assignedCount} policy(ies) assigned`);
      if (skippedCount > 0) toast.info(`${skippedCount} already assigned (skipped)`);
      setDialogOpen(false);
      fetchData();

      // Generate AI email preview if any were newly assigned
      if (assignedCount > 0) {
        const assignedPolicyIds = res.data.results
          .filter((r) => r.status === "assigned")
          .map((r) => r.policy_id);
        generateEmailPreview(selectedHr, assignedPolicyIds);
      }

      setSelectedHr("");
      setSelectedPolicies([]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to assign");
    } finally {
      setAssigning(false);
    }
  };

  const generateEmailPreview = async (hrUserId, policyIds) => {
    setEmailLoading(true);
    setEmailDialogOpen(true);
    setEmailSubject("");
    setEmailBody("");
    setEmailTo("");
    setEmailHrName("");
    try {
      const res = await axios.post(`${API}/policy-assignments/preview-email`, {
        hr_user_id: hrUserId,
        policy_ids: policyIds,
      }, { headers: hdrs() });
      setEmailSubject(res.data.subject || "");
      setEmailBody(res.data.body || "");
      setEmailTo(res.data.to_email || "");
      setEmailHrName(res.data.hr_name || "");
    } catch (err) {
      console.error("Email preview failed:", err);
      toast.error("Failed to generate email preview");
      setEmailDialogOpen(false);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject || !emailBody) {
      toast.error("Email, subject, and body are required");
      return;
    }
    setEmailSending(true);
    try {
      await axios.post(`${API}/policy-assignments/send-email`, {
        to_emails: [emailTo],
        subject: emailSubject,
        body: emailBody,
      }, { headers: hdrs() });
      toast.success(`Email sent to ${emailHrName || emailTo}`);
      setEmailDialogOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  };

  const handleRevoke = async (assignmentId, policyNumber, hrName) => {
    if (!window.confirm(`Revoke policy "${policyNumber}" from "${hrName}"?`)) return;
    try {
      await axios.delete(`${API}/policy-assignments/${assignmentId}`, { headers: hdrs() });
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

  const alreadyAssigned = assignments.filter((a) => a.hr_user_id === selectedHr && a.policy_id).map((a) => a.policy_id);
  const availablePolicies = policies.filter((p) => !alreadyAssigned.includes(p.id));

  const hrGroupMap = {};
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    const hrId = a.hr_user_id || "unknown";
    if (!hrGroupMap[hrId]) {
      hrGroupMap[hrId] = { hrName: a.hr_full_name || a.hr_username || "Unknown", hrUsername: a.hr_username || "—", list: [] };
    }
    hrGroupMap[hrId].list.push(a);
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Assign Dialog */}
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
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
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

      {/* AI Email Preview Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => { if (!emailLoading) setEmailDialogOpen(open); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="email-preview-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              AI-Generated Email Preview
            </DialogTitle>
            <DialogDescription>
              {emailHrName ? `Notification email for ${emailHrName}. Review, edit if needed, then send.` : "Generating email..."}
            </DialogDescription>
          </DialogHeader>

          {emailLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#E05A47]" />
              <p className="text-sm text-stone-500">AI is crafting the perfect email...</p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">To</Label>
                <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} data-testid="email-to-input" placeholder="recipient@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Subject</Label>
                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} data-testid="email-subject-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email Body (HTML)
                </Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-stone-50 border-b px-3 py-1.5 text-[10px] text-stone-400 uppercase tracking-wider">Preview</div>
                  <div
                    className="p-4 bg-white max-h-[340px] overflow-y-auto overflow-x-auto text-sm"
                    dangerouslySetInnerHTML={{ __html: emailBody }}
                    data-testid="email-body-preview"
                  />
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-stone-400 hover:text-stone-600">Edit raw HTML</summary>
                  <textarea
                    className="w-full mt-2 border rounded-md p-3 font-mono text-xs h-48 resize-y focus:outline-none focus:ring-2 focus:ring-[#E05A47]/30"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    data-testid="email-body-editor"
                  />
                </details>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4 mt-2">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailSending} data-testid="skip-email-btn">
              Skip
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={emailLoading || emailSending || !emailTo || !emailSubject}
              className="bg-[#E05A47] hover:bg-[#c44a3a] gap-1.5"
              data-testid="send-email-btn"
            >
              {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
