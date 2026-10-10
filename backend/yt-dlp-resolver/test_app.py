import asyncio
import gzip
import json
import os
import unittest
from subprocess import CompletedProcess
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
from fastapi.responses import Response
from fastapi.testclient import TestClient

import app


FACEBOOK_URL = "https://www.facebook.com/reel/123456"
CDN_URL = "https://video.xx.fbcdn.net/video.mp4"


class TrackingStream(httpx.AsyncByteStream):
    def __init__(self, content):
        self.content = content
        self.closed = False

    async def __aiter__(self):
        yield self.content

    async def aclose(self):
        self.closed = True


class FailingStream(httpx.AsyncByteStream):
    def __init__(self):
        self.closed = False

    async def __aiter__(self):
        yield b"partial"
        raise RuntimeError("stream failed")

    async def aclose(self):
        self.closed = True


class FakeUrlResponse:
    def __init__(self, status, headers=None, body=b""):
        self.status = status
        self.headers = headers or {}
        self.body = body
        self.closed = False

    def getcode(self):
        return self.status

    def read(self):
        return self.body

    def close(self):
        self.closed = True


class FacebookFormatTests(unittest.TestCase):
    def setUp(self):
        self.api_key_patcher = patch.object(app, "API_KEY", "test-key")
        self.api_key_patcher.start()

    def tearDown(self):
        self.api_key_patcher.stop()

    def test_check_api_key_rejects_unconfigured_server(self):
        with patch.object(app, "API_KEY", ""):
            with self.assertRaises(HTTPException) as raised:
                app.check_api_key("test-key")

        self.assertEqual(raised.exception.status_code, 503)

    def test_check_api_key_rejects_wrong_key(self):
        with self.assertRaises(HTTPException) as raised:
            app.check_api_key("wrong-key")

        self.assertEqual(raised.exception.status_code, 401)

    def test_health_remains_public_when_api_key_is_unconfigured(self):
        with patch.object(app, "API_KEY", ""):
            result = app.health()

        self.assertTrue(result["ok"])

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
            ["-f", app.FACEBOOK_FORMAT, "--no-check-certificates", "--user-agent", app.UA],
        )

    def test_resolve_rejects_unsupported_sources_before_yt_dlp(self):
        urls = (
            "https://example.com/video.mp4",
            "http://localhost/video.mp4",
            "http://127.0.0.1/video.mp4",
            "file://www.facebook.com/video.mp4",
            "httpx://www.tiktok.com/video/123456789",
        )

        with patch.object(
            app,
            "run_yt_dlp",
            return_value=CompletedProcess([], 1, stdout="", stderr="called"),
        ) as run:
            for url in urls:
                with self.subTest(url=url):
                    try:
                        app.resolve(url, x_api_key=app.API_KEY)
                    except HTTPException as exc:
                        self.assertEqual(exc.status_code, 400)
                    else:
                        self.fail("HTTPException not raised")

        run.assert_not_called()

    def test_debug_rejects_unsupported_sources_before_yt_dlp(self):
        urls = (
            "https://example.com/video.mp4",
            "http://localhost/video.mp4",
            "http://127.0.0.1/video.mp4",
            "file://www.facebook.com/video.mp4",
            "httpx://www.tiktok.com/video/123456789",
        )

        with patch.object(
            app,
            "run_yt_dlp",
            return_value=CompletedProcess([], 1, stdout="", stderr="called"),
        ) as run:
            for url in urls:
                with self.subTest(url=url):
                    try:
                        app.debug(url, x_api_key=app.API_KEY)
                    except HTTPException as exc:
                        self.assertEqual(exc.status_code, 400)
                    else:
                        self.fail("HTTPException not raised")

        run.assert_not_called()

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

    def test_resolve_and_get_cdn_falls_back_to_scraper_when_yt_dlp_fails(self):
        failed = CompletedProcess([], 1, stdout="", stderr="ERROR: Cannot parse data")
        scraped_data = {"videoUrl": CDN_URL, "title": "Scraped Reel", "thumbnailUrl": None}

        with patch.object(app.subprocess, "run", return_value=failed), \
             patch.object(app, "scrape_facebook_og", return_value=scraped_data):
            result = app.resolve_and_get_cdn(FACEBOOK_URL)

        self.assertEqual(result, CDN_URL)

    def test_play_redirect_mode_returns_fresh_cdn_location(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))

        with patch.object(app, "resolve_and_get_cdn", return_value=CDN_URL) as resolve:
            response = asyncio.run(app.play(
                request,
                FACEBOOK_URL,
                mode="redirect",
                direct=None,
                x_api_key=app.API_KEY or None,
                api_key=None,
            ))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["location"], CDN_URL)
        resolve.assert_called_once_with(FACEBOOK_URL)

    def test_play_resolves_source_url_in_threadpool(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))
        threadpool = AsyncMock(return_value=CDN_URL)

        with patch.object(app, "resolve_and_get_cdn") as resolve, \
                patch.object(app, "run_in_threadpool", threadpool, create=True):
            response = asyncio.run(app.play(
                request,
                FACEBOOK_URL,
                mode="redirect",
                direct=None,
                x_api_key=app.API_KEY or None,
                api_key=None,
            ))

        self.assertEqual(response.status_code, 302)
        threadpool.assert_awaited_once_with(resolve, FACEBOOK_URL)

    def test_play_rejects_unsupported_source_url_before_resolving(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))

        with patch.object(app, "resolve_and_get_cdn") as resolve:
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(app.play(
                    request,
                    "https://example.com/watch?next=facebook.com",
                    mode="redirect",
                    direct=None,
                    x_api_key=app.API_KEY or None,
                    api_key=None,
                ))

        self.assertEqual(raised.exception.status_code, 400)
        resolve.assert_not_called()

    def test_play_rejects_unknown_and_private_direct_hosts_before_fetch(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))
        proxy = AsyncMock(return_value=Response(content=b"data"))
        urls = (
            "http://localhost/video.mp4",
            "http://127.0.0.1/video.mp4",
            "http://10.0.0.1/video.mp4",
            "http://[::1]/video.mp4",
            "https://example.com/video.mp4",
            "https://fbcdn.net.example.com/video.mp4",
        )

        with patch.object(app, "proxy_cdn", proxy):
            for url in urls:
                with self.subTest(url=url):
                    try:
                        asyncio.run(app.play(
                            request,
                            url,
                            mode="proxy",
                            direct="1",
                            x_api_key=app.API_KEY or None,
                            api_key=None,
                        ))
                    except HTTPException as exc:
                        self.assertEqual(exc.status_code, 400)
                    else:
                        self.fail("HTTPException not raised")

        proxy.assert_not_awaited()

    def test_play_allows_known_direct_cdn_hosts_and_subdomains(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))
        urls = (
            "https://fbcdn.net/video.mp4",
            "https://video.xx.fbcdn.net/video.mp4",
            "https://tiktokcdn.com/video.mp4",
            "https://v16.tiktokcdn.com/video.mp4",
            "https://tiktokv.com/video.mp4",
            "https://v16.tiktokv.com/video.mp4",
            "https://byteoversea.com/video.mp4",
            "https://v16.byteoversea.com/video.mp4",
            "https://tiktok.com/video.mp4",
            "https://v16-webapp-prime.tiktok.com/video.mp4",
        )

        for url in urls:
            with self.subTest(url=url):
                try:
                    response = asyncio.run(app.play(
                        request,
                        url,
                        mode="redirect",
                        direct="1",
                        x_api_key=app.API_KEY or None,
                        api_key=None,
                    ))
                except HTTPException as exc:
                    self.fail(f"allowed direct CDN URL was rejected with HTTP {exc.status_code}")
                self.assertEqual(response.headers["location"], url)

    def test_play_rejects_private_resolver_output_before_proxy(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))
        proxy = AsyncMock(return_value=Response(content=b"data"))

        with patch.object(app, "resolve_and_get_cdn", return_value="http://127.0.0.1/private"), \
                patch.object(app, "proxy_cdn", proxy):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(app.play(
                    request,
                    FACEBOOK_URL,
                    mode="proxy",
                    direct=None,
                    x_api_key=app.API_KEY or None,
                    api_key=None,
                ))

        self.assertEqual(raised.exception.status_code, 502)
        proxy.assert_not_awaited()

    def test_play_rejects_unknown_or_missing_resolver_output_host(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))
        urls = ("https://example.com/video.mp4", "not-a-url")

        for url in urls:
            with self.subTest(url=url), patch.object(app, "resolve_and_get_cdn", return_value=url):
                try:
                    asyncio.run(app.play(
                        request,
                        FACEBOOK_URL,
                        mode="redirect",
                        direct=None,
                        x_api_key=app.API_KEY or None,
                        api_key=None,
                    ))
                except HTTPException as exc:
                    self.assertEqual(exc.status_code, 502)
                else:
                    self.fail("HTTPException not raised")

    def test_play_rejects_non_http_resolver_output_before_proxy(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))
        proxy = AsyncMock(return_value=Response(content=b"data"))
        urls = (
            "file://video.xx.fbcdn.net/private",
            "httpx://video.xx.fbcdn.net/private",
        )

        with patch.object(app, "proxy_cdn", proxy):
            for url in urls:
                with self.subTest(url=url), patch.object(app, "resolve_and_get_cdn", return_value=url):
                    try:
                        asyncio.run(app.play(
                            request,
                            FACEBOOK_URL,
                            mode="proxy",
                            direct=None,
                            x_api_key=app.API_KEY or None,
                            api_key=None,
                        ))
                    except HTTPException as exc:
                        self.assertEqual(exc.status_code, 502)
                    else:
                        self.fail("HTTPException not raised")

        proxy.assert_not_awaited()

    def test_play_allows_known_resolver_output_hosts(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))
        urls = (
            CDN_URL,
            "https://v16.tiktokcdn.com/video.mp4",
            "https://v16.tiktokv.com/video.mp4",
            "https://v16.byteoversea.com/video.mp4",
            "https://v16-webapp-prime.tiktok.com/video.mp4",
        )

        for url in urls:
            with self.subTest(url=url), patch.object(app, "resolve_and_get_cdn", return_value=url):
                try:
                    response = asyncio.run(app.play(
                        request,
                        FACEBOOK_URL,
                        mode="redirect",
                        direct=None,
                        x_api_key=app.API_KEY or None,
                        api_key=None,
                    ))
                except HTTPException as exc:
                    self.fail(f"allowed resolver CDN URL was rejected with HTTP {exc.status_code}")
                self.assertEqual(response.headers["location"], url)

    def test_play_proxies_resolved_tiktok_com_video_with_tiktok_headers(self):
        source_url = "https://www.tiktok.com/@creator/video/123456789"
        resolved_url = "https://v16-webapp-prime.tiktok.com/video.mp4"
        observed = {}

        async def handler(request):
            observed["url"] = str(request.url)
            observed["referer"] = request.headers.get("referer")
            observed["origin"] = request.headers.get("origin")
            return httpx.Response(200, stream=TrackingStream(b"video"))

        async def run_test():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                request = SimpleNamespace(
                    headers={},
                    app=SimpleNamespace(state=SimpleNamespace(http_client=client)),
                )
                with patch.object(app, "resolve_and_get_cdn", return_value=resolved_url):
                    try:
                        response = await app.play(
                            request,
                            source_url,
                            mode="proxy",
                            direct=None,
                            x_api_key=app.API_KEY,
                            api_key=None,
                        )
                    except HTTPException as exc:
                        self.fail(f"resolved TikTok CDN URL was rejected with HTTP {exc.status_code}")
                body = b"".join([chunk async for chunk in response.body_iterator])
                if response.background:
                    await response.background()
                return response, body

        response, body = asyncio.run(run_test())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body, b"video")
        self.assertEqual(observed["url"], resolved_url)
        self.assertEqual(observed["referer"], "https://www.tiktok.com/")
        self.assertEqual(observed["origin"], "https://www.tiktok.com")

    def test_play_rejects_unknown_mode(self):
        request = SimpleNamespace(headers={}, app=SimpleNamespace(state=SimpleNamespace()))

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(app.play(
                request,
                FACEBOOK_URL,
                mode="invalid",
                direct=None,
                x_api_key=app.API_KEY or None,
                api_key=None,
            ))

        self.assertEqual(raised.exception.status_code, 400)

    def test_play_defaults_to_proxy_mode(self):
        proxy = AsyncMock(return_value=Response(content=b"data"))

        with patch.object(app, "resolve_and_get_cdn", return_value=CDN_URL), \
                patch.object(app, "proxy_cdn", proxy):
            with TestClient(app.app) as client:
                response = client.get(
                    "/play",
                    params={"url": FACEBOOK_URL},
                    headers={"X-API-Key": app.API_KEY} if app.API_KEY else {},
                )

        self.assertEqual(response.status_code, 200)
        proxy.assert_awaited_once()
        self.assertEqual(proxy.await_args.args[1:], (CDN_URL, FACEBOOK_URL))

    def test_proxy_forwards_range_and_upstream_206_headers(self):
        observed = {}

        async def handler(request):
            observed["range"] = request.headers.get("range")
            observed["referer"] = request.headers.get("referer")
            observed["origin"] = request.headers.get("origin")
            observed["accept"] = request.headers.get("accept")
            observed["accept-encoding"] = request.headers.get("accept-encoding")
            return httpx.Response(
                206,
                headers={
                    "content-type": "video/mp4",
                    "content-length": "4",
                    "content-range": "bytes 0-3/100",
                    "accept-ranges": "bytes",
                },
                stream=TrackingStream(b"data"),
            )

        async def run_test():
            client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            request = SimpleNamespace(
                headers={"range": "bytes=0-3"},
                app=SimpleNamespace(state=SimpleNamespace(http_client=client)),
            )
            response = await app.proxy_cdn(request, CDN_URL, FACEBOOK_URL)
            body = b"".join([chunk async for chunk in response.body_iterator])
            if response.background:
                await response.background()
            await client.aclose()
            return response, body

        response, body = asyncio.run(run_test())

        self.assertEqual(response.status_code, 206)
        self.assertEqual(response.headers["content-type"], "video/mp4")
        self.assertEqual(response.headers["content-length"], "4")
        self.assertEqual(response.headers["content-range"], "bytes 0-3/100")
        self.assertEqual(response.headers["accept-ranges"], "bytes")
        self.assertEqual(body, b"data")
        self.assertEqual(observed["range"], "bytes=0-3")
        self.assertEqual(observed["referer"], "https://www.facebook.com/")
        self.assertEqual(observed["origin"], "https://www.facebook.com")
        self.assertEqual(observed["accept"], "*/*")
        self.assertEqual(observed["accept-encoding"], "identity")

    def test_proxy_headers_classify_all_tiktok_cdn_suffixes(self):
        urls = (
            "https://v16.tiktokcdn.com/video.mp4",
            "https://v16.tiktokv.com/video.mp4",
            "https://v16.byteoversea.com/video.mp4",
            "https://v16-webapp-prime.tiktok.com/video.mp4",
        )

        for url in urls:
            with self.subTest(url=url):
                headers = app.proxy_headers(url, None)
                self.assertEqual(headers.get("Referer"), "https://www.tiktok.com/")
                self.assertEqual(headers.get("Origin"), "https://www.tiktok.com")

    def test_proxy_preserves_upstream_403_and_closes_response(self):
        stream = TrackingStream(b"forbidden")
        upstream = httpx.Response(403, stream=stream)

        async def handler(request):
            return upstream

        async def run_test():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                request = SimpleNamespace(
                    headers={},
                    app=SimpleNamespace(state=SimpleNamespace(http_client=client)),
                )
                response = await app.proxy_cdn(request, CDN_URL, FACEBOOK_URL)
                closed_before_background = stream.closed
                if response.background:
                    await response.background()
                return response, closed_before_background

        try:
            response, closed_before_background = asyncio.run(run_test())
        except HTTPException as exc:
            self.fail(f"proxy raised HTTP {exc.status_code} instead of preserving 403")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(closed_before_background)
        self.assertTrue(stream.closed)

    def test_proxy_closes_upstream_when_stream_iteration_raises(self):
        stream = FailingStream()

        async def handler(request):
            return httpx.Response(200, stream=stream)

        async def run_test():
            client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            request = SimpleNamespace(
                headers={},
                app=SimpleNamespace(state=SimpleNamespace(http_client=client)),
            )
            try:
                response = await app.proxy_cdn(request, CDN_URL, FACEBOOK_URL)
                async for _ in response.body_iterator:
                    pass
            finally:
                await client.aclose()

        with self.assertRaisesRegex(RuntimeError, "stream failed"):
            asyncio.run(run_test())
        self.assertTrue(stream.closed)

    def test_proxy_preserves_redirect_location(self):
        redirect_url = "https://video.xx.fbcdn.net/refreshed.mp4"

        async def handler(request):
            return httpx.Response(
                302,
                headers={"location": redirect_url},
                stream=TrackingStream(b""),
            )

        async def run_test():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                request = SimpleNamespace(
                    headers={},
                    app=SimpleNamespace(state=SimpleNamespace(http_client=client)),
                )
                response = await app.proxy_cdn(request, CDN_URL, FACEBOOK_URL)
                body = b"".join([chunk async for chunk in response.body_iterator])
                if response.background:
                    await response.background()
                return response, body

        response, body = asyncio.run(run_test())

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers.get("location"), redirect_url)
        self.assertEqual(body, b"")

    def test_proxy_requests_identity_encoding_and_streams_raw_body(self):
        encoded = gzip.compress(b"uncompressed video data")
        observed = {}

        async def handler(request):
            observed["accept-encoding"] = request.headers.get("accept-encoding")
            return httpx.Response(
                200,
                headers={
                    "content-encoding": "gzip",
                    "content-length": str(len(encoded)),
                },
                stream=TrackingStream(encoded),
            )

        async def run_test():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                request = SimpleNamespace(
                    headers={},
                    app=SimpleNamespace(state=SimpleNamespace(http_client=client)),
                )
                response = await app.proxy_cdn(request, CDN_URL, FACEBOOK_URL)
                body = b"".join([chunk async for chunk in response.body_iterator])
                if response.background:
                    await response.background()
                return response, body

        response, body = asyncio.run(run_test())

        self.assertEqual(body, encoded)
        self.assertEqual(observed["accept-encoding"], "identity")
        self.assertEqual(response.headers["content-length"], str(len(encoded)))
        self.assertEqual(response.headers.get("content-encoding"), "gzip")

    def test_proxy_does_not_add_accept_ranges_when_upstream_omits_it(self):
        async def handler(request):
            return httpx.Response(200, stream=TrackingStream(b"data"))

        async def run_test():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                request = SimpleNamespace(
                    headers={},
                    app=SimpleNamespace(state=SimpleNamespace(http_client=client)),
                )
                response = await app.proxy_cdn(request, CDN_URL, FACEBOOK_URL)
                body = b"".join([chunk async for chunk in response.body_iterator])
                if response.background:
                    await response.background()
                return response, body

        response, body = asyncio.run(run_test())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body, b"data")
        self.assertNotIn("accept-ranges", response.headers)

    def test_lifespan_disables_upstream_redirect_following(self):
        application = SimpleNamespace(state=SimpleNamespace())

        async def run_test():
            async with app.lifespan(application):
                return application.state.http_client.follow_redirects

        self.assertFalse(asyncio.run(run_test()))

    def test_play_resolver_reports_missing_yt_dlp_binary(self):
        with patch.object(app.subprocess, "run", side_effect=FileNotFoundError):
            try:
                app.resolve_and_get_cdn(FACEBOOK_URL)
            except FileNotFoundError:
                self.fail("FileNotFoundError was not converted to HTTPException")
            except HTTPException as exc:
                raised = exc
            else:
                self.fail("HTTPException not raised")

        self.assertEqual(raised.status_code, 500)
        self.assertIn("yt-dlp not found", raised.detail)

    def test_tiktok_html_follows_allowed_redirect(self):
        start_url = "https://vt.tiktok.com/abc123/"
        target_url = "https://www.tiktok.com/video/123456789"
        requested = []
        responses = {
            start_url: FakeUrlResponse(302, {"Location": "//www.tiktok.com/video/123456789"}),
            target_url: FakeUrlResponse(
                200,
                body=b'<html>"playAddr":"https://v16-webapp-prime.tiktok.com/video.mp4"</html>',
            ),
        }

        def open_url(request, timeout):
            requested.append(request.full_url)
            return responses[request.full_url]

        opener = SimpleNamespace(open=open_url)
        with patch.object(app.urllib.request, "build_opener", return_value=opener), \
                patch.object(app.urllib.request, "urlopen", return_value=responses[start_url]):
            result = app.tiktok_try_html(start_url)

        self.assertIsNotNone(result)
        self.assertEqual(result["videoUrl"], "https://v16-webapp-prime.tiktok.com/video.mp4")
        self.assertEqual(requested, [start_url, target_url])

    def test_tiktok_html_rejects_private_redirect_without_requesting_it(self):
        start_url = "https://vt.tiktok.com/abc123/"
        redirect = FakeUrlResponse(302, {"Location": "http://127.0.0.1/internal"})
        requested = []

        def open_url(request, timeout):
            requested.append(request.full_url)
            return redirect

        opener = SimpleNamespace(open=open_url)
        with patch.object(app.urllib.request, "build_opener", return_value=opener), \
                patch.object(app.urllib.request, "urlopen", return_value=redirect):
            result = app.tiktok_try_html(start_url)

        self.assertIsNone(result)
        self.assertEqual(requested, [start_url])
        self.assertTrue(redirect.closed)


