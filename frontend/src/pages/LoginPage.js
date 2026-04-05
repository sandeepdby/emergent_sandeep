import { useState, useContext } from "react";
import axios from "axios";
import { API, AuthContext } from "../App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, User, Loader2 } from "lucide-react";

const LoginPage = () => {
  const { login } = useContext(AuthContext);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post(`${API}/auth/login`, credentials);
      login(response.data.access_token, response.data.user);
      toast.success(`Welcome ${response.data.user.full_name}!`);
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.response?.data?.detail || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100" data-testid="login-page">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">InsureHub Portal</CardTitle>
          <CardDescription>Aarogya Assist - Endorsement Management</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                required
                data-testid="username-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                required
                data-testid="password-input"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-button">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <User className="w-4 h-4 mr-2" />
                  Login
                </>
              )}
            </Button>
          </form>
          <div className="mt-6 text-xs text-center text-gray-500">
            <p>Demo Credentials:</p>
            <p>HR: hr@test.com / password123</p>
            <p>Admin: admin@test.com / password123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
