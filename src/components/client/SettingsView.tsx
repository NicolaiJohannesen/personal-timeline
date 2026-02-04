'use client';

import { useState, useEffect } from 'react';
import { userProfile, timelineEvents, exportAllData, clearAllData } from '@/lib/db';
import type { UserProfile, UserSettings } from '@/types';

const COUNTRIES = [
  { value: '', label: 'Select country' },
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'dk', label: 'Denmark' },
  { value: 'se', label: 'Sweden' },
  { value: 'no', label: 'Norway' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  defaultView: 'timeline',
  sidebarCollapsed: false,
  notifications: {
    goalReminders: true,
    milestoneAlerts: true,
    coachingPrompts: false,
  },
};

export function SettingsView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Form state
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('');
  const [lifeExpectancy, setLifeExpectancy] = useState(85);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileData, count] = await Promise.all([
          userProfile.get(),
          timelineEvents.count(),
        ]);

        setEventCount(count);

        if (profileData) {
          setProfile(profileData);
          setName(profileData.name || '');
          setBirthDate(
            profileData.birthDate
              ? new Date(profileData.birthDate).toISOString().split('T')[0]
              : ''
          );
          setCountry(profileData.country || '');
          setLifeExpectancy(profileData.lifeExpectancy || 85);
          setSettings(profileData.settings || DEFAULT_SETTINGS);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const now = new Date();
      const profileData: Omit<UserProfile, 'id'> = {
        name,
        birthDate: birthDate ? new Date(birthDate) : now,
        country,
        lifeExpectancy,
        createdAt: profile?.createdAt || now,
        updatedAt: now,
        settings,
      };

      await userProfile.save(profileData);
      setProfile({ ...profileData, id: 'default-user' });
      setSaveStatus('saved');

      // Auto-clear status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personal-timeline-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        'Are you sure you want to delete ALL your data? This action cannot be undone.'
      )
    ) {
      return;
    }

    if (
      !confirm(
        'This will permanently delete all your timeline events, goals, assessments, and profile. Continue?'
      )
    ) {
      return;
    }

    try {
      await clearAllData();
      setProfile(null);
      setName('');
      setBirthDate('');
      setCountry('');
      setLifeExpectancy(85);
      setSettings(DEFAULT_SETTINGS);
      setEventCount(0);
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete data:', error);
    }
  };

  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateNotification = (
    key: keyof UserSettings['notifications'],
    value: boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  };

  if (isLoading) {
    return (
      <div className="fade-in max-w-3xl">
        <div className="mb-8">
          <div className="h-9 w-48 bg-[var(--color-bg-secondary)] rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-[var(--color-bg-secondary)] rounded animate-pulse" />
        </div>
        <div className="space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-[var(--color-text-secondary)]">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Profile</h2>
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Display Name
            </label>
            <input
              type="text"
              className="input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Birth Date
              </label>
              <input
                type="date"
                className="input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Life Expectancy
              </label>
              <input
                type="number"
                className="input"
                value={lifeExpectancy}
                onChange={(e) => setLifeExpectancy(Number(e.target.value))}
                min={50}
                max={120}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Country
            </label>
            <select
              className="input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="btn btn-primary"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
            {saveStatus === 'saved' && (
              <span className="text-sm text-green-500">Profile saved successfully!</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-[var(--color-error)]">
                Failed to save profile
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Appearance</h2>
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Theme
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => updateSetting('theme', 'dark')}
                className={`btn flex-1 ${
                  settings.theme === 'dark' ? 'btn-secondary' : 'btn-ghost'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
                Dark
              </button>
              <button
                onClick={() => updateSetting('theme', 'light')}
                className={`btn flex-1 ${
                  settings.theme === 'light' ? 'btn-secondary' : 'btn-ghost'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                Light
              </button>
              <button
                onClick={() => updateSetting('theme', 'auto')}
                className={`btn flex-1 ${
                  settings.theme === 'auto' ? 'btn-secondary' : 'btn-ghost'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                System
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Default View
            </label>
            <select
              className="input"
              value={settings.defaultView}
              onChange={(e) =>
                updateSetting('defaultView', e.target.value as UserSettings['defaultView'])
              }
            >
              <option value="timeline">Timeline</option>
              <option value="insights">Insights</option>
              <option value="dreamboard">Dreamboard</option>
              <option value="coach">AI Coach</option>
            </select>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Notifications</h2>
        <div className="card space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Goal Reminders</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Get notified about upcoming milestones
              </div>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)]"
              checked={settings.notifications.goalReminders}
              onChange={(e) => updateNotification('goalReminders', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Milestone Alerts</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Celebrate when you complete milestones
              </div>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)]"
              checked={settings.notifications.milestoneAlerts}
              onChange={(e) => updateNotification('milestoneAlerts', e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Coaching Prompts</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Receive periodic check-ins from AI Coach
              </div>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)]"
              checked={settings.notifications.coachingPrompts}
              onChange={(e) => updateNotification('coachingPrompts', e.target.checked)}
            />
          </label>
        </div>
      </section>

      {/* Data Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Data Management</h2>
        <div className="card space-y-4">
          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] rounded-lg">
            <div>
              <div className="font-medium">Timeline Events</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {eventCount.toLocaleString()} events stored locally
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Export All Data</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Download a complete backup of your timeline
              </div>
            </div>
            <button onClick={handleExport} className="btn btn-secondary">
              Export
            </button>
          </div>
          <div className="border-t border-[var(--color-border-subtle)] pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--color-error)]">Delete All Data</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Permanently remove all your data
                </div>
              </div>
              <button
                onClick={handleDeleteAll}
                className="btn btn-ghost text-[var(--color-error)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="card">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-[var(--color-accent-primary)] flex items-center justify-center">
              <svg
                className="w-6 h-6 text-[var(--color-bg-primary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <div className="font-semibold">Personal Timeline</div>
              <div className="text-sm text-[var(--color-text-muted)]">Version 0.1.0</div>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            A unified personal timeline that consolidates life data across multiple
            dimensions with AI coaching. All data is stored locally on your device.
          </p>
        </div>
      </section>
    </div>
  );
}

export default SettingsView;
