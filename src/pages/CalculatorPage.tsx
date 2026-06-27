/**
 * CalculatorPage — /tools/:slug. Looks up the registry config and renders the shared
 * CalculatorShell. Unknown slugs bounce to the hub.
 */
import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import CalculatorShell from '@/components/calculators/CalculatorShell';
import { findCalculator } from '@/content/calculators';

const CalculatorPage: React.FC = () => {
  const { slug = '' } = useParams();
  const config = findCalculator(slug);
  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);
  if (!config) return <Navigate to="/tools" replace />;
  return <CalculatorShell config={config} />;
};

export default CalculatorPage;
