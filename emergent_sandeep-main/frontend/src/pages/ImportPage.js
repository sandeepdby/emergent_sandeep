import React from "react";
import axios from "axios";
import { API } from "../App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle, Loader2, FileText } from "lucide-react";

class ImportPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      file: null,
      uploading: false,
      importResult: null,
      dragActive: false,
      policies: [],
    };
    this.fileInputRef = React.createRef();
  }

  componentDidMount() {
    this.fetchPolicies();
  }

  fetchPolicies = async () => {
    try {
      const response = await axios.get(`${API}/policies`);
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
      this.setState({ file: selectedFile, importResult: null });
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

  handleUpload = async () => {
    const { file, policies } = this.state;
    
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    if (policies.length === 0) {
      toast.error("No policies found. Please create at least one policy before importing endorsements.");
      return;
    }

    try {
      this.setState({ uploading: true });
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(`${API}/endorsements/import`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      this.setState({ importResult: response.data });
      
      if (response.data.error_count === 0) {
        toast.success(`Successfully imported ${response.data.success_count} endorsements!`);
      } else {
        toast.warning(`Import completed with ${response.data.error_count} errors`);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(error.response?.data?.detail || "Failed to import endorsements");
    } finally {
      this.setState({ uploading: false });
    }
  };

  handleDownloadResults = async () => {
    const { importResult } = this.state;
    
    if (!importResult || !importResult.import_batch_id) {
      toast.error("No import results available");
      return;
    }

    try {
      const response = await axios.get(
        `${API}/endorsements/import/${importResult.import_batch_id}/results`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `import_results_${importResult.import_batch_id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Import results downloaded successfully");
    } catch (error) {
      console.error("Error downloading results:", error);
      toast.error("Failed to download import results");
    }
  };

  handleDownloadTemplate = () => {
    const csvContent = "Policy Number,Member Name,Relationship Type,Endorsement Type,Endorsement Date,Effective Date\n" +
      "POL001,John Doe,Employee,Addition,2025-01-15,2025-01-15\n" +
      "POL001,Jane Doe,Spouse,Addition,2025-01-15,2025-01-15\n" +
      "POL001,Jack Doe,Kids,Addition,2025-01-20,2025-01-20";

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "endorsement_import_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    toast.success("Template downloaded successfully");
  };

  renderErrors() {
    const { importResult } = this.state;
    const errors = importResult?.errors || [];
    
    if (errors.length === 0) return null;

    return (
      <div className="mt-4">
        <h4 className="font-semibold mb-2 text-red-600">Errors:</h4>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {errors.map((errorItem, idx) => (
            <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-md" data-testid={`error-item-${idx}`}>
              <span className="font-semibold">Row {errorItem.row}:</span> {errorItem.error}
            </div>
          ))}
        </div>
      </div>
    );
  }

  render() {
    const { file, uploading, importResult, dragActive, policies } = this.state;

    return (
      <div className="space-y-6" data-testid="import-page">
        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Import Endorsements from Excel</CardTitle>
            <CardDescription>
              Upload an Excel file (.xlsx or .xls) to import endorsements in bulk
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <div className="ml-2">
                <h4 className="font-semibold mb-2">Excel File Format:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Policy Number</strong> - Must exist in the system</li>
                  <li><strong>Member Name</strong> - Name of the member</li>
                  <li><strong>Relationship Type</strong> - Employee, Spouse, Kids, Mother, or Father</li>
                  <li><strong>Endorsement Type</strong> - Addition, Deletion, or Modification</li>
                  <li><strong>Endorsement Date</strong> - Date when endorsement received (YYYY-MM-DD or DD/MM/YYYY)</li>
                  <li><strong>Effective Date</strong> - (Optional) Defaults to Endorsement Date</li>
                </ul>
              </div>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={this.handleDownloadTemplate} variant="outline" data-testid="download-template-button">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              {policies.length === 0 && (
                <Badge variant="destructive">Create a policy first</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`drag-drop-zone p-12 text-center cursor-pointer ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={this.handleDrag}
              onDragLeave={this.handleDrag}
              onDragOver={this.handleDrag}
              onDrop={this.handleDrop}
              onClick={() => this.fileInputRef.current?.click()}
              data-testid="file-drop-zone"
            >
              <input
                ref={this.fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={this.handleFileChange}
                className="hidden"
                data-testid="file-input"
              />
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">
                {file ? file.name : "Drag and drop your Excel file here"}
              </p>
              <p className="text-sm text-gray-500">
                or click to browse (.xlsx, .xls files only)
              </p>
            </div>

            <Button
              onClick={this.handleUpload}
              disabled={!file || uploading || policies.length === 0}
              className="w-full"
              data-testid="upload-button"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Endorsements
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Import Results */}
        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                  <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Rows</p>
                    <p className="text-2xl font-bold" data-testid="result-total-rows">{importResult.total_rows}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Successful</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="result-success-count">{importResult.success_count}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600">Errors</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="result-error-count">{importResult.error_count}</p>
                  </div>
                </div>
              </div>

              {this.renderErrors()}

              {importResult.success_count > 0 && (
                <Button
                  onClick={this.handleDownloadResults}
                  variant="outline"
                  className="w-full"
                  data-testid="download-results-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Import Results
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
}

export default ImportPage;
