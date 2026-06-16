import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API, getAuthHeaders } from "../auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, BookOpen, Scale, Upload, Sparkles, FileText, Shield, Heart,
  Zap, Plus, Pencil, Trash2, CheckCircle2, Lightbulb, Download, X, File, ShieldX, Lock, Users
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const policyIcons = { "Group Health": Heart, "Group Term": Shield, "Group Accident": Zap };

function PolicyTypeSelector({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid="explainer-policy-type"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="Group Health">Group Health</SelectItem>
        <SelectItem value="Group Term">Group Term</SelectItem>
        <SelectItem value="Group Accident">Group Accident</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FocusSelector({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid="explainer-focus"><SelectValue placeholder="All Topics" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Topics (Comprehensive)</SelectItem>
        <SelectItem value="coverage">Coverage & Benefits</SelectItem>
        <SelectItem value="exclusions">Exclusions & Limitations</SelectItem>
        <SelectItem value="waiting periods">Waiting Periods</SelectItem>
        <SelectItem value="claims process">Claims Process</SelectItem>
        <SelectItem value="sub-limits and caps">Sub-limits & Caps</SelectItem>
        <SelectItem value="maternity and wellness">Maternity & Wellness</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PolicyQuickCard({ type, count, onClick }) {
  const Icon = policyIcons[type] || Shield;
  return (
    <Card className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-[#E05A47]/40" onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#E05A47]" />
        </div>
        <div>
          <p className="font-medium text-sm">{type}</p>
          <p className="text-xs text-stone-400">{count} benchmark{count !== 1 ? "s" : ""} loaded</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MarkdownResult({ icon, title, badges, content, testId, onDownload }) {
  const Icon = icon;
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="w-4 h-4 text-[#E05A47]" />
            <CardTitle className="text-base">{title}</CardTitle>
            {badges}
          </div>
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload} data-testid="download-comparison-btn">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none prose-headings:text-stone-800 prose-strong:text-stone-800 prose-table:text-xs">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}

function BenchmarkSelectCard({ b, selected, onToggle }) {
  return (
    <div
      onClick={() => onToggle(b.id)}
      className={`border rounded-lg p-3 cursor-pointer transition-all ${selected ? "border-[#E05A47] bg-orange-50 ring-1 ring-[#E05A47]/30" : "border-stone-200 hover:border-stone-300"}`}
      data-testid={`benchmark-card-${b.id}`}
    >
      <div className="flex items-center justify-between mb-1">
        <Badge variant={b.is_aarogya_addon ? "default" : "secondary"} className="text-[10px]">
          {b.is_aarogya_addon ? "Aarogya Add-on" : b.policy_type}
        </Badge>
        {selected && <CheckCircle2 className="w-4 h-4 text-[#E05A47]" />}
      </div>
      <p className="font-semibold text-sm">{b.insurer_name}</p>
      <p className="text-xs text-stone-500">{b.plan_name}</p>
    </div>
  );
}

function BenchmarkManageCard({ b, onEdit, onDelete }) {
  return (
    <Card className={b.is_aarogya_addon ? "border-l-4 border-l-emerald-500" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <Badge variant={b.is_aarogya_addon ? "default" : "secondary"} className="text-[10px] mb-1">
              {b.is_aarogya_addon ? "Aarogya Add-on" : b.policy_type}
            </Badge>
            <p className="font-semibold text-sm">{b.insurer_name}</p>
            <p className="text-xs text-stone-500">{b.plan_name}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(b)} data-testid={`edit-benchmark-${b.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onDelete(b.id)} data-testid={`delete-benchmark-${b.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
        <p className="text-[10px] text-stone-400">{Object.keys(b.parameters || {}).length} parameters configured</p>
      </CardContent>
    </Card>
  );
}

// ---- Main Component ----

export default function PolicyExplainer({ isAdmin = false }) {
  const [activeTab, setActiveTab] = useState("explainer");
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Explainer
  const [explainerType, setExplainerType] = useState("Group Health");
  const [focusArea, setFocusArea] = useState("all");
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);

  // Compare & Benchmark (unified)
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedBenchmarkIds, setSelectedBenchmarkIds] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [compareType, setCompareType] = useState("Group Health");
  const [downloading, setDownloading] = useState(false);
  const multiFileRef = useRef(null);

  // Recommend
  const [recommendForm, setRecommendForm] = useState({
    company_size: "51-200", industry: "", annual_budget_per_employee: "",
    policy_types_needed: ["Group Health"], priorities: [],
    current_insurer: "", pain_points: "", employee_avg_age: "",
  });
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null);

  // Admin benchmark CRUD
  const [benchmarkDialog, setBenchmarkDialog] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    policy_type: "Group Health", insurer_name: "", plan_name: "", is_aarogya_addon: false, parameters: {}
  });
  const [paramKey, setParamKey] = useState("");
  const [paramVal, setParamVal] = useState("");
  const [savingBenchmark, setSavingBenchmark] = useState(false);

  // Feature access control (admin)
  const [featureAccess, setFeatureAccess] = useState({ enabled_for_hr: true, allowed_hr_users: [] });
  const [hrUsers, setHrUsers] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [hrHasAccess, setHrHasAccess] = useState(true);

  const fetchBenchmarks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/policy-benchmarks`, { headers: getAuthHeaders() });
      setBenchmarks(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchBenchmarks();
    // Check access for HR
    if (!isAdmin) {
      axios.get(`${API}/feature-access-check/policy_tc`, { headers: getAuthHeaders() })
        .then(res => setHrHasAccess(res.data.has_access))
        .catch(() => setHrHasAccess(true));
    }
    // Fetch feature access settings for admin
    if (isAdmin) {
      axios.get(`${API}/feature-access/policy_tc`, { headers: getAuthHeaders() })
        .then(res => setFeatureAccess(res.data))
        .catch(() => {});
      axios.get(`${API}/users`, { headers: getAuthHeaders() })
        .then(res => setHrUsers(res.data.filter(u => u.role === "HR")))
        .catch(() => {});
    }
  }, [fetchBenchmarks, isAdmin]);

  const handleSaveAccess = async () => {
    setSavingAccess(true);
    try {
      await axios.put(`${API}/feature-access/policy_tc`, featureAccess, { headers: getAuthHeaders() });
      toast.success("Access settings saved");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSavingAccess(false); }
  };

  // -- Explainer --
  const handleExplain = async () => {
    setExplaining(true); setExplanation(null);
    try {
      const res = await axios.post(`${API}/policy-explainer/explain`, {
        policy_type: explainerType, focus_area: focusArea === "all" ? null : focusArea,
      }, { headers: getAuthHeaders() });
      setExplanation(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setExplaining(false); }
  };

  // -- Compare & Benchmark --
  const handleFilesSelected = (e) => {
    const newFiles = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (newFiles.length === 0) { toast.error("Only PDF files are supported"); return; }
    const total = uploadedFiles.length + newFiles.length + selectedBenchmarkIds.length;
    if (total > 5) { toast.error("Maximum 5 sources total"); return; }
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (multiFileRef.current) multiFileRef.current.value = "";
  };

  const removeFile = (idx) => setUploadedFiles(prev => prev.filter((_, i) => i !== idx));

  const toggleBenchmark = (id) => {
    const total = uploadedFiles.length + selectedBenchmarkIds.length;
    setSelectedBenchmarkIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : (total < 5 ? [...prev, id] : prev)
    );
  };

  const handleCompareDocuments = async () => {
    const totalSources = uploadedFiles.length + selectedBenchmarkIds.length;
    if (totalSources < 2) { toast.error("Select at least 2 sources to compare"); return; }
    setComparing(true); setComparison(null);
    try {
      const formData = new FormData();
      uploadedFiles.forEach(f => formData.append("files", f));
      const benchmarkParam = selectedBenchmarkIds.join(",");
      const res = await axios.post(
        `${API}/policy-explainer/structured-benchmark?policy_type=${encodeURIComponent(compareType)}&benchmark_ids=${encodeURIComponent(benchmarkParam)}`,
        formData,
        { headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" } }
      );
      setComparison(res.data);
      toast.success("Benchmark report generated!");
    } catch (err) { toast.error(err.response?.data?.detail || "Benchmark failed"); }
    finally { setComparing(false); }
  };

  const handleDownloadReport = async () => {
    if (!comparison?.report_id) return;
    setDownloading(true);
    try {
      const res = await axios.post(`${API}/policy-explainer/download-report/${comparison.report_id}`, {}, {
        headers: getAuthHeaders(), responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `benchmark_report_${comparison.report_id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Report downloaded & emailed to Master Admin");
    } catch (err) { toast.error("Download failed"); }
    finally { setDownloading(false); }
  };

  // -- Recommend --
  const handleRecommend = async () => {
    if (!recommendForm.industry) { toast.error("Please enter your industry"); return; }
    if (recommendForm.policy_types_needed.length === 0) { toast.error("Select at least one policy type"); return; }
    setRecommending(true); setRecommendation(null);
    try {
      const res = await axios.post(`${API}/policy-explainer/recommend`, recommendForm, { headers: getAuthHeaders() });
      setRecommendation(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || "Recommendation failed"); }
    finally { setRecommending(false); }
  };

  const togglePolicyType = (type) => {
    setRecommendForm(f => ({ ...f, policy_types_needed: f.policy_types_needed.includes(type) ? f.policy_types_needed.filter(t => t !== type) : [...f.policy_types_needed, type] }));
  };
  const togglePriority = (p) => {
    setRecommendForm(f => ({ ...f, priorities: (f.priorities || []).includes(p) ? f.priorities.filter(x => x !== p) : [...(f.priorities || []), p] }));
  };

  // -- Admin CRUD --
  const openNewBenchmark = () => { setEditingBenchmark(null); setBenchmarkForm({ policy_type: "Group Health", insurer_name: "", plan_name: "", is_aarogya_addon: false, parameters: {} }); setBenchmarkDialog(true); };
  const openEditBenchmark = (b) => { setEditingBenchmark(b.id); setBenchmarkForm({ policy_type: b.policy_type, insurer_name: b.insurer_name, plan_name: b.plan_name, is_aarogya_addon: b.is_aarogya_addon || false, parameters: { ...(b.parameters || {}) } }); setBenchmarkDialog(true); };
  const addParam = () => { if (!paramKey.trim()) return; setBenchmarkForm(f => ({ ...f, parameters: { ...f.parameters, [paramKey.trim()]: paramVal.trim() } })); setParamKey(""); setParamVal(""); };
  const removeParam = (key) => { setBenchmarkForm(f => { const p = { ...f.parameters }; delete p[key]; return { ...f, parameters: p }; }); };
  const handleSaveBenchmark = async () => {
    if (!benchmarkForm.insurer_name || !benchmarkForm.plan_name) { toast.error("Insurer name and plan name are required"); return; }
    setSavingBenchmark(true);
    try {
      const payload = { ...benchmarkForm, is_active: true };
      if (editingBenchmark) { await axios.put(`${API}/policy-benchmarks/${editingBenchmark}`, payload, { headers: getAuthHeaders() }); toast.success("Updated"); }
      else { await axios.post(`${API}/policy-benchmarks`, payload, { headers: getAuthHeaders() }); toast.success("Created"); }
      setBenchmarkDialog(false); fetchBenchmarks();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save"); }
    finally { setSavingBenchmark(false); }
  };
  const handleDeleteBenchmark = async (id) => { if (!window.confirm("Delete this benchmark?")) return; try { await axios.delete(`${API}/policy-benchmarks/${id}`, { headers: getAuthHeaders() }); toast.success("Deleted"); fetchBenchmarks(); } catch (err) { toast.error("Failed"); } };

  if (loading) return <div className="flex items-center justify-center py-20" data-testid="explainer-loading"><Loader2 className="w-8 h-8 animate-spin text-[#E05A47]" /></div>;

  // HR access gate
  if (!isAdmin && !hrHasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="policy-tc-no-access">
        <Shield className="w-16 h-16 text-stone-300 mb-4" />
        <h3 className="text-lg font-semibold text-stone-700">Access Restricted</h3>
        <p className="text-sm text-stone-500 mt-2 max-w-md">Policy T&C Explainer & Benchmarking is currently not available for your account. Contact your administrator for access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="policy-explainer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#E05A47] to-orange-400 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-stone-800 font-heading">Policy T&C Explainer & Benchmarking</h2>
          <p className="text-xs text-stone-500">AI-powered insurance analysis by Aarogya Assist</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-lg w-fit" data-testid="explainer-tabs">
        <button onClick={() => setActiveTab("explainer")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "explainer" ? "bg-white text-[#E05A47] shadow-sm" : "text-stone-500 hover:text-stone-700"}`} data-testid="tab-explainer"><BookOpen className="w-4 h-4" /> T&C Explainer</button>
        <button onClick={() => setActiveTab("compare")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "compare" ? "bg-white text-[#E05A47] shadow-sm" : "text-stone-500 hover:text-stone-700"}`} data-testid="tab-compare"><Scale className="w-4 h-4" /> Compare & Benchmark</button>
        <button onClick={() => setActiveTab("recommend")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "recommend" ? "bg-white text-amber-700 shadow-sm" : "text-stone-500 hover:text-stone-700"}`} data-testid="tab-recommend"><Lightbulb className="w-4 h-4" /> AI Recommend</button>
        {isAdmin && <button onClick={() => setActiveTab("manage")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "manage" ? "bg-white text-stone-700 shadow-sm" : "text-stone-500 hover:text-stone-700"}`} data-testid="tab-manage"><FileText className="w-4 h-4" /> Manage Benchmarks</button>}
      </div>

      {/* ===== T&C Explainer ===== */}
      {activeTab === "explainer" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div><Label className="text-sm font-medium">Policy Type</Label><PolicyTypeSelector value={explainerType} onChange={setExplainerType} /></div>
                <div><Label className="text-sm font-medium">Focus Area</Label><FocusSelector value={focusArea} onChange={setFocusArea} /></div>
                <Button onClick={handleExplain} disabled={explaining} className="bg-[#E05A47] hover:bg-[#C94837]" data-testid="explain-btn">
                  {explaining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {explaining ? "Analyzing..." : "Explain T&C"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PolicyQuickCard type="Group Health" count={benchmarks.filter(b => b.policy_type === "Group Health" && !b.is_aarogya_addon).length} onClick={() => setExplainerType("Group Health")} />
            <PolicyQuickCard type="Group Term" count={benchmarks.filter(b => b.policy_type === "Group Term" && !b.is_aarogya_addon).length} onClick={() => setExplainerType("Group Term")} />
            <PolicyQuickCard type="Group Accident" count={benchmarks.filter(b => b.policy_type === "Group Accident" && !b.is_aarogya_addon).length} onClick={() => setExplainerType("Group Accident")} />
          </div>
          {explanation && <MarkdownResult icon={Sparkles} title={`${explanation.policy_type} — T&C Explained`} badges={explanation.focus_area ? <Badge variant="secondary" className="text-xs">{explanation.focus_area}</Badge> : null} content={explanation.explanation} testId="explanation-result" />}
        </div>
      )}

      {/* ===== Compare & Benchmark (Unified) ===== */}
      {activeTab === "compare" && (
        <CompareTab
          benchmarks={benchmarks}
          uploadedFiles={uploadedFiles}
          selectedBenchmarkIds={selectedBenchmarkIds}
          comparing={comparing}
          comparison={comparison}
          compareType={compareType}
          setCompareType={setCompareType}
          multiFileRef={multiFileRef}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={removeFile}
          onToggleBenchmark={toggleBenchmark}
          onCompare={handleCompareDocuments}
          onDownload={handleDownloadReport}
          downloading={downloading}
        />
      )}

      {/* ===== AI Recommend ===== */}
      {activeTab === "recommend" && (
        <RecommendTab form={recommendForm} setForm={setRecommendForm} recommending={recommending} recommendation={recommendation} onRecommend={handleRecommend} onTogglePolicyType={togglePolicyType} onTogglePriority={togglePriority} onDownload={recommendation ? () => { const blob = new Blob([recommendation.recommendation], { type: "text/markdown" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `recommendation_${new Date().toISOString().slice(0,10)}.md`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); toast.success("Downloaded"); } : null} />
      )}

      {/* ===== Manage Benchmarks (Admin) ===== */}
      {activeTab === "manage" && isAdmin && (
        <div className="space-y-6">
          {/* HR Access Control */}
          <Card className="border-l-4 border-l-amber-500" data-testid="hr-access-control">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-sm font-semibold text-stone-700">HR Portal Access Control</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-800">Enable Policy T&C for HR users</p>
                  <p className="text-xs text-stone-500">Toggle visibility of Policy T&C tab in the HR portal</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={featureAccess.enabled_for_hr} onChange={e => setFeatureAccess(f => ({ ...f, enabled_for_hr: e.target.checked }))} data-testid="toggle-hr-access" />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:ring-2 peer-focus:ring-[#E05A47]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#E05A47] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                </label>
              </div>
              {featureAccess.enabled_for_hr && hrUsers.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-stone-800 mb-2">Grant access to specific HR users (leave empty for all)</p>
                  <HrUserAccessList users={hrUsers} selected={featureAccess.allowed_hr_users || []} onChange={ids => setFeatureAccess(f => ({ ...f, allowed_hr_users: ids }))} />
                </div>
              )}
              <Button size="sm" onClick={handleSaveAccess} disabled={savingAccess} className="bg-amber-500 hover:bg-amber-600" data-testid="save-access-btn">
                {savingAccess && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Save Access Settings
              </Button>
            </CardContent>
          </Card>

          {/* Benchmarks */}
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-stone-800">Policy Benchmarks</h3><p className="text-xs text-stone-500">{benchmarks.length} benchmarks configured</p></div>
            <Button onClick={openNewBenchmark} className="bg-[#E05A47] hover:bg-[#C94837]" data-testid="add-benchmark-btn"><Plus className="w-4 h-4 mr-2" /> Add Benchmark</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="manage-benchmarks-list">
            {benchmarks.map(b => <BenchmarkManageCard key={b.id} b={b} onEdit={openEditBenchmark} onDelete={handleDeleteBenchmark} />)}
          </div>
          <Dialog open={benchmarkDialog} onOpenChange={setBenchmarkDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingBenchmark ? "Edit Benchmark" : "Add Benchmark"}</DialogTitle><DialogDescription>Configure policy benchmark parameters.</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Policy Type</Label><PolicyTypeSelector value={benchmarkForm.policy_type} onChange={v => setBenchmarkForm(f => ({ ...f, policy_type: v }))} /></div>
                  <div><Label>Insurer Name *</Label><Input value={benchmarkForm.insurer_name} onChange={e => setBenchmarkForm(f => ({ ...f, insurer_name: e.target.value }))} placeholder="e.g. ICICI Lombard" data-testid="benchmark-insurer" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Plan Name *</Label><Input value={benchmarkForm.plan_name} onChange={e => setBenchmarkForm(f => ({ ...f, plan_name: e.target.value }))} placeholder="e.g. Group Health Protect" data-testid="benchmark-plan" /></div>
                  <div className="flex items-end"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={benchmarkForm.is_aarogya_addon} onChange={e => setBenchmarkForm(f => ({ ...f, is_aarogya_addon: e.target.checked }))} className="rounded" /><span className="text-sm">Aarogya Assist Add-on</span></label></div>
                </div>
                <div>
                  <Label className="mb-2 block">Parameters</Label>
                  <div className="flex gap-2 mb-3">
                    <Input value={paramKey} onChange={e => setParamKey(e.target.value)} placeholder="Parameter name" className="flex-1" data-testid="param-key-input" />
                    <Input value={paramVal} onChange={e => setParamVal(e.target.value)} placeholder="Value" className="flex-1" data-testid="param-val-input" />
                    <Button variant="outline" size="sm" onClick={addParam} data-testid="add-param-btn"><Plus className="w-4 h-4" /></Button>
                  </div>
                  <ParamList params={benchmarkForm.parameters} onRemove={removeParam} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBenchmarkDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveBenchmark} disabled={savingBenchmark} className="bg-[#E05A47] hover:bg-[#C94837]" data-testid="save-benchmark-btn">{savingBenchmark && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingBenchmark ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

// ========== Extracted Components ==========

function CompareTab({ benchmarks, uploadedFiles, selectedBenchmarkIds, comparing, comparison, compareType, setCompareType, multiFileRef, onFilesSelected, onRemoveFile, onToggleBenchmark, onCompare, onDownload, downloading }) {
  const totalSources = uploadedFiles.length + selectedBenchmarkIds.length;
  const report = comparison?.report;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#E05A47]" />
            <CardTitle className="text-base">Compare & Benchmark Policies</CardTitle>
          </div>
          <p className="text-xs text-stone-500 mt-1">Upload policy PDFs and/or select benchmarks to generate a visual comparison report</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Policy Type Selector */}
          <div className="max-w-xs">
            <Label className="text-sm font-medium mb-1 block">Policy Type</Label>
            <Select value={compareType} onValueChange={setCompareType}>
              <SelectTrigger data-testid="compare-policy-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Group Health">Group Health Insurance</SelectItem>
                <SelectItem value="Group Term">Group Term Insurance</SelectItem>
                <SelectItem value="Group Accident">Group Accident Insurance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Upload Area */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Step 1: Upload Policy T&C Documents (PDF)</Label>
            <div className="border-2 border-dashed border-stone-200 rounded-lg p-5 text-center hover:border-[#E05A47]/40 transition-colors">
              <input ref={multiFileRef} type="file" accept=".pdf" multiple onChange={onFilesSelected} className="hidden" data-testid="multi-pdf-input" />
              <Upload className="w-7 h-7 text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-600 mb-2">Upload your policy T&C documents</p>
              <Button variant="outline" size="sm" onClick={() => multiFileRef.current?.click()} data-testid="upload-pdfs-btn">
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Choose PDF Files
              </Button>
              <p className="text-[10px] text-stone-400 mt-2">Max 15MB per file. Up to 5 sources total.</p>
            </div>
            {uploadedFiles.length > 0 && <UploadedFilesList files={uploadedFiles} onRemove={onRemoveFile} />}
          </div>

          {/* Benchmark Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Step 2: Add Pre-loaded Benchmarks (optional)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2" data-testid="benchmark-select-grid">
              {benchmarks.map(b => <BenchmarkSelectCard key={b.id} b={b} selected={selectedBenchmarkIds.includes(b.id)} onToggle={onToggleBenchmark} />)}
            </div>
          </div>

          {/* Compare Button */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <p className="text-sm text-stone-500">{totalSources} source{totalSources !== 1 ? "s" : ""} selected</p>
            <Button onClick={onCompare} disabled={comparing || totalSources < 2} className="bg-[#E05A47] hover:bg-[#C94837]" data-testid="compare-documents-btn">
              {comparing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}
              {comparing ? "Generating Report..." : "Generate Benchmark Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visual Report Preview */}
      {report && <BenchmarkReportPreview report={report} reportId={comparison.report_id} onDownload={onDownload} downloading={downloading} />}
    </div>
  );
}

function ScoreBar({ score, max = 10 }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-stone-700 w-8 text-right">{score}</span>
    </div>
  );
}

function BenchmarkReportPreview({ report, reportId, onDownload, downloading }) {
  const policies = report.policies || [];
  const compTable = report.comparison_table || [];
  const topPick = report.top_pick || {};
  const advice = report.enhancement_advice || [];
  const addons = report.aarogya_assist_addons || [];

  return (
    <div className="space-y-6" data-testid="benchmark-report-preview">
      {/* Report Header */}
      <Card className="border-t-4 border-t-[#E05A47]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-xl font-bold text-stone-800">{report.report_title || "Benchmark Report"}</h3>
              <p className="text-sm text-stone-500 mt-1">{report.policy_type} | {report.generated_at || new Date().toLocaleDateString()}</p>
            </div>
            <Button onClick={onDownload} disabled={downloading} className="bg-[#E05A47] hover:bg-[#C94837]" data-testid="download-pdf-report-btn">
              {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {downloading ? "Generating PDF..." : "Download PDF & Email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Policy Score Cards */}
      <div className={`grid grid-cols-1 ${policies.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
        {policies.map((p, i) => (
          <PolicyScoreCard key={i} policy={p} isTopPick={topPick.name && p.name === topPick.name} />
        ))}
      </div>

      {/* Comparison Table */}
      {compTable.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-stone-700">Side-by-Side Comparison</CardTitle></CardHeader>
          <CardContent>
            <ComparisonTableView data={compTable} policyNames={policies.map(p => p.name)} />
          </CardContent>
        </Card>
      )}

      {/* Top Pick + Advice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {topPick.name && (
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-emerald-700">Top Pick</CardTitle></CardHeader>
            <CardContent>
              <p className="font-bold text-stone-800 text-lg">{topPick.name}</p>
              <p className="text-sm text-stone-600 mt-2">{topPick.reason}</p>
            </CardContent>
          </Card>
        )}
        {advice.length > 0 && (
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-amber-700">Enhancement Advice</CardTitle></CardHeader>
            <CardContent>
              <AdviceList items={advice} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Aarogya Assist Add-ons */}
      {addons.length > 0 && (
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-[#E05A47]/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-[#E05A47]">Aarogya Assist Wellness Add-ons</CardTitle></CardHeader>
          <CardContent><AdviceList items={addons} color="text-[#E05A47]" /></CardContent>
        </Card>
      )}
    </div>
  );
}

function PolicyScoreCard({ policy, isTopPick }) {
  const scores = policy.scores || {};
  const scoreEntries = Object.entries(scores);
  return (
    <Card className={`hover:shadow-lg transition-all ${isTopPick ? 'ring-2 ring-emerald-300 border-emerald-200' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-sm text-stone-800">{policy.name}</p>
            <Badge variant="secondary" className="text-[10px] mt-1">{policy.source || "benchmark"}</Badge>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-[#E05A47]">{policy.overall_score}</p>
            <p className="text-[9px] text-stone-400">/10</p>
          </div>
        </div>
        {isTopPick && <Badge className="bg-emerald-100 text-emerald-700 text-[10px] mb-3">Top Pick</Badge>}
        <div className="space-y-2">
          {scoreEntries.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-[10px] text-stone-500 mb-0.5">
                <span>{k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
              </div>
              <ScoreBar score={v} />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {(policy.strengths || []).slice(0, 2).map((s, i) => (
            <p key={i} className="text-[10px] text-emerald-600 flex items-start gap-1"><CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />{s}</p>
          ))}
          {(policy.weaknesses || []).slice(0, 2).map((w, i) => (
            <p key={i} className="text-[10px] text-red-500 flex items-start gap-1"><ShieldX className="w-3 h-3 mt-0.5 shrink-0" />{w}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonTableView({ data, policyNames }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-stone-800 text-white">
            <th className="text-left px-3 py-2 font-semibold">Parameter</th>
            {policyNames.map((n, i) => <th key={i} className="text-left px-3 py-2 font-semibold">{n.length > 25 ? n.slice(0, 25) + "..." : n}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-stone-50"}>
              <td className="px-3 py-2 font-medium text-stone-700">{row.parameter}</td>
              {(row.values || []).map((v, j) => <td key={j} className="px-3 py-2 text-stone-600">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdviceList({ items, color = "text-stone-700" }) {
  return (
    <div className="space-y-2">
      {items.map((a, i) => <p key={i} className={`text-xs ${color} flex items-start gap-2`}><span className="text-[#E05A47] font-bold shrink-0">•</span>{a}</p>)}
    </div>
  );
}

function UploadedFilesList({ files, onRemove }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-md px-3 py-1.5 text-xs" data-testid={`uploaded-file-${i}`}>
          <File className="w-3.5 h-3.5 text-[#E05A47]" />
          <span className="text-stone-700 max-w-[160px] truncate">{f.name}</span>
          <button onClick={() => onRemove(i)} className="text-stone-400 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
        </div>
      ))}
    </div>
  );
}

function ParamList({ params, onRemove }) {
  const entries = Object.entries(params);
  if (entries.length === 0) return <p className="text-xs text-stone-400">No parameters added yet.</p>;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between bg-stone-50 rounded px-3 py-1.5 text-xs">
          <span><strong>{k}:</strong> {v}</span>
          <button onClick={() => onRemove(k)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
    </div>
  );
}

const INDUSTRIES = ["IT / Software", "Manufacturing", "BFSI / Finance", "Healthcare / Pharma", "Retail / E-commerce", "Education", "Real Estate / Construction", "Media / Entertainment", "Logistics / Transportation", "Consulting / Professional Services", "Other"];
const PRIORITY_OPTIONS = ["Maternity cover", "Mental health", "No room rent cap", "Low copay", "Wide network hospitals", "OPD cover", "Wellness benefits", "Fast claims", "Telemedicine", "Critical illness rider", "High sum insured", "Low premium"];

function RecommendTab({ form, setForm, recommending, recommendation, onRecommend, onTogglePolicyType, onTogglePriority, onDownload }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" /><CardTitle className="text-base">AI Policy Recommendation Engine</CardTitle></div>
          <p className="text-xs text-stone-500 mt-1">Tell us about your organization and we'll recommend the best insurance policies</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="text-sm font-medium">Company Size *</Label>
              <Select value={form.company_size} onValueChange={v => setForm(f => ({ ...f, company_size: v }))}>
                <SelectTrigger data-testid="recommend-company-size"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1-50">1-50 employees</SelectItem><SelectItem value="51-200">51-200 employees</SelectItem><SelectItem value="201-500">201-500 employees</SelectItem><SelectItem value="501-2000">501-2000 employees</SelectItem><SelectItem value="2000+">2000+ employees</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm font-medium">Industry *</Label>
              <Select value={form.industry} onValueChange={v => setForm(f => ({ ...f, industry: v }))}>
                <SelectTrigger data-testid="recommend-industry"><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="text-sm font-medium">Annual Budget per Employee</Label>
              <Select value={form.annual_budget_per_employee || "flexible"} onValueChange={v => setForm(f => ({ ...f, annual_budget_per_employee: v === "flexible" ? "" : v }))}>
                <SelectTrigger data-testid="recommend-budget"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="flexible">Flexible</SelectItem><SelectItem value="3000-5000">₹3K - ₹5K</SelectItem><SelectItem value="5000-10000">₹5K - ₹10K</SelectItem><SelectItem value="10000-20000">₹10K - ₹20K</SelectItem><SelectItem value="20000-50000">₹20K - ₹50K</SelectItem><SelectItem value="50000+">₹50K+</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm font-medium">Average Employee Age</Label>
              <Select value={form.employee_avg_age || "notspecified"} onValueChange={v => setForm(f => ({ ...f, employee_avg_age: v === "notspecified" ? "" : v }))}>
                <SelectTrigger data-testid="recommend-age"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="notspecified">Not specified</SelectItem><SelectItem value="25-30">25-30</SelectItem><SelectItem value="30-35">30-35</SelectItem><SelectItem value="35-40">35-40</SelectItem><SelectItem value="40-45">40-45</SelectItem><SelectItem value="45+">45+</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Policies Needed *</Label>
            <div className="flex gap-2 flex-wrap">
              <PolicyTypeChip label="Group Health" icon={Heart} active={form.policy_types_needed.includes("Group Health")} onClick={() => onTogglePolicyType("Group Health")} />
              <PolicyTypeChip label="Group Term" icon={Shield} active={form.policy_types_needed.includes("Group Term")} onClick={() => onTogglePolicyType("Group Term")} />
              <PolicyTypeChip label="Group Accident" icon={Zap} active={form.policy_types_needed.includes("Group Accident")} onClick={() => onTogglePolicyType("Group Accident")} />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Key Priorities</Label>
            <div className="flex gap-2 flex-wrap" data-testid="recommend-priorities">
              {PRIORITY_OPTIONS.map(p => (
                <button key={p} onClick={() => onTogglePriority(p)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${(form.priorities || []).includes(p) ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-stone-200 text-stone-500 hover:border-stone-300"}`} data-testid={`priority-${p.replace(/\s/g, "-").toLowerCase()}`}>{p}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="text-sm font-medium">Current Insurer</Label><Input value={form.current_insurer} onChange={e => setForm(f => ({ ...f, current_insurer: e.target.value }))} placeholder="e.g. ICICI Lombard" data-testid="recommend-current-insurer" /></div>
            <div><Label className="text-sm font-medium">Pain Points</Label><Input value={form.pain_points} onChange={e => setForm(f => ({ ...f, pain_points: e.target.value }))} placeholder="e.g. Slow claims" data-testid="recommend-pain-points" /></div>
          </div>
          <Button onClick={onRecommend} disabled={recommending} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white" size="lg" data-testid="get-recommendation-btn">
            {recommending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />}
            {recommending ? "Generating..." : "Get AI Recommendation"}
          </Button>
        </CardContent>
      </Card>
      {recommendation && <MarkdownResult icon={Lightbulb} title="AI Policy Recommendation" badges={<Badge className="bg-amber-100 text-amber-700 text-xs">{recommendation.benchmarks_considered} policies analyzed</Badge>} content={recommendation.recommendation} testId="recommendation-result" onDownload={onDownload} />}
    </div>
  );
}

function PolicyTypeChip({ label, icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${active ? "bg-orange-50 border-[#E05A47]/40 text-[#E05A47]" : "bg-white border-stone-200 text-stone-500 hover:border-stone-300"}`} data-testid={`policy-type-chip-${label.replace(/\s/g, "-").toLowerCase()}`}>
      <Icon className="w-4 h-4" /> {label}
      {active && <CheckCircle2 className="w-3.5 h-3.5" />}
    </button>
  );
}


function HrUserAccessList({ users, selected, onChange }) {
  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };
  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {users.map(u => (
        <label key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 cursor-pointer transition-colors" data-testid={`hr-user-access-${u.id}`}>
          <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="rounded border-stone-300 text-[#E05A47] focus:ring-[#E05A47]/20" />
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-sm text-stone-700 font-medium">{u.username}</span>
            {u.email && <span className="text-xs text-stone-400">{u.email}</span>}
          </div>
        </label>
      ))}
    </div>
  );
}
