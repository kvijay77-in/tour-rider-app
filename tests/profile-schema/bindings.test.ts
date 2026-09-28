import { buildProfileDefinitions, createProfileDraftValues, getAttributeDisplayValue } from '../../src/profile-schema';
import type { AppConfigEntry } from '../../src/profile-schema';
import type { RiderProfile } from '../../src/types/rider';

function entry(configType: string, configId: string, config: Record<string, unknown>, enabled = true, version = 1): AppConfigEntry {
  return { configType, configId, config, enabled, version };
}

describe('profile-schema bindings', () => {
  const definitions = buildProfileDefinitions([
    entry('RIDER_PROFILE_SECTION', 'contact', { label: 'Contact', order: 10 }),
    entry('LOV', 'COUNTRY', {
      label: 'Country',
      items: [
        { value: 'IN', label: 'India', order: 10, meta: { callingCode: '91' } },
        { value: 'US', label: 'United States', order: 20, meta: { callingCode: '1' } },
      ],
    }),
    entry('LOV', 'STATE', {
      label: 'State',
      parentLovId: 'COUNTRY',
      items: [
        { value: 'TN', label: 'Tamil Nadu', parent: 'IN', order: 10 },
      ],
    }),
    entry('RIDER_PROFILE_ATTRIBUTE', 'address', {
      label: 'Address',
      sectionId: 'contact',
      order: 10,
      type: 'GROUP',
      storage: { scope: 'CORE', path: 'address' },
      fields: [
        { key: 'country', label: 'Country', type: 'SELECT', lovId: 'COUNTRY' },
        { key: 'state', label: 'State', type: 'SELECT', lovId: 'STATE', dependsOn: 'country', fallbackToText: true },
      ],
    }),
    entry('RIDER_PROFILE_ATTRIBUTE', 'emergencyRelation', {
      label: 'Emergency relation',
      sectionId: 'contact',
      order: 20,
      type: 'SELECT',
      lovId: 'RELATION',
      storage: { scope: 'ATTRIBUTES' },
    }),
    entry('LOV', 'RELATION', {
      label: 'Relation',
      items: [
        { value: 'PARENT', label: 'Parent', order: 10 },
      ],
    }),
  ], 'server-defs-v1');

  it('maps legacy select labels to configured values when building draft values', () => {
    const profile: RiderProfile = {
      profileId: 'P1',
      name: 'Jane Rider',
      email: 'jane@example.com',
      address: {
        country: 'India',
        state: 'Tamil Nadu',
      },
      attributes: {
        emergencyRelation: 'Parent',
      },
    };

    const draftValues = createProfileDraftValues(profile, definitions, null);

    expect((draftValues.address as Record<string, unknown>).country).toBe('IN');
    expect((draftValues.address as Record<string, unknown>).state).toBe('TN');
    expect(draftValues.emergencyRelation).toBe('PARENT');
  });

  it('keeps unmatched legacy values and shows them as-is', () => {
    const displayValue = getAttributeDisplayValue(
      definitions.attributesByKey.emergencyRelation,
      'Neighbour',
      definitions,
    );

    expect(displayValue).toBe('Neighbour');
  });
});
