from __future__ import annotations

import pytest

from caos_vtt.__main__ import _catalog_from_env


def test_source_server_runs_without_campaign_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CAOS_VTT_CAMPAIGN_MANIFEST", raising=False)
    monkeypatch.delenv("CAOS_VTT_CAMPAIGN_ROOT", raising=False)

    assert _catalog_from_env() is None


@pytest.mark.parametrize(
    ("manifest", "root"),
    (("manifest.json", ""), ("", "campaign")),
)
def test_source_campaign_environment_requires_a_pair(
    monkeypatch: pytest.MonkeyPatch,
    manifest: str,
    root: str,
) -> None:
    monkeypatch.setenv("CAOS_VTT_CAMPAIGN_MANIFEST", manifest)
    monkeypatch.setenv("CAOS_VTT_CAMPAIGN_ROOT", root)

    with pytest.raises(RuntimeError, match="precisam ser definidos juntos"):
        _catalog_from_env()
