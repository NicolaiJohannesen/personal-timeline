// Core data types for Personal Timeline application

export type DataLayer =
  | 'economics'
  | 'education'
  | 'work'
  | 'health'
  | 'relationships'
  | 'travel'
  | 'media';

export type EventSource =
  | 'manual'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'google'
  | 'ical'
  | 'spotify'
  | 'apple'
  | 'other';

export type GoalCategory =
  | 'career'
  | 'health'
  | 'finance'
  | 'personal'
  | 'relationship'
  | 'travel';

export type GoalStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

export type GoalPriority = 'high' | 'medium' | 'low';

// Timeline Event
export interface TimelineEvent {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  layer: DataLayer;
  eventType: string;
  source: EventSource;
  sourceId?: string;
  location?: GeoLocation;
  media?: MediaAttachment[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  name?: string;
  city?: string;
  country?: string;
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'document';
  url: string;
  thumbnail?: string;
  caption?: string;
}

// Goals & Milestones
export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: GoalCategory;
  targetDate?: Date;
  priority: GoalPriority;
  status: GoalStatus;
  milestones: Milestone[];
  order: number; // Position for custom ordering in Dreamboard
  createdAt: Date;
  updatedAt: Date;
}

export interface Milestone {
  id: string;
  title: string;
  targetDate?: Date;
  completed: boolean;
  completedAt?: Date;
}

// User Profile
export interface UserProfile {
  id: string;
  name: string;
  birthDate: Date;
  country?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  lifeExpectancy?: number;
  createdAt: Date;
  updatedAt: Date;
  settings: UserSettings;
}

export interface UserSettings {
  theme: 'dark' | 'light' | 'auto';
  defaultView: 'timeline' | 'insights' | 'dreamboard' | 'coach';
  sidebarCollapsed: boolean;
  notifications: NotificationSettings;
  ai?: AISettings;
}

export interface NotificationSettings {
  goalReminders: boolean;
  milestoneAlerts: boolean;
  coachingPrompts: boolean;
}

// AI Coach Settings
export type AIProvider = 'anthropic' | 'none';

export interface AISettings {
  provider: AIProvider;
  apiKey?: string;
  model: string;
}

// Assessment Results
export type AssessmentType =
  | 'iq'
  | 'personality_big5'
  | 'personality_mbti'
  | 'risk_tolerance'
  | 'values'
  | 'fire_projection';

export interface AssessmentResult {
  id: string;
  userId?: string;
  assessmentType: AssessmentType;
  completedAt: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scores: Record<string, any>;
  duration: number; // seconds
}

// Navigation
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

// View state
export type MainView = 'timeline' | 'insights' | 'dreamboard' | 'coach' | 'import' | 'assessments' | 'settings';
