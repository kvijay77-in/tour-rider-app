import { buildProfileDefinitions, getVisibleEditableAttributes, validateProfileDraftValues } from '../../src/profile-schema';
import type { AppConfigEntry } from '../../src/profile-schema';

function entry(configType: string, configId: string, config: Record<string, unknown>, enabled = true, version = 1): AppConfigEntry {
  return { configType, configId, config, enabled, version };
}

describe('validateProfileDraftValues', () => {
  it('validates the main field types used by the rider profile', () => {
    const definitions = buildProfileDefinitions([
      entry('RIDER_PROFILE_SECTION', 'personal', { label: 'Personal', order: 10 }),
      entry('LOV', 'GENDER', { label: 'Gender', items: [{ value: 'M', label: 'Male', order: 10, enabled: true }] }),
      entry('LOV', 'DIET', { label: 'Diet', items: [{ value: 'VEG', label: 'Vegetarian', order: 10, enabled: true }] }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'email', {
        label: 'Email',
        sectionId: 'personal',
        order: 10,
        type: 'EMAIL',
        storage: { scope: 'CORE', path: 'email' },
        required: true,
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'phone', {
        label: 'Phone',
        sectionId: 'personal',
        order: 20,
        type: 'PHONE',
        storage: { scope: 'CORE', path: 'phone' },
        required: true,
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'dateOfBirth', {
        label: 'Date of birth',
        sectionId: 'personal',
        order: 30,
        type: 'DATE',
        storage: { scope: 'CORE', path: 'dateOfBirth' },
        validation: { maxDate: '-18y' },
        required: true,
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'height', {
        label: 'Height',
        sectionId: 'personal',
        order: 40,
        type: 'NUMBER',
        storage: { scope: 'ATTRIBUTES' },
        validation: { min: 1, max: 250, decimals: 1 },
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'gender', {
        label: 'Gender',
        sectionId: 'personal',
        order: 50,
        type: 'SELECT',
        lovId: 'GENDER',
        storage: { scope: 'CORE', path: 'gender' },
        required: true,
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'dietaryPreference', {
        label: 'Dietary preference',
        sectionId: 'personal',
        order: 60,
        type: 'MULTI_SELECT',
        lovId: 'DIET',
        storage: { scope: 'ATTRIBUTES' },
        validation: { minItems: 1 },
      }),
    ]);

    const errors = validateProfileDraftValues(definitions, {
      email: 'bad-email',
      phone: '12345',
      dateOfBirth: '2020-01-01',
      height: '180.55',
      gender: 'UNKNOWN',
      dietaryPreference: [],
    });

    expect(errors.email).toContain('valid email');
    expect(errors.phone).toContain('valid phone');
    expect(errors.dateOfBirth).toContain('on or before');
    expect(errors.height).toContain('decimal places');
    expect(errors.gender).toContain('selected from the list');
    expect(errors.dietaryPreference).toContain('at least 1');
  });

  it('excludes hidden and rider read-only attributes from visible editable attributes', () => {
    const definitions = buildProfileDefinitions([
      entry('RIDER_PROFILE_SECTION', 'personal', { label: 'Personal', order: 10 }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'name', {
        label: 'Name',
        sectionId: 'personal',
        order: 10,
        type: 'TEXT',
        storage: { scope: 'CORE', path: 'name' },
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'email', {
        label: 'Email',
        sectionId: 'personal',
        order: 20,
        type: 'EMAIL',
        storage: { scope: 'CORE', path: 'email' },
        handler: 'COGNITO_EMAIL',
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'personalCode', {
        label: 'Personal code',
        sectionId: 'personal',
        order: 30,
        type: 'TEXT',
        storage: { scope: 'CORE', path: 'personalCode' },
        adminOnly: true,
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'medicalConditions', {
        label: 'Medical conditions',
        sectionId: 'personal',
        order: 40,
        type: 'TEXTAREA',
        storage: { scope: 'ATTRIBUTES' },
        visibleWhen: { attribute: 'hasMedicalCondition', op: 'EQ', value: true },
      }),
    ]);

    const visibleEditableAttributes = getVisibleEditableAttributes(definitions, {
      hasMedicalCondition: false,
    });

    expect(visibleEditableAttributes.map((attribute) => attribute.key)).toEqual(['name']);
  });

  describe('profile photo attribute', () => {
    const definitions = buildProfileDefinitions([
      entry('RIDER_PROFILE_SECTION', 'personal', { label: 'Personal', order: 10 }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'photo', {
        label: 'Photo',
        sectionId: 'personal',
        order: 10,
        type: 'IMAGE',
        storage: { scope: 'CORE', path: 'photoS3Key' },
        handler: 'PROFILE_PHOTO',
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'phone', {
        label: 'Phone',
        sectionId: 'personal',
        order: 20,
        type: 'PHONE',
        storage: { scope: 'CORE', path: 'phone' },
      }),
    ]);

    it('does not reject the stored S3 key of an existing profile photo', () => {
      const errors = validateProfileDraftValues(
        definitions,
        { photo: 'riders/P123/photo/profile.jpg', phone: '+14155550123' },
        { skipReadOnly: true },
      );

      expect(errors).toEqual({});
    });

    it('skips the photo attribute even when the skipReadOnly option is not set', () => {
      const errors = validateProfileDraftValues(definitions, { photo: 'riders/P123/photo/profile.jpg' });

      expect(errors.photo).toBeUndefined();
    });

    it('still validates other fields alongside an existing photo', () => {
      const errors = validateProfileDraftValues(
        definitions,
        { photo: 'riders/P123/photo/profile.jpg', phone: '12345' },
        { skipReadOnly: true },
      );

      expect(errors.photo).toBeUndefined();
      expect(errors.phone).toContain('valid phone');
    });

    it('still reports invalid file information for non-photo IMAGE attributes', () => {
      const withDocument = buildProfileDefinitions([
        entry('RIDER_PROFILE_SECTION', 'personal', { label: 'Personal', order: 10 }),
        entry('RIDER_PROFILE_ATTRIBUTE', 'idScan', {
          label: 'ID scan',
          sectionId: 'personal',
          order: 10,
          type: 'IMAGE',
          storage: { scope: 'ATTRIBUTES' },
        }),
      ]);

      expect(validateProfileDraftValues(withDocument, { idScan: 'not-an-object' }).idScan)
        .toContain('file information is invalid');
    });
  });

  describe('excludedKeys option', () => {
    const definitions = buildProfileDefinitions([
      entry('RIDER_PROFILE_SECTION', 'personal', { label: 'Personal', order: 10 }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'phone', {
        label: 'Phone',
        sectionId: 'personal',
        order: 10,
        type: 'PHONE',
        storage: { scope: 'CORE', path: 'phone' },
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'badge', {
        label: 'Badge',
        sectionId: 'personal',
        order: 20,
        type: 'IMAGE',
        storage: { scope: 'ATTRIBUTES' },
        required: true,
      }),
    ]);

    it('does not validate attributes that are excluded from the form', () => {
      const errors = validateProfileDraftValues(
        definitions,
        { phone: '+14155550123', badge: 'stored-reference' },
        { excludedKeys: ['badge'] },
      );

      expect(errors).toEqual({});
    });

    it('does not report a required excluded attribute with no value', () => {
      const errors = validateProfileDraftValues(definitions, { phone: '+14155550123' }, { excludedKeys: ['badge'] });

      expect(errors.badge).toBeUndefined();
    });

    it('still validates attributes that are not excluded', () => {
      const errors = validateProfileDraftValues(
        definitions,
        { phone: '12345', badge: 'stored-reference' },
        { excludedKeys: ['badge'] },
      );

      expect(errors.phone).toContain('valid phone');
      expect(errors.badge).toBeUndefined();
    });

    it('validates every attribute when no keys are excluded', () => {
      const errors = validateProfileDraftValues(definitions, { phone: '+14155550123', badge: 'stored-reference' });

      expect(errors.badge).toContain('file information is invalid');
    });
  });
});
