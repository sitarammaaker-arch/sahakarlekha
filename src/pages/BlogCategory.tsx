/**
 * BlogCategory — /blog/category/:cat. One crawlable, shareable hub per topic
 * (src/content/blog/categories.ts): its own title/description/intro, every live
 * post of the category, and CollectionPage + BreadcrumbList JSON-LD. The same page
 * is prerendered by scripts/prerender-guide.mjs (blogCategoryPages) — keep the
 * title, description, h1 and JSON-LD shape in step with it.
 */
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { publishedOrder, postsInCategory } from '@/content/blog';
import { categoryBySlug } from '@/content/blog/categories';
import { fetchBlogViewCounts } from '@/lib/blogViews';
import { CategoryPills, PostGridCard, BlogSearchBox, BlogSearchResults } from '@/components/blog/BlogCards';
import { useBlogSearch } from '@/lib/useBlogSearch';
import { ChevronRight, Home } from 'lucide-react';

const SITE = 'https://sahakarlekha.com';

const BlogCategory: React.FC = () => {
  const { cat = '' } = useParams<{ cat: string }>();
  const category = categoryBySlug(cat);
  const posts = React.useMemo(() => (category ? postsInCategory(category.name) : []), [category]);
  const url = `${SITE}/blog/category/${cat}`;
  const { input, setInput, query, results, searching } = useBlogSearch(posts, cat);

  useDocumentMeta({
    title: category ? category.metaTitle : 'श्रेणी नहीं मिली | सहकार लेखा ब्लॉग',
    description: category?.description,
    canonicalPath: category ? `/blog/category/${category.slug}` : '/blog',
    // ?q= result lists stay out of the index; the canonical is the hub itself
    robots: category && posts.length && !searching ? undefined : 'noindex, follow',
    jsonLd: category ? [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: category.name,
        description: category.description,
        url,
        inLanguage: 'hi',
        isPartOf: { '@type': 'Blog', name: 'सहकार लेखा ब्लॉग', url: `${SITE}/blog` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/blog/${p.slug}`, name: p.title })),
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'होम', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'ब्लॉग', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: category.name, item: url },
        ],
      },
    ] : undefined,
  });

  const [views, setViews] = React.useState<Record<string, number>>({});
  React.useEffect(() => { fetchBlogViewCounts().then(setViews); }, []);
  const liveCategories = React.useMemo(() => new Set(publishedOrder().map((p) => p.category as string)), []);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <nav aria-label="ब्रेडक्रम्ब" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-4">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary"><Home className="h-3.5 w-3.5" aria-hidden="true" /> होम</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to="/blog" className="hover:text-primary">ब्लॉग</Link>
          {category && (
            <>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-foreground/70" aria-current="page">{category.name}</span>
            </>
          )}
        </nav>

        {category ? (
          <>
            <div className="mb-6">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">{category.name}</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-3xl">{category.intro}</p>
              <p className="text-xs text-muted-foreground mt-1">{posts.length} लेख</p>
            </div>
            {posts.length > 0 && <BlogSearchBox value={input} onChange={setInput} scopeName={category.name} />}
            <CategoryPills active={category.slug} liveCategories={liveCategories} />
            {searching ? (
              <BlogSearchResults query={query} results={results} views={views} scopeName={category.name} />
            ) : posts.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {posts.map((post) => <PostGridCard key={post.slug} post={post} views={views[post.slug]} />)}
              </div>
            ) : (
              <p className="text-muted-foreground">इस श्रेणी में अभी कोई लेख नहीं है। <Link to="/blog" className="text-primary hover:underline">सभी लेख देखें</Link>।</p>
            )}
          </>
        ) : (
          <div className="py-12 text-center space-y-3">
            <h1 className="font-serif text-2xl font-bold text-foreground">यह श्रेणी नहीं मिली</h1>
            <p className="text-muted-foreground">लिंक पुराना या ग़लत हो सकता है। <Link to="/blog" className="text-primary hover:underline">सभी लेख देखें</Link>।</p>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default BlogCategory;
