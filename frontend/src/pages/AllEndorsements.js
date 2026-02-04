import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Edit, Trash2, Loader2, Filter, X, Eye, Download, ChevronDown, ChevronUp } from "lucide-react";

const EndorsementsPage = () => {
  const [endorsements, setEndorsements] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingEndorsement, setEditingEndorsement] = useState(null);
  const [viewingEndorsement, setViewingEndorsement] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [filters, setFilters] = useState({
    policy_number: "all",
    relationship_type: "all",
  });
  const [stats, setStats] = useState(null);

  const [formData, setFormData] = useState({
    policy_number: "",
    employee_id: "",
    member_name: "",
    dob: "",
    age: "",
    gender: "",
    relationship_type: "",
    endorsement_type: "",
    date_of_joining: "",
    date_of_leaving: "",
    coverage_type: "",
    sum_insured: "",
    endorsement_date: "",
    effective_date: "",
    remarks: "",
  });

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

  const fetchEndorsements = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = `${API}/endorsements`;
      const params = [];
      
      if (filters.policy_number && filters.policy_number !== "all") {
        params.push(`policy_number=${filters.policy_number}`);
      }
      if (filters.relationship_type && filters.relationship_type !== "all") {
        params.push(`relationship_type=${filters.relationship_type}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEndorsements(response.data);
    } catch (error) {
      console.error("Error fetching endorsements:", error);
      toast.error("Failed to fetch endorsements");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
    fetchEndorsements();
    fetchStats();
  }, [fetchPolicies, fetchEndorsements, fetchStats]);

  const handleEdit = (endorsement) => {
    setEditingEndorsement(endorsement);
    setFormData({
      policy_number: endorsement.policy_number,
      employee_id: endorsement.employee_id || "",
      member_name: endorsement.member_name,
      dob: endorsement.dob || "",
      age: endorsement.age || "",
      gender: endorsement.gender || "",
      relationship_type: endorsement.relationship_type,
      endorsement_type: endorsement.endorsement_type,
      date_of_joining: endorsement.date_of_joining || "",
      date_of_leaving: endorsement.date_of_leaving || "",
      coverage_type: endorsement.coverage_type || "",
      sum_insured: endorsement.sum_insured || "",
      endorsement_date: endorsement.endorsement_date,
      effective_date: endorsement.effective_date || "",
      remarks: endorsement.remarks || "",
    });
    setIsDialogOpen(true);
  };

  const handleView = (endorsement) => {
    setViewingEndorsement(endorsement);
    setIsViewDialogOpen(true);
  };

  const toggleExpand = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/endorsements/${editingEndorsement.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement updated successfully");
      setIsDialogOpen(false);
      fetchEndorsements();
    } catch (error) {
      console.error("Error updating endorsement:", error);
      toast.error(error.response?.data?.detail || "Failed to update endorsement");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this endorsement?")) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/endorsements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement deleted");
      fetchEndorsements();
    } catch (error) {
      console.error("Error deleting endorsement:", error);
      toast.error(error.response?.data?.detail || "Failed to delete endorsement");
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/endorsements/download/approved`;
      if (filters.policy_number && filters.policy_number !== "all") {
        url += `?policy_number=${filters.policy_number}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob"
      });
      
      const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = urlBlob;
      link.setAttribute("download", `endorsements_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Excel downloaded successfully");
    } catch (error) {
      console.error("Error downloading:", error);
      toast.error("Failed to download Excel. Make sure there are approved endorsements.");
    }
  };

  const getRelationshipColor = (type) => {
    const colors = {
      'Employee': 'bg-blue-100 text-blue-800',
      'Spouse': 'bg-pink-100 text-pink-800',
      'Kids': 'bg-green-100 text-green-800',
      'Mother': 'bg-purple-100 text-purple-800',
      'Father': 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="all-endorsements-page">
      {/* Stats Cards */}
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
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All Endorsements</CardTitle>
              <CardDescription>View and manage all endorsement records (latest first)</CardDescription>
            </div>
            <Button onClick={handleDownloadExcel} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={filters.policy_number} onValueChange={(value) => { setFilters({...filters, policy_number: value}); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Policies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Policies</SelectItem>
                {policies.map((p) => (<SelectItem key={p.id} value={p.policy_number}>{p.policy_number}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filters.relationship_type} onValueChange={(value) => { setFilters({...filters, relationship_type: value}); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Relationships</SelectItem>
                <SelectItem value="Employee">Employee</SelectItem>
                <SelectItem value="Spouse">Spouse</SelectItem>
                <SelectItem value="Kids">Kids</SelectItem>
                <SelectItem value="Mother">Mother</SelectItem>
                <SelectItem value="Father">Father</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { setFilters({ policy_number: "all", relationship_type: "all" }); }}>
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
            <Button size="sm" onClick={fetchEndorsements}>Apply</Button>
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
                    <TableHead>Member Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pro-rata Premium</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endorsements.map((endorsement) => (
                    <>
                      <TableRow key={endorsement.id} data-testid={`endorsement-row-${endorsement.id}`}>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => toggleExpand(endorsement.id)}>
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
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(endorsement.status)}`}>
                            {endorsement.status}
                          </span>
                        </TableCell>
                        <TableCell className={`font-semibold ${endorsement.prorata_premium < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {endorsement.prorata_premium < 0 ? `₹${Math.abs(endorsement.prorata_premium).toLocaleString()} (Refund)` : `₹${endorsement.prorata_premium.toLocaleString()}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleView(endorsement)}><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(endorsement)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(endorsement.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
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
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Endorsement Details</DialogTitle>
          </DialogHeader>
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
              <div><span className="font-semibold">Endorsement Date:</span> {viewingEndorsement.endorsement_date}</div>
              <div><span className="font-semibold">Effective Date:</span> {viewingEndorsement.effective_date}</div>
              <div><span className="font-semibold">Pro-rata Premium:</span> <span className={viewingEndorsement.prorata_premium < 0 ? 'text-red-600' : 'text-green-600'}>{viewingEndorsement.prorata_premium < 0 ? `₹${Math.abs(viewingEndorsement.prorata_premium).toLocaleString()} (Refund)` : `₹${viewingEndorsement.prorata_premium.toLocaleString()}`}</span></div>
              <div><span className="font-semibold">Status:</span> <span className={`px-2 py-1 rounded text-xs ${getStatusColor(viewingEndorsement.status)}`}>{viewingEndorsement.status}</span></div>
              <div className="col-span-2"><span className="font-semibold">Remarks:</span> {viewingEndorsement.remarks || "-"}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Endorsement</DialogTitle>
            <DialogDescription>Update the endorsement details</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Member Name</Label>
              <Input value={formData.member_name} onChange={(e) => setFormData({ ...formData, member_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>DOB</Label>
              <Input type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relationship Type</Label>
              <Select value={formData.relationship_type} onValueChange={(value) => setFormData({ ...formData, relationship_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Spouse">Spouse</SelectItem>
                  <SelectItem value="Kids">Kids</SelectItem>
                  <SelectItem value="Mother">Mother</SelectItem>
                  <SelectItem value="Father">Father</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Endorsement Type</Label>
              <Select value={formData.endorsement_type} onValueChange={(value) => setFormData({ ...formData, endorsement_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Addition">Addition</SelectItem>
                  <SelectItem value="Deletion">Deletion</SelectItem>
                  <SelectItem value="Correction">Correction</SelectItem>
                  <SelectItem value="Midterm addition">Midterm addition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Joining</Label>
              <Input type="date" value={formData.date_of_joining} onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date of Leaving</Label>
              <Input type="date" value={formData.date_of_leaving} onChange={(e) => setFormData({ ...formData, date_of_leaving: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Coverage Type</Label>
              <Select value={formData.coverage_type} onValueChange={(value) => setFormData({ ...formData, coverage_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Floater">Floater</SelectItem>
                  <SelectItem value="Non-Floater">Non-Floater</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sum Insured</Label>
              <Input type="number" value={formData.sum_insured} onChange={(e) => setFormData({ ...formData, sum_insured: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Endorsement Date</Label>
              <Input type="date" value={formData.endorsement_date} onChange={(e) => setFormData({ ...formData, endorsement_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input type="date" value={formData.effective_date} onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Remarks</Label>
              <Input value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EndorsementsPage;
