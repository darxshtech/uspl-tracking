/**
 * Standard Company Policies & Regulations for Unitglo Solutions Private Limited
 * Shared between Server Settings and Client Letter Generator & Preview.
 */

export interface PolicyTermsContext {
  working_days?: string;
  work_timing?: string;
  probation_period?: string;
  designation?: string;
  work_location?: string;
  reporting_manager?: string;
  annual_ctc?: string;
  monthly_salary?: string;
}

/**
 * Builds the official letter policies dynamically matched to the employee's appointment terms & compensation.
 */
export function buildLetterPolicies(terms?: PolicyTermsContext): string {
  const days = terms?.working_days || "Monday to Friday";
  const timing = terms?.work_timing || "10:00 AM - 7:00 PM (IST)";
  const probation = terms?.probation_period || "3 Months";
  const designation = terms?.designation || "Software Professional";
  const location = terms?.work_location || "Pune, Maharashtra / Hybrid";
  const isFiveDay = !days.toLowerCase().includes("saturday") && (days.toLowerCase().includes("friday") || days.includes("5"));

  const weeklyOffs = isFiveDay ? "Saturdays, Sundays" : "Sundays";

  return `1. Working Hours & Shift Schedule: Standard full-time employment requires active professional commitment during scheduled company operating hours (${days}, ${timing}). Daily attendance, shift commencement, and completion must be recorded promptly via the company tracking portal upon check-in and check-out.

2. Attendance & Absenteeism Thresholds: Active shift duration below 4.5 hours is automatically classified as Full Day Absent. Active shift duration between 4.5 hours and 9 hours is recorded as a Half Day. Continuous unauthorized absence for 3 consecutive working days without prior notification shall be treated as voluntary abandonment of employment.

3. Monthly Paid Leaves & Carry-Forward: Employees receive a credit of 2 paid leaves per calendar month. Unused leaves carry forward month-to-month through December 31st of each calendar year, resetting annually on January 1st. Planned leaves require at least 48 hours prior managerial approval.

4. Half-Day Accumulation & Deductions: Every 2 half-days recorded within a calendar month equate to 1 full day paid leave deduction. Once paid leave quotas are exhausted, subsequent absences and half-days convert into Leave Without Pay (LWP) and are deducted proportionally from monthly payroll based on daily rate (Gross Monthly Salary / Total Calendar Days in Month).

5. Weekly Offs & Declared Public Holidays: ${weeklyOffs} and officially scheduled company holidays are designated weekly offs and shall never be counted against or deducted from an employee's paid leave balance.

6. Code of Conduct & Workplace Decorum: Employees are required to maintain high standards of integrity, professional courtesy, and ethical conduct. Discrimination, insubordination, harassment, or actions detrimental to company reputation will attract immediate disciplinary proceedings, up to and including termination for cause.

7. Non-Disclosure, Confidentiality & Intellectual Property: All proprietary software, application source code, API keys, client databases, technical designs, credentials, and business workflows developed or accessed during employment remain the sole and exclusive intellectual property of Unitglo Solutions Private Limited. Strict confidentiality must be preserved perpetually.

8. Probation Period & Performance Confirmation: A formal probationary period of ${probation} commences from the Date of Commencement. Comprehensive technical, delivery, and peer appraisals will be conducted before permanent confirmation in writing.

9. Resignation & Notice Period: During probation (${probation}), either party may terminate this employment agreement by serving 15 calendar days written notice. Post-confirmation, a mandatory 30 calendar days written notice period (or basic gross salary in lieu thereof, strictly at management discretion) is required.

10. Company Assets & IT Security: Workstations, official email accounts, cloud repositories, and access tokens provided by the company for duties as "${designation}" at "${location}" must be utilized exclusively for official duties. All assigned company equipment and property must be returned in good working order upon separation.`;
}

export const DEFAULT_LETTER_POLICIES = buildLetterPolicies();

/**
 * Intelligently synchronizes terms (working days, timing, probation, designation, location)
 * with the current policy text so that custom text is preserved while the appointment terms always match.
 */
export function syncPoliciesWithTerms(currentText: string, terms: PolicyTermsContext): string {
  if (!currentText || currentText.trim() === "" || currentText === DEFAULT_LETTER_POLICIES) {
    return buildLetterPolicies(terms);
  }

  const days = terms.working_days || "Monday to Friday";
  const timing = terms.work_timing || "10:00 AM - 7:00 PM (IST)";
  const probation = terms.probation_period || "3 Months";
  const designation = terms.designation || "Software Professional";
  const location = terms.work_location || "Pune, Maharashtra / Hybrid";
  const isFiveDay = !days.toLowerCase().includes("saturday") && (days.toLowerCase().includes("friday") || days.includes("5"));
  const weeklyOffs = isFiveDay ? "Saturdays, Sundays" : "Sundays";

  let updated = currentText;

  // 1. Synchronize Working Hours & Shift Schedule
  updated = updated.replace(
    /(1\.\s*Working Hours & Shift Schedule:[^\n]*\()([^\)]*)(\)[^\n]*)/i,
    `$1${days}, ${timing}$3`
  );

  // 2. Synchronize Weekly Offs
  updated = updated.replace(
    /(5\.\s*Weekly Offs & Declared Public Holidays:\s*)(Saturdays,\s*Sundays|Sundays)(\s*and\s*officially)/i,
    `$1${weeklyOffs}$3`
  );

  // 3. Synchronize Probation Period
  updated = updated.replace(
    /(8\.\s*Probation Period & Performance Confirmation:\s*A formal probationary period of\s*)([^\s]+(?:\s+Months|\s+months|\s+Days|\s+days)?)(\s*commences)/i,
    `$1${probation}$3`
  );

  // 4. Synchronize Notice Period Probation reference
  updated = updated.replace(
    /(9\.\s*Resignation & Notice Period:\s*During probation\s*\()([^\)]*)(\))/i,
    `$1${probation}$3`
  );

  // 5. Synchronize Company Assets designation & location
  updated = updated.replace(
    /(10\.\s*Company Assets & IT Security:[^\n]*duties as\s*")[^"]*("\s*at\s*")[^"]*(")/i,
    `$1${designation}$2${location}$3`
  );

  return updated;
}
