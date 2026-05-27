"""Security middleware — SAST/OWASP compliance."""
import re
from fastapi import Request
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

MAX_BODY_BYTES = 4 * 1024 * 1024  # 4 MB

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"]  = "nosniff"
        response.headers["X-Frame-Options"]         = "DENY"
        response.headers["X-XSS-Protection"]        = "1; mode=block"
        response.headers["Referrer-Policy"]         = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"]           = "no-store, no-cache"
        if "server" in response.headers:
            del response.headers["server"]
        return response

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl and int(cl) > MAX_BODY_BYTES:
            return Response(
                content='{"detail":"Request body too large (max 4 MB)"}',
                status_code=413, media_type="application/json"
            )
        return await call_next(request)

def sanitise_id(value: str, max_len: int = 80) -> str:
    cleaned = re.sub(r'[^a-z0-9_]', '', str(value).lower())[:max_len]
    return ("m_" + cleaned) if not cleaned or not cleaned[0].isalpha() else cleaned
