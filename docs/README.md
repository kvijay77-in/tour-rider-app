# Rider app documentation

_Last updated: 2026-09-30_

This repository documents the rider-facing Expo app. The [platform overview](https://kvijay77-in.github.io/cycling-tour-platform/) describes the whole system; the [shared glossary](https://github.com/kvijay77-in/cycling-tour-platform/blob/main/docs/glossary.md) defines cross-app terms.

## Requirements

- [Sign-up and authentication](requirements/sign-up-and-auth.md)
- [Profile and picture](requirements/profile.md)
- [Tours and registration](requirements/tours-and-registration.md)
- [Check-in status](requirements/check-in-status.md)
- [Notifications](requirements/notifications.md)
- [Training challenge](requirements/training-challenge.md)

## Design

- [Architecture and navigation](design/architecture.md)
- [Authentication and sign-up](design/auth-and-signup.md)
- [Dynamic profile schema](design/profile-schema.md)
- [Notifications](design/notifications.md)
- [App variants and environments (Test / Production)](design/app-variants-and-environments.md)

## Guides

- [Development and project structure](guides/development.md)
- [Build and distribution](guides/deployment.md)
- [EAS build and release](guides/eas-build-and-release.md)
- [Rider's guide](user-guide/README.md)
- [Historical planning notes](misc/INITIAL_PLANNING_SUMMARY.md)

The [backend API reference](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md) and [backend deployment guide](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/guides/deployment.md) are the sources of truth for API contracts and AWS resources. This app does not provision them.
