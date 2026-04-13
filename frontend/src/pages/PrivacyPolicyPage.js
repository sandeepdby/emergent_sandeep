import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
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
          <Link to="/" className="flex items-center gap-2 text-sm text-[#4A4D54] hover:text-[#0F1115] transition-colors" data-testid="back-to-home-privacy">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#E05D36]/10 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#E05D36]" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid="privacy-policy-title">Privacy Policy</h1>
            <p className="text-sm text-[#4A4D54] mt-1">Last updated: February 2026</p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none space-y-8" data-testid="privacy-policy-content">
          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">1. Introduction</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              Aarogya Assist ("we", "our", "us") operates the InsureHub platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our insurance endorsement management platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">2. Information We Collect</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3"><strong>Personal Information:</strong> When you register or use our services, we may collect your name, email address, phone number, company affiliation, designation, and employment details.</p>
            <p className="text-[#4A4D54] leading-relaxed"><strong>Insurance Data:</strong> Policy details, endorsement records, claims information, premium calculations, and related insurance documentation uploaded by authorized HR and Admin users.</p>
            <p className="text-[#4A4D54] leading-relaxed"><strong>Usage Data:</strong> Browser type, IP address, pages visited, time spent on pages, and other diagnostic data collected automatically.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-[#4A4D54] space-y-2 mt-3">
              <li>To provide, maintain, and improve the InsureHub platform</li>
              <li>To process insurance endorsements, claims, and premium calculations</li>
              <li>To send notifications via email and WhatsApp regarding endorsement status updates</li>
              <li>To generate AI-powered insights and analytics for your organization</li>
              <li>To communicate with you about your account and provide customer support</li>
              <li>To detect, prevent, and address technical issues and security threats</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">4. Data Security</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              We implement industry-standard security measures including encryption in transit (TLS/SSL), encrypted storage, role-based access control, and regular security audits. Insurance data is handled in compliance with applicable data protection regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">5. Data Sharing & Disclosure</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              We do not sell your personal information. We may share data only with: authorized HR and Admin users within your organization, insurance partners as required for policy processing, and law enforcement when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">6. Data Retention</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              We retain your information for as long as your account is active or as needed to provide services. Insurance records are retained per regulatory requirements. You may request deletion of your personal data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">7. Your Rights</h2>
            <ul className="list-disc list-inside text-[#4A4D54] space-y-2 mt-3">
              <li>Access your personal data</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your data (subject to legal obligations)</li>
              <li>Withdraw consent for data processing</li>
              <li>Lodge a complaint with a supervisory authority</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">8. Cookies</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              We use essential cookies for authentication and session management. We do not use third-party tracking cookies. You can configure your browser to refuse cookies, though some platform features may not function properly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#16332A] border-b border-black/5 pb-2">9. Contact Us</h2>
            <p className="text-[#4A4D54] leading-relaxed mt-3">
              For privacy-related inquiries, contact us at:
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
