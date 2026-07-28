import React from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, FileText, Eye, ArrowLeft, AlertTriangle } from "lucide-react";

class ImportEndorsements extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      file: null,
      uploading: false,
      previewing: false,
      importResult: null,
      previewData: null,
      dragActive: false,
      policies: [],
      step: "upload" // "upload" | "preview" | "result"
    };
    this.fileInputRef = React.createRef();
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
    }
  };

  handleFileSelect = (selectedFile) => {
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
        toast.error("Please select a valid Excel file (.xlsx or .xls)");
        return;
      }
      this.setState({ file: selectedFile, importResult: null, previewData: null, step: "upload" });
    }
  };

  handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      this.setState({ dragActive: true });
    } else if (e.type === "dragleave") {
      this.setState({ dragActive: false });
    }
  };

  handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragActive: false });
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      this.handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      this.handleFileSelect(e.target.files[0]);
    }
  };

  handlePreview = async () => {
    const { file, policies } = this.state;
    if (!file) { toast.error("Please select a file first"); return; }
    if (policies.length === 0) { toast.error("No policies found. Admin must create policies first."); return; }

    try {
      this.setState({ previewing: true });
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/endorsements/preview`, formData, {
        headers: { "Content-Type": "multipart/form-data", "Authorization": `Bearer ${token}` }
      });
      this.setState({ previewData: response.data, step: "preview" });
      if (response.data.error_count > 0) {
        toast.warning(`${response.data.error_count} row(s) have errors`);
      } else {
        toast.success(`${response.data.valid_rows} rows parsed successfully — review below`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to preview file");
    } finally {
      this.setState({ previewing: false });
    }
  };

  handleConfirmImport = async () => {
    const { file } = this.state;
    try {
      this.setState({ uploading: true });
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/endorsements/import`, formData, {
        headers: { "Content-Type": "multipart/form-data", "Authorization": `Bearer ${token}` }
      });
      this.setState({ importResult: response.data, step: "result" });
      if (response.data.error_count === 0) {
        toast.success(`Successfully imported ${response.data.success_count} endorsements!`);
      } else {
        toast.warning(`Import completed with ${response.data.error_count} errors`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import endorsements");
    } finally {
      this.setState({ uploading: false });
    }
  };

  handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/endorsements/template/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "endorsement_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  handleDownloadFamilyTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/endorsements/template/family`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "family_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Family template downloaded");
    } catch (error) {
      toast.error("Failed to download family template");
    }
  };

  renderPreview() {
    const { previewData } = this.state;
    if (!previewData) return null;
    const { rows, errors } = previewData;
    const restrictedRows = rows.filter(r => r.parent_restricted);
    const validRows = rows.filter(r => !r.parent_restricted);

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Review Import Data</CardTitle>
            <CardDescription>
              {validRows.length} valid rows, {restrictedRows.length > 0 ? `${restrictedRows.length} restricted (parent rule), ` : ''}{errors.length} errors — Review before final submission
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => this.setState({ step: "upload", previewData: null })} data-testid="back-to-upload-btn">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={this.handleConfirmImport} disabled={this.state.uploading || validRows.length === 0} data-testid="confirm-import-btn" className="bg-green-600 hover:bg-green-700">
              {this.state.uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              {this.state.uploading ? "Importing..." : `Confirm Import (${validRows.length} rows)`}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {restrictedRows.length > 0 && (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg p-3" data-testid="parent-restriction-banner">
              <h4 className="font-semibold text-amber-700 mb-1 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Parent Restriction ({restrictedRows.length} rows)</h4>
              <p className="text-sm text-amber-600">Parents (Father/Mother) are not allowed for Midterm addition. These rows will be skipped during import.</p>
            </div>
          )}
          {errors.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="font-semibold text-red-700 mb-1">Errors ({errors.length})</h4>
              {errors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-sm text-red-600">Row {err.row}: {err.error}</p>
              ))}
              {errors.length > 5 && <p className="text-xs text-red-500 mt-1">... and {errors.length - 5} more</p>}
            </div>
          )}
          <div className="overflow-x-auto">
            <Table data-testid="preview-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Row</TableHead>
                  <TableHead className="text-xs">Policy</TableHead>
                  <TableHead className="text-xs">Member</TableHead>
                  <TableHead className="text-xs">Relationship</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs text-right">Per Life Premium</TableHead>
                  <TableHead className="text-xs text-right">Pro-rata Premium</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Mobile</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i} className={row.parent_restricted ? "bg-amber-50/70" : ""} data-testid={row.parent_restricted ? `restricted-row-${row.row_num}` : undefined}>
                    <TableCell className="text-xs">{row.row_num}</TableCell>
                    <TableCell className="text-xs font-medium">{row.policy_number}</TableCell>
                    <TableCell className="text-xs">{row.member_name}</TableCell>
                    <TableCell className="text-xs">
                      {row.relationship_type}
                      {row.parent_restricted && <span className="ml-1 text-amber-600 text-[10px] font-semibold">(Blocked)</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={row.endorsement_type === "Addition" ? "default" : row.endorsement_type === "Deletion" ? "destructive" : "secondary"} className={`text-xs ${row.parent_restricted ? 'opacity-50' : ''}`}>
                        {row.endorsement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right">₹{(row.per_life_premium || row.annual_premium_per_life)?.toLocaleString() || 0}</TableCell>
                    <TableCell className={`text-xs text-right font-medium ${row.parent_restricted ? 'text-gray-400' : row.prorata_premium >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.parent_restricted ? '—' : `${row.prorata_premium >= 0 ? '+' : ''}₹${row.prorata_premium?.toLocaleString() || 0}`}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 truncate max-w-[120px]">{row.employee_email || '—'}</TableCell>
                    <TableCell className="text-xs text-gray-500">{row.employee_mobile || '—'}</TableCell>
                    <TableCell className="text-xs">
                      {row.parent_restricted ? (
                        <span className="text-amber-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Restricted</span>
                      ) : row.policy_exists ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  renderErrors() {
    const { importResult } = this.state;
    const errors = importResult?.errors || [];
    if (errors.length === 0) return null;
    return (
      <div className="mt-4">
        <h4 className="font-semibold mb-2 text-red-600">Errors:</h4>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {errors.map((errorItem, idx) => (
            <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-md">
              <span className="font-semibold">Row {errorItem.row}:</span> {errorItem.error}
            </div>
          ))}
        </div>
      </div>
    );
  }

  render() {
    const { file, uploading, previewing, importResult, dragActive, policies, step } = this.state;

    if (step === "preview") return this.renderPreview();

    return (
      <div className="space-y-6" data-testid="import-page">
        <Card>
          <CardHeader>
            <CardTitle>Import Endorsements from Excel</CardTitle>
            <CardDescription>Upload an Excel file (.xlsx or .xls) to import endorsements in bulk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <div className="ml-2">
                <h4 className="font-semibold mb-2">Excel File Format (All Fields):</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Policy Number</strong> - Unique policy identifier (Required)</li>
                  <li><strong>Member Name</strong> - Name of the member (Required)</li>
                  <li><strong>Relationship Type</strong> - Employee, Spouse, Kids1, Kids2, Mother, or Father (Required)</li>
                  <li><strong>Endorsement Type</strong> - Addition, Deletion, Correction, or Midterm addition (Required)</li>
                  <li><strong>Endorsement Date</strong> - When endorsement received (Required)</li>
                  <li><strong>Per Life Premium</strong> - Leave blank to auto-fill from Rate Card based on age</li>
                  <li><strong>Employee ID</strong> - Same ID links family members together</li>
                  <li><strong>DOB, Age, Gender, Date of Joining, Date of Leaving</strong> - Optional</li>
                  <li><strong>Coverage Type, Suminsured, Effective Date, Remarks</strong> - Optional</li>
                </ul>
              </div>
            </Alert>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={this.handleDownloadTemplate} variant="outline" data-testid="download-template-btn">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Standard Template
              </Button>
              <Button onClick={this.handleDownloadFamilyTemplate} variant="outline" className="border-pink-200 text-pink-700 hover:bg-pink-50" data-testid="download-family-template-btn">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Family Import Template
              </Button>
              {policies.length === 0 && <Badge variant="destructive">Contact admin to create policies first</Badge>}
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700 space-y-1">
              <p className="font-semibold">Rate Card Auto-Fill</p>
              <p>Leave "Per Life Premium" blank in your Excel — the system will automatically fill rates from the assigned Rate Card based on each member's age. Enter a value to override.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Upload File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`drag-drop-zone p-12 text-center cursor-pointer ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={this.handleDrag} onDragLeave={this.handleDrag} onDragOver={this.handleDrag} onDrop={this.handleDrop}
              onClick={() => this.fileInputRef.current?.click()}>
              <input ref={this.fileInputRef} type="file" accept=".xlsx,.xls" onChange={this.handleFileChange} className="hidden" />
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">{file ? file.name : "Drag and drop your Excel file here"}</p>
              <p className="text-sm text-gray-500">or click to browse (.xlsx, .xls files only)</p>
            </div>

            <Button onClick={this.handlePreview} disabled={!file || previewing || policies.length === 0} className="w-full" data-testid="preview-import-btn">
              {previewing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Parsing...</>) : (<><Eye className="w-4 h-4 mr-2" />Preview & Review Data</>)}
            </Button>
          </CardContent>
        </Card>

        {importResult && (
          <Card>
            <CardHeader><CardTitle>Import Results</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                  <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                  <div><p className="text-sm text-gray-600">Total Rows</p><p className="text-2xl font-bold">{importResult.total_rows}</p></div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div><p className="text-sm text-gray-600">Successful</p><p className="text-2xl font-bold text-green-600">{importResult.success_count}</p></div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div><p className="text-sm text-gray-600">Errors</p><p className="text-2xl font-bold text-red-600">{importResult.error_count}</p></div>
                </div>
              </div>
              {this.renderErrors()}
              {importResult.success_count > 0 && (
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => {
                      const msg = encodeURIComponent(
                        `*InsureHub — Endorsement Import Complete*\n\n` +
                        `${importResult.success_count} endorsements imported successfully` +
                        (importResult.error_count > 0 ? ` (${importResult.error_count} errors)` : '') +
                        `.\nBatch ID: ${importResult.import_batch_id || 'N/A'}\n\n` +
                        `Please review in the Admin portal.`
                      );
                      window.open(`https://wa.me/?text=${msg}`, '_blank');
                    }}
                    data-testid="whatsapp-share-import"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Share via WhatsApp
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
}

export default ImportEndorsements;
