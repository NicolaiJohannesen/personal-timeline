import type { Metadata } from 'next';
import { TimelineView } from '@/components/client/TimelineView';

export const metadata: Metadata = {
  title: 'Timeline',
  description: 'View your life timeline with events across multiple dimensions.',
};

export default function TimelinePage() {
  return <TimelineView />;
}
