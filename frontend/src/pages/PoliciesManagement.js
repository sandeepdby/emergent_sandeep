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
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";

const PoliciesPage = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState({
    policy_number: "",
    policy_holder_name: "",
    policy_date: "",
    policy_type: "Group Health",
    family_definition: "ESKP",
    premium: "",
    employees_count: "",
    spouse_count: "",
    kids_count: "",
    parents_count: "",
    addition_lives: "",
    deletion_lives: "",
    status: "Active",
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/policies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolicies(response.data);
    } catch (error) {
      console.error("Error fetching policies:", error);
      toast.error("Failed to fetch policies");
    } finally {
      setLoading(false);
    }
  };

  const totalLives = () => {
    return (parseInt(formData.employees_count) || 0) + (parseInt(formData.spouse_count) || 0) + (parseInt(formData.kids_count) || 0) + (parseInt(formData.parents_count) || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        policy_number: formData.policy_number,
        policy_holder_name: formData.policy_holder_name,
        policy_date: formData.policy_date,
        policy_type: formData.policy_type,
        family_definition: formData.family_definition || null,
        premium: parseFloat(formData.premium) || 0,
        employees_count: parseInt(formData.employees_count) || 0,
        spouse_count: parseInt(formData.spouse_count) || 0,
        kids_count: parseInt(formData.kids_count) || 0,
        parents_count: parseInt(formData.parents_count) || 0,
        addition_lives: parseInt(formData.addition_lives) || 0,
        deletion_lives: parseInt(formData.deletion_lives) || 0,
        status: formData.status,
      };

      if (editingPolicy) {
        await axios.put(`${API}/policies/${editingPolicy.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Policy updated successfully");
      } else {
        await axios.post(`${API}/policies`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Policy created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPolicies();
    } catch (error) {
      console.error("Error saving policy:", error);
      toast.error(error.response?.data?.detail || "Failed to save policy");
    }
  };

  const handleEdit = (policy) => {
    setEditingPolicy(policy);
    setFormData({
      policy_number: policy.policy_number || "",
      policy_holder_name: policy.policy_holder_name || "",
      policy_date: policy.policy_date || policy.inception_date || "",
      policy_type: policy.policy_type || "Group Health",
      family_definition: policy.family_definition || "ESKP",
      premium: (policy.premium || 0).toString(),
      employees_count: (policy.employees_count || 0).toString(),
      spouse_count: (policy.spouse_count || 0).toString(),
      kids_count: (policy.kids_count || 0).toString(),
      parents_count: (policy.parents_count || 0).toString(),
      addition_lives: (policy.addition_lives || 0).toString(),
      deletion_lives: (policy.deletion_lives || 0).toString(),
      status: policy.status || "Active",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (policyId) => {
    if (!window.confirm("Are you sure you want to delete this policy?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/policies/${policyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Policy deleted successfully");
      fetchPolicies();
    } catch (error) {
      toast.error("Failed to delete policy");
    }
  };

  const resetForm = () => {
    setFormData({
      policy_number: "", policy_holder_name: "", policy_date: "", policy_type: "Group Health",
      family_definition: "ESKP",
      premium: "", employees_count: "", spouse_count: "", kids_count: "", parents_count: "",
      addition_lives: "", deletion_lives: "", status: "Active",
    });
    setEditingPolicy(null);
  };

  const handleDialogClose = () => { setIsDialogOpen(false); resetForm(); };

  const getPolicyTotalLives = (p) => {
    return (p.total_lives_count || p.total_lives_covered || 0);
  };

  return (
    <div className="space-y-6" data-testid="policies-page">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Insurance Policies</CardTitle>
              <CardDescription>Manage policy details with life category counts</CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="add-policy-button">
              <Plus className="w-4 h-4 mr-2" /> Add Policy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No policies found. Create your first policy to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="admin-policies-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Policy #</TableHead>
                    <TableHead className="text-xs">Holder</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Family Def.</TableHead>
                    <TableHead className="text-xs text-right">Premium</TableHead>
                    <TableHead className="text-xs text-right">Emp</TableHead>
                    <TableHead className="text-xs text-right">Spouse</TableHead>
                    <TableHead className="text-xs text-right">Kids</TableHead>
                    <TableHead className="text-xs text-right">Parents</TableHead>
                    <TableHead className="text-xs text-right">Total Lives</TableHead>
                    <TableHead className="text-xs text-right">Add</TableHead>
                    <TableHead className="text-xs text-right">Del</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id} data-testid={`policy-row-${policy.policy_number}`}>
                      <TableCell className="text-xs font-medium">{policy.policy_number}</TableCell>
                      <TableCell className="text-xs">{policy.policy_holder_name}</TableCell>
                      <TableCell className="text-xs">{policy.policy_date || policy.inception_date || "-"}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{policy.policy_type || "-"}</Badge></TableCell>
                      <TableCell className="text-xs"><Badge variant="secondary">{policy.family_definition || "-"}</Badge></TableCell>
                      <TableCell className="text-xs text-right font-medium">{(policy.premium || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-xs text-right">{policy.employees_count || 0}</TableCell>
                      <TableCell className="text-xs text-right">{policy.spouse_count || 0}</TableCell>
                      <TableCell className="text-xs text-right">{policy.kids_count || 0}</TableCell>
                      <TableCell className="text-xs text-right">{policy.parents_count || 0}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{getPolicyTotalLives(policy)}</TableCell>
                      <TableCell className="text-xs text-right text-emerald-600">{policy.addition_lives || 0}</TableCell>
                      <TableCell className="text-xs text-right text-red-600">{policy.deletion_lives || 0}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={policy.status === "Active" ? "default" : "secondary"}>{policy.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(policy)} data-testid={`edit-policy-${policy.policy_number}`}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(policy.id)} data-testid={`delete-policy-${policy.policy_number}`}>
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
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

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Policy" : "Create New Policy"}</DialogTitle>
            <DialogDescription>
              {editingPolicy ? "Update the policy details" : "Add a new insurance policy"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Policy Number *</Label>
                  <Input data-testid="policy-number-input" value={formData.policy_number}
                    onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                    required disabled={!!editingPolicy} />
                </div>
                <div className="space-y-2">
                  <Label>Policy Date</Label>
                  <Input type="date" data-testid="policy-date-input" value={formData.policy_date}
                    onChange={(e) => setFormData({ ...formData, policy_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Policy Holder Name *</Label>
                <Input data-testid="policy-holder-input" value={formData.policy_holder_name}
                  onChange={(e) => setFormData({ ...formData, policy_holder_name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Policy Type</Label>
                  <Select value={formData.policy_type} onValueChange={(v) => setFormData({ ...formData, policy_type: v })}>
                    <SelectTrigger data-testid="policy-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Group Health">Group Health (GMC)</SelectItem>
                      <SelectItem value="GTL">Group Term (GTL)</SelectItem>
                      <SelectItem value="GPA">Group Accident (GPA)</SelectItem>
                      <SelectItem value="Group Accident">Group Accident</SelectItem>
                      <SelectItem value="Group Term">Group Term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Family Definition</Label>
                  <Select value={formData.family_definition} onValueChange={(v) => setFormData({ ...formData, family_definition: v })}>
                    <SelectTrigger data-testid="family-definition-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESKP">ESKP (Emp+Spouse+Kids+Parents)</SelectItem>
                      <SelectItem value="ESK">ESK (Emp+Spouse+Kids)</SelectItem>
                      <SelectItem value="E">E (Employee Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Premium (Total)</Label>
                <Input type="number" step="0.01" data-testid="premium-input" value={formData.premium}
                  onChange={(e) => setFormData({ ...formData, premium: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employees Count</Label>
                  <Input type="number" data-testid="employees-count-input" value={formData.employees_count}
                    onChange={(e) => setFormData({ ...formData, employees_count: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Spouse Count</Label>
                  <Input type="number" data-testid="spouse-count-input" value={formData.spouse_count}
                    onChange={(e) => setFormData({ ...formData, spouse_count: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kids Count</Label>
                  <Input type="number" data-testid="kids-count-input" value={formData.kids_count}
                    onChange={(e) => setFormData({ ...formData, kids_count: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Parents Count</Label>
                  <Input type="number" data-testid="parents-count-input" value={formData.parents_count}
                    onChange={(e) => setFormData({ ...formData, parents_count: e.target.value })} />
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 font-medium">
                  Total Lives: <span className="text-lg font-bold" data-testid="total-lives-display">{totalLives()}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Addition Lives</Label>
                  <Input type="number" data-testid="addition-lives-input" value={formData.addition_lives}
                    onChange={(e) => setFormData({ ...formData, addition_lives: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Deletion Lives</Label>
                  <Input type="number" data-testid="deletion-lives-input" value={formData.deletion_lives}
                    onChange={(e) => setFormData({ ...formData, deletion_lives: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleDialogClose}>Cancel</Button>
              <Button type="submit" data-testid="save-policy-button">{editingPolicy ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PoliciesPage;
