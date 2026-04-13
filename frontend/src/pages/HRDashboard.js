import React from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { FileSpreadsheet, ClipboardList, Plus, CloudUpload, LayoutDashboard, Shield, FileCheck, Wallet } from "lucide-react";
import { AuthContext } from "../auth";
import UserProfileMenu from "./UserProfileMenu";
import HRSummary from "./HRSummary";
import SubmitEndorsement from "./SubmitEndorsement";
import MyEndorsements from "./MyEndorsements";
import ImportEndorsements from "./ImportEndorsements";
import CloudStorage from "./CloudStorage";
import HRPoliciesDashboard from "./HRPoliciesDashboard";
import HRClaimsDashboard from "./HRClaimsDashboard";
import CDLedger from "./CDLedger";

const Navigation = ({ onLogout, user }) => {
  const location = useLocation();
  
  const navItems = [
    { path: "/hr/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/hr/policies", label: "Policies", icon: Shield },
    { path: "/hr/claims", label: "Claims", icon: FileCheck },
    { path: "/hr/submit", label: "Submit Endorsement", icon: Plus },
    { path: "/hr/my-endorsements", label: "My Endorsements", icon: ClipboardList },
    { path: "/hr/import", label: "Import Excel", icon: FileSpreadsheet },
    { path: "/hr/cd-ledger", label: "CD Ledger", icon: Wallet },
    { path: "/hr/storage", label: "Cloud Storage", icon: CloudUpload },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_policy-plus-1/artifacts/j6pmedsr_Aarogya-assist%20Logo%20trade.png" 
                alt="Aarogya Assist" 
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold text-blue-600">InsureHub</h1>
                <span className="text-xs text-gray-500">HR Portal</span>
              </div>
            </div>
            <div className="ml-6 flex space-x-1 overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium rounded-t whitespace-nowrap ${
                      isActive
                        ? "border-blue-500 text-blue-600 bg-blue-50"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            <UserProfileMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </div>
    </nav>
  );
};

class HRDashboard extends React.Component {
  static contextType = AuthContext;

  render() {
    const { logout, user } = this.context;

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation onLogout={logout} user={user} />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/dashboard" element={<HRSummary />} />
            <Route path="/policies" element={<HRPoliciesDashboard />} />
            <Route path="/claims" element={<HRClaimsDashboard />} />
            <Route path="/submit" element={<SubmitEndorsement />} />
            <Route path="/my-endorsements" element={<MyEndorsements />} />
            <Route path="/import" element={<ImportEndorsements />} />
            <Route path="/cd-ledger" element={<CDLedger />} />
            <Route path="/storage" element={<CloudStorage />} />
            <Route path="/" element={<Navigate to="/hr/dashboard" />} />
          </Routes>
        </div>
      </div>
    );
  }
}

export default HRDashboard;
