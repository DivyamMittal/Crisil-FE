import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app/app";
import { GlobalLoadingIndicator } from "./components/global-loading-indicator";
import { ToastProvider } from "./components/toast-provider";
import { AuthProvider } from "./features/auth/auth-context";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <GlobalLoadingIndicator />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
);
