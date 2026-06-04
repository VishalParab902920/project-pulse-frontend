/**
 * Date and time utility functions.
 */

/**
 * Calculates current age accurately based on a Date of Birth string.
 * Accounts for leap years and exact birth month/day boundaries.
 * 
 * @param dobString Date of birth (ISO format or YYYY-MM-DD)
 * @returns Computed age as integer
 */
export function calculateAge(dobString: string): number {
  const dob = new Date(dobString);
  const now = new Date(); // Client's active date calendar

  if (isNaN(dob.getTime())) {
    throw new Error(`Invalid date string provided: ${dobString}`);
  }

  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }

  return Math.max(0, age);
}
