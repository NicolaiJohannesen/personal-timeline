import type { Metadata } from 'next';
import { ImportWizard } from '@/components/client/ImportWizard';

export const metadata: Metadata = {
  title: 'Import Data',
  description: 'Import your data from social media and other sources.',
};

export default function ImportPage() {
  return <ImportWizard />;
}
