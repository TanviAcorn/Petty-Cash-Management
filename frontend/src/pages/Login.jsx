import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axiosClient.post("/users/login", { email, password });
      localStorage.setItem("token", res.data.token);
      try { 
        localStorage.setItem("user", JSON.stringify(res.data.user)); 
      } catch {}
      // Navigate to dashboard after successful login
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.message || "Invalid email or password";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(180deg,#eef4ff_0%,#e9f0ff_100%)] flex flex-col items-center">
      {/* Brand header */}
      <div className="pt-16 px-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-blue-900 flex items-center justify-center shadow-md">
          <Lock className="text-white w-6 h-6" />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-800">HR PettyCash</h1>
        <p className="mt-1 text-slate-500">Sign in to your account</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md mt-8 px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Sign In</h2>
            <p className="text-slate-500">Enter your email and password to access your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-600 text-sm text-center bg-red-50 border border-red-100 rounded-md py-2">
                {error}
              </p>
            )}

            {/* Button */}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-lg shadow-sm transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
