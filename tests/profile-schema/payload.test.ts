import { buildProfileDefinitions, buildProfileSavePayload } from '../../src/profile-schema';
import type { AppConfigEntry } from '../../src/profile-schema';
import type { RiderProfile } from '../../src/types/rider';

function entry(configType: string, configId: string, config: Record<string, unknown>, enabled = true, version = 1): AppConfigEntry {
  return { configType, configId, config, enabled, version };
}

describe('buildProfileSavePayload', () => {
  it('excludes disabled, unknown and admin-only keys from the change-only payload', () => {
    const definitions = buildProfileDefinitions([
      entry('RIDER_PROFILE_SECTION', 'personal', { label: 'Personal', order: 10 }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'name', {
        label: 'Name',
        sectionId: 'personal',
        order: 10,
        type: 'TEXT',
        storage: { scope: 'CORE', path: 'name' },
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'dietaryPreference', {
        label: 'Dietary preference',
        sectionId: 'personal',
        order: 20,
        type: 'TEXT',
        storage: { scope: 'ATTRIBUTES' },
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'personalCode', {
        label: 'Personal code',
        sectionId: 'personal',
        order: 30,
        type: 'TEXT',
        storage: { scope: 'CORE', path: 'personalCode' },
        adminOnly: true,
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'disabledField', {
        label: 'Disabled',
        sectionId: 'personal',
        order: 40,
        type: 'TEXT',
        storage: { scope: 'ATTRIBUTES' },
      }, false),
    ], 'profile-v1');

    const profile: RiderProfile = {
      profileId: 'PROFILE-1',
      name: 'Jane Rider',
      email: 'jane@example.com',
      phone: '+919876543210',
      attributes: {
        dietaryPreference: 'Vegetarian',
        disabledField: 'Keep existing',
      },
      personalCode: 'PCODE-1',
    };

    const payload = buildProfileSavePayload({
      profile,
      definitions,
      values: {
        name: 'Jane Updated',
        dietaryPreference: 'Vegan',
        personalCode: 'SHOULD_NOT_SEND',
        disabledField: 'SHOULD_NOT_SEND',
        unknownField: 'SHOULD_NOT_SEND',
      },
    });

    expect(payload).toMatchObject({
      definitionsVersion: definitions.definitionsVersion,
      name: 'Jane Updated',
      attributes: { dietaryPreference: 'Vegan' },
    });
    expect(payload).not.toHaveProperty('personalCode');
    expect((payload.attributes as Record<string, unknown>).disabledField).toBeUndefined();
    expect((payload.attributes as Record<string, unknown>).unknownField).toBeUndefined();
  });
});
