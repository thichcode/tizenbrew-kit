# Reel Suggestions Feature

## Summary
When a user submits a Facebook reel URL, the system auto-generates 2-3 similar reel URLs by modifying the last few digits. These appear in a "Suggestions" tab on the TV.

## Architecture

### URL Generation
- Input: `https://www.facebook.com/reel/1347475237485872`
- Strategy: Modify last 2-3 digits randomly
- Output: 2-3 URLs like `https://www.facebook.com/reel/1347475237485833`

### Worker Changes
- New KV key pattern: `suggest:{code}` (separate from `feed:{code}`)
- `POST /submit` with Facebook reel URL → auto-generate suggestions
- `GET /suggestions?code=X` → returns `{ items: FeedItem[] }`
- `DELETE /suggestions?code=X` → clears suggestions
- TTL: 48 hours (same as feed)

### TV Changes
- New tab "Suggestions" next to "Feeds" tab
- Polls `/suggestions?code=X` every 10 seconds
- Click suggestion → plays video (skips if invalid URL)
- "Add to feed" button to move suggestion to main feed

### Setup Page Changes
- After submitting a reel, show generated suggestions
- Allow manual addition of suggestion URLs

## Data Flow
```
User submits reel URL
    ↓
Worker generates 2-3 fake URLs
    ↓
Stored in KV: suggest:{code}
    ↓
TV polls /suggestions
    ↓
TV displays in Suggestions tab
    ↓
User clicks → TV tries to play (skip if fails)
```

## Error Handling
- If generated URL doesn't exist → TV skips to next suggestion
- If KV is full → oldest suggestions removed (max 20)
- If worker fails to generate → no suggestions added (silent fail)
