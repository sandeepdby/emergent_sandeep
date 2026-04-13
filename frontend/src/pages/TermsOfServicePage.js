import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F1115]">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#FAF9F6]/70 border-b border-black/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-20 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="https://customer-assets.emergentagent.com/job_policy-plus-1/artifacts/j6pmedsr_Aarogya-assist%20Logo%20trade.png"
              alt="Aarogya Assist"
              className="h-11 w-auto"
            />
            <span className="text-xl font-bold tracking-tight">InsureHub</span>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-[#4A4D54] hover:text-[#0F1115] transition-colors" data-testid="back-to-home-terms">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#16332A]/10 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-[#16332A]" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid="terms-of-service-title">Terms of Service</h1>
            <p className="text-sm text-[#4A4D54] mt-1">Last updated: February 2026</p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none space-y-8" data-testid="terms-of-service-content">
          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">1. Acceptance of Terms</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              By accessing or using the InsureHub platform operated by Aarogya Assist, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">2. Description of Service</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              InsureHub is an AI-powered insurance endorsement management platform that provides tools for HR teams and Insurance Administrators to manage health insurance endorsements, claims tracking, premium calculations, cloud document storage, and automated notifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">3. User Accounts</h2>
            <ul className="list-disc list-inside text-[#4A4D54] space-y-2 mt-3">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials</li>
              <li>You must notify us immediately of any unauthorized use of your account</li>
              <li>Accounts are assigned roles (Admin, HR) with specific access permissions</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">4. Acceptable Use</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">You agree not to:</p>
            <ul className="list-disc list-inside text-[#4A4D54] space-y-2">
              <li>Upload false, misleading, or fraudulent insurance data</li>
              <li>Attempt to gain unauthorized access to other users' data or system components</li>
              <li>Use the platform for any unlawful purpose</li>
              <li>Share your login credentials with unauthorized persons</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">5. Data Accuracy</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              Users are responsible for the accuracy of insurance data, endorsement details, and employee information uploaded to the platform. Aarogya Assist is not liable for decisions made based on inaccurate data provided by users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">6. Intellectual Property</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              The InsureHub platform, including its design, code, AI models, and branding, is the intellectual property of Aarogya Assist. You retain ownership of data you upload but grant us a limited license to process it as needed to provide our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">7. Service Availability</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              We strive for 99.9% uptime but do not guarantee uninterrupted service. We may perform scheduled maintenance with prior notice. We are not liable for service interruptions due to factors beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">8. Limitation of Liability</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              To the maximum extent permitted by law, Aarogya Assist shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform. Our total liability shall not exceed the amount paid by you for the services in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">9. Indemnification</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              You agree to indemnify and hold harmless Aarogya Assist from any claims, losses, or damages arising from your use of the platform or violation of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">10. Governing Law</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              These terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">11. Changes to Terms</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              We reserve the right to modify these terms at any time. Users will be notified of material changes via email or platform notification. Continued use after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">12. Contact</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              For questions about these Terms of Service, contact us at:
            </p>
            <div className="bg-[#F3F2F0] rounded-xl p-4 mt-3">
              <p className="text-sm text-[#4A4D54]"><strong>Aarogya Assist</strong></p>
              <p className="text-sm text-[#4A4D54]">Email: connect@aarogya-assist.com</p>
              <p className="text-sm text-[#4A4D54]">Phone: +91 98862 60579</p>
              <p className="text-sm text-[#4A4D54]">Address: Bengaluru, Karnataka, India</p>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-[#0F1115] text-[#FAF9F6]/50 py-8 text-center text-sm">
        &copy; {new Date().getFullYear()} InsureHub by Aarogya Assist. All rights reserved.
      </footer>
    </div>
  );
}
