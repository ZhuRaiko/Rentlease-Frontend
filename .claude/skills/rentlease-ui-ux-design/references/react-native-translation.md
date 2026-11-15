# Translating design-skill advice to React Native

Several installed skills assume the web. RentLease is Android-first React Native + Expo + TypeScript with MVVM. Treat web output as inspiration for decisions (hierarchy, spacing, contrast, copy), never as code to paste.

## Do not introduce

Tailwind, shadcn/ui, Radix, CSS or CSS variables, HTML pages as app UI, WebView to mimic a reference, Framer Motion, Next.js, Vite, a web framework, a new font or icon library, a new dependency. `docs/FRONTEND_CONTEXT.md` lists the technologies not to add automatically. A design skill recommending one is not an instruction to add it.

## Mapping

| Web advice | RentLease equivalent |
| --- | --- |
| CSS variables / design tokens | `src/shared/theme` exports (`colors`, `ui`, spacing, radius, typography) |
| Utility classes / component library | Existing shared components (`AppButton`, `ScreenContainer`, `ScreenHeader`, `FeedbackNotice`) and `StyleSheet.create` |
| `rem`, media queries, breakpoints | `useWindowDimensions` width and `fontScale`; test about 411dp/100% and 320dp/150% |
| Hover and focus states | Pressed state (`Pressable` style callback), `accessibilityState`, TalkBack labels |
| Scroll animations, page-load choreography | Avoid. Motion only answers a user action, using core `Animated` already present |
| Google Fonts / display typeface | Roboto stays. Express character through weight, size, and spacing within the existing type scale |
| Modal / dialog markup | Existing React Native `Modal` patterns, including Android Back handling |
| Hero sections, landing-page structure | Not applicable. Use the existing screen structure and navigation |
| Dark mode token sets | Not in scope unless the user asks |

## Architecture

- Views (`.tsx`) render and bind. ViewModels (`.ts`) own state, validation orchestration, and lifecycle. Services own data access.
- A visual change must not move a Supabase call, a fetch, or an authorization rule into a View.
- Reuse the existing ViewModel for the screen; do not add state to a View for convenience when it belongs in the ViewModel.

## Keeping the right skill in charge

- Hallmark's own rule is to run only when named or on new pages, and it treats a root `DESIGN.md` as a locked system. Keep it that way: RentLease's `DESIGN.md` locks the system.
- Frontend Design pushes distinctive, risk-taking choices. In RentLease that applies inside the 20-25% expressive share only, and never against the approved palette, Roboto, or component styling.
- UI/UX Pro Max's stack data includes `react-native`. Use `--stack react-native` and treat results as recommendations.
