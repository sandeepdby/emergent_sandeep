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
    inception_date: "",
    expiry_date: "",
    annual_premium_per_life: "",
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        annual_premium_per_life: parseFloat(formData.annual_premium_per_life),
        total_lives_covered: 0,
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
      policy_number: policy.policy_number,
      policy_holder_name: policy.policy_holder_name,
      inception_date: policy.inception_date,
      expiry_date: policy.expiry_date,
      annual_premium_per_life: policy.annual_premium_per_life.toString(),
      status: policy.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (policyId) => {
    if (!window.confirm("Are you sure you want to delete this policy? All related endorsements will also be deleted.")) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/policies/${policyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Policy deleted successfully");
      fetchPolicies();
    } catch (error) {
      console.error("Error deleting policy:", error);
      toast.error("Failed to delete policy");
    }
  };

  const resetForm = () => {
    setFormData({
      policy_number: "",
      policy_holder_name: "",
      inception_date: "",
      expiry_date: "",
      annual_premium_per_life: "",
      status: "Active",
    });
    setEditingPolicy(null);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6" data-testid="policies-page">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Insurance Policies</CardTitle>
              <CardDescription>Manage your insurance policies</CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="add-policy-button">
              <Plus className="w-4 h-4 mr-2" />
              Add Policy
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Number</TableHead>
                  <TableHead>Policy Holder</TableHead>
                  <TableHead>Inception Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Premium/Life</TableHead>
                  <TableHead>Lives Covered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id} data-testid={`policy-row-${policy.policy_number}`}>
                    <TableCell className="font-medium">{policy.policy_number}</TableCell>
                    <TableCell>{policy.policy_holder_name}</TableCell>
                    <TableCell>{new Date(policy.inception_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(policy.expiry_date).toLocaleDateString()}</TableCell>
                    <TableCell>₹{policy.annual_premium_per_life.toLocaleString()}</TableCell>
                    <TableCell>{policy.total_lives_covered}</TableCell>
                    <TableCell>
                      <Badge variant={policy.status === "Active" ? "default" : "secondary"}>
                        {policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(policy)}
                        data-testid={`edit-policy-${policy.policy_number}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(policy.id)}
                        data-testid={`delete-policy-${policy.policy_number}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Policy" : "Create New Policy"}</DialogTitle>
            <DialogDescription>
              {editingPolicy ? "Update the policy details" : "Add a new insurance policy"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="policy_number">Policy Number</Label>
                <Input
                  id="policy_number"
                  data-testid="policy-number-input"
                  value={formData.policy_number}
                  onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                  required
                  disabled={!!editingPolicy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policy_holder_name">Policy Holder Name</Label>
                <Input
                  id="policy_holder_name"
                  data-testid="policy-holder-input"
                  value={formData.policy_holder_name}
                  onChange={(e) => setFormData({ ...formData, policy_holder_name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inception_date">Inception Date</Label>
                  <Input
                    id="inception_date"
                    type="date"
                    data-testid="inception-date-input"
                    value={formData.inception_date}
                    onChange={(e) => setFormData({ ...formData, inception_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry_date">Expiry Date</Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    data-testid="expiry-date-input"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="annual_premium_per_life">Annual Premium Per Life (₹)</Label>
                <Input
                  id="annual_premium_per_life"
                  type="number"
                  step="0.01"
                  data-testid="premium-input"
                  value={formData.annual_premium_per_life}
                  onChange={(e) => setFormData({ ...formData, annual_premium_per_life: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-policy-button">
                {editingPolicy ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PoliciesPage;