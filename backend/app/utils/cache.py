import threading
from datetime import date
from typing import Any, Callable, Dict, Tuple

from cachetools import TTLCache

PRACTICE_GENERATE_LIMIT_PER_HOUR = 10
TRANSLATE_ATTEMPT_LIMIT_PER_HOUR = 30
DAILY_TOKEN_BUDGET = 50000

content_cache: TTLCache = TTLCache(maxsize=100, ttl=600)
_content_cache_lock = threading.Lock()

_practice_generate_hits: TTLCache = TTLCache(maxsize=10000, ttl=3600)
_translate_attempt_hits: TTLCache = TTLCache(maxsize=10000, ttl=3600)
_rate_limit_lock = threading.Lock()

_daily_token_usage: Dict[Tuple[str, date], int] = {}
_daily_token_usage_lock = threading.Lock()


class RateLimitExceeded(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def get_or_set_cache(cache_key: str, loader: Callable[[], Any]) -> Any:
    with _content_cache_lock:
        if cache_key in content_cache:
            return content_cache[cache_key]
    value = loader()
    with _content_cache_lock:
        content_cache[cache_key] = value
    return value


def invalidate_cache_key(cache_key: str) -> None:
    with _content_cache_lock:
        content_cache.pop(cache_key, None)


def _check_hourly_limit(cache: TTLCache, user_id: str, limit: int, feature_name: str) -> None:
    with _rate_limit_lock:
        current_count = cache.get(user_id, 0)
        if current_count >= limit:
            raise RateLimitExceeded(
                f"Batas penggunaan {feature_name} tercapai ({limit}x per jam), coba lagi nanti"
            )
        cache[user_id] = current_count + 1


def check_practice_generate_rate_limit(user_id: str) -> None:
    _check_hourly_limit(
        _practice_generate_hits, user_id, PRACTICE_GENERATE_LIMIT_PER_HOUR, "generate soal latihan"
    )


def check_translate_attempt_rate_limit(user_id: str) -> None:
    _check_hourly_limit(
        _translate_attempt_hits, user_id, TRANSLATE_ATTEMPT_LIMIT_PER_HOUR, "percobaan translate"
    )


def check_and_add_daily_token_usage(user_id: str, token_count: int) -> None:
    today = date.today()
    key = (user_id, today)
    with _daily_token_usage_lock:
        stale_keys = [existing_key for existing_key in _daily_token_usage if existing_key[1] != today]
        for stale_key in stale_keys:
            del _daily_token_usage[stale_key]

        current_usage = _daily_token_usage.get(key, 0)
        if current_usage + token_count > DAILY_TOKEN_BUDGET:
            raise RateLimitExceeded(
                f"Batas penggunaan token AI harian tercapai ({DAILY_TOKEN_BUDGET} token/hari)"
            )
        _daily_token_usage[key] = current_usage + token_count


def get_daily_token_usage(user_id: str) -> int:
    today = date.today()
    key = (user_id, today)
    with _daily_token_usage_lock:
        return _daily_token_usage.get(key, 0)
