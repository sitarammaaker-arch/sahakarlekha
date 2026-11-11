/**
 * Shown in place of a page whose feature the society's plan does not include (CapabilityGuard).
 * Says which plan has it and sends the admin to where a plan is bought. Nothing here writes data.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { PLAN_CATALOG, PLAN_FEATURE_LABEL, minPlanFor, priceLabel, type PlanFeature } from '@/lib/plans';

const PLAN_NAME = { plus: 'Plus', pro: 'Pro' } as const;

const PlanUpgradeNotice: React.FC<{ feature: PlanFeature }> = ({ feature }) => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const need = minPlanFor(feature);
  const name = PLAN_NAME[need];
  const price = `${priceLabel(PLAN_CATALOG[need].price)} + GST`;
  const label = PLAN_FEATURE_LABEL[feature];

  return (
    <div className="p-6 flex justify-center">
      <Card className="max-w-lg w-full">
        <CardContent className="p-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">
            {hi ? `${label.hi} — ${name} plan में` : `${label.en} — on the ${name} plan`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {hi
              ? `यह सुविधा आपके मौजूदा plan में शामिल नहीं है। ${name} plan (${price}/साल) लेने पर यह तुरंत खुल जाएगी। आपका बाकी सारा हिसाब पहले की तरह चलता रहेगा।`
              : `This feature is not part of your current plan. It opens as soon as you take the ${name} plan (${price}/year). Everything else keeps working as before.`}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/user-management">
              <Button>{hi ? `${name} plan लें` : `Get ${name}`}</Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline">{hi ? 'Plans की तुलना देखें' : 'Compare plans'}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanUpgradeNotice;
