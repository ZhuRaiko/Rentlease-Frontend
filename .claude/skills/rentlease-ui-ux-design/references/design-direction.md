# RentLease design direction

Source of truth: [DESIGN.md](../../../../DESIGN.md) and [PRODUCT.md](../../../../PRODUCT.md). This file summarizes; it does not replace them. If they disagree with this summary, they win.

## Character

An approachable everyday Filipino housing application: Professional, approachable, grounded, trustworthy. Roughly 75-80% calm, functional marketplace and 20-25% expressive typography and visual character. Confidence comes from hierarchy, not thick framing.

## Maintain

- Green branding for meaningful identity, actions, and verification emphasis (`primaryAction` #32743C). Ordinary navigation icons stay neutral gray.
- Warm neutral surfaces (canvas #F7F9F5, ink #172C27).
- Strong but restrained typography. Keep Roboto. Prices, property names, and key results get emphasis; routine labels do not compete.
- Intentional information hierarchy and predictable navigation.
- Consistent iconography; moderate corner radii (12dp panels, 10dp controls).
- Thin, purposeful borders: 1dp `outline` (#DCE5DD) for panels, `controlBorder` (#7D9383) for controls.
- Accessible controls: 48dp minimum targets, default font scaling and wrapping, never truncate essential account or status text.
- Real data and legitimate status indicators. Status labels describe backend-derived facts; tier color never implies approval.

## Avoid

Generic AI dashboard layouts, excessive nested cards, neon colors, heavy black borders, overly colorful buttons, luxury real-estate aesthetics, unnecessary gradients, decorative icons without purpose, inconsistent component styling, sterile minimalism, washed-out pastel overuse, random color blocks, comic styling, ceremonial verification copy.

DESIGN.md permits exactly one scoped gradient treatment (the verification overview). Do not extend it elsewhere.

## Scope boundary

DESIGN.md documents Phase 1 (Discovery, property details, Profile, Verification, Admin dashboard) and lists Phase 2 areas as awaiting approval: Auth/onboarding, landlord creation/management, messaging/scheduling, ratings/reports, notifications, maintenance/tenancy, estimator, detailed Admin review. Refinement requests on a Phase 2 surface need the user's direction on the target look first. Do not infer a redesign from this skill.

## Refinement versus redesign

Default to refinement: keep the incumbent identity, behavior, copy, and anything outside the requested scope. Never replace factual copy or add claims without asking. A request for a new visual world needs explicit instruction.
