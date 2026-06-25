/**
 * Testimonials — shows admin-approved reviews (via the public_reviews() RPC,
 * safe columns only) and lets visitors submit their own rating below.
 * Hides the reviews grid gracefully when there are none yet.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { Card, CardContent } from '@/components/ui/card';
import RatingWidget from '@/components/RatingWidget';
import { Star, Quote } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

interface Review {
  id: string;
  name: string | null;
  rating: number | null;
  message: string | null;
  created_at: string;
}

const Stars: React.FC<{ n: number }> = ({ n }) => (
  <div className="flex gap-0.5" aria-label={`${n} स्टार`}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} className={`h-4 w-4 ${i <= n ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
    ))}
  </div>
);

const Testimonials: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('public_reviews');
        if (!error && alive) setReviews((data as Review[]) || []);
      } catch { /* fail-soft: just show the rating form */ }
    })();
    return () => { alive = false; };
  }, []);

  const rated = reviews.filter(r => typeof r.rating === 'number');
  const avg = rated.length ? rated.reduce((s, r) => s + (r.rating || 0), 0) / rated.length : 0;

  // SEO: SoftwareApplication + AggregateRating + Review JSON-LD → eligible for
  // ★ rich results. Only emitted when real, on-page reviews exist (Google policy).
  const jsonLd = rated.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SahakarLekha',
    url: SITE,
    image: `${SITE}/og-image.png`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: avg.toFixed(1),
      reviewCount: String(rated.length),
      bestRating: '5',
      worstRating: '1',
    },
    review: rated.filter(r => r.message).slice(0, 5).map(r => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.name || 'एक सदस्य' },
      reviewRating: { '@type': 'Rating', ratingValue: String(r.rating), bestRating: '5' },
      reviewBody: r.message,
      ...(r.created_at ? { datePublished: r.created_at.slice(0, 10) } : {}),
    })),
  } : undefined;
  useDocumentMeta({ jsonLd });

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">हमारे उपयोगकर्ता क्या कहते हैं</h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">सहकारी समितियों, सचिवों व लेखाकारों के असली अनुभव।</p>
          {rated.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-950/30 px-4 py-1.5">
              <Stars n={Math.round(avg)} />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {avg.toFixed(1)} / 5 · {rated.length}+ समीक्षाएँ
              </span>
            </div>
          )}
        </div>

        {reviews.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {reviews.map(r => (
              <Card key={r.id} className="h-full">
                <CardContent className="p-5 flex flex-col h-full">
                  <Quote className="h-6 w-6 text-primary/30 mb-2" aria-hidden="true" />
                  {typeof r.rating === 'number' && <Stars n={r.rating} />}
                  {r.message && <p className="text-sm text-foreground/90 mt-3 flex-1">{r.message}</p>}
                  <p className="text-sm font-semibold text-foreground mt-4">{r.name || 'एक सदस्य'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="max-w-xl mx-auto">
          <RatingWidget />
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
