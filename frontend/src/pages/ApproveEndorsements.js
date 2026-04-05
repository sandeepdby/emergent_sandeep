import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, CheckSquare, MessageCircle, Mail, Phone } from "lucide-react";

// WhatsApp Web link generator
const generateWhatsAppLink = (phone, message) => {
  if (!phone) return null;
  // Clean phone number - remove spaces, dashes, etc.
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

export default function ApproveEndorsements() {
  const [endorsements, setEndorsements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEndorsement, setSelectedEndorsement] = useState(null);
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [processing, setProcessing] = useState(false);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState("Approved");
  const [bulkRemarks, setBulkRemarks] = useState("");
  
  // Notification dialog state
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [notificationData, setNotificationData] = useState(null);

  const fetchPendingEndorsements = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/endorsements?status=Pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEndorsements(response.data);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching endorsements:", error);
      toast.error("Failed to fetch pending endorsements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingEndorsements();
  }, [fetchPendingEndorsements]);

  const openApprovalDialog = (endorsement, action) => {
    setSelectedEndorsement(endorsement);
    setApprovalAction(action);
    setRemarks("");
    setApprovalDialog(true);
  };

  const handleApproval = async () => {
    try {
      setProcessing(true);
      const token = localStorage.getItem('token');
      
      // Get submitter info for notifications
      let submitterInfo = null;
      if (selectedEndorsement.submitted_by) {
        try {
          const userResponse = await axios.get(
            `${API}/users/${selectedEndorsement.submitted_by}/contact`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          submitterInfo = userResponse.data;
        } catch (e) {
          console.log("Could not fetch submitter info");
        }
      }
      
      await axios.post(
        `${API}/endorsements/${selectedEndorsement.id}/approve`,
        { status: approvalAction, remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Endorsement ${approvalAction.toLowerCase()} successfully`);
      setApprovalDialog(false);
      
      // Show notification dialog with WhatsApp option
      if (submitterInfo) {
        const message = `*InsureHub Notification*\n\nYour endorsement has been *${approvalAction}*.\n\n*Member:* ${selectedEndorsement.member_name}\n*Policy:* ${selectedEndorsement.policy_number}\n*Type:* ${selectedEndorsement.endorsement_type}\n*Premium:* ₹${Math.abs(selectedEndorsement.prorata_premium).toLocaleString()}${selectedEndorsement.prorata_premium < 0 ? ' (Refund)' : ''}\n${remarks ? `*Remarks:* ${remarks}` : ''}\n\nPlease log in to InsureHub portal for details.`;
        
        setNotificationData({
          user: submitterInfo,
          action: approvalAction,
          endorsement: selectedEndorsement,
          message: message,
          whatsappLink: generateWhatsAppLink(submitterInfo.phone, message)
        });
        setNotificationDialog(true);
      }
      
      fetchPendingEndorsements();
    } catch (error) {
      console.error("Error processing endorsement:", error);
      toast.error(error.response?.data?.detail || "Failed to process endorsement");
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(endorsements.map(e => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleBulkApproval = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one endorsement");
      return;
    }

    try {
      setProcessing(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/endorsements/bulk-approve`,
        {
          endorsement_ids: selectedIds,
          status: bulkAction,
          remarks: bulkRemarks
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`${response.data.success_count} endorsement(s) ${bulkAction.toLowerCase()} successfully`);
      if (response.data.failed_count > 0) {
        toast.warning(`${response.data.failed_count} endorsement(s) failed to process`);
      }
      
      setBulkDialog(false);
      setBulkRemarks("");
      fetchPendingEndorsements();
    } catch (error) {
      console.error("Error bulk processing:", error);
      toast.error(error.response?.data?.detail || "Failed to process endorsements");
    } finally {
      setProcessing(false);
    }
  };

  const getRelationshipColor = (type) => {
    const colors = {
      'Employee': 'bg-blue-100 text-blue-800',
      'Spouse': 'bg-pink-100 text-pink-800',
      'Kids': 'bg-green-100 text-green-800',
      'Mother': 'bg-purple-100 text-purple-800',
      'Father': 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="approve-endorsements-page">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pending Endorsements</CardTitle>
              <CardDescription>Review and approve/reject endorsement requests</CardDescription>
            </div>
            {selectedIds.length > 0 && (
              <Button onClick={() => setBulkDialog(true)} className="bg-purple-600 hover:bg-purple-700">
                <CheckSquare className="w-4 h-4 mr-2" />
                Bulk Action ({selectedIds.length} selected)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {endorsements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending endorsements to review
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === endorsements.length && endorsements.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="select-all-checkbox"
                      />
                    </TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Pro-rata Premium</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endorsements.map((endorsement) => (
                    <TableRow key={endorsement.id} className={selectedIds.includes(endorsement.id) ? "bg-blue-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(endorsement.id)}
                          onCheckedChange={(checked) => handleSelectOne(endorsement.id, checked)}
                          data-testid={`select-${endorsement.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{endorsement.policy_number}</TableCell>
                      <TableCell>{endorsement.employee_id || "-"}</TableCell>
                      <TableCell>{endorsement.member_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRelationshipColor(endorsement.relationship_type)}`}>
                          {endorsement.relationship_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={endorsement.endorsement_type === "Addition" || endorsement.endorsement_type === "Midterm addition" ? "default" : endorsement.endorsement_type === "Deletion" ? "destructive" : "secondary"}>
                          {endorsement.endorsement_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{endorsement.sum_insured ? `₹${endorsement.sum_insured.toLocaleString()}` : "-"}</TableCell>
                      <TableCell>{new Date(endorsement.endorsement_date).toLocaleDateString()}</TableCell>
                      <TableCell className={`font-semibold ${endorsement.prorata_premium < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {endorsement.prorata_premium < 0 ? `₹${Math.abs(endorsement.prorata_premium).toLocaleString()} (Refund)` : `₹${endorsement.prorata_premium.toLocaleString()}`}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-[150px] truncate">{endorsement.remarks || "-"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          onClick={() => openApprovalDialog(endorsement, "Approved")}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openApprovalDialog(endorsement, "Rejected")}
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

      {/* Single Approval Dialog */}
      <Dialog open={approvalDialog} onOpenChange={setApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "Approved" ? "Approve" : "Reject"} Endorsement
            </DialogTitle>
            <DialogDescription>
              {selectedEndorsement && (
                <>
                  {selectedEndorsement.member_name} - {selectedEndorsement.endorsement_type}
                  <br />
                  Pro-rata Premium: ₹{Math.abs(selectedEndorsement.prorata_premium).toLocaleString()}
                  {selectedEndorsement.prorata_premium < 0 && " (Refund)"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Remarks (optional)</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any notes for this approval/rejection"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApproval}
              disabled={processing}
              className={approvalAction === "Approved" ? "bg-green-600" : "bg-red-600"}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {approvalAction === "Approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approval Dialog */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Action - {selectedIds.length} Endorsement(s)</DialogTitle>
            <DialogDescription>
              Select an action to apply to all selected endorsements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Action</Label>
              <RadioGroup value={bulkAction} onValueChange={setBulkAction}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-green-50 cursor-pointer">
                  <RadioGroupItem value="Approved" id="bulk-approve" />
                  <Label htmlFor="bulk-approve" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium">Approve All</div>
                      <div className="text-sm text-gray-500">Approve all selected endorsements</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-red-50 cursor-pointer">
                  <RadioGroupItem value="Rejected" id="bulk-reject" />
                  <Label htmlFor="bulk-reject" className="flex items-center gap-2 cursor-pointer flex-1">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <div className="font-medium">Reject All</div>
                      <div className="text-sm text-gray-500">Reject all selected endorsements</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Remarks (applied to all)</Label>
              <Textarea
                value={bulkRemarks}
                onChange={(e) => setBulkRemarks(e.target.value)}
                placeholder="Add remarks for bulk action"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkApproval}
              disabled={processing}
              className={bulkAction === "Approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {bulkAction === "Approved" ? "Approve" : "Reject"} {selectedIds.length} Endorsement(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Notification Dialog */}
      <Dialog open={notificationDialog} onOpenChange={setNotificationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Notify HR via WhatsApp
            </DialogTitle>
            <DialogDescription>
              {notificationData && (
                <>
                  Endorsement has been {notificationData.action.toLowerCase()}. 
                  Email notification sent automatically.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {notificationData && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">HR:</span> 
                  <span>{notificationData.user.full_name}</span>
                </div>
                {notificationData.user.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{notificationData.user.email}</span>
                    <Badge variant="outline" className="text-green-600 border-green-600">Email Sent</Badge>
                  </div>
                )}
                {notificationData.user.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{notificationData.user.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {notificationData.whatsappLink ? (
                  <a
                    href={notificationData.whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                    data-testid="whatsapp-notify-btn"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Send WhatsApp Message
                  </a>
                ) : (
                  <div className="text-center text-gray-500 py-3">
                    No phone number registered for this user
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={() => setNotificationDialog(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
