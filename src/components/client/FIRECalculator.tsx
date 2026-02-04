'use client';

import { useState, useMemo } from 'react';
import { assessments } from '@/lib/db';
import type { AssessmentResult } from '@/types';

interface FIRECalculatorProps {
  onComplete?: (result: AssessmentResult) => void;
  onCancel?: () => void;
}

interface FIREInputs {
  currentAge: number;
  targetRetirementAge: number;
  annualIncome: number;
  annualExpenses: number;
  currentSavings: number;
  expectedReturn: number;
  withdrawalRate: number;
  inflationRate: number;
}

interface FIREResults {
  fireNumber: number;
  yearsToFIRE: number;
  projectedRetirementAge: number;
  monthlySavingsNeeded: number;
  currentSavingsRate: number;
  progressPercentage: number;
  projectedSavingsAtRetirement: number;
  canRetireOnTime: boolean;
}

const DEFAULT_INPUTS: FIREInputs = {
  currentAge: 30,
  targetRetirementAge: 50,
  annualIncome: 80000,
  annualExpenses: 50000,
  currentSavings: 50000,
  expectedReturn: 7,
  withdrawalRate: 4,
  inflationRate: 2.5,
};

export function FIRECalculator({ onComplete, onCancel }: FIRECalculatorProps) {
  const [inputs, setInputs] = useState<FIREInputs>(DEFAULT_INPUTS);
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const startTime = useState(() => Date.now())[0];

  // Calculate FIRE metrics
  const results = useMemo((): FIREResults => {
    const {
      currentAge,
      targetRetirementAge,
      annualIncome,
      annualExpenses,
      currentSavings,
      expectedReturn,
      withdrawalRate,
      inflationRate,
    } = inputs;

    // FIRE number = annual expenses / withdrawal rate
    // Handle division by zero - use a very small rate if 0
    const effectiveWithdrawalRate = withdrawalRate > 0 ? withdrawalRate : 0.01;
    const fireNumber = annualExpenses / (effectiveWithdrawalRate / 100);

    // Real return (adjusted for inflation)
    const realReturn = (1 + expectedReturn / 100) / (1 + inflationRate / 100) - 1;

    // Calculate years to FIRE using compound interest formula
    // FV = PV * (1 + r)^n + PMT * ((1 + r)^n - 1) / r
    // Solving for n when FV = fireNumber
    const annualSavings = annualIncome - annualExpenses;

    let yearsToFIRE: number;
    if (annualSavings <= 0) {
      yearsToFIRE = Infinity;
    } else if (currentSavings >= fireNumber) {
      yearsToFIRE = 0;
    } else {
      // Use iterative approach to find years to FIRE
      let years = 0;
      let accumulated = currentSavings;
      while (accumulated < fireNumber && years < 100) {
        accumulated = accumulated * (1 + realReturn) + annualSavings;
        years++;
      }
      yearsToFIRE = years >= 100 ? Infinity : years;
    }

    const projectedRetirementAge = currentAge + yearsToFIRE;

    // Calculate how much needs to be saved monthly to hit target by retirement age
    const yearsUntilTarget = targetRetirementAge - currentAge;
    let monthlySavingsNeeded: number;

    if (yearsUntilTarget <= 0) {
      monthlySavingsNeeded = currentSavings >= fireNumber ? 0 : Infinity;
    } else {
      // Calculate required annual savings to reach FIRE number by target age
      // Using future value of annuity formula, solving for PMT
      const n = yearsUntilTarget;
      const r = realReturn;
      const FV = fireNumber;
      const PV = currentSavings;

      // FV = PV * (1+r)^n + PMT * ((1+r)^n - 1) / r
      // PMT = (FV - PV * (1+r)^n) * r / ((1+r)^n - 1)
      const futureValueFactor = Math.pow(1 + r, n);
      const futureValueOfCurrentSavings = PV * futureValueFactor;
      const neededFromAnnualSavings = FV - futureValueOfCurrentSavings;

      if (neededFromAnnualSavings <= 0) {
        monthlySavingsNeeded = 0;
      } else {
        const annuityFactor = (futureValueFactor - 1) / r;
        const requiredAnnualSavings = neededFromAnnualSavings / annuityFactor;
        monthlySavingsNeeded = requiredAnnualSavings / 12;
      }
    }

    // Current savings rate
    const currentSavingsRate = annualIncome > 0 ? (annualSavings / annualIncome) * 100 : 0;

    // Progress towards FIRE number
    const progressPercentage = (currentSavings / fireNumber) * 100;

    // Projected savings at target retirement age
    let projectedSavingsAtRetirement = currentSavings;
    for (let i = 0; i < yearsUntilTarget; i++) {
      projectedSavingsAtRetirement = projectedSavingsAtRetirement * (1 + realReturn) + annualSavings;
    }

    const canRetireOnTime = projectedSavingsAtRetirement >= fireNumber;

    return {
      fireNumber,
      yearsToFIRE: Math.round(yearsToFIRE * 10) / 10,
      projectedRetirementAge: Math.round(projectedRetirementAge * 10) / 10,
      monthlySavingsNeeded: Math.round(monthlySavingsNeeded),
      currentSavingsRate: Math.round(currentSavingsRate * 10) / 10,
      progressPercentage: Math.min(Math.round(progressPercentage * 10) / 10, 100),
      projectedSavingsAtRetirement: Math.round(projectedSavingsAtRetirement),
      canRetireOnTime,
    };
  }, [inputs]);

  const handleInputChange = (field: keyof FIREInputs, value: number) => {
    // Validate and clamp values to reasonable ranges
    let clampedValue = value;

    // Handle NaN
    if (isNaN(value)) {
      clampedValue = 0;
    }

    // Apply field-specific constraints
    switch (field) {
      case 'currentAge':
        clampedValue = Math.min(Math.max(0, clampedValue), 120);
        break;
      case 'targetRetirementAge':
        clampedValue = Math.min(Math.max(0, clampedValue), 120);
        break;
      case 'annualIncome':
      case 'annualExpenses':
      case 'currentSavings':
        // Cap at reasonable maximum (100 billion)
        clampedValue = Math.min(Math.max(0, clampedValue), 100_000_000_000);
        break;
      case 'expectedReturn':
      case 'inflationRate':
        clampedValue = Math.min(Math.max(0, clampedValue), 50);
        break;
      case 'withdrawalRate':
        // Allow 0 during input (division by zero handled in calculation)
        // Max at 20% which is unrealistically high for sustainable withdrawal
        clampedValue = Math.min(Math.max(0, clampedValue), 20);
        break;
    }

    setInputs((prev) => ({ ...prev, [field]: clampedValue }));
  };

  const handleCalculate = () => {
    setShowResults(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const result: AssessmentResult = {
        id: crypto.randomUUID(),
        userId: 'default-user',
        assessmentType: 'fire_projection',
        completedAt: new Date(),
        duration,
        scores: {
          fireNumber: results.fireNumber,
          yearsToFIRE: results.yearsToFIRE,
          projectedRetirementAge: results.projectedRetirementAge,
          currentSavingsRate: results.currentSavingsRate,
          progressPercentage: results.progressPercentage,
          // Store inputs for reference
          currentAge: inputs.currentAge,
          targetRetirementAge: inputs.targetRetirementAge,
          annualIncome: inputs.annualIncome,
          annualExpenses: inputs.annualExpenses,
          currentSavings: inputs.currentSavings,
          expectedReturn: inputs.expectedReturn,
          withdrawalRate: inputs.withdrawalRate,
        },
      };

      await assessments.add(result);
      onComplete?.(result);
    } catch (error) {
      console.error('Failed to save FIRE results:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Results view
  if (showResults) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your FIRE Projection</h2>
          <button
            onClick={() => setShowResults(false)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Edit inputs
          </button>
        </div>

        {/* Main FIRE Number */}
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-6 mb-6 text-center">
          <div className="text-sm text-[var(--color-text-muted)] mb-2">Your FIRE Number</div>
          <div className="text-4xl font-bold text-[var(--color-accent-primary)]">
            {formatCurrency(results.fireNumber)}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-2">
            Based on {inputs.withdrawalRate}% safe withdrawal rate
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--color-text-secondary)]">Progress to FIRE</span>
            <span className="font-medium">{results.progressPercentage}%</span>
          </div>
          <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent-primary)] rounded-full transition-all duration-500"
              style={{ width: `${Math.min(results.progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
            <span>{formatCurrency(inputs.currentSavings)}</span>
            <span>{formatCurrency(results.fireNumber)}</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Years to FIRE</div>
            <div className="text-2xl font-bold">
              {results.yearsToFIRE === Infinity ? '∞' : results.yearsToFIRE}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              Retire at age {results.projectedRetirementAge === Infinity ? '—' : Math.round(results.projectedRetirementAge)}
            </div>
          </div>

          <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Current Savings Rate</div>
            <div className="text-2xl font-bold">{results.currentSavingsRate}%</div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {formatCurrency(inputs.annualIncome - inputs.annualExpenses)}/year
            </div>
          </div>

          <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Monthly Savings Needed</div>
            <div className="text-2xl font-bold">
              {results.monthlySavingsNeeded === Infinity
                ? '∞'
                : formatCurrency(results.monthlySavingsNeeded)}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              To retire by age {inputs.targetRetirementAge}
            </div>
          </div>

          <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Projected at Target Age</div>
            <div className="text-2xl font-bold">
              {formatCurrency(results.projectedSavingsAtRetirement)}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {results.canRetireOnTime ? (
                <span className="text-green-500">On track!</span>
              ) : (
                <span className="text-amber-500">Below target</span>
              )}
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div
          className={`rounded-lg p-4 mb-6 ${
            results.canRetireOnTime
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-amber-500/10 border border-amber-500/20'
          }`}
        >
          {results.canRetireOnTime ? (
            <div>
              <div className="font-medium text-green-500 mb-1">You&apos;re on track!</div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                At your current savings rate, you&apos;ll reach your FIRE number by age{' '}
                {Math.round(results.projectedRetirementAge)}. Keep up the great work!
              </p>
            </div>
          ) : (
            <div>
              <div className="font-medium text-amber-500 mb-1">Adjustment needed</div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                To retire by age {inputs.targetRetirementAge}, consider increasing your monthly savings to{' '}
                {formatCurrency(results.monthlySavingsNeeded)} or adjusting your target retirement age.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn btn-secondary flex-1">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary flex-1"
          >
            {isSaving ? 'Saving...' : 'Save Results'}
          </button>
        </div>
      </div>
    );
  }

  // Input form view
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">FIRE Calculator</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            Calculate your path to Financial Independence, Retire Early
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        {/* Personal Info Section */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Personal Info</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Current Age</label>
              <input
                type="number"
                value={inputs.currentAge}
                onChange={(e) => handleInputChange('currentAge', parseInt(e.target.value) || 0)}
                min={18}
                max={100}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Retirement Age</label>
              <input
                type="number"
                value={inputs.targetRetirementAge}
                onChange={(e) => handleInputChange('targetRetirementAge', parseInt(e.target.value) || 0)}
                min={inputs.currentAge}
                max={100}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Income & Expenses Section */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Income & Expenses</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Annual Income</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
                <input
                  type="number"
                  value={inputs.annualIncome}
                  onChange={(e) => handleInputChange('annualIncome', parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full pl-7 pr-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Annual Expenses</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
                <input
                  type="number"
                  value={inputs.annualExpenses}
                  onChange={(e) => handleInputChange('annualExpenses', parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full pl-7 pr-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Savings Section */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Current Savings</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Total Invested Assets</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
              <input
                type="number"
                value={inputs.currentSavings}
                onChange={(e) => handleInputChange('currentSavings', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full pl-7 pr-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
              />
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Include 401k, IRA, brokerage accounts, etc.
            </p>
          </div>
        </div>

        {/* Assumptions Section */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Assumptions</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Expected Return</label>
              <div className="relative">
                <input
                  type="number"
                  value={inputs.expectedReturn}
                  onChange={(e) => handleInputChange('expectedReturn', parseFloat(e.target.value) || 0)}
                  min={0}
                  max={20}
                  step={0.5}
                  className="w-full pr-7 pl-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Withdrawal Rate</label>
              <div className="relative">
                <input
                  type="number"
                  value={inputs.withdrawalRate}
                  onChange={(e) => handleInputChange('withdrawalRate', parseFloat(e.target.value) || 0)}
                  min={1}
                  max={10}
                  step={0.5}
                  className="w-full pr-7 pl-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Inflation Rate</label>
              <div className="relative">
                <input
                  type="number"
                  value={inputs.inflationRate}
                  onChange={(e) => handleInputChange('inflationRate', parseFloat(e.target.value) || 0)}
                  min={0}
                  max={10}
                  step={0.5}
                  className="w-full pr-7 pl-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">%</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Historical S&P 500 returns ~10%/year. The 4% rule is a common safe withdrawal rate.
          </p>
        </div>

        {/* Quick Preview */}
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--color-text-muted)]">Quick Preview</div>
              <div className="text-lg font-bold text-[var(--color-accent-primary)]">
                FIRE Number: {formatCurrency(results.fireNumber)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--color-text-muted)]">Current Savings Rate</div>
              <div className="text-lg font-bold">{results.currentSavingsRate}%</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleCalculate} className="btn btn-primary flex-1">
            Calculate Projection
          </button>
        </div>
      </div>
    </div>
  );
}
