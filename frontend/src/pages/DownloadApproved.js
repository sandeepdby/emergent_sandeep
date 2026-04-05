import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

export default function DownloadApproved() {
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState("all");
  const [downloading, setDownloading] = useState(false);
  const [stats, setStats] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("excel");
  const [pdfType, setPdfType] = useState("detailed");

  const fetchPolicies = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/policies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolicies(response.data);
    } catch (error) {
      console.error("Error fetching policies:", error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/endorsements/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
    fetchStats();
  }, [fetchPolicies, fetchStats]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem('token');
      
      let url, filename, mimeType;
      
      if (downloadFormat === "excel") {
        url = `${API}/endorsements/download/approved`;
        if (selectedPolicy !== "all") {
          url += `?policy_number=${selectedPolicy}`;
        }
        filename = `approved_endorsements_${new Date().toISOString().split('T')[0]}.xlsx`;
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else {
        url = `${API}/endorsements/download/pdf?report_type=${pdfType}`;
        if (selectedPolicy !== "all") {
          url += `&policy_number=${selectedPolicy}`;
        }
        filename = `endorsements_${pdfType}_${new Date().toISOString().split('T')[0]}.pdf`;
        mimeType = "application/pdf";
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob"
      });

      const urlBlob = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const link = document.createElement("a");
      link.href = urlBlob;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlBlob);

      toast.success(`Report downloaded successfully as ${downloadFormat.toUpperCase()}`);
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error(error.response?.data?.detail || "Failed to download report");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="download-approved-page">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Total Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Total Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.total_policies}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Total Endorsements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.total_endorsements}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Download Approved Endorsements</CardTitle>
          <CardDescription>
            Export approved endorsements in Excel or PDF format for sharing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Filters */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Policy (Optional)</Label>
                <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
                  <SelectTrigger data-testid="policy-filter-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Policies</SelectItem>
                    {policies.map((policy) => (
                      <SelectItem key={policy.id} value={policy.policy_number}>
                        {policy.policy_number} - {policy.policy_holder_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Download Format</Label>
                <RadioGroup value={downloadFormat} onValueChange={setDownloadFormat}>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-green-50 cursor-pointer">
                    <RadioGroupItem value="excel" id="format-excel" />
                    <Label htmlFor="format-excel" className="flex items-center gap-2 cursor-pointer flex-1">
                      <FileSpreadsheet className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="font-medium">Excel (.xlsx)</div>
                        <div className="text-sm text-gray-500">Full data with all 27 columns</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-red-50 cursor-pointer">
                    <RadioGroupItem value="pdf" id="format-pdf" />
                    <Label htmlFor="format-pdf" className="flex items-center gap-2 cursor-pointer flex-1">
                      <FileText className="w-5 h-5 text-red-600" />
                      <div>
                        <div className="font-medium">PDF Report</div>
                        <div className="text-sm text-gray-500">Formatted report for printing/sharing</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {downloadFormat === "pdf" && (
                <div className="space-y-3 pl-4 border-l-2 border-red-200">
                  <Label>PDF Report Type</Label>
                  <RadioGroup value={pdfType} onValueChange={setPdfType}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="summary" id="pdf-summary" />
                      <Label htmlFor="pdf-summary" className="cursor-pointer">
                        <span className="font-medium">Summary Report</span>
                        <span className="text-sm text-gray-500 block">Statistics, totals, and charts overview</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="detailed" id="pdf-detailed" />
                      <Label htmlFor="pdf-detailed" className="cursor-pointer">
                        <span className="font-medium">Detailed Report</span>
                        <span className="text-sm text-gray-500 block">Full endorsement list in table format</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            {/* Right Column - Info */}
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-2">Excel Export Includes:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Policy details & Employee ID</li>
                      <li>Member info (Name, DOB, Age, Gender)</li>
                      <li>Endorsement & Coverage Type</li>
                      <li><strong>Premium Type</strong> (Charge/Refund)</li>
                      <li>Pro-rata Premium calculations</li>
                      <li>Approval Date & Approved By</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <FileText className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-2">PDF Export Includes:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Summary:</strong> Total counts, premium breakdown</li>
                      <li><strong>Summary:</strong> Charge vs Refund totals</li>
                      <li><strong>Detailed:</strong> Full table with key columns</li>
                      <li>Ready for printing & email sharing</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full"
            size="lg"
            data-testid="download-button"
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating {downloadFormat === "excel" ? "Excel" : "PDF"} File...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Download as {downloadFormat === "excel" ? "Excel (.xlsx)" : "PDF"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
