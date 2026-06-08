"""
Key Pool — CareerPilot

Round-robin API key rotation with automatic 429 fallback.

Usage:
    from services.key_pool import KeyPool

    groq_pool   = KeyPool("GROQ_API_KEY")
    google_pool = KeyPool("GOOGLE_API_KEY")

    # Simple: get current key
    key = groq_pool.current()

    # With 429 fallback inside a retry loop — use rotate_on_rate_limit():
    async for key in groq_pool.rotate_on_rate_limit():
        try:
            result = call_api(key)
            break
        except RateLimitError:
            continue   # pool raises KeyPoolExhausted if all keys are tried
"""

import os
import threading
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


class KeyPoolExhausted(Exception):
    """Raised when every key in the pool has hit a rate limit."""


class KeyPool:
    """
    Loads all numbered variants of an env var and rotates through them.

    Given base_name="GROQ_API_KEY", it loads:
        GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ...
    up to suffix _10 (11 keys maximum — more than enough for 5 friends).
    """

    def __init__(self, base_name: str, max_keys: int = 10) -> None:
        self._base_name = base_name
        self._keys: list[str] = self._load_keys(base_name, max_keys)
        self._index: int = 0
        self._lock = threading.Lock()

        if not self._keys:
            logger.warning(
                "KeyPool: no keys found for %s — API calls will fail.", base_name
            )
        else:
            logger.info(
                "KeyPool: loaded %d key(s) for %s.", len(self._keys), base_name
            )

    @staticmethod
    def _load_keys(base_name: str, max_keys: int) -> list[str]:
        keys: list[str] = []
        # First key: GROQ_API_KEY (no suffix)
        primary = os.environ.get(base_name, "").strip()
        if primary:
            keys.append(primary)
        # Additional keys: GROQ_API_KEY_2 … GROQ_API_KEY_{max_keys}
        for n in range(2, max_keys + 1):
            extra = os.environ.get(f"{base_name}_{n}", "").strip()
            if extra:
                keys.append(extra)
        return keys

    def __len__(self) -> int:
        return len(self._keys)

    def current(self) -> str:
        """Return the current key without rotating."""
        with self._lock:
            if not self._keys:
                raise KeyPoolExhausted(
                    f"No API keys configured for {self._base_name}."
                )
            return self._keys[self._index % len(self._keys)]

    def rotate(self) -> str:
        """Advance to the next key and return it."""
        with self._lock:
            if not self._keys:
                raise KeyPoolExhausted(
                    f"No API keys configured for {self._base_name}."
                )
            self._index = (self._index + 1) % len(self._keys)
            return self._keys[self._index]

    def all_keys(self) -> list[str]:
        """Return a copy of all loaded keys (for clients that need a fresh key per request)."""
        return list(self._keys)

    def rotate_on_rate_limit(self) -> "KeyRotationContext":
        """
        Return a context manager / iterator for automatic 429 fallback.

        Usage:
            ctx = groq_pool.rotate_on_rate_limit()
            for key in ctx:
                try:
                    result = call_api(key)
                    ctx.success()   # stop iteration
                    break
                except RateLimitError:
                    pass            # loop tries next key automatically
        """
        return KeyRotationContext(self)


class KeyRotationContext:
    """
    Iterator that yields each key in the pool once before raising
    KeyPoolExhausted.  Call .success() to break out early.
    """

    def __init__(self, pool: KeyPool) -> None:
        self._pool = pool
        self._tried: int = 0
        self._done: bool = False

    def __iter__(self) -> "KeyRotationContext":
        return self

    def __next__(self) -> str:
        if self._done:
            raise StopIteration
        if self._tried >= len(self._pool):
            raise KeyPoolExhausted(
                f"All {len(self._pool)} keys for "
                f"{self._pool._base_name} are rate-limited. "
                "Please wait a few minutes or add more API keys."
            )
        if self._tried == 0:
            key = self._pool.current()
        else:
            key = self._pool.rotate()
            logger.warning(
                "KeyPool: rotating %s to key index %d after rate limit.",
                self._pool._base_name,
                self._pool._index,
            )
        self._tried += 1
        return key

    def success(self) -> None:
        """Signal that the last key worked — stop the iteration."""
        self._done = True


# ---------------------------------------------------------------------------
# Module-level singletons — import and use directly
# ---------------------------------------------------------------------------

groq_pool    = KeyPool("GROQ_API_KEY")
google_pool  = KeyPool("GOOGLE_API_KEY")
jsearch_pool = KeyPool("JSEARCH_API_KEY")
tavily_pool  = KeyPool("TAVILY_API_KEY")
