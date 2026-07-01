import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Loader2, MessageCircle, Sparkles, AlertCircle, TrendingUp, TrendingDown, Zap } from "lucide-react";

const generateWhatsAppLink = (phone, message) => {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

const ProRataPreview = ({ policy, endorsementType, endorsementDate, perLifePremium }) => {
  const calc = useMemo(() => {
    if (!policy || !endorsementDate || !endorsementType || endorsementType === "Correction" || !perLifePremium) return null;
    try {
      const inception = new Date(policy.inception_date);
      const expiry = new Date(policy.expiry_date);
      const endDate = new Date(endorsementDate);
      const totalDays = Math.ceil((expiry - inception) / (1000 * 60 * 60 * 24));
      const elapsed = Math.ceil((endDate - inception) / (1000 * 60 * 60 * 24));
      const remaining = Math.max(totalDays - elapsed, 0);
      const prorata = Math.round((perLifePremium * remaining) / 365);
      const isRefund = endorsementType === "Deletion";
      return { remaining, totalDays, prorata: isRefund ? -prorata : prorata, isRefund };
    } catch { return null; }
  }, [policy, endorsementType, endorsementDate, perLifePremium]);

  if (!calc) return null;
  return (
    <div className="flex items-center gap-4 mt-1 text-sm" data-testid="prorata-preview">
      <span className="text-gray-600">Remaining Days: <strong>{calc.remaining}</strong> / {calc.totalDays}</span>
      <span className="text-gray-400">|</span>
      <span className={`font-bold flex items-center gap-1 ${calc.isRefund ? 'text-red-600' : 'text-emerald-600'}`}>
        {calc.isRefund ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
        Pro-rata: {calc.isRefund ? '-' : '+'}₹{Math.abs(calc.prorata).toLocaleString()}
        {calc.isRefund ? ' (Refund)' : ' (Charge)'}
      </span>
    </div>
  );
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

/* Determine allowed relationship options based on family definition */
const FAMILY_RELATIONSHIPS = {
  E: ["Employee"],
  ESK: ["Employee", "Spouse", "Kids1", "Kids2"],
  ESKP: ["Employee", "Spouse", "Kids1", "Kids2", "Mother", "Father"],
};

/* Sub-component: Policy select option */
function PolicySelectOption({ policy }) {
  const typeLabel = policy.family_definition || policy.policy_type || "";
  return (
    <SelectItem value={policy.policy_number}>
      {policy.policy_number} - {policy.policy_holder_name}
      {typeLabel ? ` (${typeLabel})` : ""}
    </SelectItem>
  );
}

/* Sub-component: Relationship select option */
function RelationshipOption({ value }) {
  return <SelectItem value={value}>{value}</SelectItem>;
}

/* Sub-component: WhatsApp admin button */
function WhatsAppButton({ admin, message }) {
  const link = generateWhatsAppLink(admin.phone, message);
  if (!link) return null;
  return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      data-testid={`whatsapp-admin-${admin.id}`}>
      <MessageCircle className="w-4 h-4" />{admin.full_name.split(' ')[0]}
    </a>
  );
}

export default function SubmitEndorsement() {
  const [policies, setPolicies] = useState([]);
  const [raters, setRaters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [aiWhatsappMessage, setAiWhatsappMessage] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [rateAutoFilled, setRateAutoFilled] = useState(false);
  const [formData, setFormData] = useState({
    policy_number: "",
    family_definition: "",
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
    per_life_premium: "",
    endorsement_date: new Date().toISOString().split('T')[0],
    effective_date: "",
    employee_email: "",
    employee_mobile: "",
    remarks: ""
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const h = { Authorization: `Bearer ${token}` };
    axios.get(`${API}/policies`, { headers: h }).then(r => setPolicies(r.data)).catch(() => toast.error("Failed to load policies"));
    axios.get(`${API}/users/admins`, { headers: h }).then(r => setAdminUsers(r.data)).catch(() => {});
    axios.get(`${API}/raters`, { headers: h }).then(r => setRaters(r.data)).catch(() => {});
  }, []);

  const selectedPolicy = useMemo(() => policies.find(p => p.policy_number === formData.policy_number), [policies, formData.policy_number]);

  // Determine family definition: from form selection, policy data, or default ESKP
  const activeFamilyDef = useMemo(() => {
    if (formData.family_definition) return formData.family_definition;
    if (selectedPolicy?.family_definition) return selectedPolicy.family_definition;
    // GPA/GTL → E only
    if (selectedPolicy && (selectedPolicy.policy_type === "GPA" || selectedPolicy.policy_type === "GTL")) return "E";
    return "ESKP";
  }, [formData.family_definition, selectedPolicy]);

  // Get raters for selected policy
  const policyRaters = useMemo(() => raters.filter(r => r.policy_number === formData.policy_number), [raters, formData.policy_number]);

  // Auto-populate per-life rate from rater when age changes
  useEffect(() => {
    const age = parseInt(formData.age);
    if (isNaN(age) || policyRaters.length === 0) return;
    // Find matching age band from first available rater
    const rater = policyRaters[0];
    const band = (rater.age_bands || []).find(ab => age >= ab.min_age && age <= ab.max_age);
    if (band) {
      setFormData(prev => ({ ...prev, per_life_premium: String(band.per_life_rate) }));
      setRateAutoFilled(true);
    }
  }, [formData.age, policyRaters]);

  // Dynamic relationship options based on family definition + endorsement type
  const relationshipOptions = useMemo(() => {
    let opts = FAMILY_RELATIONSHIPS[activeFamilyDef] || FAMILY_RELATIONSHIPS.ESKP;
    if (formData.endorsement_type === "Midterm addition") {
      opts = opts.filter(r => r !== "Employee" && r !== "Mother" && r !== "Father");
    }
    return opts;
  }, [activeFamilyDef, formData.endorsement_type]);

  // Reset relationship if it becomes invalid
  useEffect(() => {
    if (formData.relationship_type && !relationshipOptions.includes(formData.relationship_type)) {
      setFormData(prev => ({ ...prev, relationship_type: "" }));
    }
  }, [relationshipOptions, formData.relationship_type]);

  // When policy changes, update family_definition from policy data
  useEffect(() => {
    if (selectedPolicy) {
      const fd = selectedPolicy.family_definition || "";
      if (fd && fd !== formData.family_definition) {
        setFormData(prev => ({ ...prev, family_definition: fd }));
      }
    }
  }, [selectedPolicy, formData.family_definition]);

  const showDOJ = formData.endorsement_type === "Addition" || formData.endorsement_type === "Midterm addition";
  const showDOL = formData.endorsement_type === "Deletion";
  const minDate45 = getMinDate45();

  const updateFormData = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === "dob" && value) {
        const age = calcAge(value);
        if (age !== "") next.age = String(age);
      }
      if (field === "endorsement_type") {
        next.date_of_joining = "";
        next.date_of_leaving = "";
      }
      if (field === "per_life_premium") {
        setRateAutoFilled(false);
      }
      if (field === "policy_number") {
        next.per_life_premium = "";
        next.relationship_type = "";
        setRateAutoFilled(false);
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
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (response.data.content?.whatsapp_message) setAiWhatsappMessage(response.data.content.whatsapp_message);
    } catch {
      setAiWhatsappMessage(`*InsureHub - New Endorsement*\n\n*Policy:* ${endorsementData.policy_number}\n*Member:* ${endorsementData.member_name}\n*Type:* ${endorsementData.endorsement_type}\n\nPlease review in Admin portal.`);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (showDOJ && formData.date_of_joining && formData.date_of_joining < minDate45) {
      toast.error("Date of Joining cannot be more than 45 days backdated"); return;
    }
    if (showDOL && formData.date_of_leaving && formData.date_of_leaving < minDate45) {
      toast.error("Date of Leaving cannot be more than 45 days backdated"); return;
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
        per_life_premium: formData.per_life_premium ? parseFloat(formData.per_life_premium) : null,
        effective_date: formData.effective_date || null,
        employee_email: formData.employee_email || null,
        employee_mobile: formData.employee_mobile || null,
        remarks: formData.remarks || null
      };
      // Remove family_definition from submit payload (not a backend field on endorsement)
      delete submitData.family_definition;
      const response = await axios.post(`${API}/endorsements`, submitData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Endorsement submitted! AI-powered email sent to Admins.");
      setSubmittedData(response.data);
      setShowSuccess(true);
      generateAIWhatsappMessage(response.data);
      setFormData({
        policy_number: "", family_definition: "", employee_id: "", member_name: "", dob: "", age: "", gender: "",
        relationship_type: "", endorsement_type: "", date_of_joining: "", date_of_leaving: "",
        coverage_type: "", sum_insured: "", per_life_premium: "",
        endorsement_date: new Date().toISOString().split('T')[0], effective_date: "",
        employee_email: "", employee_mobile: "", remarks: ""
      });
      setRateAutoFilled(false);
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
        <SuccessBanner
          submittedData={submittedData}
          adminsWithPhone={adminsWithPhone}
          generatingAI={generatingAI}
          getWhatsAppMessage={getWhatsAppMessage}
          onClose={() => setShowSuccess(false)}
        />
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
                    {policies.map((p) => <PolicySelectOption key={p.id} policy={p} />)}
                  </SelectContent>
                </Select>
              </div>

              {/* Policy Type / Family Definition */}
              <div className="space-y-2">
                <Label>Policy Type (Family) *</Label>
                <Select value={activeFamilyDef} onValueChange={(v) => updateFormData('family_definition', v)}>
                  <SelectTrigger data-testid="family-definition-select"><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="E">E — Employee Only</SelectItem>
                    <SelectItem value="ESK">ESK — Employee + Spouse + Kids</SelectItem>
                    <SelectItem value="ESKP">ESKP — Employee + Spouse + Kids + Parents</SelectItem>
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
                    {relationshipOptions.map(r => <RelationshipOption key={r} value={r} />)}
                  </SelectContent>
                </Select>
                {formData.endorsement_type === "Midterm addition" && (
                  <p className="text-xs text-amber-600 flex items-center gap-1" data-testid="parent-restriction-warning"><AlertCircle className="w-3 h-3" /> Employee &amp; Parents not allowed for Midterm Addition</p>
                )}
                {activeFamilyDef === "E" && (
                  <p className="text-xs text-blue-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> E-type: Employee only</p>
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

              {/* DOB */}
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

              {/* Per Life Premium (auto-populated from rater, editable) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Per Life Premium
                  {rateAutoFilled && <Badge variant="secondary" className="text-[9px] py-0 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200"><Zap className="w-2.5 h-2.5 inline mr-0.5" />From Rate Card</Badge>}
                </Label>
                <Input
                  type="number"
                  value={formData.per_life_premium}
                  onChange={(e) => updateFormData('per_life_premium', e.target.value)}
                  placeholder={selectedPolicy ? `Default: ₹${selectedPolicy.annual_premium_per_life?.toLocaleString()}` : "Enter per life premium"}
                  data-testid="per-life-premium-input"
                />
                {rateAutoFilled && policyRaters.length > 0 && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Auto-filled from "{policyRaters[0].name}" rate card (age {formData.age}). You can edit this value.
                  </p>
                )}
                {!rateAutoFilled && selectedPolicy && !formData.per_life_premium && (
                  <p className="text-xs text-gray-500">Will use policy premium: ₹{selectedPolicy.annual_premium_per_life?.toLocaleString()}</p>
                )}
                {!rateAutoFilled && policyRaters.length > 0 && !formData.age && (
                  <p className="text-xs text-blue-500 flex items-center gap-1"><Zap className="w-3 h-3" /> Enter DOB/age to auto-fill from rate card</p>
                )}
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

              {/* Employee Email */}
              <div className="space-y-2">
                <Label>Employee Email</Label>
                <Input type="email" value={formData.employee_email} onChange={(e) => updateFormData('employee_email', e.target.value)} placeholder="employee@company.com" data-testid="employee-email-input" />
              </div>

              {/* Employee Mobile */}
              <div className="space-y-2">
                <Label>Employee Mobile</Label>
                <Input type="tel" value={formData.employee_mobile} onChange={(e) => updateFormData('employee_mobile', e.target.value)} placeholder="+91 9876543210" data-testid="employee-mobile-input" />
              </div>
            </div>

            {/* Premium & Pro-rata Calculation Display */}
            {selectedPolicy && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 space-y-2" data-testid="premium-info">
                <div className="flex flex-wrap gap-4 text-sm">
                  {selectedPolicy.annual_premium_per_life != null && <span><strong>Policy Premium/Life:</strong> ₹{selectedPolicy.annual_premium_per_life?.toLocaleString()}</span>}
                  {formData.per_life_premium && (
                    <span className="text-indigo-700 font-medium"><strong>Custom Per Life:</strong> ₹{parseFloat(formData.per_life_premium).toLocaleString()}</span>
                  )}
                  <span><strong>Inception:</strong> {selectedPolicy.inception_date}</span>
                  <span><strong>Expiry:</strong> {selectedPolicy.expiry_date}</span>
                  {policyRaters.length > 0 && <Badge variant="outline" className="text-[10px]">Rate Card: {policyRaters[0].name}</Badge>}
                </div>
                {formData.endorsement_type && formData.endorsement_date && (
                  <ProRataPreview
                    policy={selectedPolicy}
                    endorsementType={formData.endorsement_type}
                    endorsementDate={formData.endorsement_date}
                    perLifePremium={formData.per_life_premium ? parseFloat(formData.per_life_premium) : selectedPolicy.annual_premium_per_life}
                  />
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

/* Sub-component: Success banner after submission */
function SuccessBanner({ submittedData, adminsWithPhone, generatingAI, getWhatsAppMessage, onClose }) {
  return (
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
              <WhatsAppButton key={admin.id} admin={admin} message={getWhatsAppMessage()} />
            ))}
            <Button variant="ghost" size="sm" onClick={onClose} className="text-green-600">✕</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
