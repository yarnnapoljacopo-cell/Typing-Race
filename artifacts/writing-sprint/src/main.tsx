import { createRoot } from "react-dom/client";
import App from "./App";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import "./index.css";

async function start() {
  if (import.meta.env.DEV) {
    const { isDemoSession } = await import("./lib/demoSession");
    if (isDemoSession()) {
      const { installDemo } = await import("./lib/demo/runtime");
      installDemo();
    }
  }
  createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);

}
void start();
