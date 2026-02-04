'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoalForm } from './GoalForm';
import { goals as goalsDb } from '@/lib/db';
import type { Goal, GoalCategory, GoalStatus } from '@/types';
import { createAbortController } from '@/lib/utils/asyncCleanup';

// Goal templates for quick creation
const GOAL_TEMPLATES: Array<{ title: string; category: GoalCategory; description: string }> = [
  { title: 'Get promoted', category: 'career', description: 'Achieve a promotion or new role at work' },
  { title: 'Learn a new skill', category: 'career', description: 'Master a new professional skill or certification' },
  { title: 'Lose weight', category: 'health', description: 'Reach target weight through diet and exercise' },
  { title: 'Run a marathon', category: 'health', description: 'Train for and complete a full marathon' },
  { title: 'Build emergency fund', category: 'finance', description: 'Save 3-6 months of expenses' },
  { title: 'Pay off debt', category: 'finance', description: 'Become debt-free by paying off all loans' },
  { title: 'Learn a language', category: 'personal', description: 'Achieve conversational fluency in a new language' },
  { title: 'Read 24 books', category: 'personal', description: 'Read 2 books per month for a year' },
  { title: 'Strengthen relationships', category: 'relationship', description: 'Spend more quality time with family and friends' },
  { title: 'Visit 5 new countries', category: 'travel', description: 'Explore new destinations around the world' },
];

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  career: 'var(--color-layer-work)',
  health: 'var(--color-layer-health)',
  finance: 'var(--color-layer-economics)',
  personal: 'var(--color-accent-primary)',
  relationship: 'var(--color-layer-relationships)',
  travel: 'var(--color-layer-travel)',
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

