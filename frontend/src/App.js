import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthContext, API } from "./auth";
import LoginPage from "./pages/LoginPage";
import HRDashboard from "./pages/HRDashboard";
import AdminDashboard from "./pages/AdminDashboard";

export { API, AuthContext };

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="App min-h-screen bg-gray-50">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={user.role === 'Admin' ? '/admin' : '/hr'} />} />
            <Route path="/hr/*" element={user && user.role === 'HR' ? <HRDashboard /> : <Navigate to="/login" />} />
            <Route path="/admin/*" element={user && user.role === 'Admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
            <Route path="/" element={<Navigate to={user ? (user.role === 'Admin' ? '/admin' : '/hr') : '/login'} />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </AuthContext.Provider>
  );
}

export default App;
