import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Shield, Users, DollarSign, UserPlus, UserMinus } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function HRPoliciesDashboard() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/policies-analytics`, { headers });
      setAnalytics(res.data);
    } catch (err) {
      console.error("Error loading policy analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="hr-policies-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12" data-testid="hr-policies-error">
        <p className="text-gray-500">Failed to load policy data</p>
      </div>
    );
  }

  const {
    total_policies, active_policies, expired_policies,
    total_employees, total_spouse, total_kids, total_parents,
    total_lives, total_premium,
    total_addition_lives, total_deletion_lives,
    type_breakdown, policies
  } = analytics;

  const statusData = [
    { name: "Active", value: active_policies, color: "#10b981" },
    { name: "Expired", value: expired_policies, color: "#ef4444" },
    { name: "Other", value: Math.max(0, total_policies - active_policies - expired_policies), color: "#94a3b8" },
  ].filter(d => d.value > 0);

  const livesBreakdown = [
    { name: "Employees", value: total_employees, fill: "#3b82f6" },
    { name: "Spouse", value: total_spouse, fill: "#8b5cf6" },
    { name: "Kids", value: total_kids, fill: "#f59e0b" },
    { name: "Parents", value: total_parents, fill: "#10b981" },
  ].filter(d => d.value > 0);

  const typeBarData = type_breakdown.map((t, i) => ({
    name: t.name,
    policies: t.count,
    lives: t.lives,
    fill: COLORS[i % COLORS.length],
  }));

  const fmt = (v) => v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6" data-testid="hr-policies-dashboard">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-800">Policy Dashboard</h2>
      </div>

      {/* Row 1 — Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Policies</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5" data-testid="total-policies-count">{total_policies}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Active</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{active_policies}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Premium</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{fmt(total_premium)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-purple-400" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Lives</p>
            </div>
            <p className="text-xl font-bold text-purple-600 mt-0.5" data-testid="total-lives-count">{total_lives}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <UserPlus className="w-3 h-3 text-teal-400" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Additions</p>
            </div>
            <p className="text-xl font-bold text-teal-600 mt-0.5">{total_addition_lives}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <UserMinus className="w-3 h-3 text-red-400" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Deletions</p>
            </div>
            <p className="text-xl font-bold text-red-600 mt-0.5">{total_deletion_lives}</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2 — Life Category Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase">Employees</p>
          <p className="text-xl font-bold text-blue-600">{total_employees}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase">Spouse</p>
          <p className="text-xl font-bold text-purple-600">{total_spouse}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase">Kids</p>
          <p className="text-xl font-bold text-amber-600">{total_kids}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase">Parents</p>
          <p className="text-xl font-bold text-emerald-600">{total_parents}</p>
        </CardContent></Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Policy Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No data</p>}
          </CardContent>
        </Card>

        {/* Lives Breakdown Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Lives Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {livesBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={livesBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {livesBreakdown.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No data</p>}
          </CardContent>
        </Card>

        {/* Type Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">By Policy Type</CardTitle>
          </CardHeader>
          <CardContent>
            {typeBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={typeBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="lives" name="Lives" radius={[4, 4, 0, 0]}>
                    {typeBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Policy Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">All Policies</CardTitle>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No policies available. Contact Admin.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="hr-policies-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Policy #</TableHead>
                    <TableHead className="text-xs">Holder</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Family</TableHead>
                    <TableHead className="text-xs text-right">Premium</TableHead>
                    <TableHead className="text-xs text-right">Emp</TableHead>
                    <TableHead className="text-xs text-right">Spouse</TableHead>
                    <TableHead className="text-xs text-right">Kids</TableHead>
                    <TableHead className="text-xs text-right">Parents</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs text-right">Add</TableHead>
                    <TableHead className="text-xs text-right">Del</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-medium">{p.policy_number}</TableCell>
                      <TableCell className="text-xs">{p.policy_holder_name}</TableCell>
                      <TableCell className="text-xs">{p.policy_date || "-"}</TableCell>
                      <TableCell className="text-xs"><Badge variant="secondary" className="text-xs">{p.policy_type}</Badge></TableCell>
                      <TableCell className="text-xs"><Badge variant="outline" className="text-xs">{p.family_definition || "-"}</Badge></TableCell>
                      <TableCell className="text-xs text-right font-medium">{(p.premium || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-xs text-right">{p.employees_count || 0}</TableCell>
                      <TableCell className="text-xs text-right">{p.spouse_count || 0}</TableCell>
                      <TableCell className="text-xs text-right">{p.kids_count || 0}</TableCell>
                      <TableCell className="text-xs text-right">{p.parents_count || 0}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{p.total_lives_count || 0}</TableCell>
                      <TableCell className="text-xs text-right text-emerald-600">{p.addition_lives || 0}</TableCell>
                      <TableCell className="text-xs text-right text-red-600">{p.deletion_lives || 0}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={p.status === "Active" ? "default" : "destructive"} className="text-xs">{p.status}</Badge>
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
