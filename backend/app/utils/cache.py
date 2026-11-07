import threading
from typing import Any, Callable, MutableMapping

from cachetools import TTLCache

PRACTICE_GENERATE_LIMIT_PER_HOUR = 10
TRANSLATE_ATTEMPT_LIMIT_PER_HOUR = 30
DAILY_TOKEN_BUDGET = 50000
CONTENT_CACHE_TTL_SECONDS = 600
RATE_LIMIT_WINDOW_SECONDS = 3600
DAILY_TOKEN_WINDOW_SECONDS = 86400

content_cache: TTLCache = TTLCache(maxsize=100, ttl=CONTENT_CACHE_TTL_SECONDS)

_practice_generate_rate_cache: TTLCache = TTLCache(maxsize=10000, ttl=RATE_LIMIT_WINDOW_SECONDS)
_translate_attempt_rate_cache: TTLCache = TTLCache(maxsize=10000, ttl=RATE_LIMIT_WINDOW_SECONDS)
_daily_token_usage_cache: TTLCache = TTLCache(maxsize=10000, ttl=DAILY_TOKEN_WINDOW_SECONDS)

_content_cache_lock = threading.Lock()
_rate_limit_lock = threading.Lock()


class RateLimitExceeded(Exception):
    def __init__(self, message: str, retry_after_seconds: int) -> None:
        super().__init__(message)
        self.message = message
        self.retry_after_seconds = retry_after_seconds


def get_or_set_cache(cache: MutableMapping, key: str, fetch_fn: Callable[[], Any]) -> Any:
    with _content_cache_lock:
        if key in cache:
            return cache[key]
    value = fetch_fn()
    with _content_cache_lock:
        cache[key] = value
    return value


def invalidate_cache_key(cache: MutableMapping, key: str) -> None:
    with _content_cache_lock:
        cache.pop(key, None)


def _check_and_increment(cache: TTLCache, user_id: str, limit: int, window_seconds: int) -> None:
    with _rate_limit_lock:
        entry = cache.get(user_id)
        if entry is None:
            entry = {"count": 0}
            cache[user_id] = entry
        if entry["count"] >= limit:
            jam = window_seconds // 3600
            raise RateLimitExceeded(
                f"Kamu udah pakai fitur ini {entry['count']} kali dari batas {limit} kali per {jam} jam. Coba lagi nanti ya.",
                window_seconds,
            )
        entry["count"] += 1


def check_practice_generate_rate_limit(user_id: str) -> None:
    _check_and_increment(
        _practice_generate_rate_cache, user_id, PRACTICE_GENERATE_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_SECONDS
    )


def check_translate_attempt_rate_limit(user_id: str) -> None:
    _check_and_increment(
        _translate_attempt_rate_cache, user_id, TRANSLATE_ATTEMPT_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_SECONDS
    )


def check_and_add_daily_token_usage(user_id: str, token_amount: int) -> None:
    with _rate_limit_lock:
        entry = _daily_token_usage_cache.get(user_id)
        if entry is None:
            entry = {"total": 0}
            _daily_token_usage_cache[user_id] = entry
        if entry["total"] + token_amount > DAILY_TOKEN_BUDGET:
            raise RateLimitExceeded(
                f"Total token AI kamu hari ini udah {entry['total']} dari batas {DAILY_TOKEN_BUDGET} token. Coba lagi besok ya.",
                DAILY_TOKEN_WINDOW_SECONDS,
            )
        entry["total"] += token_amount