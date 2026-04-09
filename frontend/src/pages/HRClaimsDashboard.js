import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileCheck, DollarSign, TrendingUp, AlertCircle, PieChart as PieIcon } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from "recharts";

const STATUS_COLORS = {
  Submitted: "#f59e0b",
  "In Process": "#3b82f6",
  Settled: "#10b981",
  Rejected: "#ef4444",
  Closed: "#6b7280",
};

const TYPE_COLORS = { Cashless: "#8b5cf6", Reimbursement: "#f97316" };

export default function HRClaimsDashboard() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [claims, setClaims] = useState([]);
  const [policyTypeFilter, setPolicyTypeFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const params = {};
      if (policyTypeFilter !== "all") params.policy_type = policyTypeFilter;

      const [analyticsRes, claimsRes] = await Promise.all([
        axios.get(`${API}/claims-analytics`, { headers, params }),
        axios.get(`${API}/claims`, { headers, params }),
      ]);
      setAnalytics(analyticsRes.data);
      setClaims(claimsRes.data);
    } catch (err) {
      console.error("Error loading claims:", err);
    } finally {
      setLoading(false);
    }
  }, [policyTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="hr-claims-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12" data-testid="hr-claims-error">
        <p className="text-gray-500">Failed to load claims data</p>
      </div>
    );
  }

  const { total_claims, total_claimed_amount, total_approved_amount, total_settled_amount, settlement_ratio, status_distribution, type_distribution, monthly_trend } = analytics;

  const statusPieData = status_distribution.map(s => ({ ...s, color: STATUS_COLORS[s.name] || "#94a3b8" }));
  const typePieData = type_distribution.map(t => ({ ...t, color: TYPE_COLORS[t.name] || "#94a3b8" }));

  const statusBadge = (status) => {
    const variants = { Settled: "default", Rejected: "destructive", "In Process": "secondary", Submitted: "outline", Closed: "secondary" };
    return <Badge variant={variants[status] || "secondary"} className="text-xs">{status}</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="hr-claims-dashboard">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">Claims Dashboard</h2>
        </div>
        <Select value={policyTypeFilter} onValueChange={setPolicyTypeFilter}>
          <SelectTrigger className="w-48" data-testid="claims-policy-type-filter">
            <SelectValue placeholder="All Policy Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Policy Types</SelectItem>
            <SelectItem value="Group Health">Group Health (GMC)</SelectItem>
            <SelectItem value="GTL">Group Term (GTL)</SelectItem>
            <SelectItem value="GPA">Group Accident (GPA)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Claims</p>
            <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="total-claims-count">{total_claims}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">Claimed</p>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{total_claimed_amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">Approved</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{total_approved_amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">Settled</p>
            </div>
            <p className="text-2xl font-bold text-purple-600 mt-1">{total_settled_amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-teal-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">Settlement %</p>
            </div>
            <p className="text-2xl font-bold text-teal-600 mt-1">{settlement_ratio}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <PieIcon className="w-4 h-4" /> By Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-8">No claims yet</p>
            )}
          </CardContent>
        </Card>

        {/* Type Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">By Claim Type</CardTitle>
          </CardHeader>
          <CardContent>
            {typePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={typePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {typePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Monthly Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {monthly_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthly_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-8">No trend data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Claims Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Recent Claims</CardTitle>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No claims available. Admin will update claim details.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="hr-claims-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Claim #</TableHead>
                    <TableHead className="text-xs">Policy</TableHead>
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs">Patient</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Claimed</TableHead>
                    <TableHead className="text-xs text-right">Settled</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.slice(0, 20).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-medium">{c.claim_number}</TableCell>
                      <TableCell className="text-xs">{c.policy_number}</TableCell>
                      <TableCell className="text-xs">{c.employee_name}</TableCell>
                      <TableCell className="text-xs">{c.patient_name}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">{c.claim_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">{(c.claimed_amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{(c.settled_amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</TableCell>
                      <TableCell className="text-xs">{statusBadge(c.status)}</TableCell>
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
