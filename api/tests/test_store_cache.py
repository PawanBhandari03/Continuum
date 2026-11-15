"""The read cache in store.py: identical reads cost one request, writes invalidate, callers cannot corrupt it."""
import httpx

from app import store


def _store(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://db.test")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "k")
    calls = []

    def handler(request):
        calls.append((request.method, request.url.path))
        return httpx.Response(200, json=[{"id": "a", "n": len(calls)}])

    st = store.Store()
    st.http = httpx.Client(transport=httpx.MockTransport(handler), headers=st.http.headers)
    store._RC.clear()
    return st, calls


def test_identical_reads_share_one_request_and_writes_invalidate(monkeypatch):
    st, calls = _store(monkeypatch)
    a = st.sel("claims", {"handover_id": "h"})
    st.sel("claims", {"handover_id": "h"})
    assert len(calls) == 1
    a[0]["id"] = "mutated"                       # a caller changing its copy must not change the cache
    assert st.sel("claims", {"handover_id": "h"})[0]["id"] == "a"
    st.sel("claims", {"handover_id": "other"})   # different query: its own request
    assert len(calls) == 2
    st.upd("claims", {"id": "a"}, {"x": 1})       # a write invalidates every cached read
    st.sel("claims", {"handover_id": "h"})
    assert [c[0] for c in calls] == ["GET", "GET", "PATCH", "GET"]


def test_user_and_service_reads_never_share_cache(monkeypatch):
    svc, calls = _store(monkeypatch)
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "pub")
    user = store.Store(user_jwt="token-1")
    user.http = svc.http
    svc.sel("claims", {"handover_id": "h"})
    user.sel("claims", {"handover_id": "h"})
    assert len(calls) == 2
