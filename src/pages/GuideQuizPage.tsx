/**
 * GuideQuizPage — /guide/quiz/:partId (bilingual). Wraps GuideQuiz for one part.
 */
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import GuideQuiz from '@/components/guide/GuideQuiz';
import LangToggle from '@/components/guide/LangToggle';
import { QUIZ_PART_IDS } from '@/content/guide/quizzes';
import { localizedQuiz } from '@/content/guide/quizzes.en';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { useGuideLang, useGuideT } from '@/lib/guideLang';
import { ChevronRight, Home, HelpCircle } from 'lucide-react';

const GuideQuizPage: React.FC = () => {
  const { partId = '' } = useParams();
  const lang = useGuideLang();
  const t = useGuideT();
  const quiz = localizedQuiz(partId, lang);

  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [partId]);

  useDocumentMeta({
    title: quiz ? `${quiz.title} — ${lang === 'en' ? 'Quiz | SahakarLekha Guide' : 'क्विज़ | सहकार लेखा गाइड'}` : undefined,
    description: quiz ? `${quiz.title}: ${quiz.questions.length} ${lang === 'en' ? 'questions to test your knowledge.' : 'प्रश्नों की क्विज़ — अपना ज्ञान परखें।'}` : undefined,
    canonicalPath: `/guide/quiz/${partId}`,
  });

  if (!quiz) return <Navigate to="/guide" replace />;

  const idx = QUIZ_PART_IDS.indexOf(partId);
  const nextPath = idx >= 0 && idx < QUIZ_PART_IDS.length - 1
    ? `/guide/quiz/${QUIZ_PART_IDS[idx + 1]}`
    : '/guide/certificate';

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-8 md:py-12 max-w-3xl">
        <div className="flex items-center justify-between gap-3 mb-6">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            <Link to="/guide" className="inline-flex items-center gap-1 hover:text-primary">
              <Home className="h-3.5 w-3.5" /> {t('ch.home')}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium line-clamp-1">{t('quiz.breadcrumb')}</span>
          </nav>
          <LangToggle className="flex-shrink-0" />
        </div>

        <header className="mb-6 pb-6 border-b">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
            <HelpCircle className="h-3.5 w-3.5" /> {t('quiz.badge', { n: quiz.questions.length })}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">{t('quiz.instructions')}</p>
        </header>

        <GuideQuiz quiz={quiz} nextPath={nextPath} />
      </div>
    </PublicLayout>
  );
};

export default GuideQuizPage;
