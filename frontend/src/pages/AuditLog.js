import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_BADGES = {
  LOGIN: "outline",
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  APPROVE: "default",
  REJECT: "destructive",
  REGISTER: "default",
  CREATE_USER: "default",
  DELETE_USER: "destructive",
  PROMOTE: "default",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ action: "", resource: "", username: "" });

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchLog = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 30 };
      if (filters.action) params.action = filters.action;
      if (filters.resource) params.resource = filters.resource;
      if (filters.username) params.username = filters.username;
      const res = await axios.get(`${API}/audit-log`, { headers, params });
      setEntries(res.data.entries);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filters.action, filters.resource, filters.username]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const formatTime = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  };

  return (
    <div className="space-y-4" data-testid="audit-log-page">
      <div className="flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-gray-800">Audit Log</h2>
        <Badge variant="outline" className="ml-2">{total} entries</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filters.action} onValueChange={v => { setFilters({...filters, action: v === "all" ? "" : v}); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="audit-action-filter"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="LOGIN">Login</SelectItem>
            <SelectItem value="REGISTER">Register</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
            <SelectItem value="APPROVED">Approve</SelectItem>
            <SelectItem value="REJECTED">Reject</SelectItem>
            <SelectItem value="CREATE_USER">Create User</SelectItem>
            <SelectItem value="DELETE_USER">Delete User</SelectItem>
            <SelectItem value="PROMOTE">Promote</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.resource} onValueChange={v => { setFilters({...filters, resource: v === "all" ? "" : v}); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="audit-resource-filter"><SelectValue placeholder="All Resources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="policy">Policy</SelectItem>
            <SelectItem value="endorsement">Endorsement</SelectItem>
            <SelectItem value="claim">Claim</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="cd_ledger">CD Ledger</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search username..."
          value={filters.username}
          onChange={e => { setFilters({...filters, username: e.target.value}); setPage(1); }}
          className="w-48"
          data-testid="audit-username-filter"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No audit log entries found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="audit-log-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Timestamp</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Resource</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">{formatTime(e.timestamp)}</TableCell>
                      <TableCell className="text-xs font-medium">{e.username}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{e.role}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={ACTION_BADGES[e.action] || "secondary"} className="text-[10px]">{e.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{e.resource}</TableCell>
                      <TableCell className="text-xs text-gray-600 max-w-xs truncate">{e.details || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="audit-prev-page">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="audit-next-page">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
