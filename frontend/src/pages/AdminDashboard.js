import React from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, CheckSquare, Download, Layers, ClipboardList, BarChart3, Mail, CloudUpload, Wallet, FileSpreadsheet, Users, FileCheck, ScrollText } from "lucide-react";
import { AuthContext } from "../auth";
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

const Navigation = ({ onLogout, user }) => {
  const location = useLocation();
  
  const navItems = [
    { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/admin/approve", label: "Approvals", icon: CheckSquare },
    { path: "/admin/all-endorsements", label: "Endorsements", icon: ClipboardList },
    { path: "/admin/import-batches", label: "Imports", icon: FileSpreadsheet },
    { path: "/admin/policies", label: "Policies", icon: Layers },
    { path: "/admin/claims", label: "Claims", icon: FileCheck },
    { path: "/admin/cd-ledger", label: "CD Ledger", icon: Wallet },
    { path: "/admin/download", label: "Download", icon: Download },
    { path: "/admin/storage", label: "Storage", icon: CloudUpload },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
    { path: "/admin/email", label: "Email", icon: Mail },
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
                <h1 className="text-xl font-bold text-indigo-600">InsureHub</h1>
                <span className="text-xs text-gray-500">Admin Portal</span>
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
                    className={`inline-flex items-center px-2.5 py-2 border-b-2 text-xs font-medium rounded-t whitespace-nowrap ${
                      isActive
                        ? "border-indigo-500 text-indigo-600 bg-indigo-50"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">{user?.full_name}</span>
            </div>
            <Button onClick={onLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

class AdminDashboard extends React.Component {
  static contextType = AuthContext;

  render() {
    const { logout, user } = this.context;

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation onLogout={logout} user={user} />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/approve" element={<ApproveEndorsements />} />
            <Route path="/all-endorsements" element={<AllEndorsements />} />
            <Route path="/import-batches" element={<ImportBatches />} />
            <Route path="/policies" element={<PoliciesManagement />} />
            <Route path="/claims" element={<ClaimsManagement />} />
            <Route path="/cd-ledger" element={<CDLedger />} />
            <Route path="/download" element={<DownloadApproved />} />
            <Route path="/email" element={<EmailSettings />} />
            <Route path="/storage" element={<CloudStorage />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/" element={<Navigate to="/admin/analytics" />} />
          </Routes>
        </div>
      </div>
    );
  }
}

export default AdminDashboard;
