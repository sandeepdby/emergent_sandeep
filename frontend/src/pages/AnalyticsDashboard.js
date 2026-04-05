import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Users, FileText, DollarSign, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, Area, AreaChart
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/dashboard/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="analytics-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load analytics</p>
        <Button onClick={fetchAnalytics} className="mt-4">Retry</Button>
      </div>
    );
  }

  const statusData = [
    { name: 'Pending', value: analytics.status_distribution.pending, color: '#f59e0b' },
    { name: 'Approved', value: analytics.status_distribution.approved, color: '#10b981' },
    { name: 'Rejected', value: analytics.status_distribution.rejected, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const typeData = analytics.by_endorsement_type.map((item, idx) => ({
    name: item._id,
    count: item.count,
    premium: item.total_premium,
    fill: COLORS[idx % COLORS.length]
  }));

  const relationshipData = analytics.by_relationship_type.map((item, idx) => ({
    name: item._id,
    count: item.count,
    fill: COLORS[idx % COLORS.length]
  }));

  const trendData = analytics.monthly_trend.map(item => ({
    month: item._id,
    count: item.count,
    premium: item.total_premium
  }));

  const policyData = analytics.by_policy.map(item => ({
    name: item._id,
    count: item.count,
    premium: Math.abs(item.total_premium)
  }));

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Comprehensive insights into your endorsement data</p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Total Endorsements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{analytics.status_distribution.total}</span>
              <FileText className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Total Premium (Charge)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">₹{analytics.premium_summary.total_charge.toLocaleString()}</span>
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Total Refund</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">₹{analytics.premium_summary.total_refund.toLocaleString()}</span>
              <TrendingDown className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Net Premium Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">₹{analytics.premium_summary.net_premium.toLocaleString()}</span>
              <DollarSign className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Breakdown of endorsements by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Endorsement Type Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Endorsements by Type</CardTitle>
            <CardDescription>Addition, Deletion, Correction breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value, name) => [name === 'premium' ? `₹${value.toLocaleString()}` : value, name]} />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Count" />
                <Bar dataKey="premium" fill="#10b981" name="Premium" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Trend</CardTitle>
            <CardDescription>Endorsement activity over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#93c5fd" name="Endorsements" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Relationship Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>By Relationship Type</CardTitle>
            <CardDescription>Distribution of member relationships</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={relationshipData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="count"
                  label={({ name, count }) => `${name}: ${count}`}
                >
                  {relationshipData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Policy Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Top Policies by Endorsement Count</CardTitle>
          <CardDescription>Policies with most endorsement activity</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={policyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip formatter={(value, name) => [name === 'premium' ? `₹${value.toLocaleString()}` : value, name]} />
              <Legend />
              <Bar dataKey="count" fill="#8b5cf6" name="Count" />
              <Bar dataKey="premium" fill="#ec4899" name="Premium (Absolute)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
