import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import axios from "axios";
import { AuthContext, API } from "./auth";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail } from "lucide-react";

// ==================== FORGOT PASSWORD COMPONENT ====================
const ForgotPasswordPage = ({ onBack }) => {
  const [step, setStep] = useState(1); // 1=email, 2=code+newpass
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      setMessage("Reset code sent to your email. Check your inbox.");
      setStep(2);
    } catch (err) {
      setMessage(err.response?.data?.detail || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { setMessage("Password must be at least 6 characters"); return; }
    setLoading(true);
    setMessage("");
    try {
      const res = await axios.post(`${API}/auth/reset-password`, { token: code, new_password: newPassword });
      setMessage(res.data.message);
      setTimeout(() => onBack(), 2000);
    } catch (err) {
      setMessage(err.response?.data?.detail || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Mail className="w-12 h-12 text-blue-500 mx-auto mb-2" />
          <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
          <p className="text-gray-500 text-sm mt-1">
            {step === 1 ? "Enter your email to receive a reset code" : "Enter the code from your email"}
          </p>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${message.includes("sent") || message.includes("success") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`} data-testid="reset-message">
            {message}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="forgot-email-input" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2" data-testid="send-reset-code-btn">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Send Reset Code
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reset Code</label>
              <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-lg tracking-widest text-center" placeholder="XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={8} data-testid="reset-code-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Minimum 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} data-testid="new-password-input" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2" data-testid="reset-password-btn">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Reset Password
            </button>
          </form>
        )}

        <button onClick={onBack} className="w-full mt-4 text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1" data-testid="back-to-login-from-reset">
          <ArrowLeft className="w-3 h-3" /> Back to Login
        </button>
      </div>
    </div>
  );
};

// ==================== LOGIN/REGISTER COMPONENT ====================
const LoginRegisterPage = ({ onLogin, onBack }) => {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [registerData, setRegisterData] = useState({
    username: "", password: "", full_name: "", email: "", phone: "", role: "HR"
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, credentials);
      onLogin(response.data.access_token, response.data.user);
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/auth/register`, registerData);
      alert('Registration successful! You will receive a welcome email. Please login.');
      setShowRegister(false);
      setRegisterData({ username: "", password: "", full_name: "", email: "", phone: "", role: "HR" });
    } catch (error) {
      alert('Registration failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (showForgot) {
    return <ForgotPasswordPage onBack={() => setShowForgot(false)} />;
  }

  if (showRegister) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-center text-blue-600 mb-2">InsureHub</h1>
          <p className="text-center text-gray-600 mb-6">Register New User</p>
          
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={registerData.full_name}
                onChange={(e) => setRegisterData({...registerData, full_name: e.target.value})}
                required
                data-testid="register-fullname-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={registerData.email}
                onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                required
                data-testid="register-email-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="+91 9876543210"
                value={registerData.phone}
                onChange={(e) => setRegisterData({...registerData, phone: e.target.value})}
                data-testid="register-phone-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={registerData.username}
                onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                required
                data-testid="register-username-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showRegPassword ? "text" : "password"}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                  required
                  minLength="6"
                  data-testid="register-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  data-testid="toggle-register-password-visibility"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium">
                HR User
              </div>
              <input type="hidden" value="HR" />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              data-testid="register-submit-button"
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
            
            <button
              type="button"
              onClick={() => setShowRegister(false)}
              className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium"
              data-testid="back-to-login-button"
            >
              Back to Login
            </button>
          </form>
          
          <p className="text-xs text-center text-gray-500 mt-4">
            A welcome email will be sent to you and notifications will be sent to existing HR &amp; Admin users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img 
              src="https://customer-assets.emergentagent.com/job_policy-plus-1/artifacts/j6pmedsr_Aarogya-assist%20Logo%20trade.png" 
              alt="Aarogya Assist" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-blue-600">InsureHub</h1>
          <p className="text-gray-600 mt-2">Endorsement Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                required
                data-testid="login-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                data-testid="toggle-password-visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            data-testid="login-submit-button"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="mt-6 text-center space-y-2">
          <button
            onClick={() => setShowForgot(true)}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
            data-testid="forgot-password-link"
          >
            Forgot Password?
          </button>
          <div>
            <button
              onClick={() => setShowRegister(true)}
              className="text-blue-600 hover:text-blue-800 font-medium"
              data-testid="create-account-link"
            >
              Create New Account
            </button>
          </div>
          {onBack && (
            <div>
              <button
                onClick={onBack}
                className="text-gray-500 hover:text-gray-700 text-sm"
                data-testid="back-to-landing-btn"
              >
                ← Back to Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== IMPORT ACTUAL PORTAL COMPONENTS ====================
// These are already created in the codebase
import HRDashboard from "./pages/HRDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LandingPage from "./pages/LandingPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import CareersPage from "./pages/CareersPage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setShowAuth(false);
  };

  const logout = () => {
    localStorage.clear();
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
            <Route path="/" element={
              user ? (
                <Navigate to={user.role === 'Admin' ? '/admin' : '/hr'} />
              ) : showAuth ? (
                <LoginRegisterPage onLogin={login} onBack={() => setShowAuth(false)} />
              ) : (
                <LandingPage onGetStarted={() => setShowAuth(true)} />
              )
            } />
            <Route path="/login" element={!user ? <LoginRegisterPage onLogin={login} /> : <Navigate to={user.role === 'Admin' ? '/admin' : '/hr'} />} />
            <Route path="/hr/*" element={user && user.role === 'HR' ? <HRDashboard /> : <Navigate to="/login" />} />
            <Route path="/admin/*" element={user && user.role === 'Admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            <Route path="/careers" element={<CareersPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </AuthContext.Provider>
  );
}

export default App;
