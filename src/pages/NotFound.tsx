import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

const NotFound = () => {
  const location = useLocation();

  // Soft-404 mitigation: the SPA fallback returns HTTP 200 for unknown URLs, so
  // explicitly tell crawlers this page must not be indexed.
  useDocumentMeta({ title: "पेज नहीं मिला (404) — SahakarLekha", robots: "noindex" });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">यह पेज नहीं मिला · Page not found</p>
        <div className="flex flex-wrap justify-center gap-4 text-primary underline">
          <Link to="/" className="hover:text-primary/90">होम पर जाएँ</Link>
          <Link to="/search" className="hover:text-primary/90">खोजें</Link>
          <Link to="/guide" className="hover:text-primary/90">गाइड</Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
