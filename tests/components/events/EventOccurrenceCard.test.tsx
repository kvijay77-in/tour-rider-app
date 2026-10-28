import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { EventOccurrenceCard } from '../../../src/components/events/EventOccurrenceCard';
import type { EventDefinition, EventOccurrence } from '../../../src/types/event';

const baseEvent: EventDefinition = {
  eventId: 'EVT1',
  eventName: 'Tour briefing',
  eventType: 'SINGLE',
  location: 'Hall',
  sequenceEnforced: true,
  registrationEnabled: true,
  activities: [
    { activityId: 'A2', name: 'Second activity', sequenceNo: 2 },
    { activityId: 'A1', name: 'First activity', sequenceNo: 1, mandatory: true, allowOptOut: true },
  ],
};

const planned: EventOccurrence = {
  eventId: 'EVT1', occurrenceId: 'EVT1#2026-10-01#1', date: '2026-10-01', seq: 1, status: 'PLANNED',
};

const active: EventOccurrence = { ...planned, status: 'ACTIVE' };

function renderCard(overrides: Partial<React.ComponentProps<typeof EventOccurrenceCard>> = {}) {
  const handlers = {
    onRegister: jest.fn(),
    onUnregister: jest.fn(),
    onRecord: jest.fn(),
    onCancel: jest.fn(),
  };
  const result = render(
    <EventOccurrenceCard
      event={baseEvent}
      occurrence={planned}
      registered={false}
      progress={[]}
      selfServiceByActivity={{}}
      busy={false}
      {...handlers}
      {...overrides}
    />,
  );
  return { ...result, handlers };
}

it('shows Register only for a planned occurrence and Un-register when registered', () => {
  const { getByText, handlers, rerender } = renderCard();
  fireEvent.press(getByText('Register'));
  expect(handlers.onRegister).toHaveBeenCalledTimes(1);

  rerender(
    <EventOccurrenceCard
      event={baseEvent}
      occurrence={planned}
      registered
      progress={[]}
      selfServiceByActivity={{}}
      busy={false}
      {...handlers}
    />,
  );
  expect(getByText('Un-register')).toBeTruthy();

  rerender(
    <EventOccurrenceCard
      event={baseEvent}
      occurrence={active}
      registered
      progress={[]}
      selfServiceByActivity={{}}
      busy={false}
      {...handlers}
    />,
  );
  expect(getByText('Registered')).toBeTruthy();
  expect(() => getByText('Un-register')).toThrow();
});

it('sorts activities and labels mandatory activities', () => {
  const { getByText } = renderCard({
    event: baseEvent,
    occurrence: active,
    registered: true,
  });
  const first = getByText('1. First activity *');
  const second = getByText('2. Second activity');
  expect(first).toBeTruthy();
  expect(second).toBeTruthy();
});

it('does not show self-service actions without the bootstrap permission', () => {
  const { getAllByText, queryByText } = renderCard({
    occurrence: active,
    registered: true,
    selfServiceByActivity: { A1: false },
  });
  expect(getAllByText('Pending')).toHaveLength(2);
  expect(queryByText('Mark complete')).toBeNull();
  expect(queryByText('Opt out')).toBeNull();
});

it('requires a variant choice and offers opt-out where allowed', () => {
  const event: EventDefinition = {
    ...baseEvent,
    activities: [{
      activityId: 'A1', name: 'Choose a meal', sequenceNo: 1, allowOptOut: true,
      variantOptions: ['Vegetarian', 'Standard'],
    }],
  };
  const { getByText, getByTestId, handlers } = renderCard({
    event,
    occurrence: active,
    registered: true,
    selfServiceByActivity: { A1: true },
  });
  expect(getByTestId('event-complete-A1').props.disabled).toBe(true);
  fireEvent.press(getByText('Vegetarian'));
  expect(getByTestId('event-complete-A1').props.disabled).toBe(false);
  fireEvent.press(getByTestId('event-complete-A1'));
  fireEvent.press(getByText('Opt out'));
  expect(handlers.onRecord).toHaveBeenNthCalledWith(1, event.activities[0], 'COMPLETED', 'Vegetarian');
  expect(handlers.onRecord).toHaveBeenNthCalledWith(2, event.activities[0], 'OPTED_OUT');
});

it('labels self records and exposes Cancel only for a cancellable own progress record', () => {
  const event: EventDefinition = { ...baseEvent, activities: [baseEvent.activities[1]!] };
  const { getByText, handlers } = renderCard({
    event,
    occurrence: active,
    registered: true,
    progress: [{
      eventId: 'EVT1', occurrenceId: active.occurrenceId, activityId: 'A1',
      recordId: 'R1#A1#now', status: 'COMPLETED', method: 'SELF_SERVICE',
    }],
    selfServiceByActivity: { A1: true },
  });
  expect(getByText('Self')).toBeTruthy();
  fireEvent.press(getByText('Cancel'));
  expect(handlers.onCancel).toHaveBeenCalledWith('R1#A1#now');
});

it('shows completed occurrence progress without offering lifecycle-closed actions', () => {
  const event: EventDefinition = { ...baseEvent, activities: [baseEvent.activities[1]!] };
  const completed: EventOccurrence = { ...planned, status: 'COMPLETED' };
  const { getByText, queryByText } = renderCard({
    event,
    occurrence: completed,
    registered: true,
    progress: [{
      eventId: 'EVT1', occurrenceId: completed.occurrenceId, activityId: 'A1',
      recordId: 'R1#A1#now', status: 'COMPLETED', method: 'SELF_SERVICE',
    }],
    selfServiceByActivity: { A1: true },
  });
  expect(getByText('Complete')).toBeTruthy();
  expect(getByText('Self')).toBeTruthy();
  expect(queryByText('Mark complete')).toBeNull();
  expect(queryByText('Cancel')).toBeNull();
});

it('shows registration-disabled guidance and permits active participation', () => {
  const event: EventDefinition = { ...baseEvent, registrationEnabled: false };
  const { getByText } = renderCard({
    event,
    occurrence: active,
    registered: false,
    selfServiceByActivity: { A1: true },
  });
  expect(getByText('All tour riders participate')).toBeTruthy();
  expect(getByText('Mark complete')).toBeTruthy();
});