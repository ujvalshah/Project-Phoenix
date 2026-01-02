/**
 * Escapes special characters in a string for use in RegExp
 * 
 * This prevents ReDoS (Regular Expression Denial of Service) attacks
 * by ensuring user input is treated as literal characters, not regex patterns.
 * 
 * SECURITY: Always use this function when creating RegExp from user input.
 * 
 * @param s - The string to escape
 * @returns The escaped string safe for use in RegExp
 * 
 * @example
 * // Safe search with user input
 * const userInput = "user+search*query";
 * const safe = escapeRegExp(userInput);
 * const regex = new RegExp(safe, 'i');
 * 
 * @example
 * // Prevents ReDoS attack patterns
 * const malicious = "(a+)+$"; // Would cause catastrophic backtracking
 * const safe = escapeRegExp(malicious);
 * // Results in: "\\(a\\+\\)\\+\\$" - treated as literal string
 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a case-insensitive RegExp for exact matching
 * 
 * @param s - The string to match exactly
 * @returns RegExp that matches the string exactly (case-insensitive)
 * 
 * @example
 * const regex = createExactMatchRegex("MyTag");
 * regex.test("MyTag");     // true
 * regex.test("mytag");     // true (case-insensitive)
 * regex.test("MyTag2");    // false (exact match only)
 * regex.test("AMyTag");    // false (exact match only)
 */
export function createExactMatchRegex(s: string): RegExp {
  return new RegExp(`^${escapeRegExp(s.trim())}$`, 'i');
}

/**
 * Creates a case-insensitive RegExp for partial matching (search)
 * 
 * @param s - The search string
 * @returns RegExp that matches the string anywhere (case-insensitive)
 * 
 * @example
 * const regex = createSearchRegex("test");
 * regex.test("This is a test");  // true
 * regex.test("testing 123");     // true
 * regex.test("no match");        // false
 */
export function createSearchRegex(s: string): RegExp {
  return new RegExp(escapeRegExp(s.trim()), 'i');
}




