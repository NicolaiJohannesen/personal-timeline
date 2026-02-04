import type { Metadata } from 'next';
import { DreamboardView } from '@/components/client/DreamboardView';

export const metadata: Metadata = {
  title: 'Dreamboard',
  description: 'Visualize and plan your future goals and milestones.',
};

export default function DreamboardPage() {
  return <DreamboardView />;
}
