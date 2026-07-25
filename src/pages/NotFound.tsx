import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  // Soft-404 mitigation: the SPA fallback returns HTTP 200 for unknown URLs, so
  // explicitly tell crawlers this page must not be indexed.
  useDocumentMeta({ title: "पेज नहीं मिला (404) — SahakarLekha", robots: "noindex" });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-xl px-4 py-16 sm:py-24 text-center">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          यह पेज नहीं मिला
        </h1>
        <p className="mt-2 text-muted-foreground">
          Page not found — शायद लिंक बदल गया है या पता ग़लत टाइप हुआ है।
        </p>

        {/* Search — the fastest way back to something useful */}
        <form onSubmit={onSearch} className="mt-8 flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="खोजें… जैसे 'रसीद', 'GST', 'trial balance'"
            aria-label="Search SahakarLekha"
            className="h-11"
          />
          <Button type="submit" className="h-11 shrink-0">
            <Search className="h-4 w-4 mr-1.5" /> खोजें
          </Button>
        </form>

        {/* Primary way home */}
        <div className="mt-6">
          <Button asChild size="lg" variant="default">
            <Link to="/">
              <Home className="h-4 w-4 mr-1.5" /> होम पर जाएँ
            </Link>
          </Button>
        </div>

        {/* Helpful secondary links */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link to="/guide" className="text-primary hover:underline">गाइड / Guide</Link>
          <Link to="/cookbook" className="text-primary hover:underline">एंट्री कुकबुक</Link>
          <Link to="/help" className="text-primary hover:underline">मदद केंद्र / Help</Link>
          <Link to="/ask" className="text-primary hover:underline">पूछें / Ask</Link>
          <Link to="/contact" className="text-primary hover:underline">संपर्क / Contact</Link>
        </div>
      </div>
    </PublicLayout>
  );
};

export default NotFound;
