import { buildProfileDefinitions } from '../../src/profile-schema';
import type { AppConfigEntry } from '../../src/profile-schema';

function entry(configType: string, configId: string, config: Record<string, unknown>, enabled = true, version = 1): AppConfigEntry {
  return { configType, configId, config, enabled, version };
}

describe('buildProfileDefinitions', () => {
  it('orders sections and attributes and skips disabled or orphaned attributes', () => {
    const definitions = buildProfileDefinitions([
      entry('RIDER_PROFILE_SECTION', 'medical', { label: 'Medical', order: 20 }),
      entry('RIDER_PROFILE_SECTION', 'personal', { label: 'Personal', order: 10 }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'hasMedicalCondition', {
        label: 'Medical condition',
        sectionId: 'medical',
        order: 20,
        type: 'BOOLEAN',
        storage: { scope: 'ATTRIBUTES' },
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'name', {
        label: 'Name',
        sectionId: 'personal',
        order: 20,
        type: 'TEXT',
        storage: { scope: 'CORE', path: 'name' },
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'email', {
        label: 'Email',
        sectionId: 'personal',
        order: 10,
        type: 'EMAIL',
        storage: { scope: 'CORE', path: 'email' },
        handler: 'COGNITO_EMAIL',
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'legacy', {
        label: 'Legacy',
        sectionId: 'missing',
        order: 5,
        type: 'TEXT',
        storage: { scope: 'ATTRIBUTES' },
      }),
      entry('RIDER_PROFILE_ATTRIBUTE', 'disabledField', {
        label: 'Disabled',
        sectionId: 'personal',
        order: 30,
        type: 'TEXT',
        storage: { scope: 'ATTRIBUTES' },
      }, false),
    ], 'server-defs-v1');

    expect(definitions.sections.map((section) => section.id)).toEqual(['personal', 'medical']);
    expect(definitions.sections[0]?.attributes.map((attribute) => attribute.key)).toEqual(['email', 'name']);
    expect(definitions.sections[1]?.attributes.map((attribute) => attribute.key)).toEqual(['hasMedicalCondition']);
    expect(definitions.attributesByKey.legacy).toBeUndefined();
    expect(definitions.attributesByKey.disabledField).toBeUndefined();
    expect(definitions.definitionsVersion).toBe('server-defs-v1');
  });
});
