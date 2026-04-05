import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, FileText, Clock, CheckCircle, XCircle, TrendingUp,
  TrendingDown, DollarSign, BarChart3
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

const COLORS = ["#f59e0b", "#10b981", "#ef4444"];
const TYPE_COLORS = { Addition: "#3b82f6", Deletion: "#ef4444", Correction: "#8b5cf6", "Midterm addition": "#10b981" };

export default function HRSummary() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [recent, setRecent] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [analyticsRes, endorsementsRes] = await Promise.all([
        axios.get(`${API}/dashboard/analytics`, { headers }),
        axios.get(`${API}/endorsements`, { headers }),
      ]);
      setAnalytics(analyticsRes.data);
      setRecent(endorsementsRes.data.slice(0, 8));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="hr-summary-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard</p>
        <Button onClick={fetchData} className="mt-3">Retry</Button>
      </div>
    );
  }

  const { status_distribution: dist, premium_summary: prem } = analytics;
  const totalPremCharge = prem?.total_charge || 0;
  const totalRefund = prem?.total_refund || 0;
  const netPremium = prem?.net_premium || 0;

  const statusData = [
    { name: "Pending", value: dist.pending, color: "#f59e0b" },
    { name: "Approved", value: dist.approved, color: "#10b981" },
    { name: "Rejected", value: dist.rejected, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const typeData = (analytics.by_endorsement_type || []).map(t => ({
    name: t._id || "Unknown",
    count: t.count,
    premium: Math.round(t.total_premium || 0),
    fill: TYPE_COLORS[t._id] || "#94a3b8",
  }));

  return (
    <div className="space-y-6" data-testid="hr-summary-page">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Submitted</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{dist.total}</p>
              </div>
              <FileText className="w-9 h-9 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pending</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{dist.pending}</p>
              </div>
              <Clock className="w-9 h-9 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Approved</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{dist.approved}</p>
              </div>
              <CheckCircle className="w-9 h-9 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Rejected</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{dist.rejected}</p>
              </div>
              <XCircle className="w-9 h-9 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Impact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Premium Charges</p>
                <p className="text-lg font-bold text-emerald-600">₹{totalPremCharge.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Refunds</p>
                <p className="text-lg font-bold text-red-600">₹{totalRefund.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><DollarSign className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Net Premium Impact</p>
                <p className={`text-lg font-bold ${netPremium >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {netPremium >= 0 ? "+" : ""}₹{netPremium.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-8">No data yet</p>
            )}
          </CardContent>
        </Card>

        {/* By Type Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">By Endorsement Type</CardTitle>
          </CardHeader>
          <CardContent>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {typeData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-8">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Endorsements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Recent Endorsements</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No endorsements submitted yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="hr-recent-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Policy</TableHead>
                    <TableHead className="text-xs">Member</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Pro-rata</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-medium">{e.policy_number}</TableCell>
                      <TableCell className="text-xs">{e.member_name}</TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant={e.endorsement_type === "Addition" ? "default" : e.endorsement_type === "Deletion" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {e.endorsement_type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-xs text-right font-medium ${e.prorata_premium >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {e.prorata_premium >= 0 ? "+" : ""}₹{Math.abs(e.prorata_premium).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant={e.status === "Approved" ? "default" : e.status === "Rejected" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {e.status}
                        </Badge>
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
