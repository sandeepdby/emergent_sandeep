import React, { useState } from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { CheckSquare, Download, Layers, ClipboardList, BarChart3, Mail, CloudUpload, Wallet, FileSpreadsheet, Users, FileCheck, ScrollText, Link2, Quote, BookOpen, ChevronLeft, ChevronRight, Menu, Table2 } from "lucide-react";
import { AuthContext } from "../auth";
import UserProfileMenu from "./UserProfileMenu";
import ApproveEndorsements from "./ApproveEndorsements";
import AllEndorsements from "./AllEndorsements";
import PoliciesManagement from "./PoliciesManagement";
import DownloadApproved from "./DownloadApproved";
import AnalyticsDashboard from "./AnalyticsDashboard";
import EmailSettings from "./EmailSettings";
import CloudStorage from "./CloudStorage";
import CDLedger from "./CDLedger";
import ImportBatches from "./ImportBatches";
import UserManagement from "./UserManagement";
import ClaimsManagement from "./ClaimsManagement";
import AuditLog from "./AuditLog";
import PolicyAssignment from "./PolicyAssignment";
import TestimonialsManagement from "./TestimonialsManagement";
import PolicyExplainer from "./PolicyExplainer";
import Raters from "./Raters";

const navGroups = [
  {
    label: "Overview",
    items: [
      { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { path: "/admin/approve", label: "Approvals", icon: CheckSquare },
      { path: "/admin/all-endorsements", label: "Endorsements", icon: ClipboardList },
      { path: "/admin/import-batches", label: "Imports", icon: FileSpreadsheet },
      { path: "/admin/download", label: "Download", icon: Download },
    ],
  },
  {
    label: "Policies & Claims",
    items: [
      { path: "/admin/policies", label: "Policies", icon: Layers },
      { path: "/admin/policy-assign", label: "Assign Policies", icon: Link2 },
      { path: "/admin/claims", label: "Claims", icon: FileCheck },
      { path: "/admin/policy-explainer", label: "Policy T&C", icon: BookOpen },
    ],
  },
  {
    label: "Finance",
    items: [
      { path: "/admin/cd-ledger", label: "CD Ledger", icon: Wallet },
      { path: "/admin/raters", label: "Rate Cards", icon: Table2 },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/admin/storage", label: "Cloud Storage", icon: CloudUpload },
      { path: "/admin/users", label: "User Management", icon: Users },
      { path: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
      { path: "/admin/email", label: "Email Settings", icon: Mail },
      { path: "/admin/testimonials", label: "Testimonials", icon: Quote },
    ],
  },
];

function SidebarNavItem({ item, collapsed }) {
  const location = useLocation();
  const Icon = item.icon;
  const isActive = location.pathname === item.path;
  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md mx-2 transition-all duration-200 ${
        isActive
          ? "bg-white text-[#E05A47] shadow-sm border-l-2 border-[#E05A47]"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
      title={collapsed ? item.label : undefined}
      data-testid={`admin-nav-${item.path.split('/').pop()}`}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function SidebarNavGroup({ group, collapsed }) {
  return (
    <div className="mb-1">
      {!collapsed && (
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5 mt-4 px-4 first:mt-0">{group.label}</p>
      )}
      <NavItemList items={group.items} collapsed={collapsed} />
    </div>
  );
}

function NavItemList({ items, collapsed }) {
  return (
    <div className="space-y-0.5">
      {items.map(item => <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />)}
    </div>
  );
}

const Sidebar = ({ collapsed, onToggle }) => {
  return (
    <aside className={`fixed top-0 left-0 h-screen ${collapsed ? 'w-[68px]' : 'w-60'} bg-[#FDFBF7] border-r border-stone-200 flex flex-col z-40 transition-all duration-300`} data-testid="admin-sidebar">
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-5'} h-16 border-b border-stone-200/60`}>
        <img
          src="https://customer-assets.emergentagent.com/job_policy-plus-1/artifacts/j6pmedsr_Aarogya-assist%20Logo%20trade.png"
          alt="Aarogya Assist"
          className="h-9 w-auto shrink-0"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-base font-semibold text-stone-800 tracking-tight leading-none">InsureHub</p>
            <p className="text-[10px] text-stone-400 mt-0.5">Admin Portal</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {navGroups.map(g => <SidebarNavGroup key={g.label} group={g} collapsed={collapsed} />)}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-stone-200/60 p-3">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 text-xs text-stone-400 hover:text-stone-600 py-1.5 rounded-md hover:bg-stone-100 transition-colors"
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
};

const Header = ({ user, onLogout, collapsed, onMobileToggle }) => {
  return (
    <header className={`sticky top-0 z-30 h-16 backdrop-blur-xl bg-white/70 border-b border-stone-200/50 flex items-center justify-between px-8 ${collapsed ? 'ml-[68px]' : 'ml-60'} transition-all duration-300`} data-testid="admin-header">
      <div className="flex items-center gap-3">
        <button onClick={onMobileToggle} className="lg:hidden p-1.5 rounded-md hover:bg-stone-100 text-stone-500">
          <Menu className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-center">
        <UserProfileMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
};

class AdminDashboard extends React.Component {
  static contextType = AuthContext;

  constructor(props) {
    super(props);
    this.state = { collapsed: false };
  }

  render() {
    const { logout, user } = this.context;
    const { collapsed } = this.state;

    return (
      <div className="min-h-screen bg-[#FDFBF7]">
        <Sidebar collapsed={collapsed} onToggle={() => this.setState({ collapsed: !collapsed })} />
        <Header user={user} onLogout={logout} collapsed={collapsed} onMobileToggle={() => this.setState({ collapsed: !collapsed })} />
        <main className={`${collapsed ? 'ml-[68px]' : 'ml-60'} transition-all duration-300 p-8`}>
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/analytics" element={<AnalyticsDashboard />} />
              <Route path="/approve" element={<ApproveEndorsements />} />
              <Route path="/all-endorsements" element={<AllEndorsements />} />
              <Route path="/import-batches" element={<ImportBatches />} />
              <Route path="/policies" element={<PoliciesManagement />} />
              <Route path="/policy-assign" element={<PolicyAssignment />} />
              <Route path="/claims" element={<ClaimsManagement />} />
              <Route path="/cd-ledger" element={<CDLedger />} />
              <Route path="/raters" element={<Raters isAdmin={true} />} />
              <Route path="/download" element={<DownloadApproved />} />
              <Route path="/email" element={<EmailSettings />} />
              <Route path="/storage" element={<CloudStorage />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/testimonials" element={<TestimonialsManagement />} />
              <Route path="/policy-explainer" element={<PolicyExplainer isAdmin={true} />} />
              <Route path="/" element={<Navigate to="/admin/analytics" />} />
            </Routes>
          </div>
        </main>
      </div>
    );
  }
}

export default AdminDashboard;
