import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, Loader2, Eye, FileSpreadsheet, RefreshCw } from "lucide-react";

export default function ImportBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchEndorsements, setBatchEndorsements] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  const fetchBatches = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/endorsements/import-batches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBatches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const handleView = async (batch) => {
    setSelectedBatch(batch);
    setViewLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/endorsements/batch/${batch.batch_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBatchEndorsements(res.data);
    } catch (err) {
      toast.error("Failed to load batch details");
    } finally {
      setViewLoading(false);
    }
  };

  const handleDownload = async (batchId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/endorsements/batch/${batchId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `batch_${batchId.substring(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (err) {
      toast.error("Download failed");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="import-batches-page">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Excel Import Batches</CardTitle>
            <CardDescription>View and download HR-uploaded endorsement files for correction & approval</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchBatches} data-testid="refresh-batches-btn">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No import batches yet</p>
              <p className="text-sm mt-1">HR users can import endorsements via Excel</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="batches-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Policies</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.batch_id} data-testid={`batch-row-${batch.batch_id}`}>
                      <TableCell className="font-mono text-xs">{batch.batch_id.substring(0, 8)}...</TableCell>
                      <TableCell>{batch.submitted_by_name}</TableCell>
                      <TableCell><Badge variant="secondary">{batch.count}</Badge></TableCell>
                      <TableCell className="text-sm">{batch.policy_numbers?.join(", ")}</TableCell>
                      <TableCell className={`font-medium ${batch.total_premium >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ₹{Math.abs(batch.total_premium).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {batch.statuses?.map((s) => (
                            <Badge key={s} variant={s === "Approved" ? "default" : s === "Rejected" ? "destructive" : "secondary"} className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{batch.created_at ? new Date(batch.created_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleView(batch)} data-testid={`view-batch-${batch.batch_id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(batch.batch_id)} data-testid={`download-batch-${batch.batch_id}`}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Detail Dialog */}
      <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Batch: {selectedBatch?.batch_id?.substring(0, 8)}... — {selectedBatch?.count} records
            </DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Policy</TableHead>
                    <TableHead className="text-xs">Member</TableHead>
                    <TableHead className="text-xs">Relationship</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Annual Premium</TableHead>
                    <TableHead className="text-xs text-right">Pro-rata</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchEndorsements.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e.policy_number}</TableCell>
                      <TableCell className="text-xs">{e.member_name}</TableCell>
                      <TableCell className="text-xs">{e.relationship_type}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={e.endorsement_type === "Addition" ? "default" : e.endorsement_type === "Deletion" ? "destructive" : "secondary"} className="text-xs">
                          {e.endorsement_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">₹{e.annual_premium_per_life?.toLocaleString() || "—"}</TableCell>
                      <TableCell className={`text-xs text-right font-medium ${e.prorata_premium >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {e.prorata_premium >= 0 ? '+' : ''}₹{e.prorata_premium?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={e.status === "Approved" ? "default" : e.status === "Rejected" ? "destructive" : "secondary"} className="text-xs">
                          {e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => selectedBatch && handleDownload(selectedBatch.batch_id)}>
              <Download className="w-4 h-4 mr-1" /> Download Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
