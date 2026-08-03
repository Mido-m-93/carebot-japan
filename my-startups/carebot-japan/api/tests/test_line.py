# apps/api/tests/test_line.py
"""
Tests for services/line.py's get_bot_user_id -- looks up a LINE bot's own
User ID via its access token, since LINE's Developers Console never shows
this value directly (see routers/clinics.py's auto-detect on save).
"""
from unittest.mock import patch, MagicMock

import httpx

import services.line as line


class TestGetBotUserId:
    def test_returns_the_user_id_from_a_successful_response(self):
        fake_response = MagicMock()
        fake_response.json.return_value = {
            "userId": "Uc37864da0ab5342bb653338c7aba6e70",
            "basicId": "@961msxpr",
            "displayName": "Shinjuku Demo Clinic",
            "chatMode": "bot",
        }
        fake_response.raise_for_status = lambda: None

        with patch.object(line.httpx, "get", return_value=fake_response) as mock_get:
            result = line.get_bot_user_id("test-access-token")

        assert result == "Uc37864da0ab5342bb653338c7aba6e70"
        mock_get.assert_called_once_with(
            line.LINE_BOT_INFO_URL,
            headers={"Authorization": "Bearer test-access-token"},
            timeout=10,
        )

    def test_returns_none_on_an_invalid_or_expired_token(self):
        with patch.object(
            line.httpx, "get",
            side_effect=httpx.HTTPStatusError("401", request=MagicMock(), response=MagicMock()),
        ):
            assert line.get_bot_user_id("bad-token") is None

    def test_returns_none_on_a_network_failure(self):
        with patch.object(line.httpx, "get", side_effect=httpx.ConnectError("down")):
            assert line.get_bot_user_id("test-access-token") is None
