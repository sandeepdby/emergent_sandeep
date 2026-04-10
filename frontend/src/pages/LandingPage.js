import React, { useState } from "react";
import { motion } from "framer-motion";
import Marquee from "react-fast-marquee";
import { 
  Shield, Sparkles, Users, FileCheck, Bell, MessageCircle, 
  Mail, CheckCircle, ArrowRight, Zap, Clock, BarChart3,
  UserCheck, FileText, TrendingUp, Phone, MapPin, Send, Loader2
} from "lucide-react";
import axios from "axios";
import { API } from "../auth";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" },
  viewport: { once: true, margin: "-50px" }
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
  viewport: { once: true }
};

export default function LandingPage({ onGetStarted }) {
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  const handleContact = async (e) => {
    e.preventDefault();
    setContactSending(true);
    try {
      await axios.post(`${API}/contact`, contactForm);
      setContactSent(true);
      setContactForm({ name: "", email: "", phone: "", company: "", message: "" });
    } catch {
      setContactSent(true);
    } finally {
      setContactSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F1115] overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#FAF9F6]/70 border-b border-black/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_policy-plus-1/artifacts/j6pmedsr_Aarogya-assist%20Logo%20trade.png" 
              alt="Aarogya Assist" 
              className="h-11 w-auto"
            />
            <span className="text-xl font-bold tracking-tight">InsureHub</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-[#4A4D54] hover:text-[#0F1115] transition-colors" data-testid="nav-features">Features</a>
            <a href="#pricing" className="text-[#4A4D54] hover:text-[#0F1115] transition-colors" data-testid="nav-pricing">Pricing</a>
            <a href="#testimonials" className="text-[#4A4D54] hover:text-[#0F1115] transition-colors" data-testid="nav-testimonials">Testimonials</a>
            <a href="#contact" className="text-[#4A4D54] hover:text-[#0F1115] transition-colors" data-testid="nav-contact">Contact</a>
          </nav>
          <div className="flex items-center gap-4">
            <button 
              onClick={onGetStarted}
              className="bg-[#E05D36] text-white hover:bg-[#C84B26] transition-all duration-300 rounded-full px-6 py-2.5 font-semibold text-sm"
              data-testid="header-login-btn"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center min-h-[70vh]">
          <motion.div 
            className="col-span-1 lg:col-span-7 flex flex-col gap-6 items-start"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">
              AI-Powered Insurance Management
            </span>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl tracking-tighter leading-none font-black">
              Health Endorsement
              <br />
              <span className="text-[#16332A]">Made Intelligent</span>
            </h1>
            <p className="text-lg leading-relaxed text-[#4A4D54] max-w-xl">
              Streamline your insurance endorsement workflows with AI-powered notifications, 
              real-time WhatsApp alerts, and automated premium calculations. Built for HR teams 
              and Insurance Admins.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              <button 
                onClick={onGetStarted}
                className="group bg-[#E05D36] text-white hover:bg-[#C84B26] transition-all duration-300 rounded-full px-8 py-4 font-semibold flex items-center gap-2"
                data-testid="hero-cta-button"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                className="border border-black/10 text-[#0F1115] hover:bg-black/5 transition-all duration-300 rounded-full px-8 py-4 font-semibold"
                data-testid="hero-demo-button"
              >
                Watch Demo
              </button>
            </div>
            <div className="flex items-center gap-6 mt-6 text-sm text-[#4A4D54]">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#16332A]" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#16332A]" />
                <span>Setup in 5 minutes</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="col-span-1 lg:col-span-5 relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1590650516494-0c8e4a4dd67e?w=600&h=400&fit=crop" 
                alt="HR team working"
                className="rounded-2xl shadow-[0_20px_40px_rgb(0,0,0,0.08)] w-full"
              />
              {/* Floating Card */}
              <motion.div 
                className="absolute -bottom-6 -left-6 bg-white/90 backdrop-blur-xl rounded-xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-black/5"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Endorsement Approved</p>
                    <p className="text-xs text-[#8A8D93]">AI notification sent • Just now</p>
                  </div>
                </div>
              </motion.div>
              
              {/* AI Badge */}
              <motion.div 
                className="absolute -top-4 -right-4 bg-[#16332A] text-white rounded-full px-4 py-2 flex items-center gap-2 shadow-lg"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7, type: "spring" }}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-semibold">AI Powered</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trusted By Marquee */}
      <section className="py-12 border-y border-black/5 bg-[#F3F2F0]">
        <Marquee speed={40} gradient={false} className="overflow-hidden">
          <div className="flex items-center gap-16 px-8 opacity-50">
            {["Aarogya Assist", "HealthFirst", "MediCare Plus", "InsureTech", "CareShield", "LifeGuard", "WellnessHub"].map((name, i) => (
              <span key={i} className="text-xl font-bold tracking-tight whitespace-nowrap">{name}</span>
            ))}
          </div>
        </Marquee>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">Features</span>
            <h2 className="text-3xl sm:text-4xl tracking-tight leading-tight font-bold mt-4">
              Everything You Need for<br />Endorsement Management
            </h2>
          </motion.div>
          
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {/* Addition Card */}
            <motion.div 
              className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300"
              variants={fadeInUp}
            >
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Member Additions</h3>
              <p className="text-[#4A4D54]">Add new members to policies with automatic pro-rata premium calculation.</p>
            </motion.div>

            {/* Deletion Card */}
            <motion.div 
              className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300"
              variants={fadeInUp}
            >
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Member Deletions</h3>
              <p className="text-[#4A4D54]">Process deletions with automatic refund calculations and instant notifications.</p>
            </motion.div>

            {/* Corrections Card */}
            <motion.div 
              className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300"
              variants={fadeInUp}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Data Corrections</h3>
              <p className="text-[#4A4D54]">Fix member details without affecting premiums. Track all changes.</p>
            </motion.div>

            {/* Real-time Sync - Tall Card */}
            <motion.div 
              className="bg-[#16332A] text-white rounded-2xl p-8 md:row-span-2 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.15)] transition-all duration-300"
              variants={fadeInUp}
            >
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#E05D36]" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Real-time Sync</h3>
              <p className="text-white/70 mb-6">All endorsements sync instantly across HR and Admin portals. No delays, no confusion.</p>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-[#E05D36]" />
                  <span>Instant status updates</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-[#E05D36]" />
                  <span>Live dashboard metrics</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-[#E05D36]" />
                  <span>Automated workflows</span>
                </div>
              </div>
            </motion.div>

            {/* HR Workflow - Wide Card */}
            <motion.div 
              className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:col-span-2 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300"
              variants={fadeInUp}
            >
              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">HR Workflow Portal</h3>
                  <p className="text-[#4A4D54] mb-4">Dedicated portal for HR teams to submit and track endorsements. Bulk import via Excel supported.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">Excel Import</span>
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">Bulk Actions</span>
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">Status Tracking</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Analytics Card */}
            <motion.div 
              className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300"
              variants={fadeInUp}
            >
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Analytics Dashboard</h3>
              <p className="text-[#4A4D54]">Track endorsement trends, approval rates, and premium impacts.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* AI & Notifications Section */}
      <section id="ai-insights" className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12 bg-[#F3F2F0]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div {...fadeInUp}>
            <img 
              src="https://images.unsplash.com/photo-1691256676376-357c3aa66c89?w=600&h=500&fit=crop" 
              alt="Mobile notifications"
              className="rounded-2xl shadow-[0_20px_40px_rgb(0,0,0,0.08)] w-full"
            />
          </motion.div>
          
          <motion.div className="space-y-8" {...fadeInUp}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">AI-Powered</span>
            <h2 className="text-3xl sm:text-4xl tracking-tight leading-tight font-bold">
              Intelligent Notifications<br />That Actually Help
            </h2>
            <p className="text-lg text-[#4A4D54]">
              Our AI generates personalized, context-aware notifications for every endorsement action. 
              No more generic alerts – every message is crafted to be informative and actionable.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-[#E05D36]" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">AI-Generated Content</h4>
                  <p className="text-[#4A4D54] text-sm">GPT-powered notifications that are professional, warm, and contextual.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <MessageCircle className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">WhatsApp Integration</h4>
                  <p className="text-[#4A4D54] text-sm">One-click WhatsApp notifications with pre-filled messages and emojis.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <Mail className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Smart Email Alerts</h4>
                  <p className="text-[#4A4D54] text-sm">Beautiful HTML emails sent automatically to HR and Admin on every action.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl tracking-tight leading-tight font-bold mt-4">
              Loved by HR Teams
            </h2>
          </motion.div>
          
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {[
              {
                quote: "InsureHub has cut our endorsement processing time by 70%. The AI notifications are a game-changer.",
                name: "Priya Sharma",
                role: "HR Manager, TechCorp",
                avatar: "https://images.pexels.com/photos/6077664/pexels-photo-6077664.jpeg?w=100&h=100&fit=crop"
              },
              {
                quote: "The WhatsApp integration means our team never misses an approval. Instant communication at its best.",
                name: "Rahul Verma",
                role: "Insurance Admin, HealthFirst",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
              },
              {
                quote: "Finally, an endorsement system that understands insurance workflows. The pro-rata calculations are spot-on.",
                name: "Anita Desai",
                role: "Benefits Coordinator, MediCare",
                avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop"
              }
            ].map((testimonial, i) => (
              <motion.div 
                key={i}
                className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8"
                variants={fadeInUp}
              >
                <p className="text-[#4A4D54] mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-4">
                  <img 
                    src={testimonial.avatar} 
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-[#8A8D93]">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12 bg-[#F3F2F0]">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">Pricing</span>
            <h2 className="text-3xl sm:text-4xl tracking-tight leading-tight font-bold mt-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-[#4A4D54] mt-3 max-w-lg mx-auto">Choose a plan that fits your organization. Scale as you grow.</p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            variants={staggerContainer} initial="initial" whileInView="whileInView" viewport={{ once: true }}
          >
            {/* Starter */}
            <motion.div className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex flex-col" variants={fadeInUp} data-testid="pricing-starter">
              <h3 className="text-lg font-bold">Starter</h3>
              <p className="text-sm text-[#4A4D54] mt-1">For small HR teams</p>
              <div className="mt-6 mb-6">
                <span className="text-4xl font-black tracking-tight">Free</span>
              </div>
              <ul className="space-y-3 text-sm text-[#4A4D54] flex-1">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Up to 50 endorsements/month</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> 1 Admin + 2 HR users</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Email notifications</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Basic analytics</li>
              </ul>
              <button onClick={onGetStarted} className="mt-8 w-full border border-black/10 text-[#0F1115] hover:bg-black/5 transition-all rounded-full py-3 font-semibold text-sm" data-testid="pricing-starter-btn">
                Get Started
              </button>
            </motion.div>

            {/* Professional */}
            <motion.div className="bg-[#16332A] text-white rounded-2xl shadow-[0_20px_40px_rgb(0,0,0,0.15)] p-8 flex flex-col relative" variants={fadeInUp} data-testid="pricing-professional">
              <div className="absolute -top-3 right-6 bg-[#E05D36] text-white text-xs font-bold px-4 py-1.5 rounded-full">Most Popular</div>
              <h3 className="text-lg font-bold">Professional</h3>
              <p className="text-sm text-white/60 mt-1">For growing organizations</p>
              <div className="mt-6 mb-6">
                <span className="text-4xl font-black tracking-tight">&#8377;4,999</span>
                <span className="text-sm text-white/60 ml-1">/month</span>
              </div>
              <ul className="space-y-3 text-sm text-white/80 flex-1">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E05D36] flex-shrink-0" /> Unlimited endorsements</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E05D36] flex-shrink-0" /> 5 Admin + Unlimited HR</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E05D36] flex-shrink-0" /> AI notifications + WhatsApp</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E05D36] flex-shrink-0" /> Excel bulk import</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E05D36] flex-shrink-0" /> CD Ledger & Cloud Storage</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E05D36] flex-shrink-0" /> Claims & Policy dashboard</li>
              </ul>
              <button onClick={onGetStarted} className="mt-8 w-full bg-[#E05D36] hover:bg-[#C84B26] transition-all rounded-full py-3 font-semibold text-sm" data-testid="pricing-pro-btn">
                Start Free Trial
              </button>
            </motion.div>

            {/* Enterprise */}
            <motion.div className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex flex-col" variants={fadeInUp} data-testid="pricing-enterprise">
              <h3 className="text-lg font-bold">Enterprise</h3>
              <p className="text-sm text-[#4A4D54] mt-1">For large corporations</p>
              <div className="mt-6 mb-6">
                <span className="text-4xl font-black tracking-tight">Custom</span>
              </div>
              <ul className="space-y-3 text-sm text-[#4A4D54] flex-1">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Everything in Professional</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Dedicated account manager</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Custom integrations</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> SLA & priority support</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Audit log & compliance</li>
              </ul>
              <a href="#contact" className="mt-8 w-full border border-black/10 text-[#0F1115] hover:bg-black/5 transition-all rounded-full py-3 font-semibold text-sm text-center block" data-testid="pricing-enterprise-btn">
                Contact Sales
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#E05D36]">Contact Us</span>
            <h2 className="text-3xl sm:text-4xl tracking-tight leading-tight font-bold mt-4">
              Get in Touch
            </h2>
            <p className="text-[#4A4D54] mt-3 max-w-lg mx-auto">Have questions? We'd love to hear from you. Send us a message and we'll respond promptly.</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 max-w-5xl mx-auto">
            {/* Contact Info */}
            <motion.div className="lg:col-span-2 space-y-8" {...fadeInUp}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#E05D36]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-[#E05D36]" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Email</h4>
                  <a href="mailto:connect@aarogya-assist.com" className="text-[#4A4D54] hover:text-[#E05D36] transition-colors text-sm">connect@aarogya-assist.com</a>
                  <br />
                  <a href="mailto:ks@aarogya-assist.com" className="text-[#4A4D54] hover:text-[#E05D36] transition-colors text-sm">ks@aarogya-assist.com</a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#E05D36]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-[#E05D36]" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Phone</h4>
                  <p className="text-[#4A4D54] text-sm">+91 98862 60579</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#E05D36]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-[#E05D36]" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Office</h4>
                  <p className="text-[#4A4D54] text-sm">Bengaluru, Karnataka, India</p>
                </div>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div className="lg:col-span-3" {...fadeInUp}>
              {contactSent ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center" data-testid="contact-success">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Message Sent!</h3>
                  <p className="text-[#4A4D54]">Thank you for reaching out. We'll get back to you within 24 hours.</p>
                  <button onClick={() => setContactSent(false)} className="mt-6 text-sm text-[#E05D36] hover:underline">Send another message</button>
                </div>
              ) : (
                <form onSubmit={handleContact} className="bg-white rounded-2xl border border-black/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 space-y-5" data-testid="contact-form">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Full Name *</label>
                      <input type="text" required value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                        placeholder="Your name" data-testid="contact-name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Email *</label>
                      <input type="email" required value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                        placeholder="your@email.com" data-testid="contact-email" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Phone</label>
                      <input type="tel" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                        placeholder="+91 98765 43210" data-testid="contact-phone" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Company</label>
                      <input type="text" value={contactForm.company} onChange={e => setContactForm({...contactForm, company: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm"
                        placeholder="Your company" data-testid="contact-company" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0F1115] mb-1.5">Message *</label>
                    <textarea required rows={4} value={contactForm.message} onChange={e => setContactForm({...contactForm, message: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:ring-2 focus:ring-[#E05D36]/20 focus:border-[#E05D36] outline-none transition-all text-sm resize-none"
                      placeholder="Tell us about your requirements..." data-testid="contact-message" />
                  </div>
                  <button type="submit" disabled={contactSending}
                    className="w-full bg-[#E05D36] text-white hover:bg-[#C84B26] disabled:opacity-60 transition-all rounded-full py-3.5 font-semibold text-sm flex items-center justify-center gap-2"
                    data-testid="contact-submit-btn">
                    {contactSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {contactSending ? "Sending..." : "Send Message"}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA & Footer */}
      <section className="bg-[#0F1115] text-[#FAF9F6] py-24 sm:py-32 rounded-t-[3rem] px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-tight font-black mb-6">
              Ready to Streamline Your<br />Endorsement Workflow?
            </h2>
            <p className="text-lg text-[#FAF9F6]/70 max-w-2xl mx-auto mb-8">
              Join hundreds of HR teams using InsureHub to manage health insurance endorsements with AI-powered efficiency.
            </p>
            <button 
              onClick={onGetStarted}
              className="group bg-[#E05D36] text-white hover:bg-[#C84B26] transition-all duration-300 rounded-full px-10 py-5 font-semibold text-lg flex items-center gap-2 mx-auto"
              data-testid="footer-cta-button"
            >
              Start Free Today
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
          
          <div className="border-t border-white/10 pt-12 mt-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <img 
                    src="https://customer-assets.emergentagent.com/job_policy-plus-1/artifacts/j6pmedsr_Aarogya-assist%20Logo%20trade.png" 
                    alt="Aarogya Assist" 
                    className="h-8 w-auto brightness-0 invert"
                  />
                  <span className="font-bold">InsureHub</span>
                </div>
                <p className="text-sm text-[#FAF9F6]/50">AI-powered endorsement management by Aarogya Assist</p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-[#FAF9F6]/70">
                  <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#ai-insights" className="hover:text-white transition-colors">AI Insights</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-[#FAF9F6]/70">
                  <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                  <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-[#FAF9F6]/70">
                  <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-12 pt-8 border-t border-white/10 text-sm text-[#FAF9F6]/50">
              © {new Date().getFullYear()} InsureHub by Aarogya Assist. All rights reserved.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
