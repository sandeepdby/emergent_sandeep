import React from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

class DownloadApproved extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      policies: [],
      selectedPolicy: "all",
      downloading: false,
      stats: null
    };
  }

  componentDidMount() {
    this.fetchPolicies();
    this.fetchStats();
  }

  fetchPolicies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/policies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      this.setState({ policies: response.data });
    } catch (error) {
      console.error("Error fetching policies:", error);
    }
  };

  fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/endorsements/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      this.setState({ stats: response.data });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  handleDownload = async () => {
    try {
      this.setState({ downloading: true });
      const token = localStorage.getItem('token');
      
      let url = `${API}/endorsements/download/approved`;
      if (this.state.selectedPolicy !== "all") {
        url += `?policy_number=${this.state.selectedPolicy}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob"
      });

      const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = urlBlob;
      link.setAttribute("download", `approved_endorsements_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlBlob);

      toast.success("Approved endorsements downloaded successfully");
    } catch (error) {
      console.error("Error downloading approved endorsements:", error);
      toast.error(error.response?.data?.detail || "Failed to download approved endorsements");
    } finally {
      this.setState({ downloading: false });
    }
  };

  render() {
    const { policies, selectedPolicy, downloading, stats } = this.state;

    return (
      <div className="space-y-6" data-testid="download-approved-page">
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Policies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_policies}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Endorsements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_endorsements}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Download Approved Endorsements</CardTitle>
            <CardDescription>
              Export approved endorsements to Excel format for sharing with insurers and client HR
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Policy (Optional)</Label>
                <Select
                  value={selectedPolicy}
                  onValueChange={(value) => this.setState({ selectedPolicy: value })}
                >
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Download Information</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Excel file includes all approved endorsements</li>
                      <li>Contains: Policy details, Employee ID, Member info (Name, DOB, Age, Gender)</li>
                      <li>Includes: Relationship Type, Endorsement Type, Coverage Type, Sum Insured</li>
                      <li>Calculated fields: Days from Inception, Remaining Days, Pro-rata Premium</li>
                      <li>Status info: Approval Date and Approved By</li>
                      <li>File format: .xlsx (Microsoft Excel)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button
                onClick={this.handleDownload}
                disabled={downloading}
                className="w-full"
                size="lg"
                data-testid="download-button"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating Excel File...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Download Approved Endorsements
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default DownloadApproved;
