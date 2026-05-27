"""AI chat proxy tests. With no ANTHROPIC_API_KEY set, it degrades gracefully.

We also assert the Pydantic v2 field_validators sanitise/limit input.
"""
import os
import pytest

from backend.routers.ai_chat import ChatRequest, MAX_MSG_LEN, MAX_MSGS


def test_chat_without_key_returns_helpful_message(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    res = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 200
    assert "not configured" in res.json()["response"].lower()


def test_content_validator_strips_null_and_truncates():
    long = "a" * (MAX_MSG_LEN + 500)
    req = ChatRequest(messages=[{"role": "user", "content": "x\x00y" + long}])
    content = req.messages[0].content
    assert "\x00" not in content
    assert len(content) <= MAX_MSG_LEN


def test_messages_validator_limits_count():
    msgs = [{"role": "user", "content": str(i)} for i in range(MAX_MSGS + 10)]
    req = ChatRequest(messages=msgs)
    assert len(req.messages) == MAX_MSGS
