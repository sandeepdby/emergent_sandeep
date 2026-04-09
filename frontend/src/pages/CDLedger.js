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
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Wallet, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

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
    reference: "",
    description: "",
    amount: "",
    policy_number: "",
  });

  const fetchPolicies = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/policies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPolicies(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchLedger = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      let url = `${API}/cd-ledger`;
      if (selectedPolicy && selectedPolicy !== "all") {
        url += `?policy_number=${encodeURIComponent(selectedPolicy)}`;
      }
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntries(res.data.entries || []);
      setTotalBalance(res.data.total_balance || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedPolicy]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);
  useEffect(() => { setLoading(true); fetchLedger(); }, [fetchLedger]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.reference || !formData.amount) {
      toast.error("Reference and Amount are required");
      return;
    }
    setAdding(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/cd-ledger`, {
        ...formData,
        amount: parseFloat(formData.amount),
        policy_number: formData.policy_number || null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("CD Ledger entry added");
      setFormData({ date: new Date().toISOString().split("T")[0], reference: "", description: "", amount: "", policy_number: "" });
      setShowForm(false);
      fetchLedger();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add entry");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/cd-ledger/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Entry deleted");
      fetchLedger();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const totalDeposits = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalDeductions = Math.abs(entries.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0));

  return (
    <div className="space-y-6" data-testid="cd-ledger-page">
      {/* Policy Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium whitespace-nowrap">Filter by Policy:</Label>
          <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
            <SelectTrigger className="w-[260px]" data-testid="cd-policy-filter">
              <SelectValue placeholder="All Policies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Policies</SelectItem>
              {policies.map((p) => (
                <SelectItem key={p.id} value={p.policy_number}>{p.policy_number} — {p.policy_holder_name}</SelectItem>
              ))}
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
                <p className="text-sm text-gray-500 font-medium">CD Balance{selectedPolicy !== "all" ? ` (${selectedPolicy})` : ""}</p>
                <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {totalBalance >= 0 ? '+' : ''}₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Wallet className={`w-10 h-10 ${totalBalance >= 0 ? 'text-emerald-200' : 'text-red-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Deposits</p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{totalDeposits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Deductions</p>
                <p className="text-2xl font-bold text-amber-600">
                  ₹{totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingDown className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Entry Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">CD Ledger Statement</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLedger} data-testid="refresh-ledger-btn">
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowForm(!showForm)} data-testid="add-entry-btn">
                <Plus className="w-4 h-4 mr-1" /> Add Deposit / Entry
              </Button>
            )}
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="border-b bg-gray-50 pb-4">
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required data-testid="cd-date-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reference *</Label>
                <Input placeholder="e.g. NEFT-123" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} required data-testid="cd-reference-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input placeholder="Cash deposit" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} data-testid="cd-description-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Policy</Label>
                <Select value={formData.policy_number || "none"} onValueChange={(v) => setFormData({ ...formData, policy_number: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="cd-policy-select"><SelectValue placeholder="Select Policy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Policy</SelectItem>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={p.policy_number}>{p.policy_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input type="number" step="0.01" placeholder="+5000 or -1000" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required data-testid="cd-amount-input" />
              </div>
              <Button type="submit" disabled={adding} data-testid="cd-submit-btn">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Entry"}
              </Button>
            </form>
          </CardContent>
        )}

        <CardContent className="pt-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No CD Ledger entries{selectedPolicy !== "all" ? ` for ${selectedPolicy}` : ""}</p>
              <p className="text-sm mt-1">Click "Add Deposit / Entry" to start tracking</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="cd-ledger-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} data-testid={`cd-row-${entry.id}`}>
                      <TableCell className="whitespace-nowrap">{entry.date}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.reference}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.description || "—"}</TableCell>
                      <TableCell className="text-sm">{entry.policy_number || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={entry.entry_type === "Manual" ? "secondary" : entry.entry_type === "Refund Credit" ? "default" : "destructive"} className="text-xs">
                          {entry.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${entry.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {entry.amount >= 0 ? '+' : ''}₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${entry.running_balance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                        ₹{entry.running_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {entry.entry_type === "Manual" ? (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)} className="text-red-500 hover:text-red-700" data-testid={`cd-delete-${entry.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">Auto</span>
                          )}
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
    </div>
  );
}
