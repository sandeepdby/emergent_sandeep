import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { FileSpreadsheet, ClipboardList, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

// Import pages
import PoliciesPage from "./pages/PoliciesPage";
import EndorsementsPage from "./pages/EndorsementsPage";
import ImportPage from "./pages/ImportPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "Policies", icon: Layers },
    { path: "/endorsements", label: "Endorsements", icon: ClipboardList },
    { path: "/import", label: "Import Excel", icon: FileSpreadsheet },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-2xl font-bold text-blue-600" data-testid="app-title">InsureHub</h1>
              <span className="ml-2 text-sm text-gray-500">Aarogya Assist</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                    className={cn(
                      "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium",
                      isActive
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <Navigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<PoliciesPage />} />
            <Route path="/endorsements" element={<EndorsementsPage />} />
            <Route path="/import" element={<ImportPage />} />
          </Routes>
        </div>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;