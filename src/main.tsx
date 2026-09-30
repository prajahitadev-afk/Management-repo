import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

import { AuthProvider } from "./context/AuthContext";
import { attachDevtoolsDeterrence } from "./lib/devtools";

if (typeof document !== "undefined") {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "light";
}

attachDevtoolsDeterrence();

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);