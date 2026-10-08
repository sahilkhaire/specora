import React from "react";
import ReactDOM from "react-dom/client";
import "@/shared/styles/global.css";
import { App } from "@/app/App";
import { DataProvider } from "@/data/DataProvider";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary scope="Specora">
      <DataProvider>
        <App />
      </DataProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
