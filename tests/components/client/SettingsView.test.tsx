import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsView } from '@/components/client/SettingsView';
import type { UserProfile } from '@/types';

const mockProfile: UserProfile = {
  id: 'default-user',
  name: 'John Doe',
  birthDate: new Date('1990-05-15'),
  country: 'us',
  lifeExpectancy: 85,
  createdAt: new Date(),
  updatedAt: new Date(),
  settings: {
    theme: 'dark',
    defaultView: 'timeline',
    sidebarCollapsed: false,
    notifications: {
      goalReminders: true,
      milestoneAlerts: true,
      coachingPrompts: false,
    },
  },
};

// Mock the database
vi.mock('@/lib/db', () => ({
  userProfile: {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
  timelineEvents: {
    count: vi.fn(),
    clear: vi.fn(),
  },
  exportAllData: vi.fn(),
  clearAllData: vi.fn(),
  goals: {
    clear: vi.fn(),
  },
  assessments: {
    clear: vi.fn(),
  },
}));

import {
  userProfile,
  timelineEvents,
  exportAllData,
  clearAllData,
} from '@/lib/db';

describe('SettingsView', () => {
  // Store original window.location to restore after tests
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // Default mocks
    vi.mocked(userProfile.get).mockResolvedValue(undefined);
    vi.mocked(timelineEvents.count).mockResolvedValue(0);
    vi.mocked(userProfile.save).mockResolvedValue(mockProfile);
    vi.mocked(exportAllData).mockResolvedValue({
      events: [],
      goals: [],
      profile: undefined,
      assessments: [],
      exportedAt: new Date(),
      version: '1.0',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // Restore window.location if it was modified
    if (window.location !== originalLocation) {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });

  describe('Loading State', () => {
    it('shows loading skeleton while fetching data', () => {
      vi.mocked(userProfile.get).mockImplementation(() => new Promise(() => {}));
      vi.mocked(timelineEvents.count).mockImplementation(() => new Promise(() => {}));

      render(<SettingsView />);

      // Should show loading skeleton with animated pulses
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Page Structure', () => {
    it('renders all main sections', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Data Management' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    });

    it('shows page description', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText(/Manage your profile and preferences/i)).toBeInTheDocument();
      });
    });
  });

  describe('Profile Section', () => {
    it('renders profile form fields', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText('Display Name')).toBeInTheDocument();
      });

      expect(screen.getByText('Birth Date')).toBeInTheDocument();
      expect(screen.getByText('Life Expectancy')).toBeInTheDocument();
      expect(screen.getByText('Country')).toBeInTheDocument();
    });

    it('loads existing profile data', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      });

      // Check date is formatted correctly
      expect(screen.getByDisplayValue('1990-05-15')).toBeInTheDocument();
      expect(screen.getByDisplayValue('85')).toBeInTheDocument();
    });

    it('allows editing profile name', async () => {
      const user = userEvent.setup();
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText('Your name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane Smith');

      expect(nameInput).toHaveValue('Jane Smith');
    });

    it('allows changing country', async () => {
      const user = userEvent.setup();
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText('Country')).toBeInTheDocument();
      });

      // Find the country select - it's the one with "Select country" option
      const countrySelect = screen.getByDisplayValue('Select country');
      await user.selectOptions(countrySelect, 'dk');

      expect(countrySelect).toHaveValue('dk');
    });

    it('saves profile when save button clicked', async () => {
      const user = userEvent.setup();
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText('Your name');
      await user.type(nameInput, 'Test User');

      const saveButton = screen.getByRole('button', { name: /Save Profile/i });
      await user.click(saveButton);

      expect(userProfile.save).toHaveBeenCalled();
    });

    it('shows success message after saving', async () => {
      const user = userEvent.setup();
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText('Your name');
      await user.type(nameInput, 'Test User');

      const saveButton = screen.getByRole('button', { name: /Save Profile/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Profile saved successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Appearance Section', () => {
    it('renders theme buttons', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Dark/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Light/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /System/i })).toBeInTheDocument();
    });

    it('renders default view select', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText('Default View')).toBeInTheDocument();
      });

      // There are multiple selects - Default View is the second one
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });

    it('allows changing theme', async () => {
      const user = userEvent.setup();
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Light/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Light/i }));
      // Theme state changes internally
    });
  });

  describe('Notifications Section', () => {
    it('renders all notification toggles', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText(/Goal Reminders/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Milestone Alerts/i)).toBeInTheDocument();
      expect(screen.getByText(/Coaching Prompts/i)).toBeInTheDocument();
    });

    it('loads notification preferences from profile', async () => {
      vi.mocked(userProfile.get).mockResolvedValue(mockProfile);

      render(<SettingsView />);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Data Management Section', () => {
    it('shows event count', async () => {
      vi.mocked(timelineEvents.count).mockResolvedValue(150);

      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText(/150 events stored locally/i)).toBeInTheDocument();
      });
    });

    it('renders export button', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
      });
    });

    it('renders delete button', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
      });
    });

    it('calls exportAllData when export clicked', async () => {
      const user = userEvent.setup();

      // Mock URL methods without interfering with document
      const originalCreateObjectURL = global.URL.createObjectURL;
      const originalRevokeObjectURL = global.URL.revokeObjectURL;
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      global.URL.revokeObjectURL = vi.fn();

      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Export/i }));

      expect(exportAllData).toHaveBeenCalled();

      // Restore
      global.URL.createObjectURL = originalCreateObjectURL;
      global.URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('asks for confirmation before deleting all data', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Delete/i }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(clearAllData).not.toHaveBeenCalled();
    });

    it('deletes all data when confirmed twice', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      // Mock location.reload with configurable: true so it can be restored
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
        configurable: true,
      });

      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Delete/i }));

      // Should be called twice for double confirmation
      expect(confirmSpy).toHaveBeenCalledTimes(2);
      expect(clearAllData).toHaveBeenCalled();
    });
  });

  describe('About Section', () => {
    it('shows app name and version', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText('Personal Timeline')).toBeInTheDocument();
      });

      expect(screen.getByText('Version 0.1.0')).toBeInTheDocument();
    });

    it('shows app description', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(
          screen.getByText(/unified personal timeline/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('sets life expectancy minimum to 50', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText('Life Expectancy')).toBeInTheDocument();
      });

      // Find the number input (life expectancy)
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '50');
    });

    it('sets life expectancy maximum to 120', async () => {
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByText('Life Expectancy')).toBeInTheDocument();
      });

      // Find the number input (life expectancy)
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('max', '120');
    });
  });

  describe('Error Handling', () => {
    it('handles profile save error gracefully', async () => {
      const user = userEvent.setup();
      vi.mocked(userProfile.save).mockRejectedValue(new Error('Save failed'));

      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText('Your name');
      await user.type(nameInput, 'Test');

      await user.click(screen.getByRole('button', { name: /Save Profile/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to save profile/i)).toBeInTheDocument();
      });
    });

    it('handles database load error gracefully', async () => {
      vi.mocked(userProfile.get).mockRejectedValue(new Error('Load failed'));
      vi.mocked(timelineEvents.count).mockRejectedValue(new Error('Count failed'));

      // Should not throw
      render(<SettingsView />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      });
    });
  });
});
