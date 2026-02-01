import React from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, CheckSquare, Download, Layers, ClipboardList } from "lucide-react";
import { AuthContext } from "../auth";
import ApproveEndorsements from "./ApproveEndorsements";
import AllEndorsements from "./AllEndorsements";
import PoliciesManagement from "./PoliciesManagement";
import DownloadApproved from "./DownloadApproved";

const Navigation = ({ onLogout, user }) => {
  const location = useLocation();
  
  const navItems = [
    { path: "/admin/approve", label: "Pending Approvals", icon: CheckSquare },
    { path: "/admin/all-endorsements", label: "All Endorsements", icon: ClipboardList },
    { path: "/admin/policies", label: "Policies", icon: Layers },
    { path: "/admin/download", label: "Download Approved", icon: Download },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-indigo-600">InsureHub</h1>
              <span className="text-xs text-gray-500">Admin Portal</span>
            </div>
            <div className="ml-6 flex space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium rounded-t ${
                      isActive
                        ? "border-indigo-500 text-indigo-600 bg-indigo-50"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
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
            <Route path="/approve" element={<ApproveEndorsements />} />
            <Route path="/all-endorsements" element={<AllEndorsements />} />
            <Route path="/policies" element={<PoliciesManagement />} />
            <Route path="/download" element={<DownloadApproved />} />
            <Route path="/" element={<Navigate to="/admin/approve" />} />
          </Routes>
        </div>
      </div>
    );
  }
}

export default AdminDashboard;