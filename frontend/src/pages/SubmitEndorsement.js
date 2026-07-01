import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Plus, Loader2, MessageCircle, Sparkles, AlertCircle, TrendingUp, TrendingDown, Zap, Users, UserPlus, Trash2, CheckCircle } from "lucide-react";

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

const FAMILY_RELATIONSHIPS = {
  E: ["Employee"],
  ESK: ["Employee", "Spouse", "Kids1", "Kids2"],
  ESKP: ["Employee", "Spouse", "Kids1", "Kids2", "Mother", "Father"],
};

const fmt = (v) => `₹${(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function lookupRate(raters, policyNumber, age) {
  const a = parseInt(age);
  if (isNaN(a) || !raters.length) return null;
  const rater = raters.find(r => r.policy_number === policyNumber);
  if (!rater) return null;
  const band = (rater.age_bands || []).find(ab => a >= ab.min_age && a <= ab.max_age);
  return band ? { rate: band.per_life_rate, raterName: rater.name } : null;
}

/* ─── Shared sub-components ─── */
function PolicySelectOption({ policy }) {
  const t = policy.family_definition || policy.policy_type || "";
  return <SelectItem value={policy.policy_number}>{policy.policy_number} - {policy.policy_holder_name}{t ? ` (${t})` : ""}</SelectItem>;
}
function RelationshipOption({ value }) {
  return <SelectItem value={value}>{value}</SelectItem>;
}
function WhatsAppButton({ admin, message }) {
  const link = generateWhatsAppLink(admin.phone, message);
  if (!link) return null;
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors" data-testid={`whatsapp-admin-${admin.id}`}>
      <MessageCircle className="w-4 h-4" />{admin.full_name.split(' ')[0]}
    </a>
  );
}

function ProRataPreview({ policy, endorsementType, endorsementDate, perLifePremium }) {
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
      <span className="text-gray-600">Remaining: <strong>{calc.remaining}</strong>/{calc.totalDays}d</span>
      <span className={`font-bold flex items-center gap-1 ${calc.isRefund ? 'text-red-600' : 'text-emerald-600'}`}>
        {calc.isRefund ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
        {calc.isRefund ? '-' : '+'}₹{Math.abs(calc.prorata).toLocaleString()}{calc.isRefund ? ' (Refund)' : ' (Charge)'}
      </span>
    </div>
  );
}

function SuccessBanner({ message, adminsWithPhone, generatingAI, whatsappMsg, onClose }) {
  return (
    <Card className="bg-green-50 border-green-200">
      <CardContent className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">{message}</span>
            <Badge className="bg-purple-100 text-purple-700 text-[10px]"><Sparkles className="w-3 h-3 mr-0.5" />AI Email Sent</Badge>
          </div>
          <div className="flex items-center gap-2">
            {adminsWithPhone.length > 0 && !generatingAI && adminsWithPhone.map(a => <WhatsAppButton key={a.id} admin={a} message={whatsappMsg} />)}
            <Button variant="ghost" size="sm" onClick={onClose} className="text-green-600">✕</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Family Member Row (sub-component) ─── */
function FamilyMemberRow({ member, index, relationshipOptions, raters, policyNumber, onUpdate, onRemove, isEmployee }) {
  const rateInfo = useMemo(() => lookupRate(raters, policyNumber, member.age), [raters, policyNumber, member.age]);

  // Auto-fill rate on age change
  useEffect(() => {
    if (rateInfo && !member._rateManual) {
      onUpdate(index, "per_life_premium", String(rateInfo.rate));
      onUpdate(index, "_rateAuto", true);
    }
  }, [rateInfo, index, member._rateManual, onUpdate]);

  const handleField = (field, val) => {
    if (field === "dob") {
      const age = calcAge(val);
      onUpdate(index, "dob", val);
      if (age !== "") onUpdate(index, "age", String(age));
      return;
    }
    if (field === "per_life_premium") {
      onUpdate(index, "_rateManual", true);
      onUpdate(index, "_rateAuto", false);
    }
    onUpdate(index, field, val);
  };

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${isEmployee ? 'bg-blue-50/50 border-blue-200' : 'bg-stone-50/50 border-stone-200'}`} data-testid={`family-member-${index}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isEmployee ? "default" : "secondary"} className="text-[10px]">{member.relationship_type || `Member ${index + 1}`}</Badge>
          {member._rateAuto && <Badge className="text-[9px] py-0 bg-emerald-50 text-emerald-700 border-emerald-200"><Zap className="w-2.5 h-2.5 mr-0.5" />Rate Card</Badge>}
        </div>
        {!isEmployee && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => onRemove(index)} data-testid={`remove-member-${index}`}><Trash2 className="w-3.5 h-3.5" /></Button>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div>
          <Label className="text-[10px] text-stone-500">Relationship *</Label>
          <Select value={member.relationship_type} onValueChange={(v) => handleField("relationship_type", v)}>
            <SelectTrigger className="h-8 text-xs" data-testid={`member-rel-${index}`}><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>{relationshipOptions.map(r => <RelationshipOption key={r} value={r} />)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-stone-500">Name *</Label>
          <Input value={member.member_name} onChange={e => handleField("member_name", e.target.value)} placeholder="Full name" className="h-8 text-xs" data-testid={`member-name-${index}`} />
        </div>
        <div>
          <Label className="text-[10px] text-stone-500">DOB</Label>
          <Input type="date" value={member.dob} onChange={e => handleField("dob", e.target.value)} className="h-8 text-xs" data-testid={`member-dob-${index}`} />
        </div>
        <div>
          <Label className="text-[10px] text-stone-500">Age</Label>
          <Input type="number" value={member.age} onChange={e => handleField("age", e.target.value)} placeholder="Auto" readOnly={!!member.dob} className={`h-8 text-xs ${member.dob ? 'bg-gray-50' : ''}`} data-testid={`member-age-${index}`} />
        </div>
        <div>
          <Label className="text-[10px] text-stone-500">Gender</Label>
          <Select value={member.gender} onValueChange={(v) => handleField("gender", v)}>
            <SelectTrigger className="h-8 text-xs" data-testid={`member-gender-${index}`}><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-stone-500">Per Life ₹</Label>
          <Input type="number" value={member.per_life_premium} onChange={e => handleField("per_life_premium", e.target.value)} placeholder="Rate" className="h-8 text-xs" data-testid={`member-rate-${index}`} />
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function SubmitEndorsement() {
  const [mode, setMode] = useState("single"); // "single" | "family"
  const [policies, setPolicies] = useState([]);
  const [raters, setRaters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [aiWhatsappMessage, setAiWhatsappMessage] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [rateAutoFilled, setRateAutoFilled] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);

  // --- Single mode state (initialize synchronously from sessionStorage for Select pre-fill) ---
  const [formData, setFormData] = useState(() => {
    const base = {
      policy_number: "", family_definition: "", employee_id: "", member_name: "",
      dob: "", age: "", gender: "", relationship_type: "", endorsement_type: "",
      date_of_joining: "", date_of_leaving: "", coverage_type: "", sum_insured: "",
      per_life_premium: "", endorsement_date: new Date().toISOString().split('T')[0],
      effective_date: "", employee_email: "", employee_mobile: "", remarks: ""
    };
    const prefill = sessionStorage.getItem("deletion_prefill");
    if (prefill) {
      try {
        const d = JSON.parse(prefill);
        sessionStorage.removeItem("deletion_prefill");
        return {
          ...base,
          policy_number: d.policy_number || "",
          endorsement_type: d.endorsement_type || "Deletion",
          employee_id: d.employee_id || "",
          member_name: d.member_name || "",
          relationship_type: d.relationship_type || "",
          dob: d.dob || "",
          age: d.age || "",
          gender: d.gender || "",
          per_life_premium: d.per_life_premium || "",
          sum_insured: d.sum_insured || "",
          coverage_type: d.coverage_type || "",
          employee_email: d.employee_email || "",
          employee_mobile: d.employee_mobile || "",
          _prefilled: true,
        };
      } catch { sessionStorage.removeItem("deletion_prefill"); }
    }
    return base;
  });

  // --- Family mode state ---
  const [familyCommon, setFamilyCommon] = useState({
    policy_number: "", family_definition: "", employee_id: "", endorsement_type: "Addition",
    date_of_joining: "", date_of_leaving: "", coverage_type: "", sum_insured: "",
    endorsement_date: new Date().toISOString().split('T')[0], effective_date: "",
    employee_email: "", employee_mobile: "", remarks: ""
  });
  const emptyMember = { relationship_type: "", member_name: "", dob: "", age: "", gender: "", per_life_premium: "", _rateManual: false, _rateAuto: false };
  const [familyMembers, setFamilyMembers] = useState([{ ...emptyMember, relationship_type: "Employee" }]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const h = { Authorization: `Bearer ${token}` };
    axios.get(`${API}/policies`, { headers: h }).then(r => setPolicies(r.data)).catch(() => toast.error("Failed to load policies"));
    axios.get(`${API}/users/admins`, { headers: h }).then(r => setAdminUsers(r.data)).catch(() => {});
    axios.get(`${API}/raters`, { headers: h }).then(r => setRaters(r.data)).catch(() => {});

    // Show toast if deletion pre-fill was applied
    if (formData._prefilled && !prefillApplied) {
      setPrefillApplied(true);
      toast.info(`Deletion form pre-filled for ${formData.member_name}`);
      // Clean up the _prefilled flag
      setFormData(prev => { const { _prefilled, ...rest } = prev; return rest; });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Shared derived state ---
  const singlePolicy = useMemo(() => policies.find(p => p.policy_number === formData.policy_number), [policies, formData.policy_number]);
  const familyPolicy = useMemo(() => policies.find(p => p.policy_number === familyCommon.policy_number), [policies, familyCommon.policy_number]);
  const selectedPolicy = mode === "single" ? singlePolicy : familyPolicy;

  const activeFamilyDef = useMemo(() => {
    const fd = mode === "single" ? formData.family_definition : familyCommon.family_definition;
    if (fd) return fd;
    if (selectedPolicy?.family_definition) return selectedPolicy.family_definition;
    if (selectedPolicy && (selectedPolicy.policy_type === "GPA" || selectedPolicy.policy_type === "GTL")) return "E";
    return "ESKP";
  }, [mode, formData.family_definition, familyCommon.family_definition, selectedPolicy]);

  const policyRaters = useMemo(() => {
    const pn = mode === "single" ? formData.policy_number : familyCommon.policy_number;
    return raters.filter(r => r.policy_number === pn);
  }, [raters, mode, formData.policy_number, familyCommon.policy_number]);

  const endType = mode === "single" ? formData.endorsement_type : familyCommon.endorsement_type;
  const relationshipOptions = useMemo(() => {
    let opts = FAMILY_RELATIONSHIPS[activeFamilyDef] || FAMILY_RELATIONSHIPS.ESKP;
    if (endType === "Midterm addition") opts = opts.filter(r => r !== "Employee" && r !== "Mother" && r !== "Father");
    return opts;
  }, [activeFamilyDef, endType]);

  // Dependent options (exclude Employee for Add Dependent button)
  const dependentOptions = useMemo(() => relationshipOptions.filter(r => r !== "Employee"), [relationshipOptions]);

  // --- Single mode: auto-fill rate ---
  useEffect(() => {
    if (mode !== "single") return;
    const age = parseInt(formData.age);
    if (isNaN(age) || !policyRaters.length) return;
    const info = lookupRate(raters, formData.policy_number, age);
    if (info) { setFormData(prev => ({ ...prev, per_life_premium: String(info.rate) })); setRateAutoFilled(true); }
  }, [formData.age, policyRaters, raters, formData.policy_number, mode]);

  // Reset single relationship when options change
  useEffect(() => {
    if (mode === "single" && formData.relationship_type && !relationshipOptions.includes(formData.relationship_type))
      setFormData(prev => ({ ...prev, relationship_type: "" }));
  }, [relationshipOptions, formData.relationship_type, mode]);

  // Sync family_definition from policy
  useEffect(() => {
    if (selectedPolicy?.family_definition) {
      if (mode === "single") setFormData(prev => prev.family_definition !== selectedPolicy.family_definition ? { ...prev, family_definition: selectedPolicy.family_definition } : prev);
      else setFamilyCommon(prev => prev.family_definition !== selectedPolicy.family_definition ? { ...prev, family_definition: selectedPolicy.family_definition } : prev);
    }
  }, [selectedPolicy, mode]);

  const showDOJ = endType === "Addition" || endType === "Midterm addition";
  const showDOL = endType === "Deletion";
  const minDate45 = getMinDate45();

  // --- Single mode helpers ---
  const updateFormData = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === "dob" && value) { const age = calcAge(value); if (age !== "") next.age = String(age); }
      if (field === "endorsement_type") { next.date_of_joining = ""; next.date_of_leaving = ""; }
      if (field === "per_life_premium") setRateAutoFilled(false);
      if (field === "policy_number") { next.per_life_premium = ""; next.relationship_type = ""; setRateAutoFilled(false); }
      return next;
    });
  };

  // --- Family mode helpers ---
  const updateFamilyCommon = (field, value) => {
    setFamilyCommon(prev => {
      const next = { ...prev, [field]: value };
      if (field === "endorsement_type") { next.date_of_joining = ""; next.date_of_leaving = ""; }
      if (field === "policy_number") { setFamilyMembers([{ ...emptyMember, relationship_type: "Employee" }]); }
      return next;
    });
  };

  const updateMember = useCallback((idx, field, value) => {
    setFamilyMembers(prev => {
      const updated = prev.slice();
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }, []);

  const removeMember = useCallback((idx) => {
    setFamilyMembers(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addDependent = (relType) => {
    setFamilyMembers(prev => [...prev, { ...emptyMember, relationship_type: relType }]);
  };

  // --- AI message ---
  const generateAIWhatsappMessage = async (data) => {
    try {
      setGeneratingAI(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/notifications/generate`, {
        notification_type: "endorsement_submitted",
        context: { submitted_by: "HR User", policy_number: data.policy_number, member_name: data.member_name, endorsement_type: data.endorsement_type, relationship_type: data.relationship_type, prorata_premium: data.prorata_premium || 0 }
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.content?.whatsapp_message) setAiWhatsappMessage(response.data.content.whatsapp_message);
    } catch {
      setAiWhatsappMessage(`*InsureHub - New Endorsement*\n\n*Policy:* ${data.policy_number}\n*Member:* ${data.member_name}\n*Type:* ${data.endorsement_type}\n\nPlease review in Admin portal.`);
    } finally { setGeneratingAI(false); }
  };

  // --- Single submit ---
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (showDOJ && formData.date_of_joining && formData.date_of_joining < minDate45) { toast.error("DOJ cannot be more than 45 days backdated"); return; }
    if (showDOL && formData.date_of_leaving && formData.date_of_leaving < minDate45) { toast.error("DOL cannot be more than 45 days backdated"); return; }
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const submitData = { ...formData, employee_id: formData.employee_id || null, dob: formData.dob || null, age: formData.age ? parseInt(formData.age) : null, gender: formData.gender || null, date_of_joining: showDOJ ? (formData.date_of_joining || null) : null, date_of_leaving: showDOL ? (formData.date_of_leaving || null) : null, coverage_type: formData.coverage_type || null, sum_insured: formData.sum_insured ? parseFloat(formData.sum_insured) : null, per_life_premium: formData.per_life_premium ? parseFloat(formData.per_life_premium) : null, effective_date: formData.effective_date || null, employee_email: formData.employee_email || null, employee_mobile: formData.employee_mobile || null, remarks: formData.remarks || null };
      delete submitData.family_definition;
      const response = await axios.post(`${API}/endorsements`, submitData, { headers: { Authorization: `Bearer ${token}` } });
      setSuccessMsg("Endorsement submitted!");
      setShowSuccess(true);
      generateAIWhatsappMessage(response.data);
      setFormData({ policy_number: "", family_definition: "", employee_id: "", member_name: "", dob: "", age: "", gender: "", relationship_type: "", endorsement_type: "", date_of_joining: "", date_of_leaving: "", coverage_type: "", sum_insured: "", per_life_premium: "", endorsement_date: new Date().toISOString().split('T')[0], effective_date: "", employee_email: "", employee_mobile: "", remarks: "" });
      setRateAutoFilled(false);
    } catch (error) { toast.error(error.response?.data?.detail || "Failed to submit endorsement"); }
    finally { setLoading(false); }
  };

  // --- Family submit ---
  const handleFamilySubmit = async (e) => {
    e.preventDefault();
    if (!familyCommon.policy_number) { toast.error("Select a policy"); return; }
    if (!familyCommon.endorsement_type) { toast.error("Select endorsement type"); return; }
    const validMembers = familyMembers.filter(m => m.member_name?.trim() && m.relationship_type);
    if (validMembers.length === 0) { toast.error("Add at least one member with name and relationship"); return; }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      let successCount = 0;
      let failCount = 0;

      for (const m of validMembers) {
        try {
          const payload = {
            policy_number: familyCommon.policy_number,
            endorsement_type: familyCommon.endorsement_type,
            employee_id: familyCommon.employee_id || null,
            endorsement_date: familyCommon.endorsement_date,
            effective_date: familyCommon.effective_date || null,
            date_of_joining: showDOJ ? (familyCommon.date_of_joining || null) : null,
            date_of_leaving: showDOL ? (familyCommon.date_of_leaving || null) : null,
            coverage_type: familyCommon.coverage_type || null,
            sum_insured: familyCommon.sum_insured ? parseFloat(familyCommon.sum_insured) : null,
            employee_email: familyCommon.employee_email || null,
            employee_mobile: familyCommon.employee_mobile || null,
            remarks: familyCommon.remarks || null,
            relationship_type: m.relationship_type,
            member_name: m.member_name,
            dob: m.dob || null,
            age: m.age ? parseInt(m.age) : null,
            gender: m.gender || null,
            per_life_premium: m.per_life_premium ? parseFloat(m.per_life_premium) : null,
          };
          await axios.post(`${API}/endorsements`, payload, { headers });
          successCount++;
        } catch { failCount++; }
      }

      if (successCount > 0) {
        setSuccessMsg(`Family batch: ${successCount} member${successCount > 1 ? 's' : ''} submitted${failCount > 0 ? `, ${failCount} failed` : ''}!`);
        setShowSuccess(true);
        const emp = validMembers.find(m => m.relationship_type === "Employee") || validMembers[0];
        generateAIWhatsappMessage({ policy_number: familyCommon.policy_number, member_name: emp.member_name, endorsement_type: familyCommon.endorsement_type, relationship_type: "Family Batch" });
        setFamilyMembers([{ ...emptyMember, relationship_type: "Employee" }]);
        setFamilyCommon(prev => ({ ...prev, employee_id: "", employee_email: "", employee_mobile: "", remarks: "" }));
      }
      if (failCount > 0 && successCount === 0) toast.error("All submissions failed");
    } catch (err) { toast.error("Batch submission error"); }
    finally { setLoading(false); }
  };

  const adminsWithPhone = adminUsers.filter(a => a.phone);
  const whatsappMsg = aiWhatsappMessage || "";

  /* Family total premium */
  const familyTotalPremium = useMemo(() => {
    return familyMembers.reduce((sum, m) => sum + (parseFloat(m.per_life_premium) || 0), 0);
  }, [familyMembers]);

  return (
    <div className="space-y-6" data-testid="submit-endorsement-page">
      {showSuccess && <SuccessBanner message={successMsg} adminsWithPhone={adminsWithPhone} generatingAI={generatingAI} whatsappMsg={whatsappMsg} onClose={() => setShowSuccess(false)} />}

      {/* Mode Toggle */}
      <div className="flex gap-2" data-testid="mode-toggle">
        <Button variant={mode === "single" ? "default" : "outline"} size="sm" onClick={() => setMode("single")} className="gap-1.5" data-testid="mode-single">
          <UserPlus className="w-4 h-4" /> Single Member
        </Button>
        <Button variant={mode === "family" ? "default" : "outline"} size="sm" onClick={() => setMode("family")} className="gap-1.5" data-testid="mode-family">
          <Users className="w-4 h-4" /> Add Family
        </Button>
      </div>

      {mode === "single" ? (
        <SingleModeForm
          formData={formData} updateFormData={updateFormData} handleSubmit={handleSingleSubmit}
          policies={policies} selectedPolicy={singlePolicy} activeFamilyDef={activeFamilyDef}
          relationshipOptions={relationshipOptions} policyRaters={policyRaters}
          rateAutoFilled={rateAutoFilled} showDOJ={showDOJ} showDOL={showDOL} minDate45={minDate45} loading={loading}
        />
      ) : (
        <FamilyModeForm
          familyCommon={familyCommon} updateFamilyCommon={updateFamilyCommon}
          familyMembers={familyMembers} updateMember={updateMember} removeMember={removeMember} addDependent={addDependent}
          handleSubmit={handleFamilySubmit} policies={policies} selectedPolicy={familyPolicy}
          activeFamilyDef={activeFamilyDef} dependentOptions={dependentOptions} relationshipOptions={relationshipOptions}
          raters={raters} policyRaters={policyRaters}
          showDOJ={showDOJ} showDOL={showDOL} minDate45={minDate45} loading={loading} familyTotalPremium={familyTotalPremium}
        />
      )}
    </div>
  );
}

