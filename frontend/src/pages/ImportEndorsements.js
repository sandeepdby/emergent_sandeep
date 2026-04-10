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
              <p className="text-sm text-amber-600">Parents (Father/Mother) are not allowed for mid-term Addition or Deletion. These rows will be skipped during import.</p>
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
                  <TableHead className="text-xs text-right">Annual Premium</TableHead>
                  <TableHead className="text-xs text-right">Pro-rata Premium</TableHead>
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
                    <TableCell className="text-xs text-right">₹{row.annual_premium_per_life?.toLocaleString() || 0}</TableCell>
                    <TableCell className={`text-xs text-right font-medium ${row.parent_restricted ? 'text-gray-400' : row.prorata_premium >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.parent_restricted ? '—' : `${row.prorata_premium >= 0 ? '+' : ''}₹${row.prorata_premium?.toLocaleString() || 0}`}
                    </TableCell>
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
                  <li><strong>Relationship Type</strong> - Employee, Spouse, Kids, Mother, or Father (Required)</li>
                  <li><strong>Endorsement Type</strong> - Addition, Deletion, Correction, or Midterm addition (Required)</li>
                  <li><strong>Endorsement Date</strong> - When endorsement received (Required)</li>
                  <li><strong>Annual Premium Per Life</strong> - Yearly premium (auto-filled from policy)</li>
                  <li><strong>DOB, Age, Gender, Date of Joining, Date of Leaving</strong> - Optional</li>
                  <li><strong>Coverage Type, Suminsured, Effective Date, Remarks</strong> - Optional</li>
                </ul>
              </div>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={this.handleDownloadTemplate} variant="outline">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Download Template
              </Button>
              {policies.length === 0 && <Badge variant="destructive">Contact admin to create policies first</Badge>}
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
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
}

export default ImportEndorsements;
