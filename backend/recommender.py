DEFAULT_TOP_WEIGHTS = {
    "budget": 0.2889,
    "location": 0.2452,
    "unit_specs": 0.2262,
    "amenities": 0.2398,
}

DEFAULT_SPEC_WEIGHTS = {
    "safety_rating": 10,
    "bedrooms": 8,
    "bathrooms": 8,
    "size_sqm": 4,
}

DEFAULT_AMENITY_WEIGHTS = {
    "near_public_transport": 11,
    "parking": 10,
    "near_grocery": 10,
    "air_conditioning": 8,
    "pet_friendly": 7,
    "near_mall": 7,
    "near_hospital": 6,
    "near_school": 6,
    "wifi": 5,
    "furnished": 3,
}


def build_weights_from_ranking(ranked_keys, all_keys, default_weights):
    user_weights = {}
    ranked_count = len(ranked_keys)

    for index, key in enumerate(ranked_keys):
        user_weights[key] = ranked_count - index

    min_ranked = min(user_weights.values()) if user_weights else 0
    max_default = max((default_weights.get(key, 1) for key in all_keys), default=1)

    for key in all_keys:
        if key not in user_weights:
            raw = default_weights.get(key, 1)
            floor = max(min_ranked - 0.01, 0.5) if min_ranked else 1
            user_weights[key] = round((raw / max_default) * floor, 4)

    return user_weights


def normalize_weights(weights):
    total = sum(weights.values())
    if not total:
        return weights
    return {key: value / total for key, value in weights.items()}


def rank_listings(preference, listings):
    preferred_city = preference.get("city")
    candidates = [listing for listing in listings if listing.get("city") == preferred_city]
    scored = [score_listing(preference, listing) for listing in candidates]
    return sorted(scored, key=lambda item: item["matchScore"], reverse=True)[:20]


def score_listing(preference, listing):
    budget = max(float(preference.get("budget") or 1), 1)
    budget_score = max(0, 1 - abs(budget - float(listing.get("price", 0))) / budget)
    location_score = 1 if listing.get("city") == preference.get("city") else 0

    active_specs = _active_specs(preference)
    spec_weights = (
        build_weights_from_ranking(
            preference.get("specRanking", []), active_specs, DEFAULT_SPEC_WEIGHTS
        )
        if preference.get("specRanking")
        else DEFAULT_SPEC_WEIGHTS
    )
    spec_total = sum(spec_weights[key] for key in active_specs)
    specs_score = (
        sum(
            min(_listing_spec(listing, key) / _preference_spec(preference, key), 1.0)
            * spec_weights[key]
            for key in active_specs
        )
        / spec_total
        if active_specs and spec_total
        else 1.0
    )

    active_amenities = preference.get("amenities", [])
    amenity_weights = (
        build_weights_from_ranking(
            preference.get("amenityRanking", []),
            active_amenities,
            DEFAULT_AMENITY_WEIGHTS,
        )
        if preference.get("amenityRanking")
        else DEFAULT_AMENITY_WEIGHTS
    )
    amenity_total = sum(amenity_weights[key] for key in active_amenities)
    listing_amenities = set(listing.get("amenities", []))
    amenity_score = (
        sum(
            amenity_weights[key]
            for key in active_amenities
            if key in listing_amenities
        )
        / amenity_total
        if active_amenities and amenity_total
        else 1.0
    )

    top_keys = ["budget", "location", "unit_specs", "amenities"]
    top_weights = (
        normalize_weights(
            build_weights_from_ranking(
                preference.get("priorityRanking", []),
                top_keys,
                DEFAULT_TOP_WEIGHTS,
            )
        )
        if preference.get("priorityRanking")
        else DEFAULT_TOP_WEIGHTS
    )
    score = (
        top_weights["budget"] * budget_score
        + top_weights["location"] * location_score
        + top_weights["unit_specs"] * specs_score
        + top_weights["amenities"] * amenity_score
    )
    score = min(score, 1)

    return {
        **listing,
        "matchScore": round(score, 4),
        "matchBreakdown": {
            "budget": round(budget_score, 4),
            "location": round(location_score, 4),
            "unitSpecs": round(specs_score, 4),
            "amenities": round(amenity_score, 4),
        },
    }


def _active_specs(preference):
    specs = []
    if preference.get("minSafetyRating", 0) > 0:
        specs.append("safety_rating")
    if preference.get("minBedrooms", 0) > 0:
        specs.append("bedrooms")
    if preference.get("minBathrooms", 0) > 0:
        specs.append("bathrooms")
    if preference.get("minSizeSqm", 0) > 0:
        specs.append("size_sqm")
    return specs


def _preference_spec(preference, key):
    if key == "safety_rating":
        return max(float(preference.get("minSafetyRating") or 1), 1)
    if key == "bedrooms":
        return max(float(preference.get("minBedrooms") or 1), 1)
    if key == "bathrooms":
        return max(float(preference.get("minBathrooms") or 1), 1)
    return max(float(preference.get("minSizeSqm") or 1), 1)


def _listing_spec(listing, key):
    if key == "safety_rating":
        return float(listing.get("safetyRating", 3))
    if key == "bedrooms":
        return float(listing.get("bedrooms", 0))
    if key == "bathrooms":
        return float(listing.get("bathrooms", 0))
    return float(listing.get("sizeSqm", 0))
