import React, { useState } from "react";
import axios from "axios";
import { API } from "../auth";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageSquare, Phone, CheckCircle2, Loader2, ShieldCheck, Send } from "lucide-react";

const CONSENT_TEXT =
  "I agree to receive service updates, endorsement notifications, and occasional offerings from InsureHub (Aarogya Innovate Pvt Ltd) via SMS and WhatsApp at the number provided. Message & data rates may apply. Message frequency varies. Reply STOP to unsubscribe, HELP for help.";

const SMS_NUMBER_DISPLAY = "+1 (877) 517-0579";
const WHATSAPP_NUMBER = "917618740675";

export default function SmsOptIn() {
  const [form, setForm] = useState({ name: "", phone: "", company: "", channel: "both" });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Please tick the consent box to subscribe");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/sms-optin`, { ...form, consent });
      setDone(true);
      toast.success("Subscribed! Check your phone for a confirmation message.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col" data-testid="sms-optin-page">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-[#E05A47]" data-testid="optin-home-link">InsureHub</Link>
          <Link to="/login" className="text-sm text-stone-600 hover:text-[#E05A47]">Sign in</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E05A47]/10 mb-4">
            <MessageSquare className="w-7 h-7 text-[#E05A47]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-900">Stay in the loop</h1>
          <p className="text-stone-600 mt-3 max-w-xl mx-auto">
            Get InsureHub endorsement updates, policy alerts, and helpful offerings on SMS &amp; WhatsApp.
            Opt in below — it only takes a few seconds.
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 text-center" data-testid="optin-success">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-stone-900">You're subscribed!</h2>
            <p className="text-stone-600 mt-2">
              A confirmation message has been sent to your phone. Reply <strong>STOP</strong> anytime to unsubscribe.
            </p>
            <Link to="/">
              <Button className="mt-6 bg-[#E05A47] hover:bg-[#c94a38]" data-testid="optin-back-home-btn">Back to Home</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    required
                    data-testid="optin-name-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <Input
                      className="pl-9"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      required
                      data-testid="optin-phone-input"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label>Company (optional)</Label>
                  <Input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Company name"
                    data-testid="optin-company-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred Channel</Label>
                  <select
                    className="w-full border border-stone-200 rounded-md h-10 px-3 text-sm bg-white"
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value })}
                    data-testid="optin-channel-select"
                  >
                    <option value="both">SMS + WhatsApp</option>
                    <option value="sms">SMS only</option>
                    <option value="whatsapp">WhatsApp only</option>
                  </select>
                </div>
              </div>

              {/* Consent */}
              <label className="flex items-start gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[#E05A47]"
                  data-testid="optin-consent-checkbox"
                />
                <span className="text-xs text-stone-600 leading-relaxed">{CONSENT_TEXT}</span>
              </label>

              <Button
                type="submit"
                disabled={loading || !consent}
                className="w-full bg-[#E05A47] hover:bg-[#c94a38] h-11"
                data-testid="optin-submit-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Subscribe to Updates
              </Button>
            </form>

            {/* Alternatives */}
            <div className="mt-6 pt-6 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("JOIN InsureHub updates")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-11 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors"
                data-testid="optin-whatsapp-btn"
              >
                <MessageSquare className="w-4 h-4" /> Opt in via WhatsApp
              </a>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 h-11 rounded-lg border border-stone-200 bg-white text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors"
                data-testid="optin-create-account-btn"
              >
                Create an Account
              </Link>
            </div>

            {/* SMS & Calling number */}
            <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-[#E05A47]/5 border border-[#E05A47]/15">
              <ShieldCheck className="w-5 h-5 text-[#E05A47] mt-0.5 shrink-0" />
              <div className="text-xs text-stone-600 leading-relaxed">
                <p>
                  Messages &amp; calls are sent from our SMS &amp; Calling number{" "}
                  <strong className="text-stone-800" data-testid="optin-sms-number">{SMS_NUMBER_DISPLAY}</strong>.
                </p>
                <p className="mt-1">
                  We never share your number. See our{" "}
                  <Link to="/privacy-policy" className="text-[#E05A47] underline">Privacy Policy</Link> and{" "}
                  <Link to="/terms-of-service" className="text-[#E05A47] underline">Terms</Link>.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
        © Aarogya Innovate Pvt Ltd
      </footer>
    </div>
  );
}
