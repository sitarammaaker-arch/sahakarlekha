/**
 * AuthorProfile — /author/:slug. A real-person author page (E-E-A-T): photo/
 * initials, name + role, bio, qualifications, experience, and the author's
 * articles. Emits Person + ProfilePage schema.
 */
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { AUTHORS, DEFAULT_AUTHOR_SLUG, authorInitials, type Author } from '@/content/blog/authors';
import { publishedOrder, readingMinutes } from '@/content/blog';
import { formatDate } from '@/components/blog/blogTheme';
import { GraduationCap, Briefcase, ArrowUpRight, Calendar, Clock, Home, ChevronRight } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

/** Posts attributed to this author (single-author site → the default author owns all). */
function postsFor(author: Author) {
  return publishedOrder().filter((p) => ((p as { author?: string }).author || DEFAULT_AUTHOR_SLUG) === author.slug);
}

const AuthorProfile: React.FC = () => {
  const { slug = '' } = useParams();
  const author = AUTHORS[slug];

  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  useDocumentMeta({
    title: author ? `${author.name} — ${author.designation} | सहकार लेखा` : undefined,
    description: author?.tagline,
    canonicalPath: `/author/${slug}`,
    jsonLd: author ? [
      {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
          '@type': 'Person',
          name: author.name,
          jobTitle: author.designation,
          description: author.tagline,
          url: `${SITE}/author/${author.slug}`,
          ...(author.photo ? { image: `${SITE}${author.photo}` } : {}),
          worksFor: { '@type': 'Organization', name: 'SahakarLekha', url: SITE },
          alumniOf: author.alumniOf.map((a) => ({ '@type': 'Organization', name: a })),
          knowsAbout: author.knowsAbout,
          ...(author.socials?.length ? { sameAs: author.socials.map((s) => s.href) } : {}),
        },
      },
    ] : undefined,
  });

  if (!author) return <Navigate to="/blog" replace />;

  const posts = postsFor(author);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-8">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" /> होम</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/blog" className="hover:text-primary">ब्लॉग</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground/70">{author.name}</span>
        </nav>

        {/* Identity */}
        <div className="flex items-center gap-4">
          {author.photo ? (
            <img src={author.photo} alt={author.name} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
              {authorInitials(author.name)}
            </span>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{author.name}</h1>
            <p className="text-primary font-medium">{author.designation} · सहकार लेखा</p>
            <p className="text-muted-foreground mt-1">{author.tagline}</p>
          </div>
        </div>

        {author.socials?.length ? (
          <div className="flex flex-wrap gap-2 mt-4">
            {author.socials.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
                {s.label} <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        ) : null}

        {/* Credentials + experience */}
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <Card>
            <CardContent className="p-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
                <GraduationCap className="h-4 w-4 text-primary" /> योग्यता / Qualifications
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-4">
                {author.credentials.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
                <Briefcase className="h-4 w-4 text-primary" /> अनुभव / Experience
              </p>
              <ul className="space-y-3">
                {author.experience.map((e) => (
                  <li key={e.field} className="flex items-baseline gap-3">
                    <span className="text-xl font-bold text-primary">{e.years}</span>
                    <span className="text-sm text-muted-foreground">वर्ष · {e.field}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Author's articles */}
        {posts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-foreground mb-1">{author.name} के लेख</h2>
            <p className="text-sm text-muted-foreground mb-6">{posts.length} लेख</p>
            <div className="divide-y">
              {posts.map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`} className="group block py-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">{post.category}</span>
                  <h3 className="font-serif text-lg font-bold text-foreground leading-snug mt-1 group-hover:text-primary transition-colors">
                    {post.shortTitle}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{post.excerpt}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(post.date)}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingMinutes(post.slug)} मिनट पढ़ें</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PublicLayout>
  );
};

export default AuthorProfile;
