import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "allotment/dist/style.css";
import App from "./App";
import { HomePage } from "./pages/Home";
import { ReportPage } from "./pages/Report";
import { ReviewPage } from "./pages/Review";
import "./index.css";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "reviews/:reviewId", element: <ReviewPage /> },
    ],
  },
  // report renders without the app chrome so it prints clean
  { path: "/reviews/:reviewId/report", element: <ReportPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
