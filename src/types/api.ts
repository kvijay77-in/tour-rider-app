/**
 * API types for tour-data-api backend communication.
 * Aligned with tour-data-api REST endpoints.
 */

/**
 * Standard API response envelope from tour-data-api
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

/**
 * Paginated response (for list operations)
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  total?: number;
}
