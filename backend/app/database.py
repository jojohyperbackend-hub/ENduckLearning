import logging
import threading
import time
from typing import Optional

import httpx
from postgrest.utils import SyncClient as _PostgrestSession
from supabase import Client, create_client

from app.config import settings

logger = logging.getLogger("app.database")

# Supabase (PostgREST) dipakai lewat 1 koneksi HTTP/2 bareng-bareng dari banyak thread.
# Kadang server nutup koneksi itu (GOAWAY -> httpx.RemoteProtocolError "ConnectionTerminated"),
# dan semua request yang lagi jalan di koneksi itu ikut gagal -> 500.
# Request yang kena GOAWAY belum diproses server, jadi aman diulang pakai koneksi baru.
_RETRY_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = 0.15
_RETRY_ALWAYS = (httpx.RemoteProtocolError, httpx.ConnectError, httpx.PoolTimeout)
# Error baca cuma diulang buat request yang gak ngubah data.
_RETRY_READ_ONLY = (httpx.ReadError, httpx.ReadTimeout)
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

_original_session_request = _PostgrestSession.request


def _request_with_retry(self, method, url, *args, **kwargs):
    for attempt in range(1, _RETRY_ATTEMPTS + 1):
        try:
            return _original_session_request(self, method, url, *args, **kwargs)
        except _RETRY_ALWAYS + _RETRY_READ_ONLY as exc:
            retryable = isinstance(exc, _RETRY_ALWAYS) or str(method).upper() in _SAFE_METHODS
            if not retryable or attempt == _RETRY_ATTEMPTS:
                raise
            logger.warning(
                "Koneksi Supabase putus (%s), ulang request %s ke-%s",
                type(exc).__name__,
                method,
                attempt + 1,
            )
            time.sleep(_RETRY_BACKOFF_SECONDS * attempt)
    raise RuntimeError("unreachable")


if not getattr(_PostgrestSession.request, "_retry_wrapped", False):
    _request_with_retry._retry_wrapped = True  # type: ignore[attr-defined]
    _PostgrestSession.request = _request_with_retry  # type: ignore[method-assign]

_service_client: Optional[Client] = None
_anon_client: Optional[Client] = None
_service_client_lock = threading.Lock()
_anon_client_lock = threading.Lock()


def get_service_client() -> Client:
    global _service_client
    if _service_client is not None:
        return _service_client
    with _service_client_lock:
        if _service_client is None:
            _service_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY,
            )
            logger.info("Koneksi Supabase service_role berhasil diinisialisasi")
    return _service_client


def get_anon_client() -> Client:
    global _anon_client
    if _anon_client is not None:
        return _anon_client
    with _anon_client_lock:
        if _anon_client is None:
            _anon_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_ANON_KEY,
            )
            logger.info("Koneksi Supabase anon berhasil diinisialisasi")
    return _anon_client
