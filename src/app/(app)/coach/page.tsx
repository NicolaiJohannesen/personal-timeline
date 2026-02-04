import type { Metadata } from 'next';
import { CoachView } from '@/components/client/CoachView';

export const metadata: Metadata = {
  title: 'AI Coach',
  description: 'Get personalized coaching and guidance from your AI assistant.',
};

export default function CoachPage() {
  return <CoachView />;
}
