import { buildProfileDefinitions, validateProfileDraftValues } from '../../src/profile-schema';
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
});
