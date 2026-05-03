import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { ToastContainer } from "./components/ui/Toast";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <ToastContainer />
    </ErrorBoundary>
  );
}
