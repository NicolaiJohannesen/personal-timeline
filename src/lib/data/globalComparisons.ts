/**
 * Global comparison data for insights
 * Sources: WHO, World Bank, Census data
 */

// Life expectancy by country (WHO 2023 estimates)
export const LIFE_EXPECTANCY_BY_COUNTRY: Record<string, { male: number; female: number; average: number }> = {
  'JP': { male: 81.5, female: 87.6, average: 84.6 }, // Japan
  'CH': { male: 81.9, female: 85.6, average: 83.8 }, // Switzerland
  'AU': { male: 81.3, female: 85.3, average: 83.3 }, // Australia
  'ES': { male: 80.7, female: 86.2, average: 83.5 }, // Spain
  'IT': { male: 80.9, female: 85.2, average: 83.1 }, // Italy
  'SE': { male: 81.3, female: 84.8, average: 83.1 }, // Sweden
  'NO': { male: 81.6, female: 84.5, average: 83.1 }, // Norway
  'FR': { male: 79.5, female: 85.5, average: 82.5 }, // France
  'CA': { male: 80.0, female: 84.1, average: 82.1 }, // Canada
  'NL': { male: 80.5, female: 83.6, average: 82.1 }, // Netherlands
  'DE': { male: 78.7, female: 83.4, average: 81.1 }, // Germany
  'GB': { male: 79.0, female: 82.9, average: 81.0 }, // United Kingdom
  'DK': { male: 79.6, female: 83.1, average: 81.4 }, // Denmark
  'US': { male: 74.8, female: 80.2, average: 77.5 }, // United States
  'PL': { male: 74.1, female: 82.0, average: 78.1 }, // Poland
  'MX': { male: 72.1, female: 77.8, average: 75.0 }, // Mexico
  'CN': { male: 75.0, female: 80.5, average: 77.8 }, // China
  'BR': { male: 72.8, female: 79.4, average: 76.1 }, // Brazil
  'IN': { male: 69.5, female: 72.2, average: 70.9 }, // India
  'RU': { male: 66.5, female: 76.8, average: 71.7 }, // Russia
};

// Global average life expectancy
export const GLOBAL_LIFE_EXPECTANCY = {
  male: 70.8,
  female: 75.6,
  average: 73.2,
};

// Income percentiles (USD, annual, global)
export const INCOME_PERCENTILES: Record<number, number> = {
  1: 450,
  5: 950,
  10: 1400,
  20: 2500,
  30: 4000,
  40: 6000,
  50: 8500,    // Median global income
  60: 12000,
  70: 18000,
  80: 30000,
  90: 55000,
  95: 85000,
  99: 180000,
};

// Education attainment by age group (% with bachelor's degree or higher)
export const EDUCATION_BENCHMARKS: Record<string, { age25_34: number; age35_44: number; age45_54: number; age55_64: number }> = {
  'US': { age25_34: 39, age35_44: 37, age45_54: 33, age55_64: 32 },
  'CA': { age25_34: 64, age35_44: 58, age45_54: 52, age55_64: 45 },
  'GB': { age25_34: 52, age35_44: 45, age45_54: 40, age55_64: 33 },
  'DE': { age25_34: 35, age35_44: 31, age45_54: 28, age55_64: 27 },
  'FR': { age25_34: 50, age35_44: 42, age45_54: 32, age55_64: 25 },
  'JP': { age25_34: 65, age35_44: 55, age45_54: 45, age55_64: 35 },
  'AU': { age25_34: 54, age35_44: 47, age45_54: 40, age55_64: 32 },
  'OECD': { age25_34: 47, age35_44: 40, age45_54: 34, age55_64: 28 }, // OECD average
};

// Career milestone benchmarks (median age)
export const CAREER_MILESTONES = {
  firstJob: 22,
  firstPromotion: 26,
  managerRole: 32,
  seniorRole: 38,
  executiveRole: 45,
  retirement: 65,
};

// Countries traveled benchmarks (by age)
export const TRAVEL_BENCHMARKS: Record<string, number> = {
  'age_20': 3,
  'age_30': 8,
  'age_40': 15,
  'age_50': 20,
  'age_60': 25,
};

/**
 * Get life expectancy for a country
 */
