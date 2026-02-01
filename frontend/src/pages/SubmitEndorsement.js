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
import { Plus, Loader2 } from "lucide-react";

class SubmitEndorsement extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      policies: [],
      loading: false,
      formData: {
        policy_number: "",
        member_name: "",
        relationship_type: "",
        endorsement_type: "",
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

  handleSubmit = async (e) => {
    e.preventDefault();
    try {
      this.setState({ loading: true });
      const token = localStorage.getItem('token');
      await axios.post(`${API}/endorsements`, this.state.formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement submitted successfully and is pending approval");
      this.setState({
        formData: {
          policy_number: "",
          member_name: "",
          relationship_type: "",
          endorsement_type: "",
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
    const { policies, loading, formData } = this.state;

    return (
      <div className="space-y-6" data-testid="submit-endorsement-page">
        <Card>
          <CardHeader>
            <CardTitle>Submit New Endorsement</CardTitle>
            <CardDescription>Add, delete, or correct member coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={this.handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Policy Number *</Label>
                  <Select
                    value={formData.policy_number}
                    onValueChange={(value) => this.updateFormData('policy_number', value)}
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
                    onValueChange={(value) => this.updateFormData('endorsement_type', value)}
                    required
                  >
                    <SelectTrigger data-testid="type-select">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Addition">Addition</SelectItem>
                      <SelectItem value="Deletion">Deletion</SelectItem>
                      <SelectItem value="Correction">Correction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Endorsement Date *</Label>
                  <Input
                    type="date"
                    value={formData.endorsement_date}
                    onChange={(e) => this.updateFormData('endorsement_date', e.target.value)}
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