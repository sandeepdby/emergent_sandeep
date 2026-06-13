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
  Zap, Plus, Pencil, Trash2, CheckCircle2, Lightbulb
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const POLICY_TYPES = ["Group Health", "Group Term", "Group Accident"];
const FOCUS_AREAS = [
  { value: "", label: "All Topics (Comprehensive)" },
  { value: "coverage", label: "Coverage & Benefits" },
  { value: "exclusions", label: "Exclusions & Limitations" },
  { value: "waiting periods", label: "Waiting Periods" },
  { value: "claims process", label: "Claims Process" },
  { value: "sub-limits and caps", label: "Sub-limits & Caps" },
  { value: "maternity and wellness", label: "Maternity & Wellness" },
];

const policyIcons = { "Group Health": Heart, "Group Term": Shield, "Group Accident": Zap };

// ---- Extracted Components ----

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
    <Card className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-indigo-400" onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <p className="font-medium text-sm">{type}</p>
          <p className="text-xs text-gray-400">{count} benchmark{count !== 1 ? 's' : ''} loaded</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MarkdownResult({ icon, title, badges, content, testId }) {
  const Icon = icon;
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className="w-4 h-4 text-indigo-500" />
          <CardTitle className="text-base">{title}</CardTitle>
          {badges}
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none prose-headings:text-indigo-700 prose-strong:text-gray-800 prose-table:text-xs">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}

function BenchmarkSelectCard({ b, selected, onToggle }) {
  const paramKeys = Object.keys(b.parameters || {});
  return (
    <div
      onClick={() => onToggle(b.id)}
      className={`border rounded-xl p-4 cursor-pointer transition-all ${selected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
      data-testid={`benchmark-card-${b.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Badge variant={b.is_aarogya_addon ? "default" : "secondary"} className="text-[10px]">
          {b.is_aarogya_addon ? "Aarogya Add-on" : b.policy_type}
        </Badge>
        {selected && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
      </div>
      <p className="font-semibold text-sm">{b.insurer_name}</p>
      <p className="text-xs text-gray-500">{b.plan_name}</p>
      <p className="text-[10px] text-gray-400 mt-1">{paramKeys.length} parameters</p>
    </div>
  );
}

function BenchmarkManageCard({ b, onEdit, onDelete }) {
  const paramEntries = Object.entries(b.parameters || {}).slice(0, 4);
  return (
    <Card className={b.is_aarogya_addon ? "border-l-4 border-l-emerald-500" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <Badge variant={b.is_aarogya_addon ? "default" : "secondary"} className="text-[10px] mb-1">
              {b.is_aarogya_addon ? "Aarogya Add-on" : b.policy_type}
            </Badge>
            <p className="font-semibold text-sm">{b.insurer_name}</p>
            <p className="text-xs text-gray-500">{b.plan_name}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(b)} data-testid={`edit-benchmark-${b.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onDelete(b.id)} data-testid={`delete-benchmark-${b.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
        <p className="text-[10px] text-gray-400">{Object.keys(b.parameters || {}).length} parameters configured</p>
      </CardContent>
    </Card>
  );
}

// ---- Main Component ----

export default function PolicyExplainer({ isAdmin = false }) {
  const [activeTab, setActiveTab] = useState("explainer");
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [explainerType, setExplainerType] = useState("Group Health");
  const [focusArea, setFocusArea] = useState("all");
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [pdfAnalysis, setPdfAnalysis] = useState(null);
  const fileRef = useRef(null);

  const [benchmarkDialog, setBenchmarkDialog] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    policy_type: "Group Health", insurer_name: "", plan_name: "", is_aarogya_addon: false, parameters: {}
  });
  const [paramKey, setParamKey] = useState("");
  const [paramVal, setParamVal] = useState("");
  const [savingBenchmark, setSavingBenchmark] = useState(false);

  // Recommend state
  const [recommendForm, setRecommendForm] = useState({
    company_size: "51-200", industry: "", annual_budget_per_employee: "",
    policy_types_needed: ["Group Health"], priorities: [],
    current_insurer: "", pain_points: "", employee_avg_age: "",
  });
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null);

  const fetchBenchmarks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/policy-benchmarks`, { headers: getAuthHeaders() });
      setBenchmarks(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBenchmarks(); }, [fetchBenchmarks]);

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

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev);
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) { toast.error("Select at least 2 policies"); return; }
    setComparing(true); setComparison(null);
    try {
      const res = await axios.post(`${API}/policy-explainer/compare`, { benchmark_ids: selectedIds }, { headers: getAuthHeaders() });
      setComparison(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || "Comparison failed"); }
    finally { setComparing(false); }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setPdfAnalysis(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/policy-explainer/upload-pdf`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
      });
      setPdfAnalysis(res.data);
      toast.success("PDF analyzed successfully");
    } catch (err) { toast.error(err.response?.data?.detail || "PDF analysis failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

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
    setRecommendForm(f => {
      const current = f.policy_types_needed;
      return { ...f, policy_types_needed: current.includes(type) ? current.filter(t => t !== type) : [...current, type] };
    });
  };

  const togglePriority = (p) => {
    setRecommendForm(f => {
      const current = f.priorities || [];
      return { ...f, priorities: current.includes(p) ? current.filter(x => x !== p) : [...current, p] };
    });
  };

  const openNewBenchmark = () => {
    setEditingBenchmark(null);
    setBenchmarkForm({ policy_type: "Group Health", insurer_name: "", plan_name: "", is_aarogya_addon: false, parameters: {} });
    setBenchmarkDialog(true);
  };

  const openEditBenchmark = (b) => {
    setEditingBenchmark(b.id);
    setBenchmarkForm({ policy_type: b.policy_type, insurer_name: b.insurer_name, plan_name: b.plan_name, is_aarogya_addon: b.is_aarogya_addon || false, parameters: { ...(b.parameters || {}) } });
    setBenchmarkDialog(true);
  };

  const addParam = () => {
    if (!paramKey.trim()) return;
    setBenchmarkForm(f => ({ ...f, parameters: { ...f.parameters, [paramKey.trim()]: paramVal.trim() } }));
    setParamKey(""); setParamVal("");
  };

  const removeParam = (key) => {
    setBenchmarkForm(f => { const p = { ...f.parameters }; delete p[key]; return { ...f, parameters: p }; });
  };

  const handleSaveBenchmark = async () => {
    if (!benchmarkForm.insurer_name || !benchmarkForm.plan_name) { toast.error("Insurer name and plan name are required"); return; }
    setSavingBenchmark(true);
    try {
      const payload = { ...benchmarkForm, is_active: true };
      if (editingBenchmark) {
        await axios.put(`${API}/policy-benchmarks/${editingBenchmark}`, payload, { headers: getAuthHeaders() });
        toast.success("Benchmark updated");
      } else {
        await axios.post(`${API}/policy-benchmarks`, payload, { headers: getAuthHeaders() });
        toast.success("Benchmark created");
      }
      setBenchmarkDialog(false); fetchBenchmarks();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save"); }
    finally { setSavingBenchmark(false); }
  };

  const handleDeleteBenchmark = async (id) => {
    if (!window.confirm("Delete this benchmark?")) return;
    try {
      await axios.delete(`${API}/policy-benchmarks/${id}`, { headers: getAuthHeaders() });
      toast.success("Deleted"); fetchBenchmarks();
    } catch (err) { toast.error("Failed to delete"); }
  };

  if (loading) return <div className="flex items-center justify-center py-20" data-testid="explainer-loading"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-6" data-testid="policy-explainer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Policy Explainer & Benchmarking</h2>
          <p className="text-xs text-gray-500">AI-powered insurance T&C analysis by Aarogya Assist</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit" data-testid="explainer-tabs">
        <button onClick={() => setActiveTab("explainer")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "explainer" ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} data-testid="tab-explainer"><BookOpen className="w-4 h-4" /> T&C Explainer</button>
        <button onClick={() => setActiveTab("benchmark")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "benchmark" ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} data-testid="tab-benchmark"><Scale className="w-4 h-4" /> Benchmarking</button>
        <button onClick={() => setActiveTab("upload")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "upload" ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} data-testid="tab-upload"><Upload className="w-4 h-4" /> PDF Analysis</button>
        <button onClick={() => setActiveTab("recommend")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "recommend" ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} data-testid="tab-recommend"><Lightbulb className="w-4 h-4" /> AI Recommend</button>
        {isAdmin && <button onClick={() => setActiveTab("manage")} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "manage" ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} data-testid="tab-manage"><FileText className="w-4 h-4" /> Manage Benchmarks</button>}
      </div>

      {/* T&C Explainer */}
      {activeTab === "explainer" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div><Label className="text-sm font-medium">Policy Type</Label><PolicyTypeSelector value={explainerType} onChange={setExplainerType} /></div>
                <div><Label className="text-sm font-medium">Focus Area</Label><FocusSelector value={focusArea} onChange={setFocusArea} /></div>
                <Button onClick={handleExplain} disabled={explaining} className="bg-indigo-600 hover:bg-indigo-700" data-testid="explain-btn">
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
          {explanation && (
            <MarkdownResult icon={Sparkles} title={`${explanation.policy_type} — T&C Explained`}
              badges={explanation.focus_area ? <Badge variant="secondary" className="text-xs">{explanation.focus_area}</Badge> : null}
              content={explanation.explanation} testId="explanation-result" />
          )}
        </div>
      )}

      {/* Benchmarking */}
      {activeTab === "benchmark" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-600 mb-4">Select 2-4 policies to compare side-by-side. Click cards to select.</p>
              <p className="text-xs text-gray-400 mb-4">{selectedIds.length}/4 selected</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="benchmark-cards">
                {benchmarks.map(b => <BenchmarkSelectCard key={b.id} b={b} selected={selectedIds.includes(b.id)} onToggle={toggleSelect} />)}
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={handleCompare} disabled={comparing || selectedIds.length < 2} className="bg-indigo-600 hover:bg-indigo-700" data-testid="compare-btn">
                  {comparing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}
                  {comparing ? "Comparing..." : `Compare ${selectedIds.length} Policies`}
                </Button>
              </div>
            </CardContent>
          </Card>
          {comparison && (
            <MarkdownResult icon={Scale} title="Policy Comparison" content={comparison.comparison} testId="comparison-result" badges={null} />
          )}
        </div>
      )}

      {/* PDF Upload */}
      {activeTab === "upload" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Upload className="w-8 h-8 text-indigo-500" /></div>
              <h3 className="text-lg font-semibold mb-2">Upload Policy Document</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">Upload a policy PDF and our AI will extract key terms, conditions, exclusions, and provide a comprehensive analysis.</p>
              <input ref={fileRef} type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" data-testid="pdf-file-input" />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} size="lg" className="bg-indigo-600 hover:bg-indigo-700" data-testid="upload-pdf-btn">
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? "Analyzing PDF..." : "Choose PDF File"}
              </Button>
              <p className="text-xs text-gray-400 mt-3">Max 15MB. Text-based PDFs only.</p>
            </CardContent>
          </Card>
          {pdfAnalysis && (
            <MarkdownResult icon={FileText} title={`PDF Analysis: ${pdfAnalysis.filename}`}
              badges={<Badge variant="secondary" className="text-xs">{pdfAnalysis.text_length.toLocaleString()} chars extracted</Badge>}
              content={pdfAnalysis.analysis} testId="pdf-analysis-result" />
          )}
        </div>
      )}

      {/* AI Recommend */}
      {activeTab === "recommend" && (
        <RecommendTab
          form={recommendForm}
          setForm={setRecommendForm}
          recommending={recommending}
          recommendation={recommendation}
          onRecommend={handleRecommend}
          onTogglePolicyType={togglePolicyType}
          onTogglePriority={togglePriority}
        />
      )}

      {/* Manage Benchmarks (Admin) */}
      {activeTab === "manage" && isAdmin && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-gray-800">Policy Benchmarks</h3><p className="text-xs text-gray-500">{benchmarks.length} benchmarks configured</p></div>
            <Button onClick={openNewBenchmark} data-testid="add-benchmark-btn"><Plus className="w-4 h-4 mr-2" /> Add Benchmark</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="manage-benchmarks-list">
            {benchmarks.map(b => <BenchmarkManageCard key={b.id} b={b} onEdit={openEditBenchmark} onDelete={handleDeleteBenchmark} />)}
          </div>
          <Dialog open={benchmarkDialog} onOpenChange={setBenchmarkDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBenchmark ? "Edit Benchmark" : "Add Benchmark"}</DialogTitle>
                <DialogDescription>Configure policy benchmark parameters.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Policy Type</Label><PolicyTypeSelector value={benchmarkForm.policy_type} onChange={v => setBenchmarkForm(f => ({ ...f, policy_type: v }))} /></div>
                  <div><Label>Insurer Name *</Label><Input value={benchmarkForm.insurer_name} onChange={e => setBenchmarkForm(f => ({ ...f, insurer_name: e.target.value }))} placeholder="e.g. ICICI Lombard" data-testid="benchmark-insurer" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Plan Name *</Label><Input value={benchmarkForm.plan_name} onChange={e => setBenchmarkForm(f => ({ ...f, plan_name: e.target.value }))} placeholder="e.g. Group Health Protect" data-testid="benchmark-plan" /></div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={benchmarkForm.is_aarogya_addon} onChange={e => setBenchmarkForm(f => ({ ...f, is_aarogya_addon: e.target.checked }))} className="rounded" />
                      <span className="text-sm">Aarogya Assist Add-on</span>
                    </label>
                  </div>
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
                <Button onClick={handleSaveBenchmark} disabled={savingBenchmark} data-testid="save-benchmark-btn">
                  {savingBenchmark && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingBenchmark ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

function ParamList({ params, onRemove }) {
  const entries = Object.entries(params);
  if (entries.length === 0) return <p className="text-xs text-gray-400">No parameters added yet.</p>;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5 text-xs">
          <span><strong>{k}:</strong> {v}</span>
          <button onClick={() => onRemove(k)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
    </div>
  );
}

const COMPANY_SIZES = ["1-50", "51-200", "201-500", "501-2000", "2000+"];
const INDUSTRIES = [
  "IT / Software", "Manufacturing", "BFSI / Finance", "Healthcare / Pharma",
  "Retail / E-commerce", "Education", "Real Estate / Construction",
  "Media / Entertainment", "Logistics / Transportation", "Consulting / Professional Services", "Other"
];
const PRIORITY_OPTIONS = [
  "Maternity cover", "Mental health", "No room rent cap", "Low copay",
  "Wide network hospitals", "OPD cover", "Wellness benefits", "Fast claims",
  "Telemedicine", "Critical illness rider", "High sum insured", "Low premium"
];

function RecommendTab({ form, setForm, recommending, recommendation, onRecommend, onTogglePolicyType, onTogglePriority }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-base">AI Policy Recommendation Engine</CardTitle>
          </div>
          <p className="text-xs text-gray-500 mt-1">Tell us about your organization and we'll recommend the best insurance policies</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Company Size *</Label>
              <Select value={form.company_size} onValueChange={v => setForm(f => ({ ...f, company_size: v }))}>
                <SelectTrigger data-testid="recommend-company-size"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-50">1-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="501-2000">501-2000 employees</SelectItem>
                  <SelectItem value="2000+">2000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Industry *</Label>
              <Select value={form.industry} onValueChange={v => setForm(f => ({ ...f, industry: v }))}>
                <SelectTrigger data-testid="recommend-industry"><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Annual Budget per Employee</Label>
              <Select value={form.annual_budget_per_employee || "flexible"} onValueChange={v => setForm(f => ({ ...f, annual_budget_per_employee: v === "flexible" ? "" : v }))}>
                <SelectTrigger data-testid="recommend-budget"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flexible">Flexible / Not decided</SelectItem>
                  <SelectItem value="3000-5000">₹3,000 - ₹5,000</SelectItem>
                  <SelectItem value="5000-10000">₹5,000 - ₹10,000</SelectItem>
                  <SelectItem value="10000-20000">₹10,000 - ₹20,000</SelectItem>
                  <SelectItem value="20000-50000">₹20,000 - ₹50,000</SelectItem>
                  <SelectItem value="50000+">₹50,000+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Average Employee Age</Label>
              <Select value={form.employee_avg_age || "notspecified"} onValueChange={v => setForm(f => ({ ...f, employee_avg_age: v === "notspecified" ? "" : v }))}>
                <SelectTrigger data-testid="recommend-age"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="notspecified">Not specified</SelectItem>
                  <SelectItem value="25-30">25-30 years</SelectItem>
                  <SelectItem value="30-35">30-35 years</SelectItem>
                  <SelectItem value="35-40">35-40 years</SelectItem>
                  <SelectItem value="40-45">40-45 years</SelectItem>
                  <SelectItem value="45+">45+ years</SelectItem>
                </SelectContent>
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
            <Label className="text-sm font-medium mb-2 block">Key Priorities (select all that apply)</Label>
            <div className="flex gap-2 flex-wrap" data-testid="recommend-priorities">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => onTogglePriority(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${(form.priorities || []).includes(p) ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  data-testid={`priority-${p.replace(/\s/g, '-').toLowerCase()}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Current Insurer (if any)</Label>
              <Input value={form.current_insurer} onChange={e => setForm(f => ({ ...f, current_insurer: e.target.value }))} placeholder="e.g. ICICI Lombard" data-testid="recommend-current-insurer" />
            </div>
            <div>
              <Label className="text-sm font-medium">Pain Points / Special Requirements</Label>
              <Input value={form.pain_points} onChange={e => setForm(f => ({ ...f, pain_points: e.target.value }))} placeholder="e.g. Slow claims, limited network" data-testid="recommend-pain-points" />
            </div>
          </div>

          <Button onClick={onRecommend} disabled={recommending} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white" size="lg" data-testid="get-recommendation-btn">
            {recommending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />}
            {recommending ? "Generating Recommendation..." : "Get AI Recommendation"}
          </Button>
        </CardContent>
      </Card>

      {recommendation && (
        <MarkdownResult icon={Lightbulb} title="AI Policy Recommendation"
          badges={<Badge className="bg-amber-100 text-amber-700 text-xs">{recommendation.benchmarks_considered} policies analyzed</Badge>}
          content={recommendation.recommendation} testId="recommendation-result" />
      )}
    </div>
  );
}

function PolicyTypeChip({ label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${active ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
      data-testid={`policy-type-chip-${label.replace(/\s/g, '-').toLowerCase()}`}
    >
      <Icon className="w-4 h-4" /> {label}
      {active && <CheckCircle2 className="w-3.5 h-3.5" />}
    </button>
  );
}
