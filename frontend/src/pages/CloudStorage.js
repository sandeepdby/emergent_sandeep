import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API, getAuthHeaders } from "../auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Upload,
  FileText,
  CreditCard,
  Heart,
  FolderOpen,
  Trash2,
  Download,
  File,
  Loader2,
  CloudUpload,
  AlertCircle,
} from "lucide-react";
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

function CategoryTab({ category, documents, onUpload, onDownload, onDelete, uploading }) {
  const CatIcon = category.icon;
  const catDocs = documents.filter((d) => d.category === category.key);
  const inputRef = React.useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file, category.key);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CatIcon className={`w-5 h-5 ${category.color.split(" ")[0]}`} />
          <span className="text-sm text-gray-500">{catDocs.length} file{catDocs.length !== 1 ? "s" : ""}</span>
        </div>
        <div>
          <input
            type="file"
            ref={inputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.txt,.doc,.docx"
            data-testid={`file-input-${category.key}`}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            size="sm"
            className="gap-2"
            data-testid={`upload-btn-${category.key}`}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload File"}
          </Button>
        </div>
      </div>

      {catDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <CloudUpload className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-sm font-medium">No files uploaded yet</p>
          <p className="text-xs mt-1">Click "Upload File" to add documents</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm" data-testid={`documents-table-${category.key}`}>
            <thead>
              <tr className="bg-gray-50 border-b text-left">
                <th className="px-4 py-3 font-medium text-gray-600">File Name</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Size</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Uploaded By</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catDocs.map((doc) => (
                <tr key={doc.id} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors" data-testid={`doc-row-${doc.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className={`w-4 h-4 flex-shrink-0 ${getFileIcon(doc.original_filename)}`} />
                      <span className="truncate max-w-[200px] font-medium text-gray-800">{doc.original_filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{formatFileSize(doc.size)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{doc.uploaded_by_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownload(doc)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        data-testid={`download-btn-${doc.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(doc)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-btn-${doc.id}`}
                      >
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
  );
}

export default function CloudStorage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("Policy Terms");
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setError(null);
      const res = await axios.get(`${API}/documents`, {
        headers: getAuthHeaders(),
      });
      setDocuments(res.data);
    } catch (err) {
      setError("Failed to load documents");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (file, category) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API}/documents/upload?category=${encodeURIComponent(category)}`, formData, {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success(`"${file.name}" uploaded successfully`);
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
      await axios.delete(`${API}/documents/${doc.id}`, {
        headers: getAuthHeaders(),
      });
      toast.success(`"${doc.original_filename}" deleted`);
      fetchDocuments();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      toast.error(`Delete failed: ${detail}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

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

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200" data-testid="storage-error">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
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

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.key} value={cat.key}>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-gray-800">{cat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryTab
                  category={cat}
                  documents={documents}
                  onUpload={handleUpload}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  uploading={uploading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
