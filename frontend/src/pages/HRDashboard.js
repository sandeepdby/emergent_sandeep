import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { FileSpreadsheet, ClipboardList, Plus, CloudUpload, LayoutDashboard, Shield, FileCheck, Wallet, BookOpen, ChevronLeft, ChevronRight, Menu, BarChart3 } from "lucide-react";
import { AuthContext, API, getAuthHeaders } from "../auth";
import axios from "axios";
import UserProfileMenu from "./UserProfileMenu";
import HRSummary from "./HRSummary";
import SubmitEndorsement from "./SubmitEndorsement";
import MyEndorsements from "./MyEndorsements";
import ImportEndorsements from "./ImportEndorsements";
import CloudStorage from "./CloudStorage";
import HRPoliciesDashboard from "./HRPoliciesDashboard";
import HRClaimsDashboard from "./HRClaimsDashboard";
import CDLedger from "./CDLedger";
import PolicyExplainer from "./PolicyExplainer";
import Raters from "./Raters";

const getNavGroups = (hasPolicyTC) => [
  {
    label: "Overview",
    items: [
      { path: "/hr/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Endorsements",
    items: [
      { path: "/hr/submit", label: "Submit Endorsement", icon: Plus },
      { path: "/hr/my-endorsements", label: "My Endorsements", icon: ClipboardList },
      { path: "/hr/import", label: "Import Excel", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Policies & Claims",
    items: [
      { path: "/hr/policies", label: "Policies", icon: Shield },
      { path: "/hr/claims", label: "Claims", icon: FileCheck },
      ...(hasPolicyTC ? [{ path: "/hr/policy-explainer", label: "Policy T&C", icon: BookOpen }] : []),
    ],
  },
  {
    label: "Finance & Storage",
    items: [
      { path: "/hr/cd-ledger", label: "CD Ledger", icon: Wallet },
      { path: "/hr/raters", label: "Rate Cards", icon: BarChart3 },
      { path: "/hr/storage", label: "Cloud Storage", icon: CloudUpload },
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
      data-testid={`hr-nav-${item.path.split('/').pop()}`}
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

const Sidebar = ({ collapsed, onToggle, navGroups }) => {
  return (
    <aside className={`fixed top-0 left-0 h-screen ${collapsed ? 'w-[68px]' : 'w-60'} bg-[#FDFBF7] border-r border-stone-200 flex flex-col z-40 transition-all duration-300`} data-testid="hr-sidebar">
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
            <p className="text-[10px] text-[#E05A47] font-medium mt-0.5">HR Portal</p>
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
    <header className={`sticky top-0 z-30 h-16 backdrop-blur-xl bg-white/70 border-b border-stone-200/50 flex items-center justify-between px-8 ${collapsed ? 'ml-[68px]' : 'ml-60'} transition-all duration-300`} data-testid="hr-header">
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

class HRDashboard extends React.Component {
  static contextType = AuthContext;

  constructor(props) {
    super(props);
    this.state = { collapsed: false, hasPolicyTC: true };
  }

  componentDidMount() {
    axios.get(`${API}/feature-access-check/policy_tc`, { headers: getAuthHeaders() })
      .then(res => this.setState({ hasPolicyTC: res.data.has_access }))
      .catch(() => {});
  }

  render() {
    const { logout, user } = this.context;
    const { collapsed, hasPolicyTC } = this.state;
    const navGroups = getNavGroups(hasPolicyTC);

    return (
      <div className="min-h-screen bg-[#FDFBF7]">
        <Sidebar collapsed={collapsed} onToggle={() => this.setState({ collapsed: !collapsed })} navGroups={navGroups} />
        <Header user={user} onLogout={logout} collapsed={collapsed} onMobileToggle={() => this.setState({ collapsed: !collapsed })} />
        <main className={`${collapsed ? 'ml-[68px]' : 'ml-60'} transition-all duration-300 p-8`}>
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/dashboard" element={<HRSummary />} />
              <Route path="/policies" element={<HRPoliciesDashboard />} />
              <Route path="/claims" element={<HRClaimsDashboard />} />
              <Route path="/submit" element={<SubmitEndorsement />} />
              <Route path="/my-endorsements" element={<MyEndorsements />} />
              <Route path="/import" element={<ImportEndorsements />} />
              <Route path="/cd-ledger" element={<CDLedger />} />
              <Route path="/raters" element={<Raters isAdmin={false} />} />
              <Route path="/policy-explainer" element={<PolicyExplainer isAdmin={false} />} />
              <Route path="/storage" element={<CloudStorage />} />
              <Route path="/" element={<Navigate to="/hr/dashboard" />} />
            </Routes>
          </div>
        </main>
      </div>
    );
  }
}

export default HRDashboard;
