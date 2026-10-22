# RentLease product context

## Register

Product: an Android-first React Native, Expo and TypeScript rental marketplace. The interface serves practical tasks; existing project architecture remains authoritative in `docs/ARCHITECTURE.md`.

## Users and purpose

Everyday Filipino tenants and landlords, particularly in Imus, Dasmariñas and Tagaytay, Cavite. Users discover housing, manage account details and understand verification requirements and document review status.

## Personality and direction

Professional, approachable, grounded and trustworthy. The 2026-10-23 Phase 1 refinement follows the supplied RentLease showcase: a friendly property marketplace first, with restrained outlines and confident hierarchy as subtle neo-brutalist influence. Phase 1 applies shared primitives to Discovery, property details, Profile, Verification and the Admin dashboard. Other screen layouts wait for user review before Phase 2.

## Anti-references

Avoid luxury concierge styling, sterile minimalism, generic dashboard templates, washed-out pastel overuse, thick black borders everywhere, random color blocks, comic styling and ceremonial verification copy.

## Design principles

- Keep existing information architecture and familiar navigation.
- Use green for meaningful identity, actions and verification emphasis; keep ordinary navigation icons gray.
- Status labels describe backend-derived facts. Tier numbers identify levels, never approval or role permissions.
- Preserve Android touch targets, readable contrast, text scaling, wrapping and accessible labels. Never truncate essential account/status information for visual neatness.
- Presentation changes preserve MVVM, business rules and all document workflows.
