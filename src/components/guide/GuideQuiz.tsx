/**
 * GuideQuiz — interactive multiple-choice quiz for one भाग. Scores on submit,
 * reveals correct answers + explanations, and marks the part-quiz passed
 * (≥70%) so the completion certificate can unlock.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RotateCcw, Award, ArrowRight } from 'lucide-react';
import type { PartQuiz } from '@/content/guide/quizzes';
import { setQuizPassed } from '@/lib/guideQuiz';
import { useGuideLang, useGuideT } from '@/lib/guideLang';

const PASS_PCT = 70;

const GuideQuiz: React.FC<{ quiz: PartQuiz; nextPath?: string }> = ({ quiz, nextPath }) => {
  const lang = useGuideLang();
  const t = useGuideT();
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [submitted, setSubmitted] = React.useState(false);

  const total = quiz.questions.length;
  const correct = quiz.questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= PASS_PCT;
  const allAnswered = Object.keys(answers).length === total;

  const submit = () => {
    setSubmitted(true);
    setQuizPassed(quiz.partId, passed);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const retry = () => {
    setAnswers({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {submitted && (
        <Card className={`mb-6 ${passed ? 'border-green-400 bg-green-50 dark:bg-green-950/30' : 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'}`}>
          <CardContent className="p-5 text-center">
            {passed ? (
              <Award className="h-10 w-10 text-green-600 mx-auto mb-2" />
            ) : (
              <RotateCcw className="h-10 w-10 text-amber-600 mx-auto mb-2" />
            )}
            <p className="text-2xl font-bold text-foreground">{t('quiz.score', { correct, total, pct })}</p>
            <p className={`mt-1 font-medium ${passed ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {passed ? t('quiz.passed') : t('quiz.failed', { pct: PASS_PCT })}
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              <Button variant="outline" onClick={retry} className="gap-2">
                <RotateCcw className="h-4 w-4" /> {t('quiz.retry')}
              </Button>
              {passed && nextPath && (
                <Link to={nextPath}><Button className="gap-2">{t('quiz.gonext')} <ArrowRight className="h-4 w-4" /></Button></Link>
              )}
              {passed && (
                <Link to="/guide/certificate"><Button variant="secondary" className="gap-2"><Award className="h-4 w-4" /> {t('quiz.cert')}</Button></Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-5">
        {quiz.questions.map((qq, qi) => {
          const sel = answers[qi];
          return (
            <Card key={qi}>
              <CardContent className="p-4 sm:p-5">
                <p className="font-semibold text-foreground mb-3">
                  <span className="text-primary">{t('quiz.qprefix')}{qi + 1}</span> {qq.q}
                </p>
                <div className="space-y-2">
                  {qq.options.map((opt, oi) => {
                    const chosen = sel === oi;
                    const isCorrect = oi === qq.answer;
                    let style = 'border-border hover:border-primary/50';
                    if (submitted) {
                      if (isCorrect) style = 'border-green-400 bg-green-50 dark:bg-green-950/30';
                      else if (chosen) style = 'border-red-400 bg-red-50 dark:bg-red-950/30';
                      else style = 'border-border opacity-70';
                    } else if (chosen) {
                      style = 'border-primary bg-primary/5';
                    }
                    return (
                      <button
                        key={oi}
                        disabled={submitted}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        className={`w-full text-left flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${style}`}
                      >
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs ${chosen && !submitted ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                          {(lang === 'en' ? ['A', 'B', 'C', 'D'] : ['क', 'ख', 'ग', 'घ'])[oi]}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {submitted && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                        {submitted && chosen && !isCorrect && <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {submitted && (
                  <p className="mt-3 text-sm text-muted-foreground border-l-2 border-primary/40 pl-3">
                    💡 {qq.explain}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!submitted && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button onClick={submit} disabled={!allAnswered} size="lg" className="gap-2">
            {t('quiz.check', { done: Object.keys(answers).length, total })}
          </Button>
          {!allAnswered && <p className="text-xs text-muted-foreground">{t('quiz.answerall')}</p>}
        </div>
      )}
    </div>
  );
};

export default GuideQuiz;
