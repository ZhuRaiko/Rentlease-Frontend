# RENTLEASE project instructions

Before implementing frontend features, read:

- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_CONTEXT.md`
- `docs/FIGMA_WORKFLOW.md`

Non-negotiable rules:

- RENTLEASE is an Android-first React Native + TypeScript + Expo application.
- This repository is frontend-only.
- Follow `docs/ARCHITECTURE.md` as the existing RENTLEASE architecture source of truth.
- Preserve the existing MVVM architecture.
- Views must not directly access backend or external-service clients.
- Do not modify Supabase database schema, RLS, backend infrastructure, Edge Functions, FastAPI implementation, XGBoost training, scraping, or Render deployment.
- Do not introduce technologies outside the approved RENTLEASE stack without explicit instruction.
- Figma MCP is the primary visual source of truth when a Figma link is supplied.
- Implement one feature or coherent sub-flow at a time.
- Inspect existing code before creating components, services, hooks, models, themes, or utilities.
- Reuse existing shared components and design tokens where appropriate.
- Preserve working functionality.
- Use `.tsx` for React Native UI components and Views.
- Use `.ts` for ViewModels, Models, services, hooks, utilities, and configuration.
- Do not create `.jsx` application source files.
