import React from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, User, FileSpreadsheet, ClipboardList, Plus } from "lucide-react";
import { AuthContext } from "../App";
import SubmitEndorsement from "./SubmitEndorsement";
import MyEndorsements from "./MyEndorsements";
import ImportEndorsements from "./ImportEndorsements";

const Navigation = ({ onLogout, user }) => {
  const location = useLocation();
  
  const navItems = [
    { path: "/hr/submit", label: "Submit Endorsement", icon: Plus },
    { path: "/hr/my-endorsements", label: "My Endorsements", icon: ClipboardList },
    { path: "/hr/import", label: "Import Excel", icon: FileSpreadsheet },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">InsureHub</h1>
              <span className="ml-2 text-sm text-gray-500">HR Portal</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
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

class HRDashboard extends React.Component {
  static contextType = AuthContext;

  render() {
    const { logout, user } = this.context;

    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation onLogout={logout} user={user} />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/submit" element={<SubmitEndorsement />} />
            <Route path="/my-endorsements" element={<MyEndorsements />} />
            <Route path="/import" element={<ImportEndorsements />} />
            <Route path="/" element={<Navigate to="/hr/submit" />} />
          </Routes>
        </div>
      </div>
    );
  }
}

export default HRDashboard;
