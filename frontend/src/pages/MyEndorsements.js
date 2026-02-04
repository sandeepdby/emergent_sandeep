import React from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Filter, X, Trash2, Eye, Edit, ChevronDown, ChevronUp } from "lucide-react";

class MyEndorsements extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      endorsements: [],
      loading: true,
      filters: { status: "all", relationship_type: "all" },
      stats: null,
      expandedRow: null,
      isViewDialogOpen: false,
      isEditDialogOpen: false,
      viewingEndorsement: null,
      editingEndorsement: null,
      formData: {}
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

  handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this endorsement?")) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/endorsements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement deleted");
      this.fetchEndorsements();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(error.response?.data?.detail || "Failed to delete endorsement");
    }
  };

  toggleExpand = (id) => {
    this.setState({ expandedRow: this.state.expandedRow === id ? null : id });
  };

  handleView = (endorsement) => {
    this.setState({ viewingEndorsement: endorsement, isViewDialogOpen: true });
  };

  handleEdit = (endorsement) => {
    this.setState({
      editingEndorsement: endorsement,
      formData: {
        employee_id: endorsement.employee_id || "",
        member_name: endorsement.member_name || "",
        dob: endorsement.dob || "",
        age: endorsement.age || "",
        gender: endorsement.gender || "",
        relationship_type: endorsement.relationship_type || "",
        endorsement_type: endorsement.endorsement_type || "",
        date_of_joining: endorsement.date_of_joining || "",
        date_of_leaving: endorsement.date_of_leaving || "",
        coverage_type: endorsement.coverage_type || "",
        sum_insured: endorsement.sum_insured || "",
        endorsement_date: endorsement.endorsement_date || "",
        effective_date: endorsement.effective_date || "",
        remarks: endorsement.remarks || "",
      },
      isEditDialogOpen: true
    });
  };

  handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/endorsements/${this.state.editingEndorsement.id}`, this.state.formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement updated successfully");
      this.setState({ isEditDialogOpen: false });
      this.fetchEndorsements();
    } catch (error) {
      console.error("Error updating:", error);
      toast.error(error.response?.data?.detail || "Failed to update endorsement");
    }
  };

  updateFormData = (field, value) => {
    this.setState({ formData: { ...this.state.formData, [field]: value } });
  };

  getRelationshipColor = (type) => {
    const colors = {
      'Employee': 'bg-blue-100 text-blue-800',
      'Spouse': 'bg-pink-100 text-pink-800',
      'Kids': 'bg-green-100 text-green-800',
      'Mother': 'bg-purple-100 text-purple-800',
      'Father': 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  getStatusColor = (status) => {
    const colors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  render() {
    const { endorsements, loading, filters, stats, expandedRow, isViewDialogOpen, isEditDialogOpen, viewingEndorsement, formData } = this.state;

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      );
    }

    return (
      <div className="space-y-6" data-testid="my-endorsements-page">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{stats.total_endorsements}</div><p className="text-sm text-gray-500">Total</p></CardContent></Card>
            <Card className="border-yellow-200"><CardContent className="pt-4"><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div><p className="text-sm text-gray-500">Pending</p></CardContent></Card>
            <Card className="border-green-200"><CardContent className="pt-4"><div className="text-2xl font-bold text-green-600">{stats.approved}</div><p className="text-sm text-gray-500">Approved</p></CardContent></Card>
            <Card className="border-red-200"><CardContent className="pt-4"><div className="text-2xl font-bold text-red-600">{stats.rejected}</div><p className="text-sm text-gray-500">Rejected</p></CardContent></Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>My Endorsements</CardTitle>
            <CardDescription>View and edit your submitted endorsements (latest first)</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <Select value={filters.status} onValueChange={(value) => this.setState({ filters: { ...filters, status: value } })}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.relationship_type} onValueChange={(value) => this.setState({ filters: { ...filters, relationship_type: value } })}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Relationships</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Spouse">Spouse</SelectItem>
                  <SelectItem value="Kids">Kids</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => this.setState({ filters: { status: "all", relationship_type: "all" } })}>
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
              <Button size="sm" onClick={this.fetchEndorsements}>Apply</Button>
            </div>

            {/* Table */}
            {endorsements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No endorsements found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Policy</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Pro-rata Premium</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endorsements.map((endorsement) => (
                      <React.Fragment key={endorsement.id}>
                        <TableRow>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => this.toggleExpand(endorsement.id)}>
                              {expandedRow === endorsement.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{endorsement.policy_number}</TableCell>
                          <TableCell>{endorsement.employee_id || "-"}</TableCell>
                          <TableCell>{endorsement.member_name}</TableCell>
                          <TableCell>
                            <Badge variant={endorsement.endorsement_type === "Addition" || endorsement.endorsement_type === "Midterm addition" ? "default" : endorsement.endorsement_type === "Deletion" ? "destructive" : "secondary"}>
                              {endorsement.endorsement_type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`font-semibold ${endorsement.prorata_premium < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {endorsement.prorata_premium < 0 ? `₹${Math.abs(endorsement.prorata_premium).toLocaleString()} (Refund)` : `₹${endorsement.prorata_premium.toLocaleString()}`}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${this.getStatusColor(endorsement.status)}`}>
                              {endorsement.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => this.handleView(endorsement)}><Eye className="w-4 h-4" /></Button>
                            {endorsement.status === "Pending" && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => this.handleEdit(endorsement)}><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => this.handleDelete(endorsement.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedRow === endorsement.id && (
                          <TableRow className="bg-gray-50">
                            <TableCell colSpan={8}>
                              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div><span className="font-semibold">DOB:</span> {endorsement.dob || "-"}</div>
                                <div><span className="font-semibold">Age:</span> {endorsement.age || "-"}</div>
                                <div><span className="font-semibold">Gender:</span> {endorsement.gender || "-"}</div>
                                <div><span className="font-semibold">Relationship:</span> {endorsement.relationship_type}</div>
                                <div><span className="font-semibold">DOJ:</span> {endorsement.date_of_joining || "-"}</div>
                                <div><span className="font-semibold">DOL:</span> {endorsement.date_of_leaving || "-"}</div>
                                <div><span className="font-semibold">Coverage:</span> {endorsement.coverage_type || "-"}</div>
                                <div><span className="font-semibold">Sum Insured:</span> {endorsement.sum_insured ? `₹${endorsement.sum_insured.toLocaleString()}` : "-"}</div>
                                <div><span className="font-semibold">Endorsement Date:</span> {endorsement.endorsement_date}</div>
                                <div><span className="font-semibold">Effective Date:</span> {endorsement.effective_date}</div>
                                <div><span className="font-semibold">Remaining Days:</span> {endorsement.remaining_days}</div>
                                <div><span className="font-semibold">Remarks:</span> {endorsement.remarks || "-"}</div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={(open) => this.setState({ isViewDialogOpen: open })}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Endorsement Details</DialogTitle></DialogHeader>
            {viewingEndorsement && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold">Policy:</span> {viewingEndorsement.policy_number}</div>
                <div><span className="font-semibold">Employee ID:</span> {viewingEndorsement.employee_id || "-"}</div>
                <div><span className="font-semibold">Member Name:</span> {viewingEndorsement.member_name}</div>
                <div><span className="font-semibold">DOB:</span> {viewingEndorsement.dob || "-"}</div>
                <div><span className="font-semibold">Age:</span> {viewingEndorsement.age || "-"}</div>
                <div><span className="font-semibold">Gender:</span> {viewingEndorsement.gender || "-"}</div>
                <div><span className="font-semibold">Relationship:</span> {viewingEndorsement.relationship_type}</div>
                <div><span className="font-semibold">Endorsement Type:</span> {viewingEndorsement.endorsement_type}</div>
                <div><span className="font-semibold">Date of Joining:</span> {viewingEndorsement.date_of_joining || "-"}</div>
                <div><span className="font-semibold">Date of Leaving:</span> {viewingEndorsement.date_of_leaving || "-"}</div>
                <div><span className="font-semibold">Coverage Type:</span> {viewingEndorsement.coverage_type || "-"}</div>
                <div><span className="font-semibold">Sum Insured:</span> {viewingEndorsement.sum_insured ? `₹${viewingEndorsement.sum_insured.toLocaleString()}` : "-"}</div>
                <div><span className="font-semibold">Pro-rata Premium:</span> <span className={viewingEndorsement.prorata_premium < 0 ? 'text-red-600' : 'text-green-600'}>{viewingEndorsement.prorata_premium < 0 ? `₹${Math.abs(viewingEndorsement.prorata_premium).toLocaleString()} (Refund)` : `₹${viewingEndorsement.prorata_premium.toLocaleString()}`}</span></div>
                <div><span className="font-semibold">Status:</span> <span className={`px-2 py-1 rounded text-xs ${this.getStatusColor(viewingEndorsement.status)}`}>{viewingEndorsement.status}</span></div>
                <div className="col-span-2"><span className="font-semibold">Remarks:</span> {viewingEndorsement.remarks || "-"}</div>
              </div>
            )}
            <DialogFooter><Button variant="outline" onClick={() => this.setState({ isViewDialogOpen: false })}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => this.setState({ isEditDialogOpen: open })}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Endorsement</DialogTitle>
              <DialogDescription>Update the endorsement details (only pending endorsements can be edited)</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={formData.employee_id || ""} onChange={(e) => this.updateFormData('employee_id', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Member Name</Label>
                <Input value={formData.member_name || ""} onChange={(e) => this.updateFormData('member_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>DOB</Label>
                <Input type="date" value={formData.dob || ""} onChange={(e) => this.updateFormData('dob', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input type="number" value={formData.age || ""} onChange={(e) => this.updateFormData('age', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date of Joining</Label>
                <Input type="date" value={formData.date_of_joining || ""} onChange={(e) => this.updateFormData('date_of_joining', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date of Leaving</Label>
                <Input type="date" value={formData.date_of_leaving || ""} onChange={(e) => this.updateFormData('date_of_leaving', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sum Insured</Label>
                <Input type="number" value={formData.sum_insured || ""} onChange={(e) => this.updateFormData('sum_insured', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Endorsement Date</Label>
                <Input type="date" value={formData.endorsement_date || ""} onChange={(e) => this.updateFormData('endorsement_date', e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Remarks</Label>
                <Input value={formData.remarks || ""} onChange={(e) => this.updateFormData('remarks', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => this.setState({ isEditDialogOpen: false })}>Cancel</Button>
              <Button onClick={this.handleUpdate}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
}

export default MyEndorsements;
