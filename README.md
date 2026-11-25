# Tour Rider App

_Last updated: 2026-09-29_

The rider-facing React Native/Expo app for cycling tours. Riders can manage their profile, see tour rides and ride details, read notifications and change their password. The Training Challenge page currently says “Coming soon.” Some tour registration and check-in screens exist but are not linked from the current navigation.

- [Documentation](docs/README.md) — requirements, design and development/release guides
- [Rider's guide](docs/user-guide/README.md) — how to use the current app
- [Cycling Tour Management Platform](https://kvijay77-in.github.io/cycling-tour-platform/) — platform overview and shared [glossary](https://github.com/kvijay77-in/cycling-tour-platform/blob/main/docs/glossary.md)

For local development, run `npm ci`, copy `.env.example` to `.env` with values from the backend deployment, and run `npm start`. See the [development guide](docs/guides/development.md) and [app build guide](docs/guides/deployment.md). The app does not provision AWS resources; the backend owns the rider account pool and the authenticated HTTP API.

Related repositories: [tour-data-api](https://github.com/kvijay77-in/tour-data-api) (backend and infrastructure), [tour-mgmt-app](https://github.com/kvijay77-in/tour-mgmt-app) (organizer/crew app), and [cycling-tour-platform](https://github.com/kvijay77-in/cycling-tour-platform) (platform site).


## License
Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Free for learning and non-commercial use. For commercial use, contact [kvijay77.in@gmail.com].