'use client';

import { useActionState, useState, useEffect } from 'react';
import { createGoal, updateGoal, type GoalFormState } from '@/lib/actions/goals';
import { goals as goalsDb } from '@/lib/db';
import type { Goal, GoalCategory, GoalPriority, Milestone } from '@/types';

interface GoalFormProps {
  goal?: Goal;
  initialValues?: Partial<Goal>;
  nextOrder?: number; // Order for new goals (defaults to 0)
  onSuccess?: (goal: Goal) => void;
  onCancel?: () => void;
}

const CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: 'career', label: 'Career' },
  { value: 'health', label: 'Health' },
  { value: 'finance', label: 'Finance' },
  { value: 'personal', label: 'Personal' },
  { value: 'relationship', label: 'Relationships' },
  { value: 'travel', label: 'Travel' },
];

const PRIORITIES: { value: GoalPriority; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'var(--color-error)' },
  { value: 'medium', label: 'Medium', color: 'var(--color-warning)' },
  { value: 'low', label: 'Low', color: 'var(--color-text-muted)' },
];

export function GoalForm({ goal, initialValues, nextOrder = 0, onSuccess, onCancel }: GoalFormProps) {
  const isEditing = !!goal;
  // Merge goal with initialValues (goal takes precedence)
  const defaults = { ...initialValues, ...goal };
  const action = isEditing ? updateGoal : createGoal;
  const [state, formAction, isPending] = useActionState<GoalFormState | null, FormData>(
    action,
    null
  );

  const [milestones, setMilestones] = useState<Milestone[]>(goal?.milestones || []);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  // Handle successful form submission
  useEffect(() => {
    if (state?.success && state.goal) {
      // Save to IndexedDB
      const saveGoal = async () => {
        try {
          if (isEditing) {
            await goalsDb.update(state.goal!);
          } else {
            await goalsDb.add(state.goal!);
          }
          onSuccess?.(state.goal!);
        } catch (error) {
          console.error('Failed to save goal:', error);
        }
      };
      saveGoal();
    }
  }, [state, isEditing, onSuccess]);

  const addMilestone = () => {
    if (!newMilestoneTitle.trim()) return;

    const newMilestone: Milestone = {
      id: crypto.randomUUID(),
      title: newMilestoneTitle.trim(),
      completed: false,
    };

    setMilestones([...milestones, newMilestone]);
    setNewMilestoneTitle('');
  };

  const removeMilestone = (id: string) => {
    setMilestones(milestones.filter((m) => m.id !== id));
  };

  const toggleMilestoneComplete = (id: string) => {
    setMilestones(
      milestones.map((m) =>
        m.id === id
          ? {
              ...m,
              completed: !m.completed,
              completedAt: !m.completed ? new Date() : undefined,
            }
          : m
      )
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      {isEditing && (
        <>
          <input type="hidden" name="goalId" value={goal.id} />
          <input type="hidden" name="status" value={goal.status} />
          <input type="hidden" name="createdAt" value={goal.createdAt.toISOString()} />
          <input type="hidden" name="order" value={goal.order} />
        </>
      )}
      {!isEditing && (
        <input type="hidden" name="order" value={nextOrder} />
      )}
      <input type="hidden" name="milestones" value={JSON.stringify(milestones)} />

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Goal Title *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          defaultValue={defaults?.title}
          className="input"
          placeholder="What do you want to achieve?"
          required
          maxLength={100}
        />
        {state?.errors?.title && (
          <p className="mt-1 text-sm text-[var(--color-error)]">{state.errors.title[0]}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={defaults?.description}
          className="input min-h-[100px] resize-y"
          placeholder="Why is this goal important to you?"
          maxLength={1000}
        />
        {state?.errors?.description && (
          <p className="mt-1 text-sm text-[var(--color-error)]">{state.errors.description[0]}</p>
        )}
      </div>

      {/* Category and Priority Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Category *
          </label>
          <select
            id="category"
            name="category"
            defaultValue={defaults?.category || 'personal'}
            className="input"
            required
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {state?.errors?.category && (
            <p className="mt-1 text-sm text-[var(--color-error)]">{state.errors.category[0]}</p>
          )}
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Priority *
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={defaults?.priority || 'medium'}
            className="input"
            required
          >
            {PRIORITIES.map((pri) => (
              <option key={pri.value} value={pri.value}>
                {pri.label}
              </option>
            ))}
          </select>
          {state?.errors?.priority && (
            <p className="mt-1 text-sm text-[var(--color-error)]">{state.errors.priority[0]}</p>
          )}
        </div>
      </div>

      {/* Target Date */}
      <div>
        <label htmlFor="targetDate" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Target Date
        </label>
        <input
          type="date"
          id="targetDate"
          name="targetDate"
          defaultValue={defaults?.targetDate ? new Date(defaults.targetDate).toISOString().split('T')[0] : ''}
          className="input"
        />
        {state?.errors?.targetDate && (
          <p className="mt-1 text-sm text-[var(--color-error)]">{state.errors.targetDate[0]}</p>
        )}
      </div>

      {/* Milestones */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Milestones
        </label>

        {/* Existing Milestones */}
        {milestones.length > 0 && (
          <ul className="space-y-2 mb-3">
            {milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex items-center gap-3 p-3 bg-[var(--color-bg-secondary)] rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => toggleMilestoneComplete(milestone.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    milestone.completed
                      ? 'bg-[var(--color-success)] border-[var(--color-success)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent-primary)]'
                  }`}
                >
                  {milestone.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span
                  className={`flex-1 ${
                    milestone.completed ? 'line-through text-[var(--color-text-muted)]' : ''
                  }`}
                >
                  {milestone.title}
                </span>
                <button
                  type="button"
                  onClick={() => removeMilestone(milestone.id)}
                  className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                  aria-label="Remove milestone"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Milestone Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMilestoneTitle}
            onChange={(e) => setNewMilestoneTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addMilestone();
              }
            }}
            className="input flex-1"
            placeholder="Add a milestone..."
            maxLength={100}
          />
          <button
            type="button"
            onClick={addMilestone}
            className="btn btn-secondary"
            disabled={!newMilestoneTitle.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* Error Message */}
      {state && !state.success && state.message && (
        <div className="p-3 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-lg">
          <p className="text-sm text-[var(--color-error)]">{state.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-[var(--color-border-subtle)]">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary flex-1"
        >
          {isPending ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : (
            <>{isEditing ? 'Save Changes' : 'Create Goal'}</>
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={isPending}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default GoalForm;
