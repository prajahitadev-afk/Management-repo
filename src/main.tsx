import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { initializeTheme } from "./lib/theme";
import { AuthProvider } from "./context/AuthContext";

initializeTheme();

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);