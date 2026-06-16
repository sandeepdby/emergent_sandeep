import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileCheck, TrendingUp, Activity, DollarSign, ShieldCheck, ShieldX, Clock, PieChartIcon } from "lucide-react";
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

function AnimatedValue({ value, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const num = typeof value === "number" ? value : parseFloat(value) || 0;
    if (num === 0) { setDisplay(0); return; }
    let start = 0;
    const duration = 800;
    const step = num / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= num) { setDisplay(num); clearInterval(timer); }
      else setDisplay(Math.round(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{prefix}{typeof value === "number" && value > 999 ? fmt(display) : display}{suffix}</span>;
}

function MetricCard({ label, value, subtext, color, icon: Icon }) {
  return (
    <Card className={`border-l-4 ${color} hover:shadow-lg transition-all duration-300 group cursor-default`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-medium">{label}</p>
            <p className="text-2xl font-bold text-stone-900 mt-1 tabular-nums" data-testid={`metric-${label.replace(/\s/g, '-').toLowerCase()}`}>
              <AnimatedValue value={value} />
            </p>
            {subtext && <p className="text-xs text-stone-400 mt-0.5">{subtext}</p>}
          </div>
          {Icon && (
            <div className="w-9 h-9 rounded-lg bg-stone-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon className="w-4 h-4 text-stone-400" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 border border-stone-200 rounded-xl shadow-xl text-xs">
      <p className="font-semibold text-stone-800 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
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
        <Loader2 className="w-8 h-8 animate-spin text-[#E05A47]" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12" data-testid="hr-claims-error">
        <p className="text-stone-500">Failed to load claims data</p>
      </div>
    );
  }

  const {
    total_claims, total_claimed_amount,
    total_incurred_amount, total_paid_amount,
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
    { name: "Claimed", amount: total_claimed_amount, fill: "#3b82f6" },
    { name: "Incurred", amount: total_incurred_amount || 0, fill: "#8b5cf6" },
    { name: "Paid", amount: total_paid_amount || 0, fill: "#10b981" },
    { name: "Rejected", amount: rejected_claims, fill: "#ef4444" },
  ];

  const statusBadge = (status) => {
    const colors = {
      Settled: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Rejected: "bg-red-50 text-red-700 border-red-200",
      "In Process": "bg-blue-50 text-blue-700 border-blue-200",
      Submitted: "bg-amber-50 text-amber-700 border-amber-200",
      Closed: "bg-stone-50 text-stone-600 border-stone-200",
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[status] || colors.Closed}`}>{status}</span>;
  };

  const renderLabel = ({ name, value, percent }) => {
    if (percent < 0.05) return null;
    return `${name}: ${value}`;
  };

  return (
    <div className="space-y-6" data-testid="hr-claims-dashboard">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-[#E05A47] to-orange-400 rounded-xl flex items-center justify-center">
          <FileCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-stone-800 font-heading">Claims Dashboard</h2>
          <p className="text-xs text-stone-500">Real-time claims analytics for your assigned policies</p>
        </div>
      </div>

      {/* Row 1 - Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Claims" value={total_claims} subtext={fmt(total_claimed_amount)} color="border-l-blue-500" icon={FileCheck} />
        <MetricCard label="Cashless" value={cashless_count} subtext={fmt(cashless_claims)} color="border-l-emerald-500" icon={ShieldCheck} />
        <MetricCard label="Reimbursement" value={reimbursement_count} subtext={fmt(reimbursement_claims)} color="border-l-purple-500" icon={DollarSign} />
        <MetricCard label="Rejected" value={rejected_count} subtext={fmt(rejected_claims)} color="border-l-red-500" icon={ShieldX} />
      </div>

      {/* Row 2 - Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Under Process" value={under_process_count} subtext={fmt(under_process_claims)} color="border-l-amber-500" icon={Clock} />
        <MetricCard label="Total Premium" value={total_premium} color="border-l-indigo-500" icon={DollarSign} />
        <MetricCard label="Claims Ratio" value={`${claims_ratio}%`} subtext="Claims / Premium" color="border-l-teal-500" icon={PieChartIcon} />
        <MetricCard label="Annual Claims Trend" value={annual_claims_trend} color="border-l-orange-500" icon={TrendingUp} />
      </div>

      {/* Row 3 - Settlement & Incurred */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 hover:shadow-lg transition-all">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Settlement Ratio</p>
            <p className="text-3xl font-bold text-emerald-700 mt-2" data-testid="settlement-ratio">{settlement_ratio}%</p>
            <p className="text-[10px] text-emerald-500 mt-1">Paid vs Claimed</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 hover:shadow-lg transition-all">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">Total Incurred</p>
            <p className="text-3xl font-bold text-blue-700 mt-2">{fmt(total_incurred_amount || 0)}</p>
            <p className="text-[10px] text-blue-500 mt-1">Across all claims</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100 hover:shadow-lg transition-all">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-purple-600 font-medium uppercase tracking-wider">Total Paid</p>
            <p className="text-3xl font-bold text-purple-700 mt-2">{fmt(total_paid_amount || 0)}</p>
            <p className="text-[10px] text-purple-500 mt-1">Amount disbursed</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Pie */}
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Claims by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={renderLabel} labelLine={false} strokeWidth={2} animationBegin={0} animationDuration={1200}>
                    {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="white" />)}
                  </Pie>
                  <Tooltip content={CustomTooltip} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-stone-400 py-8">No claims yet</p>}
          </CardContent>
        </Card>

        {/* Claims Amount Breakdown Bar */}
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Claims Amount Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {total_claims > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={summaryBarData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v/100000)}L`} axisLine={false} />
                  <Tooltip content={CustomTooltip} />
                  <Bar dataKey="amount" name="Amount" radius={[8, 8, 0, 0]} maxBarSize={52} animationBegin={200} animationDuration={1000}>
                    {summaryBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-stone-400 py-8">No data</p>}
          </CardContent>
        </Card>

        {/* Claim Type Pie */}
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Cashless vs Reimbursement</CardTitle>
          </CardHeader>
          <CardContent>
            {typePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={typePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={renderLabel} labelLine={false} strokeWidth={2} animationBegin={400} animationDuration={1200}>
                    {typePieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="white" />)}
                  </Pie>
                  <Tooltip content={CustomTooltip} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-stone-400 py-8">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-stone-700">Monthly Claims Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {monthly_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
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
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v/100000)}L`} axisLine={false} />
                <Tooltip content={CustomTooltip} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Area yAxisId="left" type="monotone" dataKey="count" name="Claims Count" stroke="#3b82f6" fill="url(#claimCountGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} animationBegin={0} animationDuration={1500} />
                <Area yAxisId="right" type="monotone" dataKey="amount" name="Claims Amount" stroke="#10b981" fill="url(#claimAmountGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} animationBegin={300} animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-stone-400 py-8">No trend data available yet</p>}
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card className="hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-stone-700">Claims Synopsis</CardTitle>
            <Badge variant="secondary" className="text-xs">{claims.length} records</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <p className="text-center text-stone-400 py-8">No claims available. Admin will update claim details.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="hr-claims-table">
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="text-xs font-semibold">Claim #</TableHead>
                    <TableHead className="text-xs font-semibold">Policy</TableHead>
                    <TableHead className="text-xs font-semibold">Policy Type</TableHead>
                    <TableHead className="text-xs font-semibold">Claim Type</TableHead>
                    <TableHead className="text-xs font-semibold">Report Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Claimed</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Incurred</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.slice(0, 50).map((c) => (
                    <TableRow key={c.id} className="hover:bg-stone-50/50 transition-colors">
                      <TableCell className="text-xs font-medium text-stone-800">{c.claim_number}</TableCell>
                      <TableCell className="text-xs text-stone-600">{c.policy_number}</TableCell>
                      <TableCell className="text-xs"><Badge variant="secondary" className="text-[10px]">{c.policy_type || "-"}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <span className={`inline-flex items-center gap-1 ${c.claim_type === 'Cashless' ? 'text-emerald-600' : 'text-purple-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.claim_type === 'Cashless' ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                          {c.claim_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-stone-500">{c.claims_report_date || "-"}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-stone-800">{fmt(c.claimed_amount)}</TableCell>
                      <TableCell className="text-xs text-right text-stone-600">{fmt(c.incurred_amount || 0)}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-stone-800">{fmt(c.paid_amount || 0)}</TableCell>
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
