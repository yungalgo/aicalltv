# User Journeys

## Overview

This document outlines the primary user flows through the Quadball Canada platform, aligned with the actual routes implemented in the application.

## Core User Types

1. **Players** - Individual members who play quadball
2. **Team Managers** - Coaches and captains who manage teams
3. **Event Coordinators** - Organizers who run tournaments
4. **Administrators** - Platform admins with full access

## Primary User Journeys

### 1. New Member Onboarding ✅ (Implemented)

**Goal**: Join Quadball Canada and get ready to play

```
Landing Page → Sign Up → Email Verification → Complete Profile → Purchase Membership
     /              ↓                              ↓                    ↓
    /         /login or /signup            /dashboard/profile    Square Checkout
   /                                                              (planned)
```

**Key Steps**:

1. User discovers platform via social media or search
2. Creates account with email/password or OAuth
3. Verifies email address
4. Completes profile with emergency contact
5. Purchases membership through Square (⏳ planned)

**Routes Involved**:

- `/` - Landing page with CTA ✅
- `/signup` - Registration form ✅
- `/login` - Alternative entry ✅
- `/dashboard/profile` - Profile completion ✅
- External Square checkout ⏳

### 2. Team Registration for Event ⏳ (Planned)

**Goal**: Register team for upcoming tournament

```
Team Dashboard → Browse Events → Event Details → Team Registration → Payment
      ↓               ↓               ↓                ↓               ↓
/dashboard/team  /events         /events/[slug]   Registration    Square/E-transfer
   (planned)     (planned)         (planned)         Form            (planned)
```

**Key Steps**:

1. Team manager logs in to dashboard
2. Browses upcoming events
3. Reviews event details and requirements
4. Registers team with roster selection
5. Pays registration fee

**Routes Involved**:

- `/dashboard` - Team overview ✅
- `/events` - Event listing ⏳
- `/events/[slug]` - Event details ⏳
- `/events/[slug]/register` - Registration flow ⏳

### 3. Event Creation and Management ⏳ (Planned)

**Goal**: Create and manage a tournament

```
Admin Panel → Create Event → Configure Details → Open Registration → Manage Participants
     ↓             ↓                ↓                   ↓                  ↓
   /admin    /admin/events/new   Event Form      Publish Event    /admin/events/[id]
  (planned)      (planned)        (planned)         (planned)          (planned)
```

**Key Steps**:

1. Coordinator accesses admin panel
2. Creates new event with details
3. Sets registration windows and fees
4. Opens registration to teams
5. Monitors and manages registrations

**Routes Involved**:

- `/admin` - Admin dashboard ⏳
- `/admin/events` - Event management ⏳
- `/admin/events/new` - Event creation ⏳
- `/admin/events/[id]` - Event details ⏳

### 4. Member Renewal ⏳ (Planned)

**Goal**: Renew annual membership

```
Email Reminder → Login → Dashboard → Renewal Prompt → Payment → Confirmation
       ↓           ↓         ↓            ↓              ↓           ↓
   Notification  /login  /dashboard   Membership     Square      Email + UI
   (planned)      ✅         ✅        Page (planned) (planned)   (planned)
```

**Key Steps**:

1. Member receives renewal reminder
2. Logs in to account
3. Sees renewal prompt on dashboard
4. Reviews membership options
5. Completes payment
6. Receives confirmation

**Routes Involved**:

- `/login` - Authentication ✅
- `/dashboard` - Member dashboard ✅
- `/membership` - Membership management ⏳
- External payment flow ⏳

## Supporting Flows

### Password Reset ⏳ (Planned)

```
Login Page → Forgot Password → Email Sent → Reset Link → New Password → Login
    ↓              ↓              ↓            ↓             ↓           ↓
  /login    /forgot-password   Check Email  /reset/[token]  Success    /login
    ✅          (planned)                      (planned)                  ✅
```

### Team Roster Management ⏳ (Planned)

```
Team Dashboard → Roster → Add Players → Send Invites → Players Join
       ↓           ↓          ↓             ↓              ↓
/dashboard/team  /team/roster  Modal    Email sent    Accept invite
   (planned)      (planned)  (planned)   (planned)      (planned)
```

### Profile Updates ✅ (Implemented)

```
Dashboard → Profile → Edit → Save → Confirmation
    ↓         ↓       ↓      ↓         ↓
/dashboard  /profile  Form  Server   Success
    ✅         ✅       ✅      ✅        ✅
```

## Error Handling

All flows include error states:

1. **Authentication Errors**: Redirect to login with return URL ✅
2. **Permission Errors**: Show appropriate error message ✅
3. **Payment Errors**: Return from Square with error handling ⏳
4. **Validation Errors**: Inline form validation ✅

## Mobile Considerations

All journeys are optimized for mobile:

1. **Touch-friendly**: Large tap targets ✅
2. **Progressive Forms**: Multi-step on mobile ⏳
3. **Simplified Navigation**: Bottom nav on mobile ⏳
4. **Offline Support**: Key pages cached ⏳

## Analytics Events

Key events tracked:

1. **Registration Started**: User begins signup ⏳
2. **Registration Completed**: Account created ⏳
3. **Membership Purchased**: Payment successful ⏳
4. **Event Registration**: Team registered ⏳
5. **Profile Completed**: All fields filled ⏳

## Implementation Status

| Feature                 | Status      | Notes                 |
| ----------------------- | ----------- | --------------------- |
| **Authentication Flow** | ✅ Complete | Login, signup, OAuth  |
| **Profile Management**  | ✅ Complete | View and edit profile |
| **Team Management**     | ⏳ Planned  | Q2 2025               |
| **Event System**        | ⏳ Planned  | Q2 2025               |
| **Payment Integration** | ⏳ Planned  | Q2 2025               |
| **Email Notifications** | ⏳ Planned  | Q2 2025               |
| **Admin Panel**         | ⏳ Planned  | Q3 2025               |
