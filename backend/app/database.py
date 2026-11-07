import logging
import threading
from typing import Optional

from supabase import Client, create_client

from app.config import settings

logger = logging.getLogger("app.database")

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