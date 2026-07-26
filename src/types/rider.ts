/**
 * Rider type definitions for the Tour Rider App.
 * Aligned with tour-data-api RiderProfile table.
 */

/**
 * Rider profile information (from RiderProfile table in tour-data-api)
 */
export interface RiderProfile {
  /** Unique profile identifier (UUID) */
  profileId: string;

  /** First name */
  firstName: string;

  /** Last name */
  lastName: string;

  /** Contact email (primary identifier, same as Cognito email) */
  email: string;

  /** Contact phone number */
  phone?: string;

  /** Date of birth (ISO 8601 date) */
  dateOfBirth?: string;

  /** Gender */
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say';

  /** Address (optional) */
  address?: string;

  /** Emergency contact name */
  emergencyContactName?: string;

  /** Emergency contact relationship */
  emergencyContactRelationship?: string;

  /** Emergency contact phone */
  emergencyContactPhone?: string;

  /** S3 object key for profile picture */
  photoS3Key?: string;

  /** Profile picture URL (resolved from S3 key) */
  photoUrl?: string;

  /** Created timestamp */
  createdAt?: string;

  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * Rider profile creation request
 */
export interface CreateRiderProfileRequest {
  profileId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  photoS3Key?: string;
}

/**
 * Rider profile update request
 */
export interface UpdateRiderProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  photoS3Key?: string;
}

/**
 * Profile picture upload URL response payload.
 */
export interface ProfilePictureUploadUrlResponse {
  uploadUrl: string;
  photoS3Key: string;
  contentType: string;
  expiresIn: number;
  profileId: string;
}

/**
 * Cognito-sub to rider profile link response payload.
 */
export interface LinkProfileResponse {
  profileId: string;
  cognitoUserName: string;
}
