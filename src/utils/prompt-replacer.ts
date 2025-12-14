/**
 * Format date in Japanese style
 */
function formatDateJapanese(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * Calculate days between two dates
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Variables available for prompt replacement
 */
export interface PromptVariables {
  /** Period string: "YYYY年MM月DD日からYYYY年MM月DD日まで" */
  period: string;
  /** Today's date: "YYYY年MM月DD日" */
  today: string;
  /** Number of days since last delivery */
  days: string;
}

/**
 * Generate prompt variables based on last delivery date
 * @param lastDeliveredAt - Last delivery timestamp
 * @param currentDate - Current date (defaults to now)
 * @returns Object with all available variables
 */
export function generatePromptVariables(
  lastDeliveredAt?: Date,
  currentDate: Date = new Date()
): PromptVariables {
  const today = formatDateJapanese(currentDate);

  // Default to 7 days ago if no lastDeliveredAt
  const startDate = lastDeliveredAt || new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start = formatDateJapanese(startDate);
  const period = `${start}から${today}まで`;
  const days = daysBetween(startDate, currentDate).toString();

  return {
    period,
    today,
    days,
  };
}

/**
 * Replace variables in prompt template
 * Supported variables:
 * - {{period}} - Period string (e.g., "2024年12月9日から2024年12月16日まで")
 * - {{today}} - Today's date (e.g., "2024年12月16日")
 * - {{days}} - Number of days since last delivery (e.g., "7")
 *
 * @param prompt - Prompt template with {{variable}} placeholders
 * @param lastDeliveredAt - Last delivery timestamp
 * @param currentDate - Current date (defaults to now)
 * @returns Prompt with variables replaced
 */
export function replacePromptVariables(
  prompt: string,
  lastDeliveredAt?: Date,
  currentDate: Date = new Date()
): string {
  const variables = generatePromptVariables(lastDeliveredAt, currentDate);

  let result = prompt;
  result = result.replace(/\{\{period\}\}/g, variables.period);
  result = result.replace(/\{\{today\}\}/g, variables.today);
  result = result.replace(/\{\{days\}\}/g, variables.days);

  return result;
}
