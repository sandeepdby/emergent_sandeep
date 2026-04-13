import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Briefcase, MapPin, Clock, Send, Loader2, CheckCircle, Users, TrendingUp, Heart } from "lucide-react";
import axios from "axios";
import { API } from "../auth";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" },
  viewport: { once: true, margin: "-50px" }
};

const openPositions = [
  {
    title: "Insurance Domain Expert",
    department: "Operations",
    location: "Bengaluru, India",
    type: "Full-time",
    description: "Drive insurance product strategy and help shape our endorsement management workflows. Deep knowledge of health insurance, group policies, and TPA processes required."
  },
  {
    title: "Full Stack Developer",
    department: "Engineering",
    location: "Remote / Bengaluru",
    type: "Full-time",
    description: "Build and scale our AI-powered insurance platform. Experience with React, Python/FastAPI, and MongoDB preferred. Passion for clean code and great UX."
  },
  {
    title: "AI/ML Engineer",
    department: "Engineering",
    location: "Remote / Bengaluru",
    type: "Full-time",
    description: "Develop intelligent notification systems, claims analytics, and predictive models for insurance workflows. Experience with NLP and LLMs is a plus."
  },
  {
    title: "Business Development Manager",
    department: "Sales",
    location: "Mumbai / Delhi / Bengaluru",
    type: "Full-time",
    description: "Expand our corporate client base across India. Build relationships with HR leaders and insurance brokers. Experience in B2B SaaS or InsureTech preferred."
  },
  {
    title: "Customer Success Associate",
    department: "Support",
    location: "Bengaluru, India",
    type: "Full-time",
    description: "Onboard and support HR teams using InsureHub. Ensure smooth implementation and high client satisfaction. Insurance or HR domain knowledge is a plus."
  }
];

