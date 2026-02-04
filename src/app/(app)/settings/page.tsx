import type { Metadata } from 'next';
import { SettingsView } from '@/components/client/SettingsView';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your profile and application settings.',
};

export default function SettingsPage() {
  return <SettingsView />;
}
