# Requirements

[← Back to README](../README.md)

Detailed functional requirements, use cases, and feature specifications for the Check-In App.

## Table of Contents

- [Introduction](#introduction)
- [Rider Profile](#rider-profile)
- [Dashboard](#dashboard)
  - [Stage Count](#stage-count)
  - [Historical View](#historical-view)
  - [Stage View](#stage-view)
  - [Sort](#sort)
  - [Zoom In & Out](#zoom-in--out)
- [Check-In](#check-in)
  - [Start - Flag Off](#start---flag-off)
  - [Pit Stops](#pit-stops)
  - [Finish](#finish)
  - [Not Riding (NR)](#not-riding-nr)
  - [Quit Riding](#quit-riding)
  - [Check In for Stage View](#check-in-for-stage-view)
- [Role Based App Access](#role-based-app-access)
  - [Administrator](#administrator)
  - [Super User](#super-user)
  - [Pit Stop Crew](#pit-stop-crew)
  - [Hotel Staff](#hotel-staff)
  - [Guest](#guest)
- [Offline Capability](#offline-capability)
- [Administrator Features](#administrator-features)
- [Backend](#backend)
- [Others](#others)

---

## Introduction  
An application is required for the usage in non-competitive Cycling Tour to manage daily rides and track riders in each ride. This app will be used by Cycling Tour administrators, pit stop team and optionally by hotel front desk staff to check-in riders at various stages of the daily ride - Start - Flag Off, Pit Stop(s) and Finish.

This app should provide 2 primary features:  
1. Dashboard - for Ride progress & Rider tracking  
1. Rider Check-In  

Apart from these following Admin features should also be available.  
1. Add/Modify Ride
1. Close Pit Stop
1. Close Ride

Future additions:  
- Push Notifications
- Room allocation at Finish stage check in

App must implement RBAC for all the features using clearly defined labels at feature level and Roles that can defined by group multiple features. Roles will be assigned to registered users of this application by an Administrator.

Following sections elaborates on what features required in the app together with more information about ride progress and rider tracking process.

# Rider Profile  
Each Rider registered for the tour will be assigned a unique Rider ID which must be used for all tracking purposes in this app. Rider ID together with some additional info about the Rider will be stored in a table for various purposes. Assignment of Rider ID and collecting and storing Rider info is out of scope for this app. This data expected to be available for the app to use and no modification of this data can be allowed in the app.

QR Code will be generated for each Rider that will embed Rider ID and other information as required and provided to the respective Rider before the tour commences.

# Dashboard
This is the Home Screen for the app. A sample mock up for visualization purpose is available [here](./Images/Dashboard_sample.png).

Dashboard should list all riders similar to that in the mock up in a grid format. Source for the dashboard should be from a Cloud based database table. Each icon should have the Rider ID as the label and should have various color based representation to indicate the last stage at which the Rider has checked in. Color code Stage legend should be displayed for easy understanding.

By default Dashboard should give the full picture of the Ride with latest Rider check in status and sorted by Rider ID in lexicographical order. There should be filter and sort options available.  

## Stage Count

This is part of the Header section in the Dashboard. Logic for count:
- Start: Now counts all riders who have checked in at Start or beyond (includes PS1, PS2, Finish, and QR riders who started)
- PS1: Counts riders who reached PS1 or beyond (includes PS2, Finish, and QR riders who reached PS1)
- PS2: Counts riders who reached PS2 or beyond (includes Finish and QR riders who reached PS2)
- Finish: Counts only riders who completed
- QR: Total QR riders (counted separately, but also included in their respective stage counts based on where they reached before quitting)
- NR: Excluded from stage counts as they never started

## Historical View
Dashboard should always display the respective calendar day's ride by default. There should be an option to view previous days or historical ride. When viewing historical ride, it must be alway in read-only mode i.e. check in feature must be disabled. Historical view should be available for all dates from the start of the tour with dates listed based on the ride dates available in the database as a list. A calender view instead of list can be considered if that provides a good user experience.

## Stage View
When App is launched and Dashboard is displayed it give a complete view of the riders' progress. A Stage-wise view is also required for someone to see what's the stage's status. Each stage should have a button that can toggle Stage View on and off. When stage view is on, it should display check in status relative to the stage i.e. show all riders and Rider icon color should have respective Stage color for checked in riders and a different color for not checked in riders. When stage view is off (toggle), view should go back to default complete view.

Rider icon with Not Riding and Quit Riding status should appear with respective fix color.

## Sort  
Sort should made available as a toggle option - sorted and unsort (which is actually sorted by Rider ID). Sorting when activated should group and order riders by stage. When sorting is activated within filtered view, show not checked in first and then checked in. When sorting is activated it should always have sub-sorting on Rider ID.  

Rider IDs with Not Riding and Quit Riding status should appear in the end when sorting is activated.

## Zoom In & Out
Dashboard should have a pinch and zoom feature for mobile app. Zoom should have 4 levels. For all levels grid format should be used.
- Level 1: Rider ID only
- Level 2: Rider ID and Name.
- Level 3: Rider ID, Name and Contact no.
- Level 4: Rider ID, Name, Photo and Contact no.

Dashboard will use level 1 as default zoom level. 

In Level 1 and 2, when an Rider icon is clicked, full Rider card pop-up should appear. Rider Card is complete detail of the Rider that is available and for time being card will have Rider ID, Name, Photo and Contact no. 

# Check-In
This is the key process to track riders in each ride. Tracking is done by registering the riders at every stage as they cycle along the planned route and reach the destination to finish the ride.

Check-in process (at all stages) required to be done by scanning the Rider's QR code to get the Rider ID and record the time when the scanning was done. This needs to be updated in a table to allow persistence and make data available centrally to allow other App users to get live status of the progress in the app Dashboard.

There can be 2 special cases as part of the check in:  
* Not Riding
* Quit Riding

Special cases should also be handled using QR Code scanning. User must select the check-in type (regular check-in, Not Riding, or Quit Riding) from a menu/UI option before scanning the QR code. These check in should be visible in Dashboard distinctively. An fixed color representation for these 2 cases should be implemented universally in the Dashboard.

A manual check-in option should be available to allow 'Quit Riding' check in remotely where QR Code scanning is not possible.

A fallback option should be automatically activated when QR Code scanning fails with 2 to 3 retries. This should allow manually inputting Rider ID as per the check in option. This is a sub-feature of check in and not same as manual check in option.

## Start - Flag Off  
On each day of the tour, before the ride is Started/Flagged off all riders must be checked in to ensure all riders who will ride for the day are accounted for. Check-in can be done by any designated tour admin team member with access to the app and applicable role permission.  

Tour Director will use the dashboard to view the check-in progress and only when all check-ins are completed she/he will give go ahead to start the ride.

## Pit Stops  
Pit Stops are pre-determined location along the ride route for riders to take a break and refuel/recharge and there will be one or 2 tour staff to manage each pit stop. From the app scope, their primary responsibility is to check-in each and every Rider who reaches the corresponding pit stop. Pit Stop Crew will have the control on to flag the assigned pit stop as 'Open' and 'Closed'. This will help to a tracking view for Pit Stops. In future this status can even be used for Rider App (not scope for this project) to let riders know Pit Stop as been opend and closed.

No. of pit stops may vary as per the day's ride plan and distance. Dashboard should dynamically adapt to the corresponding ride and no. of pit stops automatically.

## Finish  
Finish point is usually a hotel at the destination town where the riders will complete the day's ride. A pre-authorized hotel front desk staff will use the app to scan Rider's QR Code to check in for the Finish stage.

## Not Riding (NR)  
When a Rider decides to not ride for the day, same needs to be registered by a tour staff with relevant permission  at the starting point before the ride starts for the day. Once a Rider is marked 'Not Riding' no further check should be allowed at any other stages.

## Quit Riding  
A rider can decide to quit the ride or call it a day at any point in the ride after starting the ride. A Rider can decide to 'Quit Riding' at a pit stop or any location between stages.  

If Rider decides at a pit stop, pit stop crew user should register the Rider as 'Quit Riding'. This can be done before or after pit stop check in is completed.

If a Rider decides to Quit Riding in between any stage, QR Code scanning is not possible as there is no user around to do it. In this scenario usually Rider inform/post in the WhatsApp Group Chat monitored by Tour Director or user with Super User role and one of them can perform a manual check in using the Rider ID, remotely.

Once a Rider is registered as 'Quit Riding' any further check in should not be allowed for that Rider.  

## Check In for Stage View  
When a Rider checks in at multiple stages implies that the Rider has checked in all stages till the last checked in stage. This is important in Stage View.

Say a Rider latest checked in stage is PS1 and this implies that the Rider has checked in at Start and PS1. So in the Dashboard default view, PS1 color should be assigned to corresponding Rider ID icon. But in Stage views it slightly varies. Same Rider in Start stage view, should have Start color and in PS1 Stage view as PS1 stage color.

Another example and in this let's take a Rider has finished the ride i.e. the latest check-in is at Finish stage. So in Stage Views, Start, PS1 and PS2 the Rider ID icon color should be that of the respective stages. For clarity, in default view it should be Finish stage color.

For Rider who quit and checked in as QR, in Stage View, Stage check-in should take precedence if already checked in in that stage before quitting. In default view, QR check in status should be used. For Stage Views after QR check in, Rider status should show QR and not 'not checked in yet' to indicate to the pit crew that the rider will not be checking in further and no need to track.

# Role based app Access  
App access should be access controlled based on role. Each feature or function in the app must have a specific label or name to it. These labels can be combined in different combinations to create roles. Only user assigned with a valid role should have access to the corresponding feature/function.  

Function can be disabled or should not appear in the app if it not permitted to use by a user based on their role. This needs to be determined based on app design and ease of code maintenance. This will be decided on case by case basis.

Possible Roles expected:
- Administrator
- Super User
- Pit Stop Crew
- Hotel Staff
- Guest

## Administrator
This role will have unrestricted full access to all features and functions available in the app.

## Super User
This role will have access to all features and functions except Add/Modify and Close Ride features.

## Pit Stop Crew
This role will have access to all check in features including the 2 special cases. For clarity purpose manual check in feature will not be available for this role - Not Riding can be registered before the start of the ride and if Rider decides to Quit Riding at Pit Stop, this can be captured by scanning the QR Code.

This role will have the ability to mark assigned pit stop as 'Opened' and 'Closed' to allow good control on Pit Stop status.

There can be more than 1 pit stops hence this role assignment should include the pit stop (stage) no as well.  

Fallback feature should be considered as part of standard check in and not as manual check in feature.

Dashboard view should be fully available with option to switch to user's pit stop filter view.

## Hotel Staff
This should be flagged as a special role where Dashboard access should not be available. User with this role can only scan QR code to mark a Rider as finished the ride. There is a future functionality linked to this role. To be taken up at a later stage.  

## Guest
This role is a read-only Dashboard role with all other features disabled or removed. Purpose of having this role is basically to allow users to view the ride progress or historical dashboard.

# Offline Capability:
The app does not support offline mode. All features require an active internet connection.

When the device loses connectivity, the app displays a simple **"You are offline"** status banner to inform the user. No data is cached locally.

# Administrator Features  

1. Add/Modify Ride
1. Close Ride - Lock the day's ride as completed and disable any further check ins.  

Data model and fields to be determined as part of design and development stage.

# Backend
Data model and APIs for data access is provided by solution developed by the repo - [Backend](https://github.com/kvijay77-in/tour-data-api). Read through it's requirements and how it is implemented. Follow guidelines and recommendations in this repo for any data access implementation. Ensure data privacy and security is not compromised for any reason. 

# Others
Mobile device permission is only required for Camera to scan QR Code.

---

## Related Documentation

- [Solution Design](SolutionDesign.md) — Architecture and technical design
- [Dashboard Feature](Dashboard-Feature.md) — Dashboard screen specification
- [Data Integration Design](DataIntegrationDesign.md) — Backend integration and offline sync design
- [tour-data-api Requirements](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/Requirements.md) — Backend data requirements

---

[← Back to README](../README.md)
