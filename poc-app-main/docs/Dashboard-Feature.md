# Dashboard Feature

[← Back to README](../README.md)

Dashboard screen specification covering the grid display, stage views, sorting, zoom levels, color coding, and UI layout.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [Rider Grid Display](#1-rider-grid-display)
  - [Stage Count Summary](#2-stage-count-summary)
  - [Stage View](#3-stage-view)
  - [Sorting](#4-sorting)
  - [Color Coding](#5-color-coding)
  - [Floating Action Button](#6-floating-action-button-fab)
  - [UI Layout](#7-ui-layout)
- [Technical Notes](#technical-notes)

---

## Overview
The Dashboard is the home screen displaying real-time rider tracking during daily rides. It shows all riders in a grid format with color-coded status indicators based on their last check-in stage.

## Key Features

### 1. Rider Grid Display
- Grid layout with 6 columns showing Rider IDs
- Color-coded icons representing check-in status
- Default sort: Lexicographical order by Rider ID
- Real-time updates from database

### 2. Stage Count Summary
Located in the header, displays cumulative counts:
- **Stage Counts (Start, PS1, PS2, Finish)**: Includes all riders who reached that stage OR beyond
- **QR Count**: Total riders who quit (counted in stages they reached before quitting)
- **NR Count**: Riders marked as Not Riding (excluded from stage counts)

**Count Logic**: Each stage count is cumulative - includes riders at that stage plus all subsequent stages and QR riders who reached that stage.

### 3. Stage View
- Toggle buttons in footer for each stage
- Active stage view changes display perspective:
  - **Checked-in riders**: Show stage color if they reached that stage
  - **Not checked-in riders**: Show white with gray border
  - **QR riders who reached stage**: Show stage color
  - **QR riders who didn't reach**: Show red (QR color)
  - **NR riders**: Always show gray
- Click active stage button again to return to default view

### 4. Sorting
- Toggle button in footer (left side) with custom sort icon
- **Unsorted Mode**: Riders sorted by Rider ID (lexicographical)
- **Sorted Mode**:
  - **Default View**: Not checked in → QR → Start → PS1 → PS2 → Finish → NR
  - **Stage View**: Not checked in → QR → Checked in → NR
  - All groups sub-sorted by Rider ID

### 5. Color Coding

**Default View:**
- Start: Dark Orange (#D97706)
- PS1: Dark Brown (#7C2D12)
- PS2: Dark Blue (#1E40AF)
- Finish: Dark Green (#15803D)
- QR: Dark Red (#B91C1C)
- NR: Gray (#9CA3AF)
- Not Checked In: White with gray border

**Stage View:**
- Riders who reached stage: Stage color
- Riders who didn't reach: White with gray border
- QR who didn't reach: Red
- NR: Gray

### 6. Floating Action Button (FAB)
- QR Code scanner button (teal color)
- Positioned bottom-right by default
- **Draggable**: User can move it anywhere on screen
- Always accessible during scrolling
- Tap to open QR scanner (when not dragging)

### 7. UI Layout

**Header:**
- Ride name and date
- Stage count chips with counts

**Body:**
- Scrollable rider grid
- Touch rider icon for details (future feature)

**Footer:**
- Sort toggle button (left)
- Stage view toggle buttons (horizontal scroll)
- Height: 60px, accommodates unlimited stages

## Technical Notes
- Uses mock data service for development (to be replaced with live API — see [Data Integration Design](DataIntegrationDesign.md))
- Implements React Native Animated API for FAB drag
- Responsive grid adjusts to screen width
- State management: React hooks (useState, useRef)
- Dashboard reads from SQLite as single source of truth (see [Solution Design → Offline Architecture](SolutionDesign.md#offline-architecture))

---

## Related Documentation

- [Requirements → Dashboard](Requirements.md#dashboard) — Functional requirements for Dashboard
- [Data Integration Design → Dashboard Refresh Strategy](DataIntegrationDesign.md#44-dashboard-refresh-strategy) — Refresh intervals and polling design
- [Solution Design → State Management](SolutionDesign.md#state-management) — Context and state architecture

---

[← Back to README](../README.md)
