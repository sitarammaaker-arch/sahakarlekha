/**
 * GuideVerify — /guide/verify. Public certificate verification. Anyone can
 * enter a certificate number + holder name to confirm it is valid; the number
 * is a self-validating code (see lib/guideCertId).
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { verifyCertNumber, formatCertDate } from '@/lib/guideCertId';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, ShieldX, Home, ChevronRight, Award, Search, Loader2 } from 'lucide-react';

const GuideVerify: React.FC = () => {
  useDocumentMeta({
    title: 'प्रमाणपत्र सत्यापन — सहकार लेखा गाइड',
    description: 'सहकार लेखा गाइड के पूर्णता प्रमाणपत्र को क्रमांक व नाम से सत्यापित करें।',
    canonicalPath: '/guide/verify',
  });

  const [params] = useSearchParams();
  const [number, setNumber] = React.useState(params.get('id') || '');
  const [name, setName] = React.useState('');
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState<null | { valid: boolean; isoDate?: string; name: string }>(null);

  const check = async () => {
    if (!number.trim() || !name.trim()) return;
    setChecking(true);
    try {
      // Authoritative: look up the server registry.
      const { data, error } = await supabase.rpc('verify_certificate', {
        p_cert_no: number.trim(),
        p_name: name.trim(),
      });
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        setResult({
          valid: true,
          isoDate: data[0].issued_at ? String(data[0].issued_at).slice(0, 10) : undefined,
          name: data[0].holder_name || name.trim(),
        });
      } else {
        // Reachable but no record yet → fall back to the self-validating code.
        const r = verifyCertNumber(number, name);
        setResult({ ...r, name: name.trim() });
      }
    } catch {
      // Server unavailable / migration not run → self-validating fallback.
      const r = verifyCertNumber(number, name);
      setResult({ ...r, name: name.trim() });
    }
    setChecking(false);
  };

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-8 md:py-12 max-w-xl">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/guide" className="inline-flex items-center gap-1 hover:text-primary">
            <Home className="h-3.5 w-3.5" /> गाइड
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">प्रमाणपत्र सत्यापन</span>
        </nav>

        <div className="text-center mb-7">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">प्रमाणपत्र सत्यापन</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            प्रमाणपत्र पर छपा क्रमांक व धारक का नाम दर्ज करें।
          </p>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">प्रमाणपत्र क्रमांक</label>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="SL-20260618-AB12CD"
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">धारक का नाम</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && check()}
                placeholder="जैसा प्रमाणपत्र पर लिखा है"
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button onClick={check} disabled={!number.trim() || !name.trim() || checking} className="w-full gap-2">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} सत्यापित करें
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className={`mt-5 ${result.valid ? 'border-green-400 bg-green-50 dark:bg-green-950/30' : 'border-red-400 bg-red-50 dark:bg-red-950/30'}`}>
            <CardContent className="p-5 text-center">
              {result.valid ? (
                <>
                  <ShieldCheck className="h-10 w-10 text-green-600 mx-auto mb-2" />
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">✓ वैध प्रमाणपत्र</p>
                  <div className="mt-3 text-sm text-foreground space-y-1">
                    <p><span className="text-muted-foreground">धारक:</span> <span className="font-semibold">{result.name}</span></p>
                    {result.isoDate && <p><span className="text-muted-foreground">जारी दिनांक:</span> <span className="font-semibold">{formatCertDate(result.isoDate)}</span></p>}
                    <p className="flex items-center justify-center gap-1.5 mt-2 text-muted-foreground">
                      <Award className="h-4 w-4 text-primary" /> सहकार लेखा सम्पूर्ण Accounting कोर्स
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ShieldX className="h-10 w-10 text-red-600 mx-auto mb-2" />
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">✗ सत्यापन असफल</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    क्रमांक व नाम मेल नहीं खाते, या क्रमांक का प्रारूप गलत है। कृपया प्रमाणपत्र पर लिखा सही क्रमांक व नाम दर्ज करें।
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6">
          यह कोड प्रमाणपत्र के क्रमांक, धारक-नाम व जारी-तिथि के परस्पर मेल की पुष्टि करता है।
        </p>
      </div>
    </PublicLayout>
  );
};

export default GuideVerify;
