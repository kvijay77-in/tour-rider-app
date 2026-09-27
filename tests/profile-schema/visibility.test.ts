import { evaluateVisibleWhen } from '../../src/profile-schema';

describe('evaluateVisibleWhen', () => {
  it('supports EQ, NEQ, IN and NOT_EMPTY operations', () => {
    const values = {
      hasMedicalCondition: true,
      dietaryPreference: 'VEG',
      bloodGroup: 'B+',
      emergencyContact: { name: 'Jane' },
    };

    expect(evaluateVisibleWhen({ attribute: 'hasMedicalCondition', op: 'EQ', value: true }, values)).toBe(true);
    expect(evaluateVisibleWhen({ attribute: 'dietaryPreference', op: 'NEQ', value: 'NON_VEG' }, values)).toBe(true);
    expect(evaluateVisibleWhen({ attribute: 'bloodGroup', op: 'IN', value: ['A+', 'B+'] }, values)).toBe(true);
    expect(evaluateVisibleWhen({ attribute: 'emergencyContact', op: 'NOT_EMPTY' }, values)).toBe(true);
  });
});
