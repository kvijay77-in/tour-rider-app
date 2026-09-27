import {
  combinePhoneNumber,
  createProfileFormValues,
  splitPhoneNumber,
  validateProfileForm,
} from '../../src/utils/profileForm';

describe('profile form utilities', () => {
  it('defaults country and both dialing codes to India', () => {
    const values = createProfileFormValues();

    expect(values.country).toBe('India');
    expect(values.countryCode).toBe('IN');
    expect(values.phoneCallingCode).toBe('91');
    expect(values.emergencyPhoneCallingCode).toBe('91');
    expect(values.emergencyContactName).toBe('');
    expect(values.emergencyContactRelationship).toBe('');
  });

  it('splits and recombines an international phone number', () => {
    expect(splitPhoneNumber('+919876543210')).toMatchObject({
      countryCode: 'IN',
      callingCode: '91',
      phoneNumber: '9876543210',
    });
    expect(combinePhoneNumber('91', '98765 43210')).toBe('+919876543210');
  });

  it('marks every mandatory field except address line 2', () => {
    const errors = validateProfileForm(createProfileFormValues(), false);

    expect(errors).toEqual(expect.objectContaining({
      name: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      addressLine1: true,
      city: true,
      state: true,
      postalCode: true,
      emergencyContactName: true,
      emergencyContactRelationship: true,
      emergencyContactPhone: true,
    }));
    expect(errors).not.toHaveProperty('addressLine2');
    expect(errors).not.toHaveProperty('country');
    expect(errors).toHaveProperty('photo');
  });

  it('does not require a photo when one already exists', () => {
    const errors = validateProfileForm(createProfileFormValues(), true);

    expect(errors).not.toHaveProperty('photo');
  });
});