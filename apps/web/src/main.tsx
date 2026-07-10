import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams,
} from "react-router-dom";
import "allotment/dist/style.css";
import App from "./App";
import { ApiKeysPage } from "./pages/ApiKeys";
import { DocsPage } from "./pages/Docs";
import { PlatformHome } from "./pages/Platform";
import { PlaygroundPage } from "./pages/Playground";
import { ReferencePage } from "./pages/Reference";
import { ReportPage } from "./pages/Report";
import { ReviewPage } from "./pages/Review";
import "./index.css";

const queryClient = new QueryClient();

// pre-SDK bookmarks: /reviews/:id → /playground/reviews/:id
function LegacyReviewRedirect({ report = false }: { report?: boolean }) {
  const { reviewId } = useParams();
  return (
    <Navigate
      replace
      to={`/playground/reviews/${reviewId}${report ? "/report" : ""}`}
    />
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <PlatformHome /> },
      { path: "playground", element: <PlaygroundPage /> },
      { path: "docs", element: <DocsPage /> },
      { path: "reference", element: <ReferencePage /> },
      { path: "playground/reviews/:reviewId", element: <ReviewPage /> },
      // "/keys", not "/api-keys" — the /api prefix is claimed by the dev proxy
      { path: "keys", element: <ApiKeysPage /> },
      { path: "reviews/:reviewId", element: <LegacyReviewRedirect /> },
    ],
  },
  // report renders without the app chrome so it prints clean
  { path: "/playground/reviews/:reviewId/report", element: <ReportPage /> },
  {
    path: "/reviews/:reviewId/report",
    element: <LegacyReviewRedirect report />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
