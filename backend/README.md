# RentLease Python Recommender

This is the Milestone 3 content-based recommendation backend. It mirrors the
Streamlit thesis prototype in `../../rentlease_app.py`.

Run locally:

```bash
cd rentlease/backend
python server.py
```

Then set this in the app `.env` if you want the mobile app to call Python:

```bash
EXPO_PUBLIC_RECOMMENDER_URL=http://127.0.0.1:8000
```

For Android devices, replace `127.0.0.1` with your computer's LAN IP address.
If this env var is missing or the backend is unavailable, the app uses the same
scoring logic locally in TypeScript.