/* ─── SINGLE MODE FORM ─── */
function SingleModeForm({ formData, updateFormData, handleSubmit, policies, selectedPolicy, activeFamilyDef, relationshipOptions, policyRaters, rateAutoFilled, showDOJ, showDOL, minDate45, loading }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit New Endorsement</CardTitle>
        <CardDescription>Add, delete, or correct a single member's coverage.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Policy Number *</Label>
              <Select value={formData.policy_number} onValueChange={(v) => updateFormData('policy_number', v)} required>
                <SelectTrigger data-testid="policy-select"><SelectValue placeholder="Select Policy" /></SelectTrigger>
                <SelectContent>{policies.map(p => <PolicySelectOption key={p.id} policy={p} />)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Policy Type (Family) *</Label>
              <Select value={activeFamilyDef} onValueChange={(v) => updateFormData('family_definition', v)}>
                <SelectTrigger data-testid="family-definition-select"><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="E">E — Employee Only</SelectItem>
                  <SelectItem value="ESK">ESK — Employee + Spouse + Kids</SelectItem>
                  <SelectItem value="ESKP">ESKP — Employee + Spouse + Kids + Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Endorsement Type *</Label>
              <Select value={formData.endorsement_type} onValueChange={(v) => updateFormData('endorsement_type', v)} required>
                <SelectTrigger data-testid="type-select"><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Addition">Addition</SelectItem><SelectItem value="Deletion">Deletion</SelectItem>
                  <SelectItem value="Correction">Correction</SelectItem><SelectItem value="Midterm addition">Midterm addition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Relationship Type *</Label>
              <Select value={formData.relationship_type} onValueChange={(v) => updateFormData('relationship_type', v)} required>
                <SelectTrigger data-testid="relationship-select"><SelectValue placeholder="Select Relationship" /></SelectTrigger>
                <SelectContent>{relationshipOptions.map(r => <RelationshipOption key={r} value={r} />)}</SelectContent>
              </Select>
              {formData.endorsement_type === "Midterm addition" && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Employee &amp; Parents not allowed</p>}
            </div>
            <div className="space-y-2"><Label>Employee ID</Label><Input value={formData.employee_id} onChange={e => updateFormData('employee_id', e.target.value)} placeholder="Employee ID" data-testid="employee-id-input" /></div>
            <div className="space-y-2"><Label>Member Name *</Label><Input value={formData.member_name} onChange={e => updateFormData('member_name', e.target.value)} placeholder="Full name" required data-testid="member-name-input" /></div>
            <div className="space-y-2"><Label>Gender</Label>
              <Select value={formData.gender} onValueChange={(v) => updateFormData('gender', v)}>
                <SelectTrigger data-testid="gender-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={formData.dob} onChange={e => updateFormData('dob', e.target.value)} data-testid="dob-input" /></div>
            <div className="space-y-2"><Label>Age {formData.dob ? "(auto)" : ""}</Label><Input type="number" value={formData.age} onChange={e => updateFormData('age', e.target.value)} placeholder="Auto from DOB" readOnly={!!formData.dob} className={formData.dob ? "bg-gray-50" : ""} data-testid="age-input" /></div>
            {showDOJ && <div className="space-y-2"><Label>Date of Joining</Label><Input type="date" value={formData.date_of_joining} min={minDate45} onChange={e => updateFormData('date_of_joining', e.target.value)} data-testid="date-of-joining-input" /><p className="text-xs text-gray-500">Max 45 days backdated</p></div>}
            {showDOL && <div className="space-y-2"><Label>Date of Leaving</Label><Input type="date" value={formData.date_of_leaving} min={minDate45} onChange={e => updateFormData('date_of_leaving', e.target.value)} data-testid="date-of-leaving-input" /><p className="text-xs text-gray-500">Max 45 days backdated</p></div>}
            <div className="space-y-2"><Label>Coverage Type</Label>
              <Select value={formData.coverage_type} onValueChange={(v) => updateFormData('coverage_type', v)}>
                <SelectTrigger data-testid="coverage-type-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="Floater">Floater</SelectItem><SelectItem value="Non-Floater">Non-Floater</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Sum Insured</Label><Input type="number" value={formData.sum_insured} onChange={e => updateFormData('sum_insured', e.target.value)} placeholder="Sum insured" data-testid="sum-insured-input" /></div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">Per Life Premium{rateAutoFilled && <Badge className="text-[9px] py-0 bg-emerald-50 text-emerald-700 border-emerald-200"><Zap className="w-2.5 h-2.5 mr-0.5" />Rate Card</Badge>}</Label>
              <Input type="number" value={formData.per_life_premium} onChange={e => updateFormData('per_life_premium', e.target.value)} placeholder={selectedPolicy ? `Default: ₹${selectedPolicy.annual_premium_per_life?.toLocaleString()}` : "Per life premium"} data-testid="per-life-premium-input" />
              {rateAutoFilled && policyRaters.length > 0 && <p className="text-xs text-emerald-600 flex items-center gap-1"><Zap className="w-3 h-3" />From "{policyRaters[0].name}" (age {formData.age})</p>}
              {!rateAutoFilled && policyRaters.length > 0 && !formData.age && <p className="text-xs text-blue-500 flex items-center gap-1"><Zap className="w-3 h-3" />Enter DOB/age to auto-fill from rate card</p>}
            </div>
            <div className="space-y-2"><Label>Endorsement Date *</Label><Input type="date" value={formData.endorsement_date} onChange={e => updateFormData('endorsement_date', e.target.value)} required data-testid="endorsement-date-input" /></div>
            <div className="space-y-2"><Label>Effective Date</Label><Input type="date" value={formData.effective_date} onChange={e => updateFormData('effective_date', e.target.value)} data-testid="effective-date-input" /></div>
            <div className="space-y-2"><Label>Employee Email</Label><Input type="email" value={formData.employee_email} onChange={e => updateFormData('employee_email', e.target.value)} placeholder="employee@company.com" data-testid="employee-email-input" /></div>
            <div className="space-y-2"><Label>Employee Mobile</Label><Input type="tel" value={formData.employee_mobile} onChange={e => updateFormData('employee_mobile', e.target.value)} placeholder="+91 9876543210" data-testid="employee-mobile-input" /></div>
          </div>
          {selectedPolicy && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 space-y-2" data-testid="premium-info">
              <div className="flex flex-wrap gap-4 text-sm">
                {selectedPolicy.annual_premium_per_life != null && <span><strong>Policy Premium/Life:</strong> ₹{selectedPolicy.annual_premium_per_life?.toLocaleString()}</span>}
                {formData.per_life_premium && <span className="text-indigo-700 font-medium"><strong>Custom:</strong> ₹{parseFloat(formData.per_life_premium).toLocaleString()}</span>}
                <span><strong>Inception:</strong> {selectedPolicy.inception_date}</span>
                <span><strong>Expiry:</strong> {selectedPolicy.expiry_date}</span>
                {policyRaters.length > 0 && <Badge variant="outline" className="text-[10px]">Rate Card: {policyRaters[0].name}</Badge>}
              </div>
              {formData.endorsement_type && formData.endorsement_date && <ProRataPreview policy={selectedPolicy} endorsementType={formData.endorsement_type} endorsementDate={formData.endorsement_date} perLifePremium={formData.per_life_premium ? parseFloat(formData.per_life_premium) : selectedPolicy.annual_premium_per_life} />}
            </div>
          )}
          <div className="space-y-2"><Label>Remarks</Label><Textarea value={formData.remarks} onChange={e => updateFormData('remarks', e.target.value)} placeholder="Additional notes" rows={3} data-testid="remarks-textarea" /></div>
          <Button type="submit" disabled={loading} data-testid="submit-button">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : <><Plus className="w-4 h-4 mr-2" />Submit Endorsement</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── FAMILY MODE FORM ─── */
function FamilyModeForm({ familyCommon, updateFamilyCommon, familyMembers, updateMember, removeMember, addDependent, handleSubmit, policies, selectedPolicy, activeFamilyDef, dependentOptions, relationshipOptions, raters, policyRaters, showDOJ, showDOL, minDate45, loading, familyTotalPremium }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Add Family — Batch Submission</CardTitle>
        <CardDescription>Submit endorsements for employee and all dependents in one go. Each member will be submitted as a separate endorsement under the same Employee ID.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Common fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Policy Number *</Label>
              <Select value={familyCommon.policy_number} onValueChange={(v) => updateFamilyCommon('policy_number', v)} required>
                <SelectTrigger data-testid="family-policy-select"><SelectValue placeholder="Select Policy" /></SelectTrigger>
                <SelectContent>{policies.map(p => <PolicySelectOption key={p.id} policy={p} />)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Policy Type (Family) *</Label>
              <Select value={activeFamilyDef} onValueChange={(v) => updateFamilyCommon('family_definition', v)}>
                <SelectTrigger data-testid="family-def-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="E">E — Employee Only</SelectItem>
                  <SelectItem value="ESK">ESK — Employee + Spouse + Kids</SelectItem>
                  <SelectItem value="ESKP">ESKP — Employee + Spouse + Kids + Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Endorsement Type *</Label>
              <Select value={familyCommon.endorsement_type} onValueChange={(v) => updateFamilyCommon('endorsement_type', v)} required>
                <SelectTrigger data-testid="family-type-select"><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Addition">Addition</SelectItem><SelectItem value="Deletion">Deletion</SelectItem>
                  <SelectItem value="Correction">Correction</SelectItem><SelectItem value="Midterm addition">Midterm addition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Employee ID</Label><Input value={familyCommon.employee_id} onChange={e => updateFamilyCommon('employee_id', e.target.value)} placeholder="Employee ID" data-testid="family-emp-id" /></div>
            <div className="space-y-2"><Label>Endorsement Date *</Label><Input type="date" value={familyCommon.endorsement_date} onChange={e => updateFamilyCommon('endorsement_date', e.target.value)} required data-testid="family-end-date" /></div>
            <div className="space-y-2"><Label>Coverage Type</Label>
              <Select value={familyCommon.coverage_type} onValueChange={(v) => updateFamilyCommon('coverage_type', v)}>
                <SelectTrigger data-testid="family-coverage"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="Floater">Floater</SelectItem><SelectItem value="Non-Floater">Non-Floater</SelectItem></SelectContent>
              </Select>
            </div>
            {showDOJ && <div className="space-y-2"><Label>Date of Joining</Label><Input type="date" value={familyCommon.date_of_joining} min={minDate45} onChange={e => updateFamilyCommon('date_of_joining', e.target.value)} data-testid="family-doj" /></div>}
            {showDOL && <div className="space-y-2"><Label>Date of Leaving</Label><Input type="date" value={familyCommon.date_of_leaving} min={minDate45} onChange={e => updateFamilyCommon('date_of_leaving', e.target.value)} data-testid="family-dol" /></div>}
            <div className="space-y-2"><Label>Sum Insured</Label><Input type="number" value={familyCommon.sum_insured} onChange={e => updateFamilyCommon('sum_insured', e.target.value)} placeholder="Sum insured" data-testid="family-si" /></div>
            <div className="space-y-2"><Label>Employee Email</Label><Input type="email" value={familyCommon.employee_email} onChange={e => updateFamilyCommon('employee_email', e.target.value)} placeholder="employee@company.com" data-testid="family-email" /></div>
            <div className="space-y-2"><Label>Employee Mobile</Label><Input type="tel" value={familyCommon.employee_mobile} onChange={e => updateFamilyCommon('employee_mobile', e.target.value)} placeholder="+91 9876543210" data-testid="family-mobile" /></div>
          </div>

          {/* Members Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-1.5"><Users className="w-4 h-4" /> Family Members ({familyMembers.length})</h3>
              {policyRaters.length > 0 && <Badge variant="outline" className="text-[10px]"><Zap className="w-3 h-3 mr-0.5" />Rates from: {policyRaters[0].name}</Badge>}
            </div>

            {familyMembers.map((m, i) => (
              <FamilyMemberRow
                key={i} member={m} index={i} isEmployee={i === 0 && m.relationship_type === "Employee"}
                relationshipOptions={relationshipOptions} raters={raters}
                policyNumber={familyCommon.policy_number} onUpdate={updateMember} onRemove={removeMember}
              />
            ))}

            {/* Add Dependent Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {dependentOptions.map(dep => (
                <Button key={dep} type="button" variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => addDependent(dep)} data-testid={`add-dep-${dep}`}>
                  <Plus className="w-3 h-3" /> {dep}
                </Button>
              ))}
            </div>
          </div>

          {/* Premium Summary */}
          {familyMembers.length > 0 && familyTotalPremium > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4" data-testid="family-premium-summary">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="font-semibold text-indigo-700">Total Family Premium: {fmt(familyTotalPremium)}</span>
                <span className="text-stone-500">{familyMembers.filter(m => m.member_name?.trim()).length} member{familyMembers.filter(m => m.member_name?.trim()).length !== 1 ? 's' : ''}</span>
                {selectedPolicy && selectedPolicy.inception_date && selectedPolicy.expiry_date && familyCommon.endorsement_date && familyCommon.endorsement_type !== "Correction" && (
                  <ProRataPreview policy={selectedPolicy} endorsementType={familyCommon.endorsement_type} endorsementDate={familyCommon.endorsement_date} perLifePremium={familyTotalPremium} />
                )}
              </div>
            </div>
          )}

          <div className="space-y-2"><Label>Remarks</Label><Textarea value={familyCommon.remarks} onChange={e => updateFamilyCommon('remarks', e.target.value)} placeholder="Additional notes" rows={2} data-testid="family-remarks" /></div>

          <Button type="submit" disabled={loading} className="gap-1.5" data-testid="family-submit-button">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting batch...</> : <><Users className="w-4 h-4" />Submit Family ({familyMembers.filter(m => m.member_name?.trim()).length} members)</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
