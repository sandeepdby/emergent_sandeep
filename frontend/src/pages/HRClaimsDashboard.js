import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileCheck, TrendingUp } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";

const STATUS_COLORS = {
  Submitted: "#f59e0b",
  "In Process": "#3b82f6",
  Settled: "#10b981",
  Rejected: "#ef4444",
  Closed: "#6b7280",
};

const TYPE_COLORS = { Cashless: "#10b981", Reimbursement: "#8b5cf6" };

const fmt = (v) => (v || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-lg text-xs">
      <p className="font-medium text-gray-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.value > 999 ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

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
    total_premium, claims_ratio, annual_claims_trend,
    settlement_ratio, status_distribution, type_distribution, monthly_trend
  } = analytics;

  const statusPieData = status_distribution.map(s => ({ ...s, color: STATUS_COLORS[s.name] || "#94a3b8" }));
  const typePieData = type_distribution.map(s => ({ ...s, color: TYPE_COLORS[s.name] || "#94a3b8" }));

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

  const renderLabel = ({ name, value, percent }) => {
    if (percent < 0.05) return null;
    return `${name}: ${value}`;
  };

  return (
    <div className="space-y-6" data-testid="hr-claims-dashboard">
      <div className="flex items-center gap-2 mb-2">
        <FileCheck className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-800">Claims Dashboard</h2>
      </div>

      {/* Row 1 - Key Metrics */}
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

      {/* Row 2 - Calculated Metrics */}
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
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Claims Ratio</p>
            <p className="text-xl font-bold text-teal-600 mt-0.5" data-testid="claims-ratio">{claims_ratio}%</p>
            <p className="text-[10px] text-gray-400">Claims / Premium</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-orange-400" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Annual Claims Trend</p>
            </div>
            <p className="text-xl font-bold text-orange-600 mt-0.5" data-testid="annual-claims-trend">{fmt(annual_claims_trend)}</p>
            <p className="text-[10px] text-gray-400">(Claims / Policy Days) x 365</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Claims by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={renderLabel} labelLine={false} strokeWidth={2}>
                    {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="white" />)}
                  </Pie>
                  <Tooltip content={CustomTooltip} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No claims yet</p>}
          </CardContent>
        </Card>

        {/* Claims Amount Breakdown Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Claims Amount Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {total_claims > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={summaryBarData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v/1000)}K`} axisLine={false} />
                  <Tooltip content={CustomTooltip} />
                  <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {summaryBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No data</p>}
          </CardContent>
        </Card>

        {/* Claim Type Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Cashless vs Reimbursement</CardTitle>
          </CardHeader>
          <CardContent>
            {typePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={typePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={renderLabel} labelLine={false} strokeWidth={2}>
                    {typePieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="white" />)}
                  </Pie>
                  <Tooltip content={CustomTooltip} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Area Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Monthly Claims Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {monthly_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthly_trend}>
                <defs>
                  <linearGradient id="claimCountGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="claimAmountGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v/1000)}K`} axisLine={false} />
                <Tooltip content={CustomTooltip} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Area yAxisId="left" type="monotone" dataKey="count" name="Claims Count" stroke="#3b82f6" fill="url(#claimCountGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} />
                <Area yAxisId="right" type="monotone" dataKey="amount" name="Claims Amount" stroke="#10b981" fill="url(#claimAmountGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-400 py-8">No trend data</p>}
        </CardContent>
      </Card>

      {/* Claims Table - Corporate Synopsis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Claims Synopsis</CardTitle>
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
                    <TableHead className="text-xs">Policy Type</TableHead>
                    <TableHead className="text-xs">Claim Type</TableHead>
                    <TableHead className="text-xs">Report Date</TableHead>
                    <TableHead className="text-xs text-right">Cashless Cnt</TableHead>
                    <TableHead className="text-xs text-right">Reimb Cnt</TableHead>
                    <TableHead className="text-xs text-right">Claimed</TableHead>
                    <TableHead className="text-xs text-right">Settled</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.slice(0, 50).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-medium">{c.claim_number}</TableCell>
                      <TableCell className="text-xs">{c.policy_number}</TableCell>
                      <TableCell className="text-xs"><Badge variant="secondary" className="text-xs">{c.policy_type || "-"}</Badge></TableCell>
                      <TableCell className="text-xs">{c.claim_type}</TableCell>
                      <TableCell className="text-xs">{c.claims_report_date || "-"}</TableCell>
                      <TableCell className="text-xs text-right">{c.cashless_claims_count || 0}</TableCell>
                      <TableCell className="text-xs text-right">{c.reimbursement_claims_count || 0}</TableCell>
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
