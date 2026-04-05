import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Loader2, MessageCircle, Sparkles, AlertCircle } from "lucide-react";

const generateWhatsAppLink = (phone, message) => {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

const calcAge = (dob) => {
  if (!dob) return "";
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : "";
};

const getMinDate45 = () => {
  const d = new Date();
  d.setDate(d.getDate() - 45);
  return d.toISOString().split("T")[0];
};

export default function SubmitEndorsement() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [aiWhatsappMessage, setAiWhatsappMessage] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
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
    endorsement_date: new Date().toISOString().split('T')[0],
    effective_date: "",
    remarks: ""
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`${API}/policies`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setPolicies(r.data)).catch(() => toast.error("Failed to load policies"));
    axios.get(`${API}/users/admins`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setAdminUsers(r.data)).catch(() => {});
  }, []);

  // Selected policy details for premium display
  const selectedPolicy = useMemo(() => {
    return policies.find(p => p.policy_number === formData.policy_number);
  }, [policies, formData.policy_number]);

  // Dynamic relationship options based on endorsement type AND policy type
  const relationshipOptions = useMemo(() => {
    const all = ["Employee", "Spouse", "Kids", "Mother", "Father"];
    // GPA & GTL policies: only Employee allowed
    if (selectedPolicy && (selectedPolicy.policy_type === "GPA" || selectedPolicy.policy_type === "GTL")) {
      return ["Employee"];
    }
    if (formData.endorsement_type === "Midterm addition") {
      return all.filter(r => r !== "Employee");
    }
    return all;
  }, [formData.endorsement_type, selectedPolicy]);

  // Reset relationship if it becomes invalid
  useEffect(() => {
    if (formData.endorsement_type === "Midterm addition" && formData.relationship_type === "Employee") {
      setFormData(prev => ({ ...prev, relationship_type: "" }));
    }
    // GPA/GTL: auto-set to Employee
    if (selectedPolicy && (selectedPolicy.policy_type === "GPA" || selectedPolicy.policy_type === "GTL")) {
      if (formData.relationship_type !== "Employee") {
        setFormData(prev => ({ ...prev, relationship_type: "Employee" }));
      }
    }
  }, [formData.endorsement_type, formData.relationship_type, selectedPolicy]);

  const showDOJ = formData.endorsement_type === "Addition" || formData.endorsement_type === "Midterm addition";
  const showDOL = formData.endorsement_type === "Deletion";
  const minDate45 = getMinDate45();

  const updateFormData = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Auto-calculate age from DOB
      if (field === "dob" && value) {
        const age = calcAge(value);
        if (age !== "") next.age = String(age);
      }
      // Clear DOJ/DOL when type changes
      if (field === "endorsement_type") {
        next.date_of_joining = "";
        next.date_of_leaving = "";
      }
      return next;
    });
  };

  const generateAIWhatsappMessage = async (endorsementData) => {
    try {
      setGeneratingAI(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/notifications/generate`, {
        notification_type: "endorsement_submitted",
        context: {
          submitted_by: "HR User",
          policy_number: endorsementData.policy_number,
          member_name: endorsementData.member_name,
          endorsement_type: endorsementData.endorsement_type,
          relationship_type: endorsementData.relationship_type,
          prorata_premium: endorsementData.prorata_premium || 0
        }
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.content?.whatsapp_message) setAiWhatsappMessage(response.data.content.whatsapp_message);
    } catch {
      setAiWhatsappMessage(`*InsureHub - New Endorsement*\n\n*Policy:* ${endorsementData.policy_number}\n*Member:* ${endorsementData.member_name}\n*Type:* ${endorsementData.endorsement_type}\n\nPlease review in Admin portal.`);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend 45-day validation
    if (showDOJ && formData.date_of_joining && formData.date_of_joining < minDate45) {
      toast.error("Date of Joining cannot be more than 45 days backdated");
      return;
    }
    if (showDOL && formData.date_of_leaving && formData.date_of_leaving < minDate45) {
      toast.error("Date of Leaving cannot be more than 45 days backdated");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const submitData = {
        ...formData,
        employee_id: formData.employee_id || null,
        dob: formData.dob || null,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        date_of_joining: showDOJ ? (formData.date_of_joining || null) : null,
        date_of_leaving: showDOL ? (formData.date_of_leaving || null) : null,
        coverage_type: formData.coverage_type || null,
        sum_insured: formData.sum_insured ? parseFloat(formData.sum_insured) : null,
        effective_date: formData.effective_date || null,
        remarks: formData.remarks || null
      };
      const response = await axios.post(`${API}/endorsements`, submitData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement submitted! AI-powered email sent to Admins.");
      setSubmittedData(response.data);
      setShowSuccess(true);
      generateAIWhatsappMessage(response.data);
      setFormData({
        policy_number: "", employee_id: "", member_name: "", dob: "", age: "", gender: "",
        relationship_type: "", endorsement_type: "", date_of_joining: "", date_of_leaving: "",
        coverage_type: "", sum_insured: "",
        endorsement_date: new Date().toISOString().split('T')[0], effective_date: "", remarks: ""
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit endorsement");
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppMessage = () => {
    if (aiWhatsappMessage) return aiWhatsappMessage;
    if (!submittedData) return "";
    return `*InsureHub - New Endorsement*\n\n*Policy:* ${submittedData.policy_number}\n*Member:* ${submittedData.member_name}\n*Type:* ${submittedData.endorsement_type}\n\nPlease review in Admin portal.`;
  };

  const adminsWithPhone = adminUsers.filter(a => a.phone);

  return (
    <div className="space-y-6" data-testid="submit-endorsement-page">
      {showSuccess && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-green-700">
                <span className="text-lg">✓</span>
                <span className="font-medium">Endorsement submitted!</span>
                <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" /> AI Email Sent
                </span>
                {submittedData && (
                  <span className={`text-sm font-medium ml-2 ${submittedData.prorata_premium >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    Pro-rata: ₹{Math.abs(submittedData.prorata_premium).toLocaleString()}{submittedData.prorata_premium < 0 ? ' (Refund)' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {adminsWithPhone.length > 0 && !generatingAI && adminsWithPhone.map((admin) => (
                  <a key={admin.id} href={generateWhatsAppLink(admin.phone, getWhatsAppMessage())} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    data-testid={`whatsapp-admin-${admin.id}`}>
                    <MessageCircle className="w-4 h-4" />{admin.full_name.split(' ')[0]}
                  </a>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setShowSuccess(false)} className="text-green-600">✕</Button>
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
              {/* Policy Number */}
              <div className="space-y-2">
                <Label>Policy Number *</Label>
                <Select value={formData.policy_number} onValueChange={(v) => updateFormData('policy_number', v)} required>
                  <SelectTrigger data-testid="policy-select"><SelectValue placeholder="Select Policy" /></SelectTrigger>
                  <SelectContent>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={p.policy_number}>{p.policy_number} - {p.policy_holder_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Endorsement Type */}
              <div className="space-y-2">
                <Label>Endorsement Type *</Label>
                <Select value={formData.endorsement_type} onValueChange={(v) => updateFormData('endorsement_type', v)} required>
                  <SelectTrigger data-testid="type-select"><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Addition">Addition</SelectItem>
                    <SelectItem value="Deletion">Deletion</SelectItem>
                    <SelectItem value="Correction">Correction</SelectItem>
                    <SelectItem value="Midterm addition">Midterm addition</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Relationship Type */}
              <div className="space-y-2">
                <Label>Relationship Type *</Label>
                <Select value={formData.relationship_type} onValueChange={(v) => updateFormData('relationship_type', v)} required>
                  <SelectTrigger data-testid="relationship-select"><SelectValue placeholder="Select Relationship" /></SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.endorsement_type === "Midterm addition" && (
                  <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Employee not allowed for Midterm Addition</p>
                )}
                {selectedPolicy && (selectedPolicy.policy_type === "GPA" || selectedPolicy.policy_type === "GTL") && (
                  <p className="text-xs text-blue-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {selectedPolicy.policy_type} product: Employee only</p>
                )}
              </div>

              {/* Employee ID */}
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={formData.employee_id} onChange={(e) => updateFormData('employee_id', e.target.value)} placeholder="Enter employee ID" data-testid="employee-id-input" />
              </div>

              {/* Member Name */}
              <div className="space-y-2">
                <Label>Member Name *</Label>
                <Input value={formData.member_name} onChange={(e) => updateFormData('member_name', e.target.value)} placeholder="Enter member name" required data-testid="member-name-input" />
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => updateFormData('gender', v)}>
                  <SelectTrigger data-testid="gender-select"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* DOB → Auto age */}
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={formData.dob} onChange={(e) => updateFormData('dob', e.target.value)} data-testid="dob-input" />
              </div>

              {/* Age (auto-calculated) */}
              <div className="space-y-2">
                <Label>Age {formData.dob ? "(auto)" : ""}</Label>
                <Input type="number" value={formData.age} onChange={(e) => updateFormData('age', e.target.value)} placeholder="Auto from DOB" readOnly={!!formData.dob} className={formData.dob ? "bg-gray-50" : ""} data-testid="age-input" />
              </div>

              {/* DOJ - shown for Addition / Midterm addition */}
              {showDOJ && (
                <div className="space-y-2">
                  <Label>Date of Joining</Label>
                  <Input type="date" value={formData.date_of_joining} min={minDate45} onChange={(e) => updateFormData('date_of_joining', e.target.value)} data-testid="date-of-joining-input" />
                  <p className="text-xs text-gray-500">Max 45 days backdated</p>
                </div>
              )}

              {/* DOL - shown for Deletion */}
              {showDOL && (
                <div className="space-y-2">
                  <Label>Date of Leaving</Label>
                  <Input type="date" value={formData.date_of_leaving} min={minDate45} onChange={(e) => updateFormData('date_of_leaving', e.target.value)} data-testid="date-of-leaving-input" />
                  <p className="text-xs text-gray-500">Max 45 days backdated</p>
                </div>
              )}

              {/* Coverage Type */}
              <div className="space-y-2">
                <Label>Coverage Type</Label>
                <Select value={formData.coverage_type} onValueChange={(v) => updateFormData('coverage_type', v)}>
                  <SelectTrigger data-testid="coverage-type-select"><SelectValue placeholder="Select Coverage Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Floater">Floater</SelectItem>
                    <SelectItem value="Non-Floater">Non-Floater</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sum Insured */}
              <div className="space-y-2">
                <Label>Sum Insured</Label>
                <Input type="number" value={formData.sum_insured} onChange={(e) => updateFormData('sum_insured', e.target.value)} placeholder="Enter sum insured" data-testid="sum-insured-input" />
              </div>

              {/* Endorsement Date */}
              <div className="space-y-2">
                <Label>Endorsement Date *</Label>
                <Input type="date" value={formData.endorsement_date} onChange={(e) => updateFormData('endorsement_date', e.target.value)} required data-testid="endorsement-date-input" />
              </div>

              {/* Effective Date */}
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input type="date" value={formData.effective_date} onChange={(e) => updateFormData('effective_date', e.target.value)} data-testid="effective-date-input" />
              </div>
            </div>

            {/* Annual Premium & Pro-rata info */}
            {selectedPolicy && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-wrap gap-4 text-sm" data-testid="premium-info">
                <span><strong>Annual Premium/Life:</strong> ₹{selectedPolicy.annual_premium_per_life?.toLocaleString()}</span>
                <span><strong>Inception:</strong> {selectedPolicy.inception_date}</span>
                <span><strong>Expiry:</strong> {selectedPolicy.expiry_date}</span>
                {formData.endorsement_type && (
                  <span className={formData.endorsement_type === "Deletion" ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                    {formData.endorsement_type === "Deletion" ? "Refund (Negative Premium)" : formData.endorsement_type === "Correction" ? "No Premium Change" : "Charge (Positive Premium)"}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={formData.remarks} onChange={(e) => updateFormData('remarks', e.target.value)} placeholder="Add any additional notes" rows={3} data-testid="remarks-textarea" />
            </div>

            <Button type="submit" disabled={loading} data-testid="submit-button">
              {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>) : (<><Plus className="w-4 h-4 mr-2" />Submit Endorsement</>)}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
