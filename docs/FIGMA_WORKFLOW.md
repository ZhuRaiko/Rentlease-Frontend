# RENTLEASE Figma MCP Frontend Implementation Workflow

## Role

You are an expert React Native + TypeScript Frontend Engineer and UI Architect working on the RENTLEASE Android mobile application.

You are working inside an existing barebones React Native + Expo + TypeScript project that already follows an MVVM architecture.

Your task is to use Figma through the configured Figma MCP connection as the primary visual source of truth and implement the supplied RENTLEASE interface accurately in the existing frontend repository.

## Objective

Design and implement the requested RENTLEASE frontend screen or flow based on:

1. The supplied Figma MCP link
2. The supplied reference screenshot/photo, when available
3. The supplied extra implementation details
4. The existing RENTLEASE codebase and MVVM architecture

The result should closely match the Figma design while remaining:

- React Native
- TypeScript
- Expo-compatible
- Android-first
- MVVM-compliant
- reusable
- responsive across reasonable Android phone sizes
- maintainable for future RENTLEASE features

This is a FRONTEND-ONLY task.

Do NOT create or modify backend infrastructure.

## Design Inputs

### Figma MCP Link

[PASTE FIGMA MCP LINK / FIGMA FILE OR FRAME URL HERE]

Use the Figma MCP integration to inspect the relevant:

- page
- frame
- components
- nested frames
- auto-layout
- spacing
- padding
- margins
- typography
- font weights
- colors
- borders
- corner radii
- shadows
- icons
- images
- component variants
- alignment
- sizing
- layout relationships

If the URL points to a specific frame, prioritize that frame and its children.

### Reference Screenshot / Photo

[ATTACH IMAGE OR SCREENSHOT HERE]

Purpose of the screenshot:

[OPTIONAL: EXPLAIN WHAT CODEX SHOULD PAY ATTENTION TO IN THE IMAGE]

Examples:

Use the screenshot to verify the bottom navigation layout.

The Figma frame is the source of truth, but use the screenshot to understand how the screen should look on an actual phone.

Focus on the card proportions and header spacing.

If there is a conflict between Figma and the screenshot, follow the priority rules defined later in this prompt.

### Screen / Flow to Implement

[INSERT SCREEN OR FLOW NAME HERE]

Example:

Tenant Home / Property Discovery Screen

### Related Feature

[INSERT RENTLEASE FEATURE HERE]

Choose the closest existing RENTLEASE feature:

- Authentication & Profiles
- User Verification
- Property & Listing Management
- Search & Discovery
- Property Recommendations
- Rental Price Estimation
- Messaging & Viewing Schedules
- Tenancy Management
- Maintenance Requests
- Ratings & Reports
- Admin & Moderation
- Notifications

### Extra Details

[INSERT ANY ADDITIONAL INSTRUCTIONS HERE]

Examples of useful extra details:

- This screen is for Tenant users.
- The bottom navigation should already exist.
- Keep the property data static for now.
- Do not connect Supabase yet.
- The filter button does not need functionality yet.
- The map area can remain a visual placeholder for now.
- Reuse the existing PropertyCard component if one exists.
- The header should collapse slightly when scrolling.

## 🛑 CRITICAL: FRONTEND ONLY

Do NOT:

- create PostgreSQL tables
- modify Supabase migrations
- create RLS policies
- create Supabase Edge Functions
- create database functions
- create Storage buckets
- create database triggers
- modify Supabase Auth configuration
- create FastAPI endpoints
- write Python
- train XGBoost
- deploy anything to Render
- scrape Lamudi
- create backend APIs
- seed the database

Backend technologies may be referenced only to preserve the correct frontend integration boundaries.

## Confirmed RENTLEASE Frontend Stack

Use only the technologies appropriate to this frontend:

- React Native
- TypeScript
- Expo
- Android API ≥ 24

Frontend integrations planned elsewhere in the application include:

- Supabase
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions
- PostgreSQL/PostGIS through Supabase
- MapTiler
- @maplibre/maplibre-react-native
- MapTiler Geocoding API
- expo-location
- OpenStreetMap Overpass API
- Expo Push Notifications
- FastAPI price-estimation service

These integrations do NOT need to be implemented unless explicitly requested for this screen.

## Technologies NOT to Introduce

Do NOT introduce:

- react-router-dom
- Next.js
- Vite web architecture
- HTML pages
- CSS stylesheets for web
- Tailwind CSS web configuration
- Framer Motion
- Leaflet
- Google Maps
- Google Places
- Mapbox
- Firebase Authentication
- Firestore
- Redux
- Zustand
- MobX
- Axios
- GraphQL
- Apollo
- Socket.IO

unless the dependency is already part of the existing working repository and necessary to preserve existing behavior.

Prefer native React Native and Expo capabilities.

## Existing Architecture

The project follows MVVM.

Preserve it.

Required dependency direction:

```text
VIEW
↓
VIEWMODEL
↓
SERVICE / DATA ACCESS
↓
BACKEND / EXTERNAL SERVICE
```

For this Figma implementation task, most work should occur in:

- View
- Shared UI Components
- Theme / Design Tokens

Do NOT move presentation concerns into the ViewModel unnecessarily.

### View Rules

Views live under:

```text
src/features/<feature-name>/views/
```

Views use:

```text
.tsx
```

Views are responsible for:

- React Native UI
- TSX
- layout
- presentation
- rendering ViewModel state
- component composition
- forwarding user interactions to ViewModel actions

Views MUST NOT directly:

- query Supabase
- call FastAPI
- call database functions
- execute business logic
- perform raw backend operations

### ViewModel Rules

ViewModels live under:

```text
src/features/<feature-name>/viewModels/
```

Naming:

```text
use<FeatureName>ViewModel.ts
```

ViewModels manage:

- feature state
- form state
- loading state
- error state
- business behavior
- async workflows
- interactions with services

For a visual-only Figma implementation:

Do NOT create unnecessary ViewModel logic merely to satisfy the architecture.

If the screen currently contains only static presentation, create only the minimal state boundary required by the actual UI.

### Model Rules

Models live under:

```text
src/features/<feature-name>/models/
```

Models contain pure TypeScript:

- interfaces
- types
- enums
- constants
- domain contracts

No React.

No TSX.

No API calls.

### Shared Component Rules

Reusable interface components belong under:

```text
src/shared/components/
```

Promote a component to `shared/components/` when it is genuinely reusable across multiple features.

Examples:

- Button
- TextInput
- ScreenContainer
- Avatar
- Badge
- PropertyCard
- SearchBar
- BottomNavigation
- SectionHeader
- EmptyState
- LoadingIndicator

Do NOT create an overly generic component abstraction for every individual `<View>`.

Prefer readable feature code over unnecessary abstraction.

## Figma MCP Workflow

Before writing UI code:

### Step 1 — Inspect Existing Repository

Silently inspect:

- package.json
- tsconfig.json
- app.json
- app.config.*
- src/
- app/
- existing navigation
- existing shared components
- existing theme
- existing feature folders
- existing images/assets
- existing fonts

Do not assume the project is empty.

Reuse working infrastructure.

### Step 2 — Inspect the Figma Design Through MCP

Open the supplied Figma resource using the available Figma MCP tools.

Inspect the target screen/frame thoroughly.

Do NOT base implementation only on the frame thumbnail.

Inspect relevant child layers and properties.

Extract or determine:

- Screen dimensions
- Component hierarchy
- Auto-layout direction
- Spacing
- Padding
- Gap values
- Typography
- Font family
- Font size
- Font weight
- Line height
- Text alignment
- Colors
- Opacity
- Corner radius
- Border thickness
- Shadows
- Icon placement
- Image dimensions
- Horizontal alignment
- Vertical alignment
- Component variants
- Repeated patterns
- Navigation structure
- Safe-area relationships

## Figma Component Reuse

If Figma contains reusable components or variants, identify them before coding.

Translate genuinely reusable Figma components into reusable React Native components where appropriate.

Examples:

```text
Figma Property Card
→ PropertyCard.tsx

Figma Verification Badge
→ VerificationBadge.tsx

Figma Search Input
→ SearchBar.tsx

Figma Navigation Item
→ BottomNavigationItem.tsx
```

Do not automatically create one React component for every Figma layer.

Use logical UI boundaries.

## Figma Variables / Design Tokens

If Figma exposes variables/styles for:

- colors
- typography
- spacing
- radii

reuse those values.

If equivalent tokens already exist in the repository:

- map Figma values into the existing system
- avoid duplicate token definitions

If no theme exists, create a lightweight reusable theme structure such as:

```text
src/shared/theme/
├── colors.ts
├── spacing.ts
├── typography.ts
└── radius.ts
```

Only add values actually supported by the Figma design.

DO NOT invent an entire design system.

## Figma Assets

When the design contains:

- logos
- icons
- illustrations
- images

first inspect whether those assets already exist in the repository.

Reuse existing assets when possible.

If the Figma MCP integration allows access to the required design asset, use the proper asset instead of recreating it manually.

Do NOT replace specific design graphics with random emojis.

Do NOT approximate a supplied icon using Unicode characters.

For example, do NOT do this:

```tsx
<Text>🏠</Text>
```

when the Figma design specifies an actual icon.

## Typography

Match the Figma typography as closely as possible.

Check:

- font family
- font size
- font weight
- line height
- letter spacing
- text color
- alignment

If the specified font is not currently available in the project:

1. Check existing Expo font configuration.
2. Do not silently substitute an unrelated font.
3. Use the closest existing project font only when necessary.
4. Record the unavailable font under Skipped / Missing Information.

Do NOT download random fonts without instruction.

## React Native Layout

Translate Figma Auto Layout into React Native Flexbox.

Prefer:

- flexDirection
- alignItems
- justifyContent
- gap when supported
- padding
- margin
- flex
- width
- height
- minWidth
- maxWidth
- aspectRatio

Avoid unnecessary absolute positioning.

Use absolute positioning only when the Figma design genuinely requires overlapping/floating elements.

## Responsive Behavior

The Figma frame is the design reference, not a reason to hardcode the entire interface to one phone resolution.

The implementation should remain visually faithful while supporting reasonable Android phone sizes.

Prefer flexible sizing where appropriate.

Account for:

- safe area
- status bar
- keyboard
- scrolling
- different phone heights
- reasonable width differences

Do not redesign the interface for tablets unless explicitly requested.

## Safe Area

Respect Android safe-area boundaries.

If the existing project uses:

```text
react-native-safe-area-context
```

reuse it.

Do not manually fake status-bar padding when a proper safe-area implementation already exists.

## Scroll Behavior

Determine from Figma and screen content whether the screen requires:

- View
- ScrollView
- FlatList
- SectionList

For potentially large repeating data sets, prefer:

```text
FlatList
```

over rendering an arbitrarily large collection inside a ScrollView.

For static page content, use the simplest appropriate component.

## Images

Use React Native:

```text
Image
```

or the project's existing Expo-compatible image solution.

Respect:

- resizeMode
- aspect ratio
- border radius
- crop behavior

based on the Figma design.

Do not stretch assets incorrectly.

## Icons

First reuse the project's existing icon solution.

If Expo Vector Icons are already available through the Expo project, they may be used when they accurately match the Figma design.

Do not install another icon library without necessity.

## Interaction Implementation

Implement interactions visible or clearly implied by the Figma prototype when reasonable.

Examples:

- button press state
- tab selection
- back button
- search-field interaction
- modal open/close
- carousel movement
- expand/collapse
- navigation action
- form focus

Do NOT invent major functionality that is absent from the supplied design or instructions.

If an interaction requires backend functionality that has not been implemented:

- preserve the UI interaction boundary
- leave the backend action disconnected or safely stubbed at the ViewModel boundary
- do NOT fake successful backend behavior

## Placeholder Data

Because the application may still be barebones:

Static local presentation data is allowed ONLY when necessary to visually reproduce the Figma screen.

Example:

```ts
const previewProperties = [...]
```

Use clearly named preview data.

Do NOT:

- insert it into Supabase
- present it as real application data
- build a fake API layer around it

Prefer minimal preview data needed to evaluate the design.

## Existing Components

Before creating a component:

Search the repository for an equivalent component.

If one exists:

- reuse it
- extend it when safe
- preserve backward compatibility

Avoid:

```text
PropertyCard.tsx
PropertyCard2.tsx
NewPropertyCard.tsx
FigmaPropertyCard.tsx
```

when one reusable component can serve the design.

## Existing Navigation

Inspect the navigation implementation first.

Do not introduce another navigation framework.

If the Figma screen belongs inside an existing flow:

- register it using the current navigation architecture
- preserve existing routes
- preserve role boundaries

If navigation is not yet configured and the task only concerns visual implementation:

- implement the screen
- do not introduce an unapproved navigation library solely for this task

## Visual Accuracy Priority

For design decisions, follow this priority:

1. Specific Figma frame inspected through MCP
2. Figma components, variants, variables and styles
3. Reference screenshot/photo supplied in this prompt
4. Extra details supplied in this prompt
5. Existing RENTLEASE frontend design system
6. Reasonable React Native implementation judgment

If two supplied sources conflict substantially:

Do NOT silently redesign the screen.

Follow the higher-priority source and mention the conflict under the final Skipped / Missing Information section only if it materially affects implementation.

## Do Not Guess Important Missing Design Information

If Figma MCP cannot access the supplied design:

Do NOT invent the complete visual design.

Instead:

1. Use the supplied screenshot if available.
2. Use explicitly supplied extra details.
3. Preserve the existing project theme.
4. Build only what can be reasonably supported.
5. Report the unavailable Figma resource at completion.

If neither Figma nor a screenshot provides enough information:

Do not create a speculative final UI.

## Avoid Overengineering

Do NOT create:

- excessive abstractions
- unnecessary generic component systems
- unnecessary contexts
- unnecessary state managers
- backend mocks
- elaborate animation frameworks
- a new design system when one already exists
- dozens of components for a simple screen

The code should remain easy for student developers to understand and maintain.

## Naming

Use clear feature-oriented names.

Examples:

- TenantHomeView.tsx
- PropertyDetailsView.tsx
- PropertyCard.tsx
- SearchBar.tsx
- VerificationBadge.tsx
- useTenantHomeViewModel.ts
- usePropertyDetailsViewModel.ts

Avoid meaningless names such as:

- Component1
- Box2
- FrameCopy
- RectangleContainer
- Group37

Do not copy raw Figma layer names when they are not meaningful in application code.

## File Extension Rules

Use:

```text
.tsx → React Native Views and React Native UI components
.ts → ViewModels, Models, services, hooks, theme, constants and utilities
```

Do NOT create `.jsx` application files.

Do NOT create `.js` application source files unless an existing Expo configuration specifically requires JavaScript.

## Code Quality

Use strict TypeScript.

Avoid:

- any
- unused imports
- duplicated styles
- magic numbers repeated throughout the screen
- large inline style objects
- massive monolithic components

Use:

```ts
StyleSheet.create(...)
```

or the project's existing React Native styling convention.

Do not introduce a new styling framework.

## Required Implementation Process

Execute this sequence:

1. Inspect the existing repository.
2. Identify the target RENTLEASE feature folder.
3. Inspect existing reusable components.
4. Inspect existing theme/design tokens.
5. Open and inspect the provided Figma frame using Figma MCP.
6. Inspect child components and design properties.
7. Compare the Figma design against the supplied screenshot if provided.
8. Determine which UI pieces should remain feature-specific.
9. Determine which components are genuinely reusable.
10. Implement or update the View.
11. Implement required shared components.
12. Add only the minimal ViewModel/model changes actually required.
13. Reuse existing navigation where required.
14. Add preview/static presentation data only when necessary.
15. Match layout, spacing, typography, colors and sizing to Figma.
16. Verify reasonable Android responsiveness.
17. Run TypeScript checking if already configured.
18. Run lint if already configured.
19. Fix only problems introduced by your changes.
20. Do not modify unrelated features.

## Visual Validation

After implementation, compare the result against the supplied Figma frame.

Review:

- overall hierarchy
- header height
- content width
- padding
- vertical spacing
- horizontal spacing
- font sizes
- font weights
- colors
- cards
- radii
- borders
- images
- icons
- navigation
- button dimensions
- input dimensions
- alignment
- safe areas
- scroll behavior

Correct obvious visual mismatches before finishing.

Do not intentionally leave the first rough implementation when the design information needed to improve it is already available through Figma MCP.

## Existing Barebones Project Rule

The repository may currently contain very little UI.

That is acceptable.

Do NOT wait for:

- backend completion
- database data
- authentication completion
- ML completion
- final APIs

before implementing the visual frontend.

Build the presentation layer cleanly so the real data can later replace preview/static data through the ViewModel and service layers.

The intended evolution is:

```text
NOW

Figma
↓
View
↓
ViewModel
↓
Preview / no backend data
```

Later:

```text
Figma-designed View
↓
ViewModel
↓
Service
↓
Real RENTLEASE backend
```

The View should require minimal redesign when real data is connected.

## Final Output — SAVE CREDITS

Do NOT paste every source file into the response.

After implementation, output ONLY:

```text
Created
[path]
[path]

Modified
[path]
[path]

Figma Source Used
[frame/page name]
[Figma URL or identifier]

Shared Components Created/Reused
[component]
[component]

Preview Data Used
None
or briefly identify what presentation-only preview data was required.

Skipped / Missing Information
None
or briefly state information that could not be obtained, such as:
Figma font family was unavailable in the repository.
Backend connection intentionally not implemented.
Figma MCP could not retrieve the supplied component.
```

No additional explanation or conversational sign-off.

---

# Current Design Request

## Figma MCP — Feature / Flow Links

Provide the Figma MCP link for the feature or grouped flow being implemented.

### Primary Feature Section / Group

[PASTE MAIN FIGMA SECTION / GROUP LINK HERE]

### Related Frames / Sub-Flows

[OPTIONAL — ADD LINKS ONLY WHEN THEY ARE NOT ACCESSIBLE FROM THE PRIMARY GROUP]

1. [FRAME / SUB-FLOW NAME]
   [PASTE FIGMA LINK HERE]
2. [FRAME / SUB-FLOW NAME]
   [PASTE FIGMA LINK HERE]
3. [FRAME / SUB-FLOW NAME]
   [PASTE FIGMA LINK HERE]
4. [FRAME / SUB-FLOW NAME]
   [PASTE FIGMA LINK HERE]

### Frames to Prioritize

[OPTIONAL — LIST IMPORTANT FRAME NAMES]

-
-
-

## Reference Screenshots / Photos

[ATTACH REFERENCE SCREENSHOTS HERE]

Screenshot 1:

[WHAT CODEX SHOULD USE THIS FOR]

Screenshot 2:

[WHAT CODEX SHOULD USE THIS FOR]

Screenshot 3:

[WHAT CODEX SHOULD USE THIS FOR]

# Current Design Request

## Figma MCP — Feature / Flow Links

### Primary Feature Section / Group

[PASTE MAIN FIGMA SECTION / GROUP LINK HERE]

### Related Frames / Sub-Flows

1. [SUB-FLOW NAME]
   [LINK IF NEEDED]
2. [SUB-FLOW NAME]
   [LINK IF NEEDED]
3. [SUB-FLOW NAME]
   [LINK IF NEEDED]

### Frames to Prioritize

-
-
-

## Reference Screenshots / Photos

[ATTACH SCREENSHOTS HERE]

## RENTLEASE Feature

[ENTER FEATURE HERE]

## Actor

[Tenant / Landlord / Admin / Shared]

## Current Implementation State

Barebones unless otherwise stated.

## What Should Be Designed / Implemented

[DESCRIBE WHAT CODEX SHOULD BUILD IN THIS RUN]

## Elements That Can Stay Non-Functional For Now

[LIST VISUAL-ONLY ELEMENTS]

## Extra Details

[ADD ANY SPECIAL NOTES]
