import React from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

class ApproveEndorsements extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      endorsements: [],
      loading: true,
      selectedEndorsement: null,
      approvalDialog: false,
      approvalAction: null,
      remarks: "",
      processing: false
    };
  }

  componentDidMount() {
    this.fetchPendingEndorsements();
  }

  fetchPendingEndorsements = async () => {
    try {
      this.setState({ loading: true });
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/endorsements?status=Pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      this.setState({ endorsements: response.data });
    } catch (error) {
      console.error("Error fetching endorsements:", error);
      toast.error("Failed to fetch pending endorsements");
    } finally {
      this.setState({ loading: false });
    }
  };

  openApprovalDialog = (endorsement, action) => {
    this.setState({
      selectedEndorsement: endorsement,
      approvalDialog: true,
      approvalAction: action,
      remarks: ""
    });
  };

  closeApprovalDialog = () => {
    this.setState({
      selectedEndorsement: null,
      approvalDialog: false,
      approvalAction: null,
      remarks: ""
    });
  };

  handleApproval = async () => {
    const { selectedEndorsement, approvalAction, remarks } = this.state;
    
    try {
      this.setState({ processing: true });
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/endorsements/${selectedEndorsement.id}/approve`,
        { status: approvalAction, remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Endorsement ${approvalAction.toLowerCase()} successfully`);
      this.closeApprovalDialog();
      this.fetchPendingEndorsements();
    } catch (error) {
      console.error("Error processing approval:", error);
      toast.error(error.response?.data?.detail || "Failed to process endorsement");
    } finally {
      this.setState({ processing: false });
    }
  };

  getRelationshipColor = (type) => {
    const colors = {
      Employee: "bg-blue-100 text-blue-800",
      Spouse: "bg-pink-100 text-pink-800",
      Kids: "bg-green-100 text-green-800",
      Mother: "bg-purple-100 text-purple-800",
      Father: "bg-orange-100 text-orange-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  render() {
    const { endorsements, loading, approvalDialog, selectedEndorsement, approvalAction, remarks, processing } = this.state;

    return (
      <div className="space-y-6" data-testid="approve-endorsements-page">
        <Card>
          <CardHeader>
            <CardTitle>Pending Endorsements for Approval</CardTitle>
            <CardDescription>Review and approve/reject endorsement requests from HR</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : endorsements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pending endorsements to review
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Pro-rata Premium</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endorsements.map((endorsement) => (
                      <TableRow key={endorsement.id}>
                        <TableCell className="font-medium">{endorsement.policy_number}</TableCell>
                        <TableCell>{endorsement.member_name}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${this.getRelationshipColor(endorsement.relationship_type)}`}>
                            {endorsement.relationship_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={endorsement.endorsement_type === "Addition" ? "default" : "secondary"}>
                            {endorsement.endorsement_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(endorsement.endorsement_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-semibold">₹{endorsement.prorata_premium.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-gray-500">{endorsement.remarks || "-"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            onClick={() => this.openApprovalDialog(endorsement, "Approved")}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => this.openApprovalDialog(endorsement, "Rejected")}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={approvalDialog} onOpenChange={this.closeApprovalDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {approvalAction === "Approved" ? "Approve" : "Reject"} Endorsement
              </DialogTitle>
              <DialogDescription>
                {selectedEndorsement && (
                  <div className="mt-4 space-y-2">
                    <p><strong>Member:</strong> {selectedEndorsement.member_name}</p>
                    <p><strong>Policy:</strong> {selectedEndorsement.policy_number}</p>
                    <p><strong>Type:</strong> {selectedEndorsement.endorsement_type}</p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Remarks (Optional)</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => this.setState({ remarks: e.target.value })}
                  placeholder="Add any comments or reasons"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={this.closeApprovalDialog} disabled={processing}>
                Cancel
              </Button>
              <Button
                onClick={this.handleApproval}
                disabled={processing}
                className={approvalAction === "Approved" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {approvalAction === "Approved" ? "Approve" : "Reject"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
}

export default ApproveEndorsements;
