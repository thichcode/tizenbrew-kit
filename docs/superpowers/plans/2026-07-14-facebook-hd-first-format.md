# Facebook HD-First Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both Facebook `/resolve` and `/play` prefer `hd`, then fall back to `sd` and `b` for Tizen 3 playback.

**Architecture:** Define one shared yt-dlp format selector in the FastAPI resolver. Pass it to the metadata/direct-CDN `/resolve` path and reuse it in the proxy `/play` path so both return the same HD-first format family.

**Tech Stack:** Python 3.10, FastAPI, yt-dlp subprocess, standard-library `unittest` and `unittest.mock`.

---

## File Structure

- Modify `backend/yt-dlp-resolver/app.py`: add the shared Facebook format constant and use it in both resolver paths.
- Create `backend/yt-dlp-resolver/test_app.py`: verify command construction without network or yt-dlp execution.

### Task 1: Use One HD-First Facebook Selector

**Files:**
- Modify: `backend/yt-dlp-resolver/app.py:21-24,221-240,252-280`
- Create: `backend/yt-dlp-resolver/test_app.py`

- [ ] **Step 1: Write failing tests**

Create `backend/yt-dlp-resolver/test_app.py`:

```python
import json
import unittest
from subprocess import CompletedProcess
from unittest.mock import patch

import app


FACEBOOK_URL = "https://www.facebook.com/reel/123456"
CDN_URL = "https://video.xx.fbcdn.net/video.mp4"


class FacebookFormatTests(unittest.TestCase):
    def test_resolve_uses_hd_first_format(self):
        payload = json.dumps({
            "url": CDN_URL,
            "title": "Facebook Reel",
            "thumbnail": None,
        })

        with patch.object(
            app,
            "run_yt_dlp",
            return_value=CompletedProcess([], 0, stdout=payload, stderr=""),
        ) as run:
            result = app.resolve(FACEBOOK_URL, x_api_key=app.API_KEY or None)

        self.assertTrue(result.ok)
        self.assertEqual(result.resolved.videoUrl, CDN_URL)
        run.assert_called_once_with(
            FACEBOOK_URL,
            ["-f", "hd/sd/b", "--no-check-certificates", "--user-agent", app.UA],
        )

    def test_play_resolver_uses_shared_hd_first_format(self):
        completed = CompletedProcess([], 0, stdout=CDN_URL + "\n", stderr="")

        with patch.object(app.subprocess, "run", return_value=completed) as run:
            result = app.resolve_and_get_cdn(FACEBOOK_URL)

        self.assertEqual(result, CDN_URL)
        self.assertEqual(
            run.call_args.args[0],
            [
                app.YT_DLP,
                "-f",
                app.FACEBOOK_FORMAT,
                "--get-url",
                "--no-check-certificates",
                "--user-agent",
                app.UA,
                FACEBOOK_URL,
            ],
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest -v test_app.py`

Working directory: `backend/yt-dlp-resolver`

Expected: FAIL because `FACEBOOK_FORMAT` does not exist and `/resolve` does not pass Facebook format arguments.

- [ ] **Step 3: Add the shared selector**

In `backend/yt-dlp-resolver/app.py`, add after `YT_DLP`:

```python
FACEBOOK_FORMAT = "hd/sd/b"
```

- [ ] **Step 4: Apply the selector to `/play` resolution**

Replace the Facebook command in `resolve_and_get_cdn()` with:

```python
        cmd = [
            YT_DLP,
            "-f",
            FACEBOOK_FORMAT,
            "--get-url",
            "--no-check-certificates",
            "--user-agent",
            UA,
            url,
        ]
```

- [ ] **Step 5: Apply the selector to `/resolve`**

In `resolve()`, replace the generic non-TikTok call with platform-specific arguments:

```python
    extra_args = None
    if is_facebook_url(url):
        extra_args = [
            "-f",
            FACEBOOK_FORMAT,
            "--no-check-certificates",
            "--user-agent",
            UA,
        ]
    r = run_yt_dlp(url, extra_args)
```

This keeps non-Facebook direct URLs unchanged while forcing Facebook to use the HD-first selector.

- [ ] **Step 6: Run tests and syntax verification**

Run: `python -m unittest -v test_app.py`

Working directory: `backend/yt-dlp-resolver`

Expected: 2 tests pass.

Run: `python -m py_compile app.py test_app.py`

Working directory: `backend/yt-dlp-resolver`

Expected: command exits successfully with no output.

- [ ] **Step 7: Verify with a real Facebook URL after server deployment**

Run on the Morocco server:

```bash
curl -H 'X-API-Key: <server-api-key>' \
  'http://localhost:8000/resolve?url=https://www.facebook.com/reel/123456'
```

Expected: HTTP 200 with `ok: true` and a direct Facebook CDN `videoUrl`. Confirm with yt-dlp debug output that `format_id` is `hd` when Facebook exposes it, otherwise `sd` or `b`.

- [ ] **Step 8: Checkpoint without commit unless requested**

Run: `git diff -- backend/yt-dlp-resolver/app.py backend/yt-dlp-resolver/test_app.py`

Expected: only the shared selector, two command-path updates, and tests. Do not commit unless explicitly requested.

## Self-Review

- Spec coverage: both Facebook `/resolve` and `/play` use `hd/sd/b`; domain/Tunnel and TV player changes are excluded.
- Placeholder scan: no implementation placeholders remain; `<server-api-key>` is an operational secret marker and must not be committed as a real credential.
- Type consistency: the shared constant is `FACEBOOK_FORMAT` in implementation and tests.
