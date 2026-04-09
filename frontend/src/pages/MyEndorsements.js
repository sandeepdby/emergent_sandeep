import React from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Filter, X, Trash2, Eye, Pencil } from "lucide-react";

class MyEndorsements extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      endorsements: [],
      loading: true,
      filters: { status: "all", relationship_type: "all" },
      stats: null,
      viewDialogOpen: false,
      editDialogOpen: false,
      selectedEndorsement: null,
      editData: {},
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
      if (this.state.filters.status !== "all") params.push(`status=${this.state.filters.status}`);
      if (this.state.filters.relationship_type !== "all") params.push(`relationship_type=${this.state.filters.relationship_type}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      this.setState({ endorsements: response.data });
    } catch (error) {
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
      console.error(error);
    }
  };

  handleFilterChange = (key, value) => {
    this.setState(prev => ({ filters: { ...prev.filters, [key]: value } }), () => this.fetchEndorsements());
  };

  clearFilters = () => {
    this.setState({ filters: { status: "all", relationship_type: "all" } }, () => this.fetchEndorsements());
  };

  handleDelete = async (endorsementId) => {
    if (!window.confirm("Are you sure you want to delete this pending endorsement?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/endorsements/${endorsementId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Endorsement deleted");
      this.fetchEndorsements();
      this.fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete");
    }
  };

  openView = (endorsement) => {
    this.setState({ selectedEndorsement: endorsement, viewDialogOpen: true });
  };

  openEdit = (endorsement) => {
    this.setState({
      selectedEndorsement: endorsement,
      editData: {
        member_name: endorsement.member_name || "",
        employee_id: endorsement.employee_id || "",
        dob: endorsement.dob || "",
        age: endorsement.age != null ? String(endorsement.age) : "",
        gender: endorsement.gender || "",
        relationship_type: endorsement.relationship_type || "",
        endorsement_type: endorsement.endorsement_type || "",
        endorsement_date: endorsement.endorsement_date || "",
        effective_date: endorsement.effective_date || "",
        remarks: endorsement.remarks || "",
      },
      editDialogOpen: true,
    });
  };

  handleEditSave = async (e) => {
    e.preventDefault();
    const { selectedEndorsement, editData } = this.state;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/endorsements/${selectedEndorsement.id}`, {
        member_name: editData.member_name,
        employee_id: editData.employee_id || null,
        dob: editData.dob || null,
        age: editData.age ? parseInt(editData.age) : null,
        gender: editData.gender || null,
        relationship_type: editData.relationship_type,
        endorsement_type: editData.endorsement_type,
        endorsement_date: editData.endorsement_date,
        effective_date: editData.effective_date || null,
        remarks: editData.remarks || null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Endorsement updated");
      this.setState({ editDialogOpen: false });
      this.fetchEndorsements();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update");
    }
  };

  getStatusColor = (status) => {
    return { Pending: "bg-yellow-100 text-yellow-800", Approved: "bg-green-100 text-green-800", Rejected: "bg-red-100 text-red-800" }[status] || "bg-gray-100 text-gray-800";
  };

  render() {
    const { endorsements, loading, filters, stats, viewDialogOpen, editDialogOpen, selectedEndorsement, editData } = this.state;

    return (
      <div className="space-y-6" data-testid="my-endorsements-page">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total_endorsements}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{stats.approved}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{stats.rejected}</div></CardContent></Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(v) => this.handleFilterChange("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Select value={filters.relationship_type} onValueChange={(v) => this.handleFilterChange("relationship_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Button onClick={this.clearFilters} variant="outline" className="w-full"><X className="w-4 h-4 mr-2" />Clear Filters</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Endorsements</CardTitle>
            <CardDescription>View, edit and manage your submitted endorsements</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            ) : endorsements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No endorsements found. Submit your first endorsement!</div>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="my-endorsements-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Annual Premium</TableHead>
                      <TableHead>Pro-rata Premium</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endorsements.map((e) => (
                      <TableRow key={e.id} data-testid={`endorsement-row-${e.id}`}>
                        <TableCell className="font-medium">{e.policy_number}</TableCell>
                        <TableCell>{e.employee_id || "—"}</TableCell>
                        <TableCell>{e.member_name}</TableCell>
                        <TableCell><Badge variant="outline">{e.relationship_type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={e.endorsement_type === "Addition" || e.endorsement_type === "Midterm addition" ? "default" : e.endorsement_type === "Deletion" ? "destructive" : "secondary"}>
                            {e.endorsement_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(e.endorsement_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-gray-600">₹{e.annual_premium_per_life?.toLocaleString() || '—'}</TableCell>
                        <TableCell className={`font-semibold ${e.prorata_premium < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {e.prorata_premium < 0 ? `₹${Math.abs(e.prorata_premium).toLocaleString()} (Refund)` : `₹${e.prorata_premium.toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${this.getStatusColor(e.status)}`}>{e.status}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => this.openView(e)} data-testid={`view-endorsement-${e.id}`}>
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Button>
                            {e.status === "Pending" && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => this.openEdit(e)} data-testid={`edit-endorsement-${e.id}`}>
                                  <Pencil className="w-4 h-4 text-amber-600" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => this.handleDelete(e.id)} data-testid={`delete-endorsement-${e.id}`}>
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </>
                            )}
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

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={() => this.setState({ viewDialogOpen: false })}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Endorsement Details</DialogTitle>
              <DialogDescription>Full details of the selected endorsement</DialogDescription>
            </DialogHeader>
            {selectedEndorsement && (
              <div className="grid grid-cols-2 gap-3 text-sm" data-testid="view-endorsement-dialog">
                <div><span className="text-gray-500 block text-xs">Policy Number</span><strong>{selectedEndorsement.policy_number}</strong></div>
                <div><span className="text-gray-500 block text-xs">Employee ID</span><strong>{selectedEndorsement.employee_id || "—"}</strong></div>
                <div><span className="text-gray-500 block text-xs">Member Name</span><strong>{selectedEndorsement.member_name}</strong></div>
                <div><span className="text-gray-500 block text-xs">Relationship</span><strong>{selectedEndorsement.relationship_type}</strong></div>
                <div><span className="text-gray-500 block text-xs">Endorsement Type</span><strong>{selectedEndorsement.endorsement_type}</strong></div>
                <div><span className="text-gray-500 block text-xs">Status</span><Badge variant={selectedEndorsement.status === "Approved" ? "default" : selectedEndorsement.status === "Rejected" ? "destructive" : "secondary"}>{selectedEndorsement.status}</Badge></div>
                <div><span className="text-gray-500 block text-xs">DOB</span><strong>{selectedEndorsement.dob || "—"}</strong></div>
                <div><span className="text-gray-500 block text-xs">Age</span><strong>{selectedEndorsement.age || "—"}</strong></div>
                <div><span className="text-gray-500 block text-xs">Gender</span><strong>{selectedEndorsement.gender || "—"}</strong></div>
                <div><span className="text-gray-500 block text-xs">Sum Insured</span><strong>{selectedEndorsement.sum_insured ? `₹${selectedEndorsement.sum_insured.toLocaleString()}` : "—"}</strong></div>
                <div><span className="text-gray-500 block text-xs">Endorsement Date</span><strong>{selectedEndorsement.endorsement_date}</strong></div>
                <div><span className="text-gray-500 block text-xs">Effective Date</span><strong>{selectedEndorsement.effective_date}</strong></div>
                <div><span className="text-gray-500 block text-xs">Date of Joining</span><strong>{selectedEndorsement.date_of_joining || "—"}</strong></div>
                <div><span className="text-gray-500 block text-xs">Date of Leaving</span><strong>{selectedEndorsement.date_of_leaving || "—"}</strong></div>
                <div><span className="text-gray-500 block text-xs">Annual Premium/Life</span><strong>₹{selectedEndorsement.annual_premium_per_life?.toLocaleString() || "—"}</strong></div>
                <div><span className="text-gray-500 block text-xs">Pro-rata Premium</span><strong className={selectedEndorsement.prorata_premium < 0 ? "text-red-600" : "text-green-600"}>₹{selectedEndorsement.prorata_premium?.toLocaleString()}</strong></div>
                <div className="col-span-2"><span className="text-gray-500 block text-xs">Remarks</span><strong>{selectedEndorsement.remarks || "—"}</strong></div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={() => this.setState({ editDialogOpen: false })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Endorsement</DialogTitle>
              <DialogDescription>Update pending endorsement details</DialogDescription>
            </DialogHeader>
            <form onSubmit={this.handleEditSave}>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Member Name *</Label>
                  <Input value={editData.member_name || ""} onChange={(e) => this.setState({ editData: { ...editData, member_name: e.target.value } })} required data-testid="edit-member-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Employee ID</Label>
                    <Input value={editData.employee_id || ""} onChange={(e) => this.setState({ editData: { ...editData, employee_id: e.target.value } })} data-testid="edit-employee-id" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gender</Label>
                    <Select value={editData.gender || "none"} onValueChange={(v) => this.setState({ editData: { ...editData, gender: v === "none" ? "" : v } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not Set</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Endorsement Date *</Label>
                    <Input type="date" value={editData.endorsement_date || ""} onChange={(e) => this.setState({ editData: { ...editData, endorsement_date: e.target.value } })} required data-testid="edit-endorsement-date" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Effective Date</Label>
                    <Input type="date" value={editData.effective_date || ""} onChange={(e) => this.setState({ editData: { ...editData, effective_date: e.target.value } })} data-testid="edit-effective-date" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Remarks</Label>
                  <Input value={editData.remarks || ""} onChange={(e) => this.setState({ editData: { ...editData, remarks: e.target.value } })} data-testid="edit-remarks" />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => this.setState({ editDialogOpen: false })}>Cancel</Button>
                <Button type="submit" data-testid="edit-save-btn">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
}

export default MyEndorsements;
