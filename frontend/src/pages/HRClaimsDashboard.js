import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileCheck, DollarSign, TrendingUp, AlertCircle, PercentCircle } from "lucide-react";
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

const fmt = (v) => (v || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function HRClaimsDashboard() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [claims, setClaims] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [analyticsRes, claimsRes] = await Promise.all([
        axios.get(`${API}/claims-analytics`, { headers }),
        axios.get(`${API}/claims`, { headers }),
      ]);
      setAnalytics(analyticsRes.data);
      setClaims(claimsRes.data);
    } catch (err) {
      console.error("Error loading claims:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const {
    total_claims, total_claimed_amount,
    reimbursement_claims, reimbursement_count,
    cashless_claims, cashless_count,
    rejected_claims, rejected_count,
    under_process_claims, under_process_count,
    total_premium, claims_ratio, renewal_expected_pricing,
    status_distribution, type_distribution, monthly_trend
  } = analytics;

  const statusPieData = status_distribution.map(s => ({ ...s, color: STATUS_COLORS[s.name] || "#94a3b8" }));

  const summaryBarData = [
    { name: "Total", amount: total_claimed_amount, fill: "#3b82f6" },
    { name: "Reimburse", amount: reimbursement_claims, fill: "#8b5cf6" },
    { name: "Cashless", amount: cashless_claims, fill: "#10b981" },
    { name: "Rejected", amount: rejected_claims, fill: "#ef4444" },
    { name: "In Process", amount: under_process_claims, fill: "#f59e0b" },
  ];

  const statusBadge = (status) => {
    const v = { Settled: "default", Rejected: "destructive", "In Process": "secondary", Submitted: "outline", Closed: "secondary" };
    return <Badge variant={v[status] || "secondary"} className="text-xs">{status}</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="hr-claims-dashboard">
      <div className="flex items-center gap-2 mb-2">
        <FileCheck className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-800">Claims Dashboard</h2>
      </div>

      {/* Row 1 — Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Claims</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5" data-testid="total-claims-count">{total_claims}</p>
            <p className="text-xs text-gray-500">{fmt(total_claimed_amount)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Reimbursement</p>
            <p className="text-xl font-bold text-purple-600 mt-0.5">{reimbursement_count}</p>
            <p className="text-xs text-gray-500">{fmt(reimbursement_claims)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Cashless</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{cashless_count}</p>
            <p className="text-xs text-gray-500">{fmt(cashless_claims)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Rejected</p>
            <p className="text-xl font-bold text-red-600 mt-0.5">{rejected_count}</p>
            <p className="text-xs text-gray-500">{fmt(rejected_claims)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — Calculated Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Under Process</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{under_process_count}</p>
            <p className="text-xs text-gray-500">{fmt(under_process_claims)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Premium</p>
            <p className="text-xl font-bold text-indigo-600 mt-0.5">{fmt(total_premium)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Claims Ratio</p>
            </div>
            <p className="text-xl font-bold text-teal-600 mt-0.5" data-testid="claims-ratio">{claims_ratio}%</p>
            <p className="text-[10px] text-gray-400">Claims / Premium</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-orange-400" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Renewal Pricing</p>
            </div>
            <p className="text-xl font-bold text-orange-600 mt-0.5" data-testid="renewal-pricing">{fmt(renewal_expected_pricing)}</p>
            <p className="text-[10px] text-gray-400">Claims x 1.30</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">By Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No claims yet</p>}
          </CardContent>
        </Card>

        {/* Claims Summary Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Claims Amount Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {total_claims > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summaryBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v/1000)}K`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
                    {summaryBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No data</p>}
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
            ) : <p className="text-center text-gray-400 py-8">No trend data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Claims Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">All Claims</CardTitle>
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
                  {claims.slice(0, 30).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-medium">{c.claim_number}</TableCell>
                      <TableCell className="text-xs">{c.policy_number}</TableCell>
                      <TableCell className="text-xs">{c.employee_name}</TableCell>
                      <TableCell className="text-xs">{c.patient_name}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">{c.claim_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">{fmt(c.claimed_amount)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmt(c.settled_amount)}</TableCell>
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
