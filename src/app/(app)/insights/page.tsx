import type { Metadata } from 'next';
import { InsightsView } from '@/components/client/InsightsView';

export const metadata: Metadata = {
  title: 'Insights',
  description: 'Analytics and insights comparing your data to global averages.',
};

export default function InsightsPage() {
  return <InsightsView />;
}