export function DreamboardView() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [filter, setFilter] = useState<GoalCategory | 'all'>('all');
  const [draggedGoalId, setDraggedGoalId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateGoal, setTemplateGoal] = useState<Partial<Goal> | undefined>();

  // Load goals from IndexedDB with proper cleanup
  useEffect(() => {
    const { isAborted, cleanup } = createAbortController();

    const loadGoals = async () => {
      try {
        const data = await goalsDb.getAll();

        // Check if component unmounted during async operation
        if (isAborted()) return;

        // Handle migration: assign order to goals without one
        const goalsNeedingOrder = data.filter((g) => g.order === undefined || g.order === null);
        if (goalsNeedingOrder.length > 0) {
          // Sort existing goals by createdAt as fallback
          const sortedData = [...data].sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
            if (a.order !== undefined) return -1;
            if (b.order !== undefined) return 1;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });

          // Assign order values
          const updates: Array<{ id: string; order: number }> = [];
          sortedData.forEach((goal, index) => {
            if (goal.order === undefined || goal.order === null) {
              goal.order = index;
              updates.push({ id: goal.id, order: index });
            }
          });

          // Persist the order values
          if (updates.length > 0) {
            await goalsDb.updateOrder(updates);
          }

          setGoals(sortedData);
        } else {
          // Sort by order field
          const sortedData = [...data].sort((a, b) => a.order - b.order);
          setGoals(sortedData);
        }
      } catch (error) {
        if (isAborted()) return;
        console.error('Failed to load goals:', error);
      } finally {
        if (!isAborted()) {
          setIsLoading(false);
        }
      }
    };

    loadGoals();

    return cleanup;
  }, []);

  const handleGoalSuccess = (goal: Goal) => {
    if (editingGoal) {
      // Update existing goal in list
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
    } else {
      // Add new goal to list
      setGoals((prev) => [...prev, goal]);
    }
    setShowForm(false);
    setEditingGoal(undefined);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      await goalsDb.delete(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  const handleUpdateStatus = async (goal: Goal, newStatus: GoalStatus) => {
    const updatedGoal: Goal = {
      ...goal,
      status: newStatus,
      updatedAt: new Date(),
    };

    try {
      await goalsDb.update(updatedGoal);
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? updatedGoal : g)));
    } catch (error) {
      console.error('Failed to update goal status:', error);
    }
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((goalId: string) => {
    setDraggedGoalId(goalId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (targetGoalId: string) => {
    if (!draggedGoalId || draggedGoalId === targetGoalId) {
      setDraggedGoalId(null);
      return;
    }

    // Calculate new order
    const newGoals = [...goals];
    const draggedIndex = newGoals.findIndex((g) => g.id === draggedGoalId);
    const targetIndex = newGoals.findIndex((g) => g.id === targetGoalId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedGoalId(null);
      return;
    }

    const [draggedGoal] = newGoals.splice(draggedIndex, 1);
    newGoals.splice(targetIndex, 0, draggedGoal);

    // Update order field for each goal
    const updates: Array<{ id: string; order: number }> = [];
    newGoals.forEach((goal, index) => {
      if (goal.order !== index) {
        goal.order = index;
        updates.push({ id: goal.id, order: index });
      }
    });

    // Update local state immediately
    setGoals(newGoals);
    setDraggedGoalId(null);

    // Persist to database
    if (updates.length > 0) {
      try {
        await goalsDb.updateOrder(updates);
      } catch (error) {
        console.error('Failed to persist goal order:', error);
      }
    }
  }, [draggedGoalId, goals]);

  const handleDragEnd = useCallback(() => {
    setDraggedGoalId(null);
  }, []);

  // Template selection handler
  const handleSelectTemplate = (template: typeof GOAL_TEMPLATES[0]) => {
    setTemplateGoal({
      title: template.title,
      description: template.description,
      category: template.category,
    });
    setShowTemplates(false);
    setShowForm(true);
  };

  const filteredGoals =
    filter === 'all' ? goals : goals.filter((g) => g.category === filter);

  const activeGoals = filteredGoals.filter(
    (g) => g.status === 'not_started' || g.status === 'in_progress'
  );
  const completedGoals = filteredGoals.filter((g) => g.status === 'completed');

  if (isLoading) {
    return (
      <div className="fade-in">
        <div className="mb-8">
          <div className="h-9 w-48 bg-[var(--color-bg-secondary)] rounded animate-pulse mb-2" />
          <div className="h-5 w-64 bg-[var(--color-bg-secondary)] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dreamboard</h1>
          <p className="text-[var(--color-text-secondary)]">
            Visualize your future goals and track your journey
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="btn btn-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Templates
          </button>
          <button
            onClick={() => {
              setEditingGoal(undefined);
              setTemplateGoal(undefined);
              setShowForm(true);
            }}
            className="btn btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Goal
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`btn ${filter === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
        >
          All Goals ({goals.length})
        </button>
        {(['career', 'health', 'finance', 'personal', 'relationship', 'travel'] as GoalCategory[]).map(
          (cat) => {
            const count = goals.filter((g) => g.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`btn ${filter === cat ? 'btn-secondary' : 'btn-ghost'}`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
              </button>
            );
          }
        )}
      </div>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="card-elevated col-span-full min-h-[400px] flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-[var(--color-accent-primary)]/10 flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-[var(--color-accent-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold mb-3">Set Your First Goal</h3>
          <p className="text-[var(--color-text-secondary)] text-center max-w-md mb-6">
            Dreams become reality when you write them down. Create your first goal and
            start tracking your progress toward the life you want.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Goal
          </button>
        </div>
      ) : (
        <>
          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Active Goals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={() => handleEditGoal(goal)}
                    onDelete={() => handleDeleteGoal(goal.id)}
                    onStatusChange={(status) => handleUpdateStatus(goal, status)}
                    onDragStart={() => handleDragStart(goal.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(goal.id)}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedGoalId === goal.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={() => handleEditGoal(goal)}
                    onDelete={() => handleDeleteGoal(goal.id)}
                    onStatusChange={(status) => handleUpdateStatus(goal, status)}
                    onDragStart={() => handleDragStart(goal.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(goal.id)}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedGoalId === goal.id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Goal Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="card-elevated max-w-xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-6">
              {editingGoal ? 'Edit Goal' : 'Create New Goal'}
            </h2>
            <GoalForm
              goal={editingGoal}
              initialValues={templateGoal}
              nextOrder={goals.length}
              onSuccess={handleGoalSuccess}
              onCancel={() => {
                setShowForm(false);
                setEditingGoal(undefined);
                setTemplateGoal(undefined);
              }}
            />
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTemplates(false)}
        >
          <div
            className="card-elevated max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold">Goal Templates</h2>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Choose a template to get started quickly
                </p>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GOAL_TEMPLATES.map((template, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectTemplate(template)}
                  className="p-4 text-left bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[template.category] }}
                    />
                    <span className="font-medium">{template.title}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {template.description}
                  </p>
                  <span className="inline-block mt-2 text-xs text-[var(--color-text-muted)] capitalize">
                    {template.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Goal Card Component
function GoalCard({
  goal,
  onEdit,
  onDelete,
  onStatusChange,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
}: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: GoalStatus) => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const completedMilestones = goal.milestones.filter((m) => m.completed).length;
  const totalMilestones = goal.milestones.length;
  const progress =
    totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return (
    <div
      className={`card group cursor-grab active:cursor-grabbing transition-transform ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: CATEGORY_COLORS[goal.category] }}
        />
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-lg mb-2">{goal.title}</h3>

      {/* Description */}
      {goal.description && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
          {goal.description}
        </p>
      )}

      {/* Progress */}
      {totalMilestones > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[var(--color-text-muted)]">Progress</span>
            <span className="text-[var(--color-accent-primary)]">
              {completedMilestones}/{totalMilestones}
            </span>
          </div>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-subtle)]">
        <span className="text-xs text-[var(--color-text-muted)] capitalize">
          {goal.category}
        </span>

        <select
          value={goal.status}
          onChange={(e) => onStatusChange(e.target.value as GoalStatus)}
          className="text-xs bg-transparent border border-[var(--color-border)] rounded px-2 py-1"
        >
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="abandoned">Abandoned</option>
        </select>
      </div>
    </div>
  );
}

export default DreamboardView;
