import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Mail, Settings, Send, Loader2, AlertCircle, CheckCircle, MessageSquare, Phone, ShieldCheck, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function EmailSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [formData, setFormData] = useState({
    smtp_server: "smtp.gmail.com",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    default_from_email: ""
  });

  const [emailForm, setEmailForm] = useState({
    to_emails: "",
    cc_emails: "",
    bcc_emails: "",
    subject: "",
    body: "",
    attach_excel: false,
    attach_pdf: false
  });

  const [smsForm, setSmsForm] = useState({ to_number: "", channel: "both", message: "" });
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState(null);

  const webhookUrl = `${process.env.REACT_APP_BACKEND_URL || ""}/api/twilio/inbound`;
  const copyWebhook = () => {
    navigator.clipboard?.writeText(webhookUrl).then(
      () => toast.success("Webhook URL copied"),
      () => toast.error("Copy failed — select and copy manually")
    );
  };

  const handleSendTestSms = async (e) => {
    e.preventDefault();
    try {
      setSmsSending(true);
      setSmsResult(null);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/notifications/test-sms`, smsForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSmsResult(response.data);
      const r = response.data.results || {};
      const failed = Object.values(r).some(v => v.status === 'failed');
      if (failed) {
        toast.warning("Some channels failed — see details below");
      } else {
        toast.success("Test message sent");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send test message");
    } finally {
      setSmsSending(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/email/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(response.data);
    } catch (error) {
      console.error("Error fetching email config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API}/email/config`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Email configuration saved successfully");
      fetchConfig();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    try {
      setSending(true);
      const token = localStorage.getItem('token');
      
      const payload = {
        to_emails: emailForm.to_emails.split(',').map(e => e.trim()).filter(e => e),
        cc_emails: emailForm.cc_emails ? emailForm.cc_emails.split(',').map(e => e.trim()).filter(e => e) : [],
        bcc_emails: emailForm.bcc_emails ? emailForm.bcc_emails.split(',').map(e => e.trim()).filter(e => e) : [],
        subject: emailForm.subject,
        body: emailForm.body,
        attach_excel: emailForm.attach_excel,
        attach_pdf: emailForm.attach_pdf
      };

      await axios.post(`${API}/email/send`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Email queued for delivery");
      setEmailForm({
        to_emails: "",
        cc_emails: "",
        bcc_emails: "",
        subject: "",
        body: "",
        attach_excel: false,
        attach_pdf: false
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-settings-page">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Email Settings</h1>
        <p className="text-gray-500 mt-1">Configure Gmail SMTP and send notifications</p>
      </div>

      {/* Status Alert */}
      {config && (
        <Alert variant={config.configured ? "default" : "destructive"}>
          {config.configured ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {config.configured 
              ? `Email configured. Using: ${config.default_from_email}` 
              : "Email not configured. Please set up SMTP credentials below."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SMTP Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              SMTP Configuration
            </CardTitle>
            <CardDescription>
              Configure Gmail SMTP settings for sending emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Server</Label>
                  <Input
                    value={formData.smtp_server}
                    onChange={(e) => setFormData({...formData, smtp_server: e.target.value})}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input
                    type="number"
                    value={formData.smtp_port}
                    onChange={(e) => setFormData({...formData, smtp_port: parseInt(e.target.value)})}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gmail Username (Email)</Label>
                <Input
                  type="email"
                  value={formData.smtp_username}
                  onChange={(e) => setFormData({...formData, smtp_username: e.target.value})}
                  placeholder="your-email@gmail.com"
                />
              </div>

              <div className="space-y-2">
                <Label>App Password</Label>
                <Input
                  type="password"
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({...formData, smtp_password: e.target.value})}
                  placeholder="Gmail App Password (not your regular password)"
                />
                <p className="text-xs text-gray-500">
                  Use a Gmail App Password. Go to Google Account → Security → 2-Step Verification → App passwords
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default From Email</Label>
                <Input
                  type="email"
                  value={formData.default_from_email}
                  onChange={(e) => setFormData({...formData, default_from_email: e.target.value})}
                  placeholder="notifications@yourcompany.com"
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
                Save Configuration
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Send Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Email
            </CardTitle>
            <CardDescription>
              Send notifications to clients or insurers with attachments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="space-y-2">
                <Label>To (comma separated)</Label>
                <Input
                  value={emailForm.to_emails}
                  onChange={(e) => setEmailForm({...emailForm, to_emails: e.target.value})}
                  placeholder="client@example.com, insurer@example.com"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CC (optional)</Label>
                  <Input
                    value={emailForm.cc_emails}
                    onChange={(e) => setEmailForm({...emailForm, cc_emails: e.target.value})}
                    placeholder="cc@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>BCC (optional)</Label>
                  <Input
                    value={emailForm.bcc_emails}
                    onChange={(e) => setEmailForm({...emailForm, bcc_emails: e.target.value})}
                    placeholder="bcc@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                  placeholder="Approved Endorsements Report"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Message Body (HTML supported)</Label>
                <Textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({...emailForm, body: e.target.value})}
                  placeholder="<p>Please find attached the approved endorsements report.</p>"
                  rows={4}
                  required
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="attach_excel"
                    checked={emailForm.attach_excel}
                    onCheckedChange={(checked) => setEmailForm({...emailForm, attach_excel: checked})}
                  />
                  <Label htmlFor="attach_excel" className="text-sm">Attach Excel Report</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="attach_pdf"
                    checked={emailForm.attach_pdf}
                    onCheckedChange={(checked) => setEmailForm({...emailForm, attach_pdf: checked})}
                  />
                  <Label htmlFor="attach_pdf" className="text-sm">Attach PDF Summary</Label>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={sending || !config?.configured} 
                className="w-full"
              >
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send Email
              </Button>

              {!config?.configured && (
                <p className="text-xs text-red-500 text-center">
                  Please configure SMTP settings first
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* SMS / WhatsApp Notifications (Twilio) */}
      <Card data-testid="twilio-test-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            SMS &amp; WhatsApp Notifications
          </CardTitle>
          <CardDescription>
            Powered by Twilio. Endorsement and registration events automatically send SMS &amp; WhatsApp alerts to admins and users. Use this to send a test message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendTestSms} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9"
                    value={smsForm.to_number}
                    onChange={(e) => setSmsForm({ ...smsForm, to_number: e.target.value })}
                    placeholder="+919876543210 or 9876543210"
                    required
                    data-testid="test-sms-number-input"
                  />
                </div>
                <p className="text-xs text-gray-500">10-digit numbers default to +91 (India).</p>
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <select
                  className="w-full border border-gray-200 rounded-md h-10 px-3 text-sm bg-white"
                  value={smsForm.channel}
                  onChange={(e) => setSmsForm({ ...smsForm, channel: e.target.value })}
                  data-testid="test-sms-channel-select"
                >
                  <option value="both">SMS + WhatsApp</option>
                  <option value="sms">SMS only</option>
                  <option value="whatsapp">WhatsApp only</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Textarea
                value={smsForm.message}
                onChange={(e) => setSmsForm({ ...smsForm, message: e.target.value })}
                placeholder="Leave blank to send a default test message"
                rows={2}
                data-testid="test-sms-message-input"
              />
            </div>

            <Button type="submit" disabled={smsSending} data-testid="test-sms-send-btn">
              {smsSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Test Message
            </Button>

            {smsResult && (
              <div className="mt-3 p-3 rounded-md bg-gray-50 border text-sm space-y-1" data-testid="test-sms-result">
                <p className="text-gray-600">Sent to: <strong>{smsResult.normalized_number}</strong></p>
                {Object.entries(smsResult.results || {}).map(([channel, info]) => (
                  <div key={channel} className="flex items-center gap-2">
                    {info.status === 'sent' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="capitalize font-medium">{channel}:</span>
                    <span className={info.status === 'sent' ? 'text-green-700' : 'text-red-600'}>
                      {info.status}{info.error ? ` — ${info.error}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </form>

          {/* Inbound webhook URL for STOP/HELP compliance */}
          <div className="mt-6 pt-6 border-t max-w-2xl">
            <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> STOP / HELP Auto-Replies
            </p>
            <p className="text-xs text-gray-500 mt-1">
              To enable automatic STOP-to-unsubscribe and HELP replies, paste this URL into your Twilio number's
              <strong> "A message comes in" (Messaging) webhook</strong> (HTTP POST):
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-gray-50 border rounded-md px-3 py-2 font-mono break-all" data-testid="twilio-webhook-url">
                {webhookUrl}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyWebhook} data-testid="copy-webhook-btn">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
              </Button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              US toll-free numbers also auto-handle STOP at the carrier level. Opted-out numbers are automatically skipped on all sends.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
