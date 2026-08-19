# Feature cohorts

`Scaffolded` means the architectural feature location exists; it does not mean the feature is implemented.

| Feature | Purpose | Status |
|---|---|---|
| Authentication & Profiles | Account identity and profile foundation | Scaffolded |
| User Verification | Tiered trust verification | Scaffolded |
| Property & Listing Management | Landlord property and listing workflows | Scaffolded |
| Search & Discovery | Structured filtering, GPS and proximity discovery | Scaffolded |
| Property Recommendations | Content-based property matching | Scaffolded |
| Rental Price Estimation | XGBoost-backed pricing decision support | Scaffolded |
| Messaging & Viewing Schedules | Tenant-landlord communication and viewing coordination | Scaffolded |
| Tenancy Management | Structured ongoing rental relationship | Scaffolded |
| Maintenance Requests | Tenant-landlord maintenance coordination | Scaffolded |
| Ratings & Reports | Reciprocal feedback and reporting | Scaffolded |
| Admin & Moderation | Platform administration and moderation | Scaffolded |
| Notifications | In-app and push-notification foundation | Scaffolded |

New implementation goes in `src/features/<feature>/models`, `viewModels`, and `views` as real code is introduced. Empty locations are currently represented by `.gitkeep`; no placeholder screens, ViewModels, models or mock data were generated.
