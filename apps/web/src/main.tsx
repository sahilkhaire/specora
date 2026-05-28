import React from "react";
import ReactDOM from "react-dom/client";
import "@/shared/styles/global.css";
import { App } from "@/app/App";
import { DataProvider } from "@/data/DataProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
);
