import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Loader2, MessageCircle } from "lucide-react";

// WhatsApp Web link generator
const generateWhatsAppLink = (phone, message) => {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

export default function SubmitEndorsement() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
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
    coverage_type: "",
    sum_insured: "",
    endorsement_date: new Date().toISOString().split('T')[0],
    effective_date: "",
    remarks: ""
  });

  useEffect(() => {
    fetchPolicies();
    fetchAdminUsers();
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
      toast.error("Failed to load policies");
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users/admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminUsers(response.data);
    } catch (error) {
      console.error("Error fetching admin users:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const submitData = {
        ...formData,
        employee_id: formData.employee_id || null,
        dob: formData.dob || null,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        date_of_joining: formData.date_of_joining || null,
        coverage_type: formData.coverage_type || null,
        sum_insured: formData.sum_insured ? parseFloat(formData.sum_insured) : null,
        effective_date: formData.effective_date || null,
        remarks: formData.remarks || null
      };
      
      const response = await axios.post(`${API}/endorsements`, submitData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Endorsement submitted! Email sent to Admins.");
      setSubmittedData(response.data);
      setShowSuccess(true);
      
      // Reset form
      setFormData({
        policy_number: "",
        employee_id: "",
        member_name: "",
        dob: "",
        age: "",
        gender: "",
        relationship_type: "",
        endorsement_type: "",
        date_of_joining: "",
        coverage_type: "",
        sum_insured: "",
        endorsement_date: new Date().toISOString().split('T')[0],
        effective_date: "",
        remarks: ""
      });
    } catch (error) {
      console.error("Error submitting endorsement:", error);
      toast.error(error.response?.data?.detail || "Failed to submit endorsement");
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getWhatsAppMessage = () => {
    if (!submittedData) return "";
    return `*InsureHub - New Endorsement*\n\n*Policy:* ${submittedData.policy_number}\n*Member:* ${submittedData.member_name}\n*Type:* ${submittedData.endorsement_type}\n\nPlease review in Admin portal.`;
  };

  const adminsWithPhone = adminUsers.filter(a => a.phone);

  return (
    <div className="space-y-6" data-testid="submit-endorsement-page">
      {/* Success Banner with WhatsApp Icons */}
      {showSuccess && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <span className="text-lg">✓</span>
                <span className="font-medium">Endorsement submitted! Email sent to Admins.</span>
              </div>
              <div className="flex items-center gap-2">
                {adminsWithPhone.length > 0 && (
                  <>
                    <span className="text-sm text-green-600 mr-2">Notify via WhatsApp:</span>
                    {adminsWithPhone.map((admin) => (
                      <a
                        key={admin.id}
                        href={generateWhatsAppLink(admin.phone, getWhatsAppMessage())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        title={`WhatsApp ${admin.full_name}`}
                        data-testid={`whatsapp-admin-${admin.id}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        {admin.full_name.split(' ')[0]}
                      </a>
                    ))}
                  </>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowSuccess(false)}
                  className="text-green-600 hover:text-green-700"
                >
                  ✕
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submit New Endorsement</CardTitle>
          <CardDescription>Add, delete, or correct member coverage. Admin users will be notified via email automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Policy Number *</Label>
                <Select
                  value={formData.policy_number}
                  onValueChange={(value) => updateFormData('policy_number', value)}
                  required
                >
                  <SelectTrigger data-testid="policy-select">
                    <SelectValue placeholder="Select Policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((policy) => (
                      <SelectItem key={policy.id} value={policy.policy_number}>
                        {policy.policy_number} - {policy.policy_holder_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input
                  value={formData.employee_id}
                  onChange={(e) => updateFormData('employee_id', e.target.value)}
                  placeholder="Enter employee ID"
                  data-testid="employee-id-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Member Name *</Label>
                <Input
                  value={formData.member_name}
                  onChange={(e) => updateFormData('member_name', e.target.value)}
                  placeholder="Enter member name"
                  required
                  data-testid="member-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => updateFormData('dob', e.target.value)}
                  data-testid="dob-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Age</Label>
                <Input
                  type="number"
                  value={formData.age}
                  onChange={(e) => updateFormData('age', e.target.value)}
                  placeholder="Enter age"
                  data-testid="age-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => updateFormData('gender', value)}
                >
                  <SelectTrigger data-testid="gender-select">
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Relationship Type *</Label>
                <Select
                  value={formData.relationship_type}
                  onValueChange={(value) => updateFormData('relationship_type', value)}
                  required
                >
                  <SelectTrigger data-testid="relationship-select">
                    <SelectValue placeholder="Select Relationship" />
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
                <Label>Endorsement Type *</Label>
                <Select
                  value={formData.endorsement_type}
                  onValueChange={(value) => updateFormData('endorsement_type', value)}
                  required
                >
                  <SelectTrigger data-testid="type-select">
                    <SelectValue placeholder="Select Type" />
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
                <Label>Date of Joining</Label>
                <Input
                  type="date"
                  value={formData.date_of_joining}
                  onChange={(e) => updateFormData('date_of_joining', e.target.value)}
                  data-testid="date-of-joining-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Coverage Type</Label>
                <Select
                  value={formData.coverage_type}
                  onValueChange={(value) => updateFormData('coverage_type', value)}
                >
                  <SelectTrigger data-testid="coverage-type-select">
                    <SelectValue placeholder="Select Coverage Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Floater">Floater</SelectItem>
                    <SelectItem value="Non-Floater">Non-Floater</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sum Insured (Coverage)</Label>
                <Input
                  type="number"
                  value={formData.sum_insured}
                  onChange={(e) => updateFormData('sum_insured', e.target.value)}
                  placeholder="Enter sum insured"
                  data-testid="sum-insured-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Endorsement Date *</Label>
                <Input
                  type="date"
                  value={formData.endorsement_date}
                  onChange={(e) => updateFormData('endorsement_date', e.target.value)}
                  required
                  data-testid="endorsement-date-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => updateFormData('effective_date', e.target.value)}
                  data-testid="effective-date-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => updateFormData('remarks', e.target.value)}
                placeholder="Add any additional notes"
                rows={3}
                data-testid="remarks-textarea"
              />
            </div>

            <Button type="submit" disabled={loading} data-testid="submit-button">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit Endorsement
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
