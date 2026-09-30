# Sign-up and authentication

_Last updated: 2026-09-29_

- Riders sign up with an email address and password, confirm their email using the verification code, and sign in with those credentials. The app attempts to link a newly verified account to its rider profile; an existing organizer-created profile can also be linked during sign-in.
- A rider given a temporary password must set a new password before continuing. The login screen offers a two-step forgotten-password flow (request code, then enter code and new password). Authenticated riders can change their password using the current password.
- Sessions persist across app restarts; signing out clears the authenticated session. An incomplete or missing rider profile directs the rider to profile creation before the main app.
- The distributed build defaults to one organizer's configured account and API. Invitation-based organizer discovery and multi-organizer switching are *proposals*, not working sign-up flows; see [design](../design/auth-and-signup.md).

The backend owns the rider Cognito User Pool and its configuration: [backend deployment guide](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/guides/deployment.md). For authorization and permission names, use the backend [RBAC source](https://github.com/kvijay77-in/tour-data-api/blob/main/src/layers/common/rbac.py), not app-specific aliases.
