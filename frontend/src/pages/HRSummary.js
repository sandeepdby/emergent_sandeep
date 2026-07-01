import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, FileText, Clock, CheckCircle, XCircle, TrendingUp,
  TrendingDown, DollarSign, BarChart3, Shield, Activity, PieChart as PieChartIcon, ChevronDown, Download
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TYPE_COLORS = { Addition: "#3b82f6", Deletion: "#ef4444", Correction: "#8b5cf6", "Midterm addition": "#10b981" };
const fmt = (v) => `₹${(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function AnimVal({ value, prefix = "" }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    const n = typeof value === "number" ? value : parseFloat(value) || 0;
    if (n === 0) { setD(0); return; }
    let s = 0; const step = n / 40;
    const t = setInterval(() => { s += step; if (s >= n) { setD(n); clearInterval(t); } else setD(Math.round(s)); }, 16);
    return () => clearInterval(t);
  }, [value]);
  return <span>{prefix}{typeof value === "number" && Math.abs(value) > 999 ? fmt(d) : d}</span>;
}

function StatCard({ label, value, subtext, color, icon: Icon, large }) {
  return (
    <Card className={`border-l-4 ${color} hover:shadow-lg transition-all group`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-medium">{label}</p>
            <p className={`${large ? 'text-3xl' : 'text-2xl'} font-bold text-stone-900 mt-1 tabular-nums`}><AnimVal value={value} /></p>
            {subtext && <p className="text-xs text-stone-400 mt-0.5">{subtext}</p>}
          </div>
          {Icon && <div className="w-9 h-9 rounded-lg bg-stone-50 flex items-center justify-center group-hover:scale-110 transition-transform"><Icon className="w-4 h-4 text-stone-400" /></div>}
        </div>
      </CardContent>
    </Card>
  );
}

function GradCard({ label, value, subtext, icon: Icon, from, to, border, textColor, iconBg }) {
  return (
    <Card className={`bg-gradient-to-br ${from} ${to} ${border} hover:shadow-lg transition-all`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
            <Icon className={`w-6 h-6 ${textColor}`} />
          </div>
          <div>
            <p className={`text-[10px] ${textColor} font-semibold uppercase tracking-wider`}>{label}</p>
            <p className={`text-2xl font-bold ${textColor.replace('600', '800')} mt-0.5`}>{typeof value === "string" ? value : fmt(value)}</p>
            {subtext && <p className={`text-[10px] ${textColor.replace('600', '400')} mt-0.5`}>{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 border border-stone-200 rounded-xl shadow-xl text-xs">
      <p className="font-semibold text-stone-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: {typeof p.value === "number" && p.value > 100 ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function HRSummary() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [claimsAnalytics, setClaimsAnalytics] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [recent, setRecent] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [analyticsRes, endorsementsRes, claimsRes, policiesRes] = await Promise.all([
        axios.get(`${API}/dashboard/analytics`, { headers }),
        axios.get(`${API}/endorsements`, { headers }),
        axios.get(`${API}/claims-analytics`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/policies`, { headers }).catch(() => ({ data: [] })),
      ]);
      setAnalytics(analyticsRes.data);
      setRecent(endorsementsRes.data.slice(0, 8));
      setClaimsAnalytics(claimsRes.data);
      setPolicies(policiesRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportPDF = async (sendEmail = false) => {
    try {
      setExporting(true);
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API}/financial-summary/export?send_email_flag=${sendEmail}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `InsureHub_Financial_Summary.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(sendEmail ? "PDF downloaded & emailed to you!" : "PDF downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20" data-testid="hr-summary-loading"><Loader2 className="w-8 h-8 animate-spin text-[#E05A47]" /></div>;
  if (!analytics) return <div className="text-center py-12"><p className="text-stone-500">Failed to load dashboard</p><Button onClick={fetchData} className="mt-3">Retry</Button></div>;

  const { status_distribution: dist, premium_summary: prem } = analytics;
  const totalPremCharge = prem?.total_charge || 0;
  const totalRefund = prem?.total_refund || 0;
  const netPremium = prem?.net_premium || 0;

  // FY in India: Apr 1 - Mar 31
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStart = new Date(fyStartYear, 3, 1);
  const fyEnd = new Date(fyStartYear + 1, 2, 31);

  // Filter policies where BOTH inception AND expiry fall within current FY
  const currentFYPolicies = policies.filter(p => {
    const startStr = p.policy_date || p.inception_date || p.start_date;
    const endStr = p.expiry_date || p.end_date;
    if (!startStr) return false;
    const startDt = new Date(startStr);
    const endDt = endStr ? new Date(endStr) : null;
    const startInFY = startDt >= fyStart && startDt <= fyEnd;
    const endInFY = endDt ? (endDt >= fyStart && endDt <= fyEnd) : true;
    return startInFY && endInFY;
  });

  // Extract unique product types from policies
  const productTypes = [...new Set(currentFYPolicies.map(p => {
    const pn = (p.policy_number || "").toUpperCase();
    if (pn.startsWith("GMC") || (p.policy_type || "").toLowerCase().includes("health")) return "GMC - Group Health";
    if (pn.startsWith("GTL") || (p.policy_type || "").toLowerCase().includes("term")) return "GTL - Group Term";
    if (pn.startsWith("GPA") || (p.policy_type || "").toLowerCase().includes("accident")) return "GPA - Group Accident";
    return p.policy_type || "Other";
  }))];

  const filteredFYPolicies = selectedProduct === "all"
    ? currentFYPolicies
    : currentFYPolicies.filter(p => {
        const pn = (p.policy_number || "").toUpperCase();
        const pt = (p.policy_type || "").toLowerCase();
        if (selectedProduct === "GMC - Group Health") return pn.startsWith("GMC") || pt.includes("health");
        if (selectedProduct === "GTL - Group Term") return pn.startsWith("GTL") || pt.includes("term");
        if (selectedProduct === "GPA - Group Accident") return pn.startsWith("GPA") || pt.includes("accident");
        return (p.policy_type || "Other") === selectedProduct;
      });

  const totalPoliciesPremium = filteredFYPolicies.reduce((sum, p) => {
    const pVal = p.premium || ((p.annual_premium_per_life || 0) * (p.total_lives_covered || 0));
    return sum + pVal;
  }, 0);

  const claimsRatio = claimsAnalytics?.claims_ratio || 0;

  const statusData = [
    { name: "Pending", value: dist.pending, color: "#f59e0b" },
    { name: "Approved", value: dist.approved, color: "#10b981" },
    { name: "Rejected", value: dist.rejected, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const typeData = (analytics.by_endorsement_type || []).map(t => ({
    name: t._id || "Unknown", count: t.count, premium: Math.round(t.total_premium || 0),
    fill: TYPE_COLORS[t._id] || "#94a3b8",
  }));

  return (
    <div className="space-y-6" data-testid="hr-summary-page">
      {/* Row 1: Endorsement Stats */}
      <div className="flex items-center justify-between">
        <div />
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={() => handleExportPDF(true)}
          data-testid="export-fy-report-btn"
          className="text-xs gap-1.5"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? "Generating…" : "Export FY Report"}
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Submitted" value={dist.total} color="border-l-blue-500" icon={FileText} large />
        <StatCard label="Pending" value={dist.pending} color="border-l-amber-500" icon={Clock} large />
        <StatCard label="Approved" value={dist.approved} color="border-l-emerald-500" icon={CheckCircle} large />
        <StatCard label="Rejected" value={dist.rejected} color="border-l-red-500" icon={XCircle} large />
      </div>

      {/* Row 2: Premium Impact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 rounded-xl"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-[10px] text-stone-500 uppercase tracking-wider font-medium">Premium Charges</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(totalPremCharge)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 rounded-xl"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-[10px] text-stone-500 uppercase tracking-wider font-medium">Refunds</p>
                <p className="text-lg font-bold text-red-600">{fmt(totalRefund)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-xl"><DollarSign className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-[10px] text-stone-500 uppercase tracking-wider font-medium">Net Premium Impact</p>
                <p className={`text-lg font-bold ${netPremium >= 0 ? "text-blue-600" : "text-red-600"}`}>{netPremium >= 0 ? "+" : ""}{fmt(netPremium)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Product Filter + Policy & Claims Metrics */}
      <Card className="hover:shadow-lg transition-all">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-semibold text-stone-700">Policy & Claims Summary — FY {fyStartYear}-{(fyStartYear+1).toString().slice(-2)}</h3>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-[220px]" data-testid="product-filter">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {productTypes.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Insurer-wise breakdown */}
          {filteredFYPolicies.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 text-left">
                    <th className="px-3 py-2 font-semibold text-stone-600">Policy Number</th>
                    <th className="px-3 py-2 font-semibold text-stone-600">Insurer</th>
                    <th className="px-3 py-2 font-semibold text-stone-600">Inception</th>
                    <th className="px-3 py-2 font-semibold text-stone-600">Expiry</th>
                    <th className="px-3 py-2 font-semibold text-stone-600">Lives</th>
                    <th className="px-3 py-2 font-semibold text-stone-600 text-right">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFYPolicies.map((p, i) => (
                    <tr key={p.id || i} className={`border-t ${i % 2 === 0 ? '' : 'bg-stone-50/50'}`}>
                      <td className="px-3 py-2 font-medium text-stone-800">{p.policy_number}</td>
                      <td className="px-3 py-2 text-stone-600">{p.insurer || p.insurance_company || "—"}</td>
                      <td className="px-3 py-2 text-stone-500">{p.policy_date || p.inception_date || p.start_date || "—"}</td>
                      <td className="px-3 py-2 text-stone-500">{p.expiry_date || p.end_date || "—"}</td>
                      <td className="px-3 py-2 text-stone-600">{p.total_lives_count || p.total_lives_covered || "—"}</td>
                      <td className="px-3 py-2 text-right font-bold text-stone-800">{fmt(p.premium || ((p.annual_premium_per_life || 0) * (p.total_lives_covered || 0)))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-stone-300 bg-stone-100">
                    <td colSpan={5} className="px-3 py-2 font-bold text-stone-700 text-right">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-indigo-700 text-sm">{fmt(totalPoliciesPremium)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {filteredFYPolicies.length === 0 && <p className="text-center text-stone-400 py-4 text-sm">No policies found for FY {fyStartYear}-{(fyStartYear+1).toString().slice(-2)}{selectedProduct !== "all" ? ` under ${selectedProduct}` : ""}</p>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <GradCard label="Total Policies Premium" value={totalPoliciesPremium} subtext={`${filteredFYPolicies.length} ${filteredFYPolicies.length === 1 ? 'policy' : 'policies'}${selectedProduct !== "all" ? ` (${selectedProduct})` : ""}`}
              icon={Shield} from="from-indigo-50" to="to-blue-50" border="border-indigo-100" textColor="text-indigo-600" iconBg="bg-indigo-100" />
            <GradCard label="Total Endorsement Premium" value={`${netPremium >= 0 ? "+" : ""}${fmt(netPremium)}`} subtext="Endorsement charges - refunds"
              icon={Activity} from="from-emerald-50" to="to-teal-50" border="border-emerald-100" textColor="text-emerald-600" iconBg="bg-emerald-100" />
            <GradCard label="Claims Ratio" value={`${claimsRatio}%`} subtext="Incurred claims / Policy premium"
              icon={PieChartIcon} from="from-orange-50" to="to-amber-50" border="border-orange-100" textColor="text-orange-600" iconBg="bg-orange-100" />
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} animationDuration={1000}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="white" />)}
                  </Pie>
                  <Tooltip content={ChartTip} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-stone-400 py-8">No data yet</p>}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">By Endorsement Type</CardTitle>
          </CardHeader>
          <CardContent>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={typeData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} />
                  <Tooltip content={ChartTip} />
                  <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={800}>
                    {typeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-stone-400 py-8">No data yet</p>}
          </CardContent>
        </Card>
      </div>

      {/* Recent Endorsements */}
      <Card className="hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-stone-700">Recent Endorsements</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-center text-stone-400 py-8">No endorsements submitted yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="hr-recent-table">
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="text-xs font-semibold">Policy</TableHead>
                    <TableHead className="text-xs font-semibold">Member</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Pro-rata</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((e) => (
                    <TableRow key={e.id} className="hover:bg-stone-50/50 transition-colors">
                      <TableCell className="text-xs font-medium text-stone-800">{e.policy_number}</TableCell>
                      <TableCell className="text-xs text-stone-600">{e.member_name}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={e.endorsement_type === "Addition" ? "default" : e.endorsement_type === "Deletion" ? "destructive" : "secondary"} className="text-[10px]">{e.endorsement_type}</Badge>
                      </TableCell>
                      <TableCell className={`text-xs text-right font-medium ${e.prorata_premium >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {e.prorata_premium >= 0 ? "+" : ""}₹{Math.abs(e.prorata_premium).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={e.status === "Approved" ? "default" : e.status === "Rejected" ? "destructive" : "secondary"} className="text-[10px]">{e.status}</Badge>
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
