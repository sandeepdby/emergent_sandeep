import React from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Filter, X, Trash2 } from "lucide-react";

class MyEndorsements extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      endorsements: [],
      loading: true,
      filters: { status: "all", relationship_type: "all" },
      stats: null
    };
  }

  componentDidMount() {
    this.fetchEndorsements();
    this.fetchStats();
  }

  fetchEndorsements = async () => {
    try {
      this.setState({ loading: true });
      const token = localStorage.getItem('token');
      let url = `${API}/endorsements`;
      const params = [];
      
      if (this.state.filters.status !== "all") {
        params.push(`status=${this.state.filters.status}`);
      }
      if (this.state.filters.relationship_type !== "all") {
        params.push(`relationship_type=${this.state.filters.relationship_type}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      this.setState({ endorsements: response.data });
    } catch (error) {
      console.error("Error fetching endorsements:", error);
      toast.error("Failed to fetch endorsements");
    } finally {
      this.setState({ loading: false });
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

  handleFilterChange = (key, value) => {
    this.setState(prevState => ({
      filters: { ...prevState.filters, [key]: value }
    }), () => this.fetchEndorsements());
  };

  clearFilters = () => {
    this.setState({
      filters: { status: "all", relationship_type: "all" }
    }, () => this.fetchEndorsements());
  };

  handleDelete = async (endorsementId) => {
    if (!window.confirm("Are you sure you want to delete this pending endorsement?")) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/endorsements/${endorsementId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement deleted successfully");
      this.fetchEndorsements();
      this.fetchStats();
    } catch (error) {
      console.error("Error deleting endorsement:", error);
      toast.error(error.response?.data?.detail || "Failed to delete endorsement");
    }
  };

  getStatusColor = (status) => {
    const colors = {
      Pending: "bg-yellow-100 text-yellow-800",
      Approved: "bg-green-100 text-green-800",
      Rejected: "bg-red-100 text-red-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  getRelationshipColor = (type) => {
    const colors = {
      Employee: "bg-blue-100 text-blue-800",
      Spouse: "bg-pink-100 text-pink-800",
      Kids: "bg-green-100 text-green-800",
      Mother: "bg-purple-100 text-purple-800",
      Father: "bg-orange-100 text-orange-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  render() {
    const { endorsements, loading, filters, stats } = this.state;

    return (
      <div className="space-y-6" data-testid="my-endorsements-page">
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_endorsements}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => this.handleFilterChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Relationship Type</Label>
                <Select
                  value={filters.relationship_type}
                  onValueChange={(value) => this.handleFilterChange("relationship_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Relationships</SelectItem>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Kids">Kids</SelectItem>
                    <SelectItem value="Mother">Mother</SelectItem>
                    <SelectItem value="Father">Father</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={this.clearFilters} variant="outline" className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Endorsements</CardTitle>
            <CardDescription>View and manage your submitted endorsements</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : endorsements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No endorsements found. Submit your first endorsement!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Pro-rata Premium</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endorsements.map((endorsement) => (
                      <TableRow key={endorsement.id}>
                        <TableCell className="font-medium">{endorsement.policy_number}</TableCell>
                        <TableCell>{endorsement.employee_id || "-"}</TableCell>
                        <TableCell>{endorsement.member_name}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${this.getRelationshipColor(endorsement.relationship_type)}`}>
                            {endorsement.relationship_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={endorsement.endorsement_type === "Addition" || endorsement.endorsement_type === "Midterm addition" ? "default" : "secondary"}>
                            {endorsement.endorsement_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{endorsement.sum_insured ? `₹${endorsement.sum_insured.toLocaleString()}` : "-"}</TableCell>
                        <TableCell>{new Date(endorsement.endorsement_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-semibold">₹{endorsement.prorata_premium.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${this.getStatusColor(endorsement.status)}`}>
                            {endorsement.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {endorsement.status === "Pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => this.handleDelete(endorsement.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
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
}

export default MyEndorsements;