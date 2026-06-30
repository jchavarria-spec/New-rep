import { createContext, useContext, useEffect, useState } from "react";
import { api, setToken, getToken } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = ({ token, user }) => {
    setToken(token);
    setUser(user);
  };

  const login = async (email, password) =>
    handleAuth(await api.post("/auth/login", { email, password }));

  const register = async (payload) =>
    handleAuth(await api.post("/auth/register", payload));

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const refresh = async () => {
    const { user } = await api.get("/auth/me");
    setUser(user);
  };

  const updateUser = (u) => setUser(u);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refresh, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
