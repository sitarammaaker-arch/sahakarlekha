import { useLocation, useNavigate } from 'react-router-dom';
import { Link } from '@/components/LocalLink';
import { useEffect, useState } from "react";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === "hi" ? hi : en);

  // Soft-404 mitigation: the SPA fallback returns HTTP 200 for unknown URLs, so
  // explicitly tell crawlers this page must not be indexed.
  useDocumentMeta({ title: L("पेज नहीं मिला (404) — SahakarLekha", "Page not found (404) — SahakarLekha"), robots: "noindex" });

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
          {L("यह पेज नहीं मिला", "This page was not found")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {L("Page not found — शायद लिंक बदल गया है या पता ग़लत टाइप हुआ है।", "Page not found — the link may have changed or the address was mistyped.")}
        </p>

        {/* Search — the fastest way back to something useful */}
        <form onSubmit={onSearch} className="mt-8 flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={L("खोजें… जैसे 'रसीद', 'GST', 'trial balance'", "Search… e.g. 'receipt', 'GST', 'trial balance'")}
            aria-label={L("सहकार लेखा में खोजें", "Search SahakarLekha")}
            className="h-11"
          />
          <Button type="submit" className="h-11 shrink-0">
            <Search className="h-4 w-4 mr-1.5" /> {L("खोजें", "Search")}
          </Button>
        </form>

        {/* Primary way home */}
        <div className="mt-6">
          <Button asChild size="lg" variant="default">
            <Link to="/">
              <Home className="h-4 w-4 mr-1.5" /> {L("होम पर जाएँ", "Go to home")}
            </Link>
          </Button>
        </div>

        {/* Helpful secondary links */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link to="/guide" className="text-primary hover:underline">{L("गाइड", "Guide")}</Link>
          <Link to="/cookbook" className="text-primary hover:underline">{L("एंट्री कुकबुक", "Entry cookbook")}</Link>
          <Link to="/help" className="text-primary hover:underline">{L("मदद केंद्र", "Help")}</Link>
          <Link to="/ask" className="text-primary hover:underline">{L("पूछें", "Ask")}</Link>
          <Link to="/contact" className="text-primary hover:underline">{L("संपर्क", "Contact")}</Link>
        </div>
      </div>
    </PublicLayout>
  );
};

export default NotFound;
