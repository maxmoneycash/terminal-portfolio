import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { PrintResume } from "./components/PrintResume";
import "./index.css";

const isPrintResume = new URLSearchParams(window.location.search).get("print") === "resume";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isPrintResume ? <PrintResume /> : <App />}</StrictMode>,
);