export function getLifeExpectancy(
  countryCode: string,
  gender?: 'male' | 'female'
): number {
  const country = LIFE_EXPECTANCY_BY_COUNTRY[countryCode.toUpperCase()];
  if (!country) {
    return gender ? GLOBAL_LIFE_EXPECTANCY[gender] : GLOBAL_LIFE_EXPECTANCY.average;
  }
  return gender ? country[gender] : country.average;
}

/**
 * Calculate income percentile from annual income
 */
export function calculateIncomePercentile(annualIncome: number): number {
  const sortedPercentiles = Object.entries(INCOME_PERCENTILES).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );

  for (let i = 0; i < sortedPercentiles.length; i++) {
    const [percentile, threshold] = sortedPercentiles[i];
    if (annualIncome <= threshold) {
      if (i === 0) return Number(percentile);
      // Interpolate between percentiles
      const [prevPercentile, prevThreshold] = sortedPercentiles[i - 1];
      const range = threshold - prevThreshold;
      const position = annualIncome - prevThreshold;
      const percentileDiff = Number(percentile) - Number(prevPercentile);
      return Number(prevPercentile) + (position / range) * percentileDiff;
    }
  }

  return 99; // Above 99th percentile
}

/**
 * Get education benchmark for age
 */
export function getEducationBenchmark(
  age: number,
  countryCode: string = 'OECD'
): number {
  const country = EDUCATION_BENCHMARKS[countryCode.toUpperCase()] || EDUCATION_BENCHMARKS['OECD'];

  if (age < 25) return 0;
  if (age < 35) return country.age25_34;
  if (age < 45) return country.age35_44;
  if (age < 55) return country.age45_54;
  return country.age55_64;
}

/**
 * Get expected countries visited by age
 */
export function getExpectedCountriesVisited(age: number): number {
  if (age < 20) return Math.round(age / 10);
  if (age < 30) return TRAVEL_BENCHMARKS['age_20'] + Math.round((age - 20) / 2);
  if (age < 40) return TRAVEL_BENCHMARKS['age_30'] + Math.round((age - 30) * 0.7);
  if (age < 50) return TRAVEL_BENCHMARKS['age_40'] + Math.round((age - 40) * 0.5);
  if (age < 60) return TRAVEL_BENCHMARKS['age_50'] + Math.round((age - 50) * 0.5);
  return TRAVEL_BENCHMARKS['age_60'];
}

/**
 * Compare user's career progress to benchmarks
 */
export function getCareerProgressComparison(
  age: number,
  hasFirstJob: boolean,
  hasPromotion: boolean,
  isManager: boolean,
  isSenior: boolean,
  isExecutive: boolean
): { status: 'ahead' | 'on_track' | 'behind'; message: string } {
  const milestones = [];

  if (hasFirstJob && age < CAREER_MILESTONES.firstJob) {
    milestones.push({ expected: CAREER_MILESTONES.firstJob, actual: age, milestone: 'first job' });
  }
  if (hasPromotion && age < CAREER_MILESTONES.firstPromotion) {
    milestones.push({ expected: CAREER_MILESTONES.firstPromotion, actual: age, milestone: 'first promotion' });
  }
  if (isManager && age < CAREER_MILESTONES.managerRole) {
    milestones.push({ expected: CAREER_MILESTONES.managerRole, actual: age, milestone: 'manager role' });
  }
  if (isSenior && age < CAREER_MILESTONES.seniorRole) {
    milestones.push({ expected: CAREER_MILESTONES.seniorRole, actual: age, milestone: 'senior role' });
  }
  if (isExecutive && age < CAREER_MILESTONES.executiveRole) {
    milestones.push({ expected: CAREER_MILESTONES.executiveRole, actual: age, milestone: 'executive role' });
  }

  if (milestones.length > 0) {
    const latest = milestones[milestones.length - 1];
    const yearsAhead = latest.expected - latest.actual;
    return {
      status: 'ahead',
      message: `Reached ${latest.milestone} ${yearsAhead} years ahead of average`,
    };
  }

  // Check if behind
  if (!hasFirstJob && age > CAREER_MILESTONES.firstJob + 2) {
    return { status: 'behind', message: 'Consider exploring career opportunities' };
  }

  return { status: 'on_track', message: 'Career progression is on track' };
}

/**
 * Format percentile for display
 */
export function formatPercentile(percentile: number): string {
  const rounded = Math.round(percentile);
  const suffix = rounded === 1 ? 'st' : rounded === 2 ? 'nd' : rounded === 3 ? 'rd' : 'th';
  return `${rounded}${suffix}`;
}