class RegionScoringTests(unittest.TestCase):
    VN_URL = "https://video.fhan14-5.fna.fbcdn.net/o1/v/t2/f2/m412/abc.mp4?oh=123"
    US_URL = "https://video-den2-1.xx.fbcdn.net/o1/v/t2/f2/m412/abc.mp4?oh=123"

    def test_hanoi_edge_scores_above_denver(self):
        self.assertEqual(app.region_score(self.VN_URL), 100)
        self.assertEqual(app.region_score(self.US_URL), -50)

    def test_pick_prefers_vn_regardless_of_order(self):
        self.assertEqual(app.pick_best_region_url([self.US_URL, self.VN_URL]), self.VN_URL)
        self.assertEqual(app.pick_best_region_url([self.VN_URL, self.US_URL]), self.VN_URL)

    def test_pick_returns_none_for_empty(self):
        self.assertIsNone(app.pick_best_region_url([]))
        self.assertIsNone(app.pick_best_region_url(None))


class ProxyConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.orig_env = os.environ.copy()
        for key in (
            "PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy",
            "PROXY_USER", "PROXY_PASS", "PROXY_HOST", "PROXY_PORT", "ENABLE_PROXY",
        ):
            os.environ.pop(key, None)

    def tearDown(self):
        for key in (
            "PROXY_URL", "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy",
            "PROXY_USER", "PROXY_PASS", "PROXY_HOST", "PROXY_PORT", "ENABLE_PROXY",
        ):
            os.environ.pop(key, None)
            if key in self.orig_env:
                os.environ[key] = self.orig_env[key]

    def test_get_proxy_url_returns_none_when_no_env_configured(self):
        self.assertIsNone(app.get_proxy_url())

    def test_get_proxy_url_uses_default_vn_proxy_with_user_and_pass(self):
        os.environ["PROXY_USER"] = "myuser"
        os.environ["PROXY_PASS"] = "mypass123"
        self.assertEqual(
            app.get_proxy_url(),
            "http://myuser:mypass123@103.195.238.24:443",
        )

    def test_get_proxy_url_custom_host_and_port(self):
        os.environ["PROXY_HOST"] = "1.2.3.4"
        os.environ["PROXY_PORT"] = "8080"
        os.environ["PROXY_USER"] = "u"
        os.environ["PROXY_PASS"] = "p"
        self.assertEqual(app.get_proxy_url(), "http://u:p@1.2.3.4:8080")

    def test_get_proxy_url_direct_proxy_url(self):
        os.environ["PROXY_URL"] = "http://admin:secret@103.195.238.24:443"
        self.assertEqual(app.get_proxy_url(), "http://admin:secret@103.195.238.24:443")

    def test_get_proxy_url_normalizes_missing_scheme(self):
        os.environ["PROXY_URL"] = "103.195.238.24:443"
        self.assertEqual(app.get_proxy_url(), "http://103.195.238.24:443")

    def test_get_proxy_url_quotes_special_characters(self):
        os.environ["PROXY_USER"] = "user@name"
        os.environ["PROXY_PASS"] = "pass:word"
        self.assertEqual(
            app.get_proxy_url(),
            "http://user%40name:pass%3Aword@103.195.238.24:443",
        )

    def test_get_proxy_url_enable_proxy_flag_without_auth(self):
        os.environ["ENABLE_PROXY"] = "1"
        self.assertEqual(app.get_proxy_url(), "http://103.195.238.24:443")

    def test_run_yt_dlp_includes_proxy_when_configured(self):
        os.environ["PROXY_USER"] = "testuser"
        os.environ["PROXY_PASS"] = "testpass"
        proxy_url = "http://testuser:testpass@103.195.238.24:443"

        with patch.object(app.subprocess, "run") as mock_run:
            app.run_yt_dlp("https://www.facebook.com/watch")
            mock_run.assert_called_once()
            cmd = mock_run.call_args[0][0]
            self.assertIn("--proxy", cmd)
            self.assertEqual(cmd[cmd.index("--proxy") + 1], proxy_url)

    def test_facebook_get_url_includes_proxy_when_configured(self):
        os.environ["PROXY_USER"] = "testuser"
        os.environ["PROXY_PASS"] = "testpass"
        proxy_url = "http://testuser:testpass@103.195.238.24:443"

        completed = CompletedProcess([], 0, stdout=CDN_URL + "\n", stderr="")
        with patch.object(app.subprocess, "run", return_value=completed) as mock_run:
            result = app.resolve_and_get_cdn(FACEBOOK_URL)
            self.assertEqual(result, CDN_URL)
            cmd = mock_run.call_args[0][0]
            self.assertIn("--proxy", cmd)
            self.assertEqual(cmd[cmd.index("--proxy") + 1], proxy_url)

    def test_health_reports_sanitized_proxy_without_credentials(self):
        os.environ["PROXY_USER"] = "secret_user"
        os.environ["PROXY_PASS"] = "super_secret_password"
        health_res = app.health()
        self.assertTrue(health_res["ok"])
        self.assertEqual(health_res["version"], "0.4.2")
        self.assertEqual(health_res["proxy"], "http://103.195.238.24:443")
        self.assertNotIn("secret_user", str(health_res))
        self.assertNotIn("super_secret_password", str(health_res))

    def test_build_http_opener_attaches_proxy_handler(self):
        os.environ["PROXY_USER"] = "u"
        os.environ["PROXY_PASS"] = "p"
        opener = app.build_http_opener()
        proxy_handlers = [h for h in opener.handlers if isinstance(h, app.urllib.request.ProxyHandler)]
        self.assertTrue(len(proxy_handlers) > 0)
        self.assertEqual(proxy_handlers[0].proxies.get("http"), "http://u:p@103.195.238.24:443")

    def test_lifespan_configures_proxy_on_async_client(self):
        os.environ["PROXY_USER"] = "u"
        os.environ["PROXY_PASS"] = "p"
        application = SimpleNamespace(state=SimpleNamespace())

        async def run_lifespan():
            async with app.lifespan(application):
                return application.state.http_client, getattr(application.state, "direct_http_client", None)

        client, direct_client = asyncio.run(run_lifespan())
        self.assertIsNotNone(client)
        self.assertIsNotNone(direct_client)
        self.assertIsNot(client, direct_client)

    def test_is_proxy_error_helper(self):
        self.assertTrue(app.is_proxy_error("ERROR: Unable to connect to proxy"))
        self.assertTrue(app.is_proxy_error("Tunnel connection failed: 407"))
        self.assertTrue(app.is_proxy_error("Connection refused"))
        self.assertTrue(app.is_proxy_error("Timed out"))
        self.assertFalse(app.is_proxy_error("Video unavailable / 404 Not Found"))
        self.assertFalse(app.is_proxy_error(""))
        self.assertFalse(app.is_proxy_error(None))

    def test_run_yt_dlp_auto_fallback_on_proxy_error(self):
        os.environ["PROXY_USER"] = "u"
        os.environ["PROXY_PASS"] = "p"
        failed_proxy = CompletedProcess([], 1, stdout="", stderr="ERROR: Proxy connection refused")
        ok_direct = CompletedProcess([], 0, stdout='{"title": "Test Video"}', stderr="")

        with patch.object(app.subprocess, "run", side_effect=[failed_proxy, ok_direct]) as mock_run:
            result = app.run_yt_dlp("https://www.facebook.com/watch")
            self.assertEqual(result.returncode, 0)
            self.assertEqual(mock_run.call_count, 2)
            # First attempt with proxy
            self.assertIn("--proxy", mock_run.call_args_list[0][0][0])
            # Second attempt without proxy (direct fallback)
            self.assertNotIn("--proxy", mock_run.call_args_list[1][0][0])

    def test_facebook_get_url_auto_fallback_on_proxy_error(self):
        os.environ["PROXY_USER"] = "u"
        os.environ["PROXY_PASS"] = "p"
        failed_proxy = CompletedProcess([], 1, stdout="", stderr="ERROR: Unable to connect to proxy: 103.195.238.24")
        ok_direct = CompletedProcess([], 0, stdout=CDN_URL + "\n", stderr="")

        with patch.object(app.subprocess, "run", side_effect=[failed_proxy, ok_direct]) as mock_run:
            result = app.resolve_and_get_cdn(FACEBOOK_URL)
            self.assertEqual(result, CDN_URL)
            self.assertEqual(mock_run.call_count, 2)
            # First attempt included proxy
            self.assertIn("--proxy", mock_run.call_args_list[0][0][0])
            # Second attempt was direct
            self.assertNotIn("--proxy", mock_run.call_args_list[1][0][0])

    def test_scrape_facebook_og_uu_tien_hd_truoc_sd(self):
        """UA la Tizen TV nen Facebook tra H.264 cho ca HD -> phai chon HD truoc SD."""
        # Facebook escape JSON trong HTML: \u002F cho "https://" va \/ cho dau "/".
        html_bytes = (
            b'<html><script>{"browser_native_sd_url":"https:\\u002F\\u002Fvideo.xx.fbcdn.net\\/SD.mp4",'
            b'"browser_native_hd_url":"https:\\u002F\\u002Fvideo.xx.fbcdn.net\\/HD.mp4"}</script></html>'
        )
        opener = SimpleNamespace(open=unittest.mock.Mock(return_value=FakeUrlResponse(200, body=html_bytes)))
        with patch.object(app, "build_http_opener", return_value=opener):
            result = app.scrape_facebook_og(FACEBOOK_URL)
        self.assertEqual(result["videoUrl"], "https://video.xx.fbcdn.net/HD.mp4")

    def test_scrape_facebook_og_fallback_sd_khi_khong_co_hd(self):
        """Khong co URL HD -> duoc phep rớt xuong SD thay vì tra loi."""
        html_bytes = (
            b'<html><script>{"browser_native_sd_url":"https:\\u002F\\u002Fvideo.xx.fbcdn.net\\/SD.mp4"}'
            b"</script></html>"
        )
        opener = SimpleNamespace(open=unittest.mock.Mock(return_value=FakeUrlResponse(200, body=html_bytes)))
        with patch.object(app, "build_http_opener", return_value=opener):
            result = app.scrape_facebook_og(FACEBOOK_URL)
        self.assertEqual(result["videoUrl"], "https://video.xx.fbcdn.net/SD.mp4")

    def test_scrape_facebook_og_auto_fallback_on_proxy_error(self):
        os.environ["PROXY_USER"] = "u"
        os.environ["PROXY_PASS"] = "p"

        html_bytes = b'<html><meta property="og:video" content="https://video.xx.fbcdn.net/scraped.mp4" /></html>'
        proxy_opener = SimpleNamespace(open=unittest.mock.Mock(side_effect=app.urllib.error.URLError("Proxy connection refused")))
        direct_opener = SimpleNamespace(open=unittest.mock.Mock(return_value=FakeUrlResponse(200, body=html_bytes)))

        with patch.object(app, "build_http_opener", side_effect=[proxy_opener, direct_opener]):
            result = app.scrape_facebook_og(FACEBOOK_URL)
            self.assertIsNotNone(result)
            self.assertEqual(result["videoUrl"], "https://video.xx.fbcdn.net/scraped.mp4")

    def test_proxy_cdn_auto_fallback_on_proxy_error(self):
        proxy_client = AsyncMock()
        proxy_client.build_request = unittest.mock.MagicMock()
        proxy_client.send = AsyncMock(side_effect=httpx.ProxyError("Cannot connect to proxy"))

        direct_client = AsyncMock()
        direct_client.build_request = unittest.mock.MagicMock()
        direct_resp = httpx.Response(200, headers={"content-type": "video/mp4"}, stream=TrackingStream(b"direct_data"))
        direct_client.send = AsyncMock(return_value=direct_resp)

        request = SimpleNamespace(
            headers={},
            app=SimpleNamespace(state=SimpleNamespace(http_client=proxy_client, direct_http_client=direct_client)),
        )

        async def run_proxy():
            response = await app.proxy_cdn(request, CDN_URL, FACEBOOK_URL)
            body = b"".join([chunk async for chunk in response.body_iterator])
            if response.background:
                await response.background()
            return response, body

        response, body = asyncio.run(run_proxy())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body, b"direct_data")
        proxy_client.send.assert_awaited_once()
        direct_client.send.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
