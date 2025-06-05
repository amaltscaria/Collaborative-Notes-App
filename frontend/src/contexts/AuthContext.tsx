import { createContext, useContext, useEffect, useState } from "react";

import type { ReactNode } from "react";

import api from "../lib/api";

interface User {
  _id: string;
  username: String;
  email: String;
  createdAt: String;
  updatedAt: String;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("token");

      if (storedToken) {
        setToken(storedToken);
        try {
          // Verify token and get user info
          const response = await api.get("/auth/me");
          setUser(response.data.data.user);
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem("token");
          setToken(null);
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { user: userData, token: userToken } = response.data.data;

      // Store token in localStorage
      localStorage.setItem("token", userToken);

      // Update state
      setToken(userToken);
      setUser(userData);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Login failed");
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string
  ) => {
    try {
      const response = await api.post("/auth/register", {
        username,
        email,
        password,
      });
      const { user: userData, token: userToken } = response.data.data;

      // Store token in localStorage
      localStorage.setItem("token", userToken);

      // Update state
      setToken(userToken);
      setUser(userData);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Registration failed");
    }
  };

  const logout = () => {
    // Remove token from localStorage
    localStorage.removeItem("token");

    // Clear state
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
