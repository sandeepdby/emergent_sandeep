import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API, getAuthHeaders } from "../auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, Loader2, MessageSquare, ShieldOff, ShieldCheck, Search, RefreshCw } from "lucide-react";

const formatDate = (iso) => {
  if (!iso) return "--";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const toCsv = (rows, headers) => {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = headers.map((h) => esc(h.label)).join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(",")).join("\n");
  return `${head}\n${body}`;
};

const downloadCsv = (filename, csv) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function ConsentManagement() {
  const [optins, setOptins] = useState([]);
  const [suppressions, setSuppressions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        axios.get(`${API}/sms-optins`, { headers: getAuthHeaders() }),
        axios.get(`${API}/sms-suppressions`, { headers: getAuthHeaders() }),
      ]);
      setOptins(a.data || []);
      setSuppressions(b.data || []);
    } catch (err) {
      toast.error("Failed to load consent data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const q = search.trim().toLowerCase();
  const filterFn = (r) =>
    !q ||
    (r.phone || "").toLowerCase().includes(q) ||
    (r.name || "").toLowerCase().includes(q) ||
    (r.company || "").toLowerCase().includes(q);

  const filteredOptins = optins.filter(filterFn);
  const filteredSupp = suppressions.filter(filterFn);

  const exportOptins = () => {
    if (!filteredOptins.length) { toast.error("No opt-in records to export"); return; }
    const csv = toCsv(filteredOptins, [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "company", label: "Company" },
      { key: "channel", label: "Channel" },
      { key: "consent", label: "Consent" },
      { key: "consent_text", label: "Consent Text" },
      { key: "source", label: "Source" },
      { key: "created_at", label: "Opted In At" },
    ]);
    downloadCsv(`insurehub_optins_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Opt-in list exported");
  };

  const exportSuppressions = () => {
    if (!filteredSupp.length) { toast.error("No opt-out records to export"); return; }
    const csv = toCsv(filteredSupp, [
      { key: "phone", label: "Phone" },
      { key: "reason", label: "Keyword" },
      { key: "created_at", label: "Opted Out At" },
    ]);
    downloadCsv(`insurehub_optouts_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Opt-out list exported");
  };

  return (
    <div className="space-y-6" data-testid="consent-management-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#E05A47]" /> SMS / WhatsApp Consent
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Proof of opt-in and opt-out for Twilio toll-free verification. Export as CSV to submit.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} data-testid="consent-refresh-btn">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500">Opted In</p>
              <p className="text-3xl font-bold text-emerald-600" data-testid="optin-count">{optins.length}</p>
            </div>
            <ShieldCheck className="w-9 h-9 text-emerald-500/70" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500">Opted Out (STOP)</p>
              <p className="text-3xl font-bold text-red-600" data-testid="optout-count">{suppressions.length}</p>
            </div>
            <ShieldOff className="w-9 h-9 text-red-500/70" />
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input className="pl-9" placeholder="Search name, phone or company" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="consent-search" />
      </div>

      <Tabs defaultValue="optins">
        <TabsList>
          <TabsTrigger value="optins" data-testid="tab-optins">Opted In ({filteredOptins.length})</TabsTrigger>
          <TabsTrigger value="optouts" data-testid="tab-optouts">Opted Out ({filteredSupp.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="optins">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Opt-In Records</CardTitle>
                <CardDescription>Captured via the landing-page QR lead form.</CardDescription>
              </div>
              <Button size="sm" onClick={exportOptins} className="bg-[#E05A47] hover:bg-[#c94a38]" data-testid="export-optins-btn">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400" /></div>
              ) : filteredOptins.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-500">No opt-in records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b text-stone-500">
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Phone</th>
                        <th className="px-3 py-2 font-medium hidden md:table-cell">Company</th>
                        <th className="px-3 py-2 font-medium">Channel</th>
                        <th className="px-3 py-2 font-medium hidden md:table-cell">Opted In At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOptins.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-stone-50">
                          <td className="px-3 py-2">{r.name || "--"}</td>
                          <td className="px-3 py-2 font-mono">{r.phone}</td>
                          <td className="px-3 py-2 hidden md:table-cell">{r.company || "--"}</td>
                          <td className="px-3 py-2"><Badge variant="outline" className="text-xs capitalize">{r.channel || "both"}</Badge></td>
                          <td className="px-3 py-2 hidden md:table-cell text-stone-500">{formatDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optouts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Opt-Out Records (STOP)</CardTitle>
                <CardDescription>Numbers that texted STOP — automatically excluded from all sends.</CardDescription>
              </div>
              <Button size="sm" onClick={exportSuppressions} className="bg-[#E05A47] hover:bg-[#c94a38]" data-testid="export-optouts-btn">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400" /></div>
              ) : filteredSupp.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-500">No opt-out records.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b text-stone-500">
                        <th className="px-3 py-2 font-medium">Phone</th>
                        <th className="px-3 py-2 font-medium">Keyword</th>
                        <th className="px-3 py-2 font-medium hidden md:table-cell">Opted Out At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSupp.map((r, i) => (
                        <tr key={r.phone + i} className="border-b last:border-0 hover:bg-stone-50">
                          <td className="px-3 py-2 font-mono">{r.phone}</td>
                          <td className="px-3 py-2"><Badge variant="destructive" className="text-xs">{r.reason || "STOP"}</Badge></td>
                          <td className="px-3 py-2 hidden md:table-cell text-stone-500">{formatDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
