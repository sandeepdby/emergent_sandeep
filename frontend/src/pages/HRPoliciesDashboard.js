import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Shield, Users, DollarSign, Activity, Layers } from "lucide-react";
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

  const { total_policies, active_policies, expired_policies, total_lives_covered, total_annual_premium, type_breakdown, policies } = analytics;

  const statusData = [
    { name: "Active", value: active_policies, color: "#10b981" },
    { name: "Expired", value: expired_policies, color: "#ef4444" },
    { name: "Other", value: Math.max(0, total_policies - active_policies - expired_policies), color: "#94a3b8" },
  ].filter(d => d.value > 0);

  const typeBarData = type_breakdown.map((t, i) => ({
    name: t.name,
    lives: t.lives,
    premium: Math.round(t.premium / 1000),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6" data-testid="hr-policies-dashboard">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-800">Policy Dashboard</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Policies</p>
            <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="total-policies-count">{total_policies}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="active-policies-count">{active_policies}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Expired</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{expired_policies}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">Lives Covered</p>
            </div>
            <p className="text-2xl font-bold text-purple-600 mt-1" data-testid="total-lives-count">{total_lives_covered.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">Annual Premium</p>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{total_annual_premium.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Policy Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-8">No policies yet</p>
            )}
          </CardContent>
        </Card>

        {/* Type Breakdown Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Layers className="w-4 h-4" /> By Policy Type (Lives)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typeBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={typeBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val, name) => name === "premium" ? `${val}K` : val} />
                  <Bar dataKey="lives" name="Lives" radius={[4, 4, 0, 0]}>
                    {typeBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-8">No data</p>
            )}
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
            <p className="text-center text-gray-400 py-8">No policies available. Contact Admin to add policies.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="hr-policies-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Policy #</TableHead>
                    <TableHead className="text-xs">Holder</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Inception</TableHead>
                    <TableHead className="text-xs">Expiry</TableHead>
                    <TableHead className="text-xs text-right">Lives</TableHead>
                    <TableHead className="text-xs text-right">Premium/Life</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-medium">{p.policy_number}</TableCell>
                      <TableCell className="text-xs">{p.policy_holder_name}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="text-xs">{p.policy_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={p.status === "Active" ? "default" : "destructive"} className="text-xs">{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{p.inception_date}</TableCell>
                      <TableCell className="text-xs">{p.expiry_date}</TableCell>
                      <TableCell className="text-xs text-right">{p.total_lives_covered}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{p.annual_premium_per_life.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</TableCell>
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
