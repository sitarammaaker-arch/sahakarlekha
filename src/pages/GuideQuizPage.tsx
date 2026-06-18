/**
 * GuideQuizPage — /guide/quiz/:partId. Wraps GuideQuiz for one भाग with
 * breadcrumb, header and SEO meta.
 */
import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import GuideQuiz from '@/components/guide/GuideQuiz';
import { GUIDE_QUIZZES, QUIZ_PART_IDS } from '@/content/guide/quizzes';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { ChevronRight, Home, HelpCircle } from 'lucide-react';

const GuideQuizPage: React.FC = () => {
  const { partId = '' } = useParams();
  const quiz = GUIDE_QUIZZES[partId];

  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [partId]);

  useDocumentMeta({
    title: quiz ? `${quiz.title} — क्विज़ | सहकार लेखा गाइड` : undefined,
    description: quiz ? `${quiz.title} पर आधारित ${quiz.questions.length} प्रश्नों की क्विज़ — अपना ज्ञान परखें।` : undefined,
    canonicalPath: `/guide/quiz/${partId}`,
  });

  if (!quiz) return <Navigate to="/guide" replace />;

  // next quiz (if any) for the "आगे बढ़ें" button
  const idx = QUIZ_PART_IDS.indexOf(partId);
  const nextPath = idx >= 0 && idx < QUIZ_PART_IDS.length - 1
    ? `/guide/quiz/${QUIZ_PART_IDS[idx + 1]}`
    : '/guide/certificate';

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-8 md:py-12 max-w-3xl">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/guide" className="inline-flex items-center gap-1 hover:text-primary">
            <Home className="h-3.5 w-3.5" /> गाइड
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">क्विज़</span>
        </nav>

        <header className="mb-6 pb-6 border-b">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
            <HelpCircle className="h-3.5 w-3.5" /> क्विज़ · {quiz.questions.length} प्रश्न
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            सभी प्रश्नों के उत्तर चुनकर "उत्तर जाँचें" दबाएँ। 70% या अधिक पर यह भाग उत्तीर्ण।
          </p>
        </header>

        <GuideQuiz quiz={quiz} nextPath={nextPath} />
      </div>
    </PublicLayout>
  );
};

export default GuideQuizPage;
