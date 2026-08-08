/**
 * Rider type definitions for the Tour Rider App.
 * Aligned with tour-data-api RiderProfile table.
 */

/**
 * Rider profile information (from RiderProfile table in tour-data-api)
 */
export interface RiderAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface RiderEmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface RiderProfile {
  /** Unique profile identifier (UUID) */
  profileId: string;

  /** Rider full name */
  name: string;

  /** Contact email (primary identifier, same as Cognito email) */
  email: string;

  /** Personal code assigned by organizers (read-only for riders) */
  personalCode?: string;

  /** Contact phone number */
  phone?: string;

  /** Date of birth (ISO 8601 date) */
  dateOfBirth?: string;

  /** Gender */
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say';

  /** Address object (DynamoDB map) */
  address?: RiderAddress;

  /** Emergency contact object (DynamoDB map) */
  emergencyContact?: RiderEmergencyContact;

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
  name: string;
  email: string;
  phone: string;
  emergencyContact: RiderEmergencyContact;
  dateOfBirth?: string;
  gender?: RiderProfile['gender'];
  address?: RiderAddress;
  photoS3Key?: string;
}

/**
 * Rider profile update request
 */
export interface UpdateRiderProfileRequest {
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: RiderProfile['gender'];
  address?: RiderAddress;
  emergencyContact?: RiderEmergencyContact;
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
