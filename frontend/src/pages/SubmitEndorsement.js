import React from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Loader2, Calculator, IndianRupee } from "lucide-react";

class SubmitEndorsement extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      policies: [],
      loading: false,
      calculatingPremium: false,
      premiumData: null,
      formData: {
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
        endorsement_date: new Date().toISOString().split('T')[0],
        effective_date: "",
        remarks: ""
      }
    };
  }

  componentDidMount() {
    this.fetchPolicies();
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
      toast.error("Failed to load policies");
    }
  };

  calculateAge = (dob) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? age.toString() : "";
  };

  handleDobChange = (dob) => {
    const calculatedAge = this.calculateAge(dob);
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        dob: dob,
        age: calculatedAge
      }
    }));
  };

  calculatePremium = async () => {
    const { policy_number, endorsement_date, endorsement_type } = this.state.formData;
    
    if (!policy_number || !endorsement_date || !endorsement_type) {
      toast.error("Please select Policy, Endorsement Date, and Endorsement Type to calculate premium");
      return;
    }

    try {
      this.setState({ calculatingPremium: true });
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/endorsements/calculate-premium`, {
        policy_number,
        endorsement_date,
        endorsement_type
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      this.setState({ premiumData: response.data });
      toast.success("Premium calculated successfully");
    } catch (error) {
      console.error("Error calculating premium:", error);
      toast.error(error.response?.data?.detail || "Failed to calculate premium");
      this.setState({ premiumData: null });
    } finally {
      this.setState({ calculatingPremium: false });
    }
  };

  // Auto-calculate premium when key fields change
  handleFieldChangeWithPremiumRecalc = (field, value) => {
    this.setState(prevState => ({
      formData: { ...prevState.formData, [field]: value },
      premiumData: null // Clear premium when fields change
    }));
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    try {
      this.setState({ loading: true });
      const token = localStorage.getItem('token');
      
      // Prepare data, converting empty strings to null for optional fields
      const submitData = {
        ...this.state.formData,
        employee_id: this.state.formData.employee_id || null,
        dob: this.state.formData.dob || null,
        age: this.state.formData.age ? parseInt(this.state.formData.age) : null,
        gender: this.state.formData.gender || null,
        date_of_joining: this.state.formData.date_of_joining || null,
        date_of_leaving: this.state.formData.date_of_leaving || null,
        coverage_type: this.state.formData.coverage_type || null,
        sum_insured: this.state.formData.sum_insured ? parseFloat(this.state.formData.sum_insured) : null,
        effective_date: this.state.formData.effective_date || null,
        remarks: this.state.formData.remarks || null
      };
      
      await axios.post(`${API}/endorsements`, submitData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement submitted successfully and is pending approval");
      this.setState({
        premiumData: null,
        formData: {
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
          endorsement_date: new Date().toISOString().split('T')[0],
          effective_date: "",
          remarks: ""
        }
      });
    } catch (error) {
      console.error("Error submitting endorsement:", error);
      toast.error(error.response?.data?.detail || "Failed to submit endorsement");
    } finally {
      this.setState({ loading: false });
    }
  };

  updateFormData = (field, value) => {
    this.setState(prevState => ({
      formData: { ...prevState.formData, [field]: value }
    }));
  };

  render() {
    const { policies, loading, calculatingPremium, premiumData, formData } = this.state;

    return (
      <div className="space-y-6" data-testid="submit-endorsement-page">
        <Card>
          <CardHeader>
            <CardTitle>Submit New Endorsement</CardTitle>
            <CardDescription>Add, delete, or correct member coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={this.handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Policy Number *</Label>
                  <Select
                    value={formData.policy_number}
                    onValueChange={(value) => this.handleFieldChangeWithPremiumRecalc('policy_number', value)}
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
                    onChange={(e) => this.updateFormData('employee_id', e.target.value)}
                    placeholder="Enter employee ID"
                    data-testid="employee-id-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Member Name *</Label>
                  <Input
                    value={formData.member_name}
                    onChange={(e) => this.updateFormData('member_name', e.target.value)}
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
                    onChange={(e) => this.handleDobChange(e.target.value)}
                    data-testid="dob-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Age (Auto-calculated)</Label>
                  <Input
                    type="number"
                    value={formData.age}
                    onChange={(e) => this.updateFormData('age', e.target.value)}
                    placeholder="Auto-calculated from DOB"
                    readOnly={formData.dob !== ""}
                    className={formData.dob ? "bg-gray-100" : ""}
                    data-testid="age-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => this.updateFormData('gender', value)}
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
                    onValueChange={(value) => this.updateFormData('relationship_type', value)}
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
                    onValueChange={(value) => this.handleFieldChangeWithPremiumRecalc('endorsement_type', value)}
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
                  <Label>Date of Joining (DOJ)</Label>
                  <Input
                    type="date"
                    value={formData.date_of_joining}
                    onChange={(e) => this.updateFormData('date_of_joining', e.target.value)}
                    data-testid="date-of-joining-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date of Leaving (DOL)</Label>
                  <Input
                    type="date"
                    value={formData.date_of_leaving}
                    onChange={(e) => this.updateFormData('date_of_leaving', e.target.value)}
                    data-testid="date-of-leaving-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Coverage Type</Label>
                  <Select
                    value={formData.coverage_type}
                    onValueChange={(value) => this.updateFormData('coverage_type', value)}
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
                    onChange={(e) => this.updateFormData('sum_insured', e.target.value)}
                    placeholder="Enter sum insured"
                    data-testid="sum-insured-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Endorsement Date *</Label>
                  <Input
                    type="date"
                    value={formData.endorsement_date}
                    onChange={(e) => this.handleFieldChangeWithPremiumRecalc('endorsement_date', e.target.value)}
                    required
                    data-testid="endorsement-date-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => this.updateFormData('effective_date', e.target.value)}
                    data-testid="effective-date-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => this.updateFormData('remarks', e.target.value)}
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
}

export default SubmitEndorsement;
