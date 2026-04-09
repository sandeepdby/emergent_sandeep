import { useState, useEffect } from "react";
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
import { Edit, Trash2, Loader2, Filter, X, Eye } from "lucide-react";

const EndorsementsPage = () => {
  const [endorsements, setEndorsements] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewEndorsement, setViewEndorsement] = useState(null);
  const [editingEndorsement, setEditingEndorsement] = useState(null);
  const [filters, setFilters] = useState({
    policy_number: "all",
    relationship_type: "all",
  });
  const [stats, setStats] = useState(null);

  const [formData, setFormData] = useState({
    policy_number: "",
    member_name: "",
    relationship_type: "",
    endorsement_type: "",
    endorsement_date: "",
    effective_date: "",
  });

  useEffect(() => {
    fetchPolicies();
    fetchEndorsements();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPolicies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/policies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolicies(response.data);
    } catch (error) {
      console.error("Error fetching policies:", error);
    }
  };

  const fetchEndorsements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = `${API}/endorsements`;
      const params = new URLSearchParams();
      if (filters.policy_number && filters.policy_number !== "all") params.append("policy_number", filters.policy_number);
      if (filters.relationship_type && filters.relationship_type !== "all") params.append("relationship_type", filters.relationship_type);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
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
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/endorsements/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const applyFilters = () => {
    fetchEndorsements();
  };

  const clearFilters = () => {
    setFilters({ policy_number: "all", relationship_type: "all" });
    setTimeout(() => fetchEndorsements(), 100);
  };

  const handleEdit = (endorsement) => {
    setEditingEndorsement(endorsement);
    setFormData({
      policy_number: endorsement.policy_number,
      member_name: endorsement.member_name,
      relationship_type: endorsement.relationship_type,
      endorsement_type: endorsement.endorsement_type,
      endorsement_date: endorsement.endorsement_date,
      effective_date: endorsement.effective_date,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEndorsement) {
        const updateData = {
          member_name: formData.member_name,
          relationship_type: formData.relationship_type,
          endorsement_type: formData.endorsement_type,
          endorsement_date: formData.endorsement_date,
          effective_date: formData.effective_date || formData.endorsement_date,
        };
        const token = localStorage.getItem('token');
        await axios.put(`${API}/endorsements/${editingEndorsement.id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Endorsement updated successfully");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchEndorsements();
      fetchStats();
    } catch (error) {
      console.error("Error saving endorsement:", error);
      toast.error(error.response?.data?.detail || "Failed to save endorsement");
    }
  };

  const handleDelete = async (endorsementId) => {
    if (!window.confirm("Are you sure you want to delete this endorsement?")) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/endorsements/${endorsementId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement deleted successfully");
      fetchEndorsements();
      fetchStats();
    } catch (error) {
      console.error("Error deleting endorsement:", error);
      toast.error("Failed to delete endorsement");
    }
  };

  const resetForm = () => {
    setFormData({
      policy_number: "",
      member_name: "",
      relationship_type: "",
      endorsement_type: "",
      endorsement_date: "",
      effective_date: "",
    });
    setEditingEndorsement(null);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const getRelationshipColor = (type) => {
    const colors = {
      Employee: "bg-blue-100 text-blue-800",
      Spouse: "bg-pink-100 text-pink-800",
      Kids: "bg-green-100 text-green-800",
      Mother: "bg-purple-100 text-purple-800",
      Father: "bg-orange-100 text-orange-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6" data-testid="endorsements-page">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Endorsements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="total-endorsements">{stats.total_endorsements}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="total-policies">{stats.total_policies}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Additions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.by_endorsement_type.find(t => t._id === "Addition")?.count || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Deletions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.by_endorsement_type.find(t => t._id === "Deletion")?.count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Policy Number</Label>
              <Select
                value={filters.policy_number}
                onValueChange={(value) => handleFilterChange("policy_number", value)}
              >
                <SelectTrigger data-testid="filter-policy-select">
                  <SelectValue placeholder="All Policies" />
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
            <div className="space-y-2">
              <Label>Relationship Type</Label>
              <Select
                value={filters.relationship_type}
                onValueChange={(value) => handleFilterChange("relationship_type", value)}
              >
                <SelectTrigger data-testid="filter-relationship-select">
                  <SelectValue placeholder="All Relationships" />
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
            <div className="flex items-end gap-2">
              <Button onClick={applyFilters} className="flex-1" data-testid="apply-filters-button">
                <Filter className="w-4 h-4 mr-2" />
                Apply
              </Button>
              <Button onClick={clearFilters} variant="outline" data-testid="clear-filters-button">
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endorsements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Endorsements</CardTitle>
          <CardDescription>View and manage policy endorsements</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : endorsements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No endorsements found. Import endorsements from the Import Excel page.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Member Name</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Endorsement Date</TableHead>
                    <TableHead>Remaining Days</TableHead>
                    <TableHead>Annual Premium</TableHead>
                    <TableHead>Pro-rata Premium</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endorsements.map((endorsement) => (
                    <TableRow key={endorsement.id} data-testid={`endorsement-row-${endorsement.id}`}>
                      <TableCell className="font-medium">{endorsement.policy_number}</TableCell>
                      <TableCell>{endorsement.employee_id || "-"}</TableCell>
                      <TableCell>{endorsement.member_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRelationshipColor(endorsement.relationship_type)}`}>
                          {endorsement.relationship_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={endorsement.endorsement_type === "Addition" || endorsement.endorsement_type === "Midterm addition" ? "default" : endorsement.endorsement_type === "Deletion" ? "destructive" : "secondary"}>
                          {endorsement.endorsement_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{endorsement.sum_insured ? `₹${endorsement.sum_insured.toLocaleString()}` : "-"}</TableCell>
                      <TableCell>{new Date(endorsement.endorsement_date).toLocaleDateString()}</TableCell>
                      <TableCell>{endorsement.remaining_days} days</TableCell>
                      <TableCell className="text-gray-600">₹{endorsement.annual_premium_per_life?.toLocaleString() || '—'}</TableCell>
                      <TableCell className={`font-semibold ${endorsement.prorata_premium < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {endorsement.prorata_premium < 0 ? `₹${Math.abs(endorsement.prorata_premium).toLocaleString()} (Refund)` : `₹${endorsement.prorata_premium.toLocaleString()}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setViewEndorsement(endorsement); setViewDialogOpen(true); }}
                          data-testid={`view-endorsement-${endorsement.id}`}
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(endorsement)}
                          data-testid={`edit-endorsement-${endorsement.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(endorsement.id)}
                          data-testid={`delete-endorsement-${endorsement.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Endorsement</DialogTitle>
            <DialogDescription>Update the endorsement details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="member_name">Member Name</Label>
                <Input
                  id="member_name"
                  data-testid="edit-member-name-input"
                  value={formData.member_name}
                  onChange={(e) => setFormData({ ...formData, member_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship_type">Relationship Type</Label>
                <Select
                  value={formData.relationship_type}
                  onValueChange={(value) => setFormData({ ...formData, relationship_type: value })}
                >
                  <SelectTrigger data-testid="edit-relationship-select">
                    <SelectValue />
                  </SelectTrigger>
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
                <Label htmlFor="endorsement_type">Endorsement Type</Label>
                <Select
                  value={formData.endorsement_type}
                  onValueChange={(value) => setFormData({ ...formData, endorsement_type: value })}
                >
                  <SelectTrigger data-testid="edit-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Addition">Addition</SelectItem>
                    <SelectItem value="Deletion">Deletion</SelectItem>
                    <SelectItem value="Correction">Correction</SelectItem>
                    <SelectItem value="Midterm addition">Midterm addition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endorsement_date">Endorsement Date</Label>
                <Input
                  id="endorsement_date"
                  type="date"
                  data-testid="edit-endorsement-date-input"
                  value={formData.endorsement_date}
                  onChange={(e) => setFormData({ ...formData, endorsement_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effective_date">Effective Date</Label>
                <Input
                  id="effective_date"
                  type="date"
                  data-testid="edit-effective-date-input"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-endorsement-button">
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={() => setViewDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Endorsement Details</DialogTitle>
            <DialogDescription>Full details of the selected endorsement</DialogDescription>
          </DialogHeader>
          {viewEndorsement && (
            <div className="grid grid-cols-2 gap-3 text-sm" data-testid="view-endorsement-dialog">
              <div><span className="text-gray-500 block text-xs">Policy Number</span><strong>{viewEndorsement.policy_number}</strong></div>
              <div><span className="text-gray-500 block text-xs">Employee ID</span><strong>{viewEndorsement.employee_id || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Member Name</span><strong>{viewEndorsement.member_name}</strong></div>
              <div><span className="text-gray-500 block text-xs">Relationship</span><strong>{viewEndorsement.relationship_type}</strong></div>
              <div><span className="text-gray-500 block text-xs">Endorsement Type</span><strong>{viewEndorsement.endorsement_type}</strong></div>
              <div><span className="text-gray-500 block text-xs">Status</span><Badge variant={viewEndorsement.status === "Approved" ? "default" : viewEndorsement.status === "Rejected" ? "destructive" : "secondary"}>{viewEndorsement.status}</Badge></div>
              <div><span className="text-gray-500 block text-xs">DOB</span><strong>{viewEndorsement.dob || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Age</span><strong>{viewEndorsement.age || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Gender</span><strong>{viewEndorsement.gender || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Sum Insured</span><strong>{viewEndorsement.sum_insured ? `₹${viewEndorsement.sum_insured.toLocaleString()}` : "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Endorsement Date</span><strong>{viewEndorsement.endorsement_date}</strong></div>
              <div><span className="text-gray-500 block text-xs">Effective Date</span><strong>{viewEndorsement.effective_date}</strong></div>
              <div><span className="text-gray-500 block text-xs">Date of Joining</span><strong>{viewEndorsement.date_of_joining || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Date of Leaving</span><strong>{viewEndorsement.date_of_leaving || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Annual Premium/Life</span><strong>₹{viewEndorsement.annual_premium_per_life?.toLocaleString() || "—"}</strong></div>
              <div><span className="text-gray-500 block text-xs">Pro-rata Premium</span><strong className={viewEndorsement.prorata_premium < 0 ? "text-red-600" : "text-green-600"}>₹{viewEndorsement.prorata_premium?.toLocaleString()}</strong></div>
              <div className="col-span-2"><span className="text-gray-500 block text-xs">Remarks</span><strong>{viewEndorsement.remarks || "—"}</strong></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EndorsementsPage;