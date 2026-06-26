import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, FileCheck, TrendingUp, DollarSign, ShieldCheck, ShieldX, Clock, PieChart as PieChartIcon, Download, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const STATUS_COLORS = {
  Submitted: "#f59e0b",
  "In Process": "#3b82f6",
  Settled: "#10b981",
  Rejected: "#ef4444",
  Closed: "#6b7280",
};
const TYPE_COLORS = { Cashless: "#10b981", Reimbursement: "#8b5cf6" };
const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

const fmt = (v) => (v || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function AnimatedValue({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const num = typeof value === "number" ? value : parseFloat(value) || 0;
    if (num === 0) { setDisplay(0); return; }
    let start = 0;
    const step = num / 50;
    const timer = setInterval(() => {
      start += step;
      if (start >= num) { setDisplay(num); clearInterval(timer); } else setDisplay(Math.round(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{typeof value === "number" && value > 999 ? fmt(display) : display}</span>;
}

function MetricCard({ label, value, subtext, color, icon: Icon }) {
  return (
    <Card className={`border-l-4 ${color} hover:shadow-lg transition-all duration-300 group cursor-default`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-medium">{label}</p>
            <p className="text-2xl font-bold text-stone-900 mt-1 tabular-nums"><AnimatedValue value={value} /></p>
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

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 border border-stone-200 rounded-xl shadow-xl text-xs">
      <p className="font-semibold text-stone-800 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: {typeof p.value === "number" && p.value > 999 ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

function StatusPieChart({ data }) {
  if (!data || data.length === 0) return <p className="text-center text-stone-400 py-6 text-xs">No claims yet</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={2} animationDuration={1000}>
          {data.map((e, i) => <Cell key={i} fill={e.color} stroke="white" />)}
        </Pie>
        <Tooltip content={ChartTooltip} />
        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "10px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BreakdownBarChart({ data }) {
  if (!data || data.length === 0) return <p className="text-center text-stone-400 py-6 text-xs">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} interval={0} />
        <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${Math.round(v / 100000)}L`} axisLine={false} />
        <Tooltip content={ChartTooltip} />
        <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={800}>
          {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MonthlyBarChart({ data }) {
  if (!data || data.length === 0) return <p className="text-center text-stone-400 py-6 text-xs">No trend data yet</p>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 9 }} axisLine={false} allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={v => `${Math.round(v / 100000)}L`} axisLine={false} />
        <Tooltip content={ChartTooltip} />
        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
        <Bar yAxisId="left" dataKey="count" name="Claims Count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={800} />
        <Bar yAxisId="right" dataKey="amount" name="Claims Amount" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmployeeClaimsChart({ claims }) {
  // Aggregate incurred by employee+patient
  const empMap = {};
  claims.forEach(c => {
    const emp = c.employee_name || "Unknown";
    const patient = c.patient_name || emp;
    const key = `${emp} / ${patient}`;
    empMap[key] = (empMap[key] || 0) + (c.incurred_amount || 0);
  });
  const chartData = Object.entries(empMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  if (chartData.length === 0) return <p className="text-center text-stone-400 py-6 text-xs">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${Math.round(v / 100000)}L`} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} axisLine={false} />
        <Tooltip content={ChartTooltip} />
        <Bar dataKey="amount" name="Incurred Amount" radius={[0, 6, 6, 0]} maxBarSize={28} animationDuration={800}>
          {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function HRClaimsDashboard() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [claims, setClaims] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState("all");

  const fetchPolicies = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/policies`, { headers: { Authorization: `Bearer ${token}` } });
      setPolicies(res.data || []);
    } catch (err) { console.error(err); }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const policyParam = selectedPolicy !== "all" ? `?policy_number=${encodeURIComponent(selectedPolicy)}` : "";
      const claimsPolicyParam = selectedPolicy !== "all" ? `?policy_number=${encodeURIComponent(selectedPolicy)}` : "";
      const [analyticsRes, claimsRes] = await Promise.all([
        axios.get(`${API}/claims-analytics${policyParam}`, { headers }),
        axios.get(`${API}/claims${claimsPolicyParam}`, { headers }),
      ]);
      setAnalytics(analyticsRes.data);
      setClaims(claimsRes.data);
    } catch (err) {
      console.error("Error loading claims:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedPolicy]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadExcel = () => {
    if (claims.length === 0) { toast.error("No data to download"); return; }
    const headers = ["Claim #", "Policy", "Policy Type", "Claim Type", "Report Date", "Employee", "Patient", "Claimed", "Incurred", "Paid", "Status", "Remarks"];
    const rows = claims.map(c => [
      c.claim_number, c.policy_number, c.policy_type || "", c.claim_type,
      c.claims_report_date || "", c.employee_name || "", c.patient_name || "",
      c.claimed_amount || 0, c.incurred_amount || 0, c.paid_amount || 0,
      c.status, c.remarks || ""
    ]);
    let csv = "\uFEFF" + headers.join(",") + "\n";
    rows.forEach(r => { csv += r.map(v => `"${v}"`).join(",") + "\n"; });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claims_synopsis_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Claims downloaded");
  };

  if (loading) return <div className="flex items-center justify-center py-20" data-testid="hr-claims-loading"><Loader2 className="w-8 h-8 animate-spin text-[#E05A47]" /></div>;
  if (!analytics) return <div className="text-center py-12" data-testid="hr-claims-error"><p className="text-stone-500">Failed to load claims data</p></div>;

  const {
    total_claims, total_claimed_amount, total_incurred_amount, total_paid_amount,
    reimbursement_claims, reimbursement_count, cashless_claims, cashless_count,
    rejected_claims, rejected_count, under_process_claims, under_process_count,
    total_premium, claims_ratio, annual_claims_trend, total_policy_days, total_lives,
    status_distribution, type_distribution, monthly_trend
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

  return (
    <div className="space-y-6" data-testid="hr-claims-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#E05A47] to-orange-400 rounded-xl flex items-center justify-center">
            <FileCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-800 font-heading">Claims Dashboard</h2>
            <p className="text-xs text-stone-500">Real-time claims analytics for your assigned policies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-stone-500 whitespace-nowrap">Policy:</Label>
          <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
            <SelectTrigger className="w-[260px]" data-testid="claims-policy-filter">
              <SelectValue placeholder="All Policies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Policies</SelectItem>
              {policies.map(p => (
                <SelectItem key={p.id} value={p.policy_number}>{p.policy_number}{p.insurer_name ? ` — ${p.insurer_name}` : p.insurer ? ` — ${p.insurer}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Claims" value={total_claims} subtext={fmt(total_claimed_amount)} color="border-l-blue-500" icon={FileCheck} />
        <MetricCard label="Cashless" value={cashless_count} subtext={fmt(cashless_claims)} color="border-l-emerald-500" icon={ShieldCheck} />
        <MetricCard label="Reimbursement" value={reimbursement_count} subtext={fmt(reimbursement_claims)} color="border-l-purple-500" icon={DollarSign} />
        <MetricCard label="Rejected" value={rejected_count} subtext={fmt(rejected_claims)} color="border-l-red-500" icon={ShieldX} />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Under Process" value={under_process_count} subtext={fmt(under_process_claims)} color="border-l-amber-500" icon={Clock} />
        <MetricCard label="Total Premium" value={total_premium} color="border-l-indigo-500" icon={DollarSign} />
        <MetricCard label="Claims Ratio" value={`${claims_ratio}%`} subtext="Incurred / Premium" color="border-l-teal-500" icon={PieChartIcon} />
        <MetricCard label="Annual Claims Trend" value={annual_claims_trend} color="border-l-orange-500" icon={TrendingUp} />
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 hover:shadow-lg transition-all">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Total Lives</p>
            <p className="text-3xl font-bold text-emerald-700 mt-2" data-testid="total-lives">{total_lives || 0}</p>
            <p className="text-[10px] text-emerald-500 mt-1">Under latest policy</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-100 hover:shadow-lg transition-all">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-sky-600 font-medium uppercase tracking-wider">Policy Run Days</p>
            <p className="text-3xl font-bold text-sky-700 mt-2" data-testid="policy-run-days">{total_policy_days || 0}</p>
            <p className="text-[10px] text-sky-500 mt-1">Today - Inception Date</p>
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
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-stone-700">Claims by Status</CardTitle></CardHeader>
          <CardContent><StatusPieChart data={statusPieData} /></CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-stone-700">Claims Amount Breakdown</CardTitle></CardHeader>
          <CardContent><BreakdownBarChart data={summaryBarData} /></CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-stone-700">Cashless vs Reimbursement</CardTitle></CardHeader>
          <CardContent><StatusPieChart data={typePieData} /></CardContent>
        </Card>
      </div>

      {/* Monthly Bar + Employee Claims */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-stone-700">Monthly Claims</CardTitle></CardHeader>
          <CardContent><MonthlyBarChart data={monthly_trend} /></CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold text-stone-700">Highest Employee Claims (by Patient)</CardTitle></CardHeader>
          <CardContent><EmployeeClaimsChart claims={claims} /></CardContent>
        </Card>
      </div>

      {/* Claims Table */}
      <Card className="hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-stone-700">Claims Synopsis</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{claims.length} records</Badge>
              <Button variant="outline" size="sm" onClick={downloadExcel} data-testid="download-claims-synopsis-btn">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download
              </Button>
            </div>
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
                    <TableHead className="text-xs font-semibold">Type</TableHead>
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
                        <span className={`inline-flex items-center gap-1 ${c.claim_type === "Cashless" ? "text-emerald-600" : "text-purple-600"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.claim_type === "Cashless" ? "bg-emerald-400" : "bg-purple-400"}`} />
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
