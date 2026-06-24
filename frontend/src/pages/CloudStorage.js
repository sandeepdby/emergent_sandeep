import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API, getAuthHeaders } from "../auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, CreditCard, Heart, FolderOpen, Trash2,
  Download, File, Loader2, CloudUpload, AlertCircle, Mail, Eye, Phone, Search, CheckSquare, Square, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "Policy Terms", label: "Policy Terms", icon: FileText, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "Endorsement Files", label: "Endorsement Files", icon: File, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { key: "Premium Receipts", label: "Premium Receipts", icon: CreditCard, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "E-Cards", label: "E-Cards", icon: Heart, color: "text-rose-600 bg-rose-50 border-rose-200" },
  { key: "Others", label: "Others", icon: FolderOpen, color: "text-amber-600 bg-amber-50 border-amber-200" },
];

const formatFileSize = (bytes) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

const getFileIcon = (filename) => {
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext)) return "text-red-500";
  if (["xls", "xlsx", "csv"].includes(ext)) return "text-green-600";
  if (["doc", "docx"].includes(ext)) return "text-blue-600";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "text-purple-500";
  return "text-gray-500";
};

export default function CloudStorage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("Policy Terms");
  const [error, setError] = useState(null);
  const [hrUsers, setHrUsers] = useState([]);
  const [selectedHr, setSelectedHr] = useState("");
  const [sendingEcard, setSendingEcard] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = userData.role === "Admin";

  const fetchDocuments = useCallback(async () => {
    try {
      setError(null);
      const res = await axios.get(`${API}/documents`, { headers: getAuthHeaders() });
      setDocuments(res.data);
    } catch (err) {
      setError("Failed to load documents");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHrUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API}/users/hr`, { headers: getAuthHeaders() });
      setHrUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch HR users:", err);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchDocuments();
    fetchHrUsers();
  }, [fetchDocuments, fetchHrUsers]);

  const handleUpload = async (fileList, category) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);

    // Use bulk upload for multiple files or ZIP
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    let uploadUrl = `${API}/documents/bulk-upload?category=${encodeURIComponent(category)}`;
    if (isAdmin && selectedHr && selectedHr !== "none") {
      uploadUrl += `&assigned_to_hr=${encodeURIComponent(selectedHr)}`;
    }

    try {
      const res = await axios.post(uploadUrl, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      if (data.uploaded > 0) toast.success(`${data.uploaded} file${data.uploaded > 1 ? 's' : ''} uploaded successfully`);
      if (data.errors > 0) toast.error(`${data.errors} file${data.errors > 1 ? 's' : ''} failed`);
      fetchDocuments();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      toast.error(`Upload failed: ${detail}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await axios.get(`${API}/documents/${doc.id}/download`, {
        headers: getAuthHeaders(),
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.original_filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success(`Downloaded "${doc.original_filename}"`);
    } catch (err) {
      toast.error("Download failed");
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.original_filename}"? This action cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/documents/${doc.id}`, { headers: getAuthHeaders() });
      toast.success(`"${doc.original_filename}" deleted`);
      setSelectedDocs(prev => prev.filter(id => id !== doc.id));
      fetchDocuments();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      toast.error(`Delete failed: ${detail}`);
    }
  };

  const toggleDocSelect = (docId) => {
    setSelectedDocs(prev => prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]);
  };

  const toggleSelectAll = (catDocs) => {
    const catIds = catDocs.map(d => d.id);
    const allSelected = catIds.length > 0 && catIds.every(id => selectedDocs.includes(id));
    if (allSelected) {
      setSelectedDocs(prev => prev.filter(id => !catIds.includes(id)));
    } else {
      setSelectedDocs(prev => [...new Set([...prev, ...catIds])]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocs.length === 0) return;
    if (!window.confirm(`Delete ${selectedDocs.length} selected file(s)?`)) return;
    setBulkDeleting(true);
    try {
      const res = await axios.post(`${API}/documents/bulk-delete`, { doc_ids: selectedDocs }, { headers: getAuthHeaders() });
      toast.success(`${res.data.deleted} file(s) deleted`);
      setSelectedDocs([]);
      fetchDocuments();
    } catch (err) { toast.error("Bulk delete failed"); }
    finally { setBulkDeleting(false); }
  };

  const handleSendEcardEmail = async (doc) => {
    setSendingEcard(doc.id);
    try {
      await axios.post(`${API}/documents/${doc.id}/send-ecard`, null, { headers: getAuthHeaders() });
      toast.success(`E-Card emailed to ${doc.assigned_to_hr_name || "HR user"}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send E-Card email");
    } finally {
      setSendingEcard(null);
    }
  };

  const handleWhatsApp = (doc) => {
    const phone = doc.assigned_to_hr_phone;
    if (!phone) {
      toast.error("No phone number found for this HR user");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const message = `Hi ${doc.assigned_to_hr_name || ""},\nYour E-Card "${doc.original_filename}" has been shared with you from InsureHub. Please check your email or log in to download it.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleViewEcard = async (doc) => {
    try {
      const res = await axios.get(`${API}/documents/${doc.id}/download`, {
        headers: getAuthHeaders(),
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, "_blank");
    } catch (err) {
      toast.error("Failed to load E-Card for preview");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isEcardTab = activeTab === "E-Cards";

  return (
    <div className="space-y-6" data-testid="cloud-storage-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cloud Storage</h2>
          <p className="text-sm text-gray-500 mt-1">Upload and manage your insurance documents</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <FolderOpen className="w-4 h-4" />
          <span>{documents.length} total files</span>
        </div>
      </div>

      {isAdmin && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Assign uploads to HR:</label>
              <Select value={selectedHr} onValueChange={setSelectedHr}>
                <SelectTrigger className="max-w-xs" data-testid="cloud-hr-select">
                  <SelectValue placeholder="All users (no assignment)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No HR assignment</SelectItem>
                  {hrUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedHr && selectedHr !== "none" && (
                <Badge variant="secondary" className="text-xs">
                  Uploads will be visible to selected HR
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200" data-testid="storage-error">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search files by name, uploader, or assigned HR..."
          className="pl-10 pr-10"
          data-testid="cloud-search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bulk Delete Bar */}
      {selectedDocs.length > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2.5" data-testid="bulk-delete-bar">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <CheckSquare className="w-4 h-4" />
            <span className="font-medium">{selectedDocs.length} file{selectedDocs.length > 1 ? "s" : ""} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedDocs([])} className="text-stone-500 text-xs" data-testid="clear-selection-btn">Clear</Button>
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting} data-testid="bulk-delete-btn">
              {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-gray-100 p-1 rounded-xl">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = documents.filter((d) => d.category === cat.key).length;
            return (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="flex-1 min-w-[120px] gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm py-2"
                data-testid={`tab-${cat.key}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{cat.label}</span>
                {count > 0 && (
                  <span className="ml-1 text-xs bg-gray-200 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          const allCatDocs = documents.filter((d) => d.category === cat.key);
          const catDocs = allCatDocs.filter(d => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (d.original_filename || "").toLowerCase().includes(q)
              || (d.uploaded_by_name || "").toLowerCase().includes(q)
              || (d.assigned_to_hr_name || "").toLowerCase().includes(q);
          });
          const isEcard = cat.key === "E-Cards";
          const catIds = catDocs.map(d => d.id);
          const allSelected = catIds.length > 0 && catIds.every(id => selectedDocs.includes(id));

          return (
            <TabsContent key={cat.key} value={cat.key}>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-gray-800">{cat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CatIcon className={`w-5 h-5 ${cat.color.split(" ")[0]}`} />
                        <span className="text-sm text-gray-500">{catDocs.length} file{catDocs.length !== 1 ? "s" : ""}</span>
                      </div>
                      <UploadButton catKey={cat.key} uploading={uploading} onUpload={handleUpload} />
                    </div>

                    {catDocs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        <CloudUpload className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-sm font-medium">No files uploaded yet</p>
                        <p className="text-xs mt-1">Click "Upload File" to add documents</p>
                      </div>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <table className="w-full text-sm" data-testid={`documents-table-${cat.key}`}>
                          <thead>
                            <tr className="bg-gray-50 border-b text-left">
                              <th className="px-2 py-3 w-10">
                                <button onClick={() => toggleSelectAll(catDocs)} className="p-0.5" data-testid={`select-all-${cat.key}`}>
                                  {allSelected ? <CheckSquare className="w-4 h-4 text-[#E05A47]" /> : <Square className="w-4 h-4 text-stone-300" />}
                                </button>
                              </th>
                              <th className="px-4 py-3 font-medium text-gray-600">File Name</th>
                              <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Size</th>
                              <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Uploaded By</th>
                              {isEcard && <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Assigned HR</th>}
                              <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Date</th>
                              <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catDocs.map((doc) => (
                              <tr key={doc.id} className={`border-b last:border-b-0 hover:bg-gray-50 transition-colors ${selectedDocs.includes(doc.id) ? 'bg-red-50/40' : ''}`} data-testid={`doc-row-${doc.id}`}>
                                <td className="px-2 py-3">
                                  <button onClick={() => toggleDocSelect(doc.id)} className="p-0.5" data-testid={`select-doc-${doc.id}`}>
                                    {selectedDocs.includes(doc.id) ? <CheckSquare className="w-4 h-4 text-[#E05A47]" /> : <Square className="w-4 h-4 text-stone-300" />}
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <FileText className={`w-4 h-4 flex-shrink-0 ${getFileIcon(doc.original_filename)}`} />
                                    <span className="truncate max-w-[200px] font-medium text-gray-800">{doc.original_filename}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{formatFileSize(doc.size)}</td>
                                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{doc.uploaded_by_name || "--"}</td>
                                {isEcard && (
                                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                                    {doc.assigned_to_hr_name ? (
                                      <Badge variant="outline" className="text-xs">{doc.assigned_to_hr_name}</Badge>
                                    ) : "--"}
                                  </td>
                                )}
                                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDate(doc.created_at)}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {isEcard && (
                                      <>
                                        <Button variant="ghost" size="sm" onClick={() => handleViewEcard(doc)}
                                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                          data-testid={`view-ecard-${doc.id}`} title="View E-Card">
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                        {doc.assigned_to_hr_phone && (
                                          <Button variant="ghost" size="sm" onClick={() => handleWhatsApp(doc)}
                                            className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                            data-testid={`whatsapp-ecard-${doc.id}`} title="Send via WhatsApp">
                                            <Phone className="w-4 h-4" />
                                          </Button>
                                        )}
                                        {doc.assigned_to_hr_email && (
                                          <Button variant="ghost" size="sm" onClick={() => handleSendEcardEmail(doc)}
                                            disabled={sendingEcard === doc.id}
                                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                            data-testid={`email-ecard-${doc.id}`} title="Send via Email">
                                            {sendingEcard === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                          </Button>
                                        )}
                                      </>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}
                                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                      data-testid={`download-btn-${doc.id}`}>
                                      <Download className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      data-testid={`delete-btn-${doc.id}`}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function UploadButton({ catKey, uploading, onUpload }) {
  const inputRef = React.useRef(null);
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files, catKey);
      e.target.value = "";
    }
  };
  return (
    <div>
      <input type="file" ref={inputRef} className="hidden" onChange={handleFileChange} multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.txt,.doc,.docx,.zip"
        data-testid={`file-input-${catKey}`} />
      <Button onClick={() => inputRef.current?.click()} disabled={uploading} size="sm" className="gap-2"
        data-testid={`upload-btn-${catKey}`}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? "Uploading..." : "Upload Files / ZIP"}
      </Button>
    </div>
  );
}
