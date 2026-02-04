import type { Metadata } from 'next';
import { AssessmentsView } from '@/components/client/AssessmentsView';

export const metadata: Metadata = {
  title: 'Assessments',
  description: 'Take personality, IQ, and other self-assessment tests.',
};

export default function AssessmentsPage() {
  return <AssessmentsView />;
}