export default function CareersPage() {
  const [selectedPosition, setSelectedPosition] = useState("");
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", position: "",
    experience_years: "", current_company: "", cover_letter: "", linkedin_url: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleApply = (positionTitle) => {
    setSelectedPosition(positionTitle);
    setForm({ ...form, position: positionTitle });
    document.getElementById("apply-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API}/careers/apply`, form);
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

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
          <Link to="/" className="flex items-center gap-2 text-sm text-[#4A4D54] hover:text-[#0F1115] transition-colors" data-testid="back-to-home-careers">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 sm:py-28 px-6 sm:px-8 lg:px-12 bg-gradient-to-b from-[#16332A] to-[#1a3d32] text-white">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">We're Hiring</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-none font-black mt-4" data-testid="careers-title">
              Build the Future of<br />Insurance Technology
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto mt-6">
              Join Aarogya Assist and help transform how organizations manage health insurance.
              We're a passionate team solving real problems with AI and great software.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-8 mt-12">
            <div className="text-center">
              <Users className="w-8 h-8 text-[#E05D36] mx-auto mb-2" />
              <p className="text-2xl font-bold">20+</p>
              <p className="text-sm text-white/60">Team Members</p>
            </div>
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-[#E05D36] mx-auto mb-2" />
              <p className="text-2xl font-bold">3x</p>
              <p className="text-sm text-white/60">Year-over-Year Growth</p>
            </div>
            <div className="text-center">
              <Heart className="w-8 h-8 text-[#E05D36] mx-auto mb-2" />
              <p className="text-2xl font-bold">100+</p>
              <p className="text-sm text-white/60">Corporates Served</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Join Us */}
      <section className="py-20 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">Why Aarogya Assist</span>
            <h2 className="text-3xl sm:text-4xl tracking-tight leading-tight font-bold mt-4">Why You'll Love Working Here</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Impactful Work", desc: "Your work directly impacts how millions of employees access health insurance benefits." },
              { title: "Growth Culture", desc: "We invest in your learning. Regular workshops, conference budgets, and a culture of knowledge sharing." },
              { title: "Flexible & Remote", desc: "Work from anywhere in India. We trust our team and value results over hours logged." },
            ].map((item, i) => (
              <motion.div key={i} className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8" {...fadeInUp}>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-[#4A4D54] text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-20 px-6 sm:px-8 lg:px-12 bg-[#F3F2F0]">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">Open Positions</span>
            <h2 className="text-3xl sm:text-4xl tracking-tight leading-tight font-bold mt-4">Current Openings</h2>
          </motion.div>

          <div className="space-y-4 max-w-4xl mx-auto" data-testid="open-positions-list">
            {openPositions.map((pos, i) => (
              <motion.div
                key={i}
                className="bg-white rounded-xl border border-black/5 p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all"
                {...fadeInUp}
                data-testid={`position-card-${i}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{pos.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-[#4A4D54]">
                      <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {pos.department}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {pos.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {pos.type}</span>
                    </div>
                    <p className="text-sm text-[#4A4D54] mt-3">{pos.description}</p>
                  </div>
                  <button
                    onClick={() => handleApply(pos.title)}
                    className="shrink-0 bg-[#E05D36] text-white hover:bg-[#C84B26] transition-all rounded-full px-6 py-2.5 font-semibold text-sm"
                    data-testid={`apply-btn-${i}`}
                  >
                    Apply Now
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply-form" className="py-20 px-6 sm:px-8 lg:px-12">
        <div className="max-w-3xl mx-auto">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">Apply</span>
            <h2 className="text-3xl sm:text-4xl tracking-tight leading-tight font-bold mt-4">Submit Your Application</h2>
            <p className="text-[#4A4D54] mt-3">Fill in your details below and we'll get back to you within 48 hours.</p>
          </motion.div>

          {submitted ? (
            <motion.div className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center" {...fadeInUp} data-testid="career-application-success">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Application Submitted!</h3>
              <p className="text-[#4A4D54]">Thank you for your interest in joining Aarogya Assist. We'll review your profile and reach out soon.</p>
              <button onClick={() => { setSubmitted(false); setForm({ full_name: "", email: "", phone: "", position: "", experience_years: "", current_company: "", cover_letter: "", linkedin_url: "" }); }} className="mt-6 text-sm text-[#E05D36] hover:underline">
                Submit another application
              </button>
            </motion.div>
          ) : (
            <motion.form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 space-y-5" {...fadeInUp} data-testid="career-application-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Full Name *</label>
                  <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                    placeholder="Your full name" data-testid="career-fullname" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Email *</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                    placeholder="your@email.com" data-testid="career-email" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Phone *</label>
                  <input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                    placeholder="+91 98765 43210" data-testid="career-phone" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Position *</label>
                  <select required value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm bg-white"
                    data-testid="career-position">
                    <option value="">Select a position</option>
                    {openPositions.map((p, i) => <option key={i} value={p.title}>{p.title}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Years of Experience</label>
                  <select value={form.experience_years} onChange={e => setForm({ ...form, experience_years: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm bg-white"
                    data-testid="career-experience">
                    <option value="">Select</option>
                    <option value="0-1">0-1 years</option>
                    <option value="1-3">1-3 years</option>
                    <option value="3-5">3-5 years</option>
                    <option value="5-8">5-8 years</option>
                    <option value="8+">8+ years</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Current Company</label>
                  <input type="text" value={form.current_company} onChange={e => setForm({ ...form, current_company: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                    placeholder="Current employer" data-testid="career-company" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0F1115] mb-1.5">LinkedIn Profile</label>
                <input type="url" value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                  placeholder="https://linkedin.com/in/yourprofile" data-testid="career-linkedin" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Cover Letter / Why do you want to join?</label>
                <textarea rows={4} value={form.cover_letter} onChange={e => setForm({ ...form, cover_letter: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm resize-none"
                  placeholder="Tell us about yourself and why you'd be a great fit..." data-testid="career-coverletter" />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-[#E05D36] text-white hover:bg-[#C84B26] disabled:opacity-60 transition-all rounded-full py-3.5 font-semibold text-sm flex items-center justify-center gap-2"
                data-testid="career-submit-btn">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </motion.form>
          )}
        </div>
      </section>

      <footer className="bg-[#0F1115] text-[#FAF9F6]/50 py-8 text-center text-sm">
        &copy; {new Date().getFullYear()} InsureHub by Aarogya Assist. All rights reserved.
      </footer>
    </div>
  );
}
