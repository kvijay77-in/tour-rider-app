Follow the `.github/copilot-instructions.md` files in poc-app-main.zip and tour-data-api.zip for now. Repo specific instructions will be added later.

This App is for Cycling Tour riders who can
- Register as Rider in this app.
- Rider need not be a registerd user for a tour.
- Rigister riders mean those who have registered for a tour and have been approved by the tour organizer.
- Riders can view the details of the tour and access other tour specifc functions in the app.
- General riders mean those who are not participating in any tour but can view the details of the tour and access non-tour specifc functions in the app.

>[!IMPORTANT]
> For all purpose all users who will use the app will be referred to as riders. Riders can be of two types: General riders and Registered riders.

# App Signup and Login

- Follow the mechanism for sign up and login as described in the poc-app-main.zip. The same mechanism will be used for both riders and tour organizers.
- Rider must be able to fill up personal details such as name, email, phone number, etc. during sign up.
- Rider must be able to upload a profile picture during sign up or later from the profile settings.
- Rider must be able to login using email and password and have a logout option.
- Rider must be able to reset password in case they forget it.
- Rider must be able to view and edit their profile details after login.

All rider data must be 'strictly' stored in data backend defined in 'tour-data-api.zip'. If any additional table or attribute is needed for this app usage, it can be added tour-data-api backend. This app must provide the requirement. But all design approach must be strictly as per tour-data-api design and implementation. No deviation from the tour-data-api design and implementation is allowed. If any deviation is needed, it must be discussed and approved by the team before implementation.

For now create the basic UI for this app.
For registered users:
- add a tour page that can show their daily check in info. Also create provision for getting nofications from tour organizers.
- self-service option to 'not riding' and 'quit riding' (both are well defined in other 2 repos).


