from __future__ import annotations

import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest import mock

from tools.campaign_manifest import generate
from tools.campaign_manifest.generate import (
    ManifestError,
    build_manifest,
    render_manifest,
    write_manifest,
)


def _png(width: int, height: int, color_type: int = 6) -> bytes:
    def chunk(name: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(name)
        crc = zlib.crc32(data, crc)
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", crc & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IEND", b"")


class CampaignManifestTests(unittest.TestCase):
    def _campaign(self, root: Path) -> Path:
        campaign = root / "Projeto Memoria"
        (campaign / "assets" / "mapas" / "helix-9" / "vtt-limpo").mkdir(parents=True)
        (campaign / "assets" / "mapas" / "helix-9" / "overlays").mkdir(parents=True)
        (campaign / "assets" / "tokens").mkdir(parents=True)
        (campaign / "assets" / "objetos" / "ancoras").mkdir(parents=True)
        (campaign / "docs").mkdir(parents=True)

        (campaign / "README.md").write_text("# Projeto Mnemosyne\n", encoding="utf-8")
        (campaign / "docs" / "memoria.md").write_text(
            "# Memória corrompida\n\n> Documento do mestre.\n", encoding="utf-8"
        )
        (campaign / "docs" / "biblia-da-campanha.md").write_text(
            "# Bíblia da campanha\n\nSegredos sem marcador textual.\n", encoding="utf-8"
        )
        (campaign / "assets" / "mapas" / "helix-9" / "vtt-limpo" / "helix-9-nivel-0-battlemap-vtt-v1.png").write_bytes(
            _png(128, 128, color_type=2)
        )
        (campaign / "assets" / "mapas" / "helix-9" / "vtt-limpo" / "helix-9-nivel-0-battlemap-vtt-v2.png").write_bytes(
            _png(128, 128, color_type=2)
        )
        (campaign / "assets" / "mapas" / "helix-9" / "overlays" / "helix-9-nivel-0-inundacao-overlay-vtt-v1.png").write_bytes(
            _png(128, 128)
        )
        (campaign / "assets" / "tokens" / "eco-indexador-token-vtt-v1.png").write_bytes(
            _png(64, 64)
        )
        (campaign / "assets" / "objetos" / "ancoras" / "malha-mnemonica-ativa-objeto-vtt-v1.png").write_bytes(
            _png(64, 64)
        )
        (campaign / "assets" / "objetos" / "ancoras" / "malha-mnemonica-ativa-objeto-vtt-v2.png").write_bytes(
            _png(64, 64)
        )
        (campaign / "assets" / "objetos" / "ancoras" / "malha-mnemonica-desativada-objeto-vtt-v1.png").write_bytes(
            _png(64, 64)
        )
        return campaign

    def test_builds_utf8_manifest_with_relative_paths_and_scene(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self._campaign(Path(temporary))
            manifest = build_manifest(campaign)

            self.assertEqual(manifest["summary"]["assetCount"], 7)
            documents = {item["relativePath"]: item for item in manifest["documents"]}
            self.assertEqual(documents["docs/memoria.md"]["title"], "Memória corrompida")
            self.assertEqual(documents["docs/memoria.md"]["audienceHint"], "gm")
            self.assertEqual(documents["docs/biblia-da-campanha.md"]["audienceHint"], "gm")
            self.assertEqual(documents["README.md"]["audienceHint"], "unspecified")
            scene = manifest["collections"]["scenes"][0]
            self.assertEqual(scene["key"], "helix-9-nivel-0")
            self.assertEqual([item["version"] for item in scene["playerMaps"]], [1, 2])
            self.assertTrue(scene["activePlayerMap"].endswith("-v2.png"))
            self.assertEqual(manifest["summary"]["stateGroupCount"], 1)
            self.assertEqual(
                set(manifest["collections"]["stateGroups"][0]["states"]),
                {"ativo", "desativado"},
            )
            active_state = manifest["collections"]["stateGroups"][0]["states"]["ativo"]
            self.assertEqual(active_state["version"], 2)
            self.assertTrue(
                any(warning["code"] == "state-duplicate" for warning in manifest["warnings"])
            )
            self.assertEqual(manifest["campaign"]["sourceRef"], "mnemosyne")
            self.assertNotIn("sourceRoot", manifest["campaign"])
            self.assertNotIn("\\", manifest["assets"][0]["relativePath"])

    def test_render_is_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first_campaign = self._campaign(root / "first")
            second_campaign = self._campaign(root / "second")
            first = render_manifest(build_manifest(first_campaign))
            second = render_manifest(build_manifest(second_campaign))
            self.assertEqual(first, second)
            self.assertNotIn(str(first_campaign.resolve()), first)

    def test_same_highest_map_version_is_explicitly_ambiguous(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self._campaign(Path(temporary))
            alternative = (
                campaign
                / "assets"
                / "mapas"
                / "helix-9"
                / "vtt-limpo"
                / "helix-9-nivel-0-battlemap-vtt-v2.svg"
            )
            alternative.write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"/>',
                encoding="utf-8",
            )

            manifest = build_manifest(campaign)
            scene = manifest["collections"]["scenes"][0]

            self.assertIsNone(scene["activePlayerMap"])
            self.assertTrue(
                any(
                    warning["code"] == "scene-player-map-ambiguous"
                    for warning in manifest["warnings"]
                )
            )

    def test_refuses_output_inside_source_campaign(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self._campaign(Path(temporary))
            manifest = build_manifest(campaign)
            with self.assertRaises(ManifestError):
                write_manifest(manifest, campaign / "manifest.json", campaign)

    def test_writes_utf8_without_copying_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            output = root / "generated" / "manifest.json"
            source_files_before = sorted(path.relative_to(campaign) for path in campaign.rglob("*") if path.is_file())

            write_manifest(build_manifest(campaign), output, campaign)

            source_files_after = sorted(path.relative_to(campaign) for path in campaign.rglob("*") if path.is_file())
            self.assertEqual(source_files_before, source_files_after)
            self.assertIn("Memória corrompida", output.read_text(encoding="utf-8"))

    def test_unique_temporary_does_not_touch_legacy_temp_name(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            output = root / "generated" / "manifest.json"
            output.parent.mkdir()
            legacy_temporary = output.with_name(f"{output.name}.tmp")
            legacy_temporary.write_text("nao tocar", encoding="utf-8")

            write_manifest(build_manifest(campaign), output, campaign)

            self.assertEqual(legacy_temporary.read_text(encoding="utf-8"), "nao tocar")
            self.assertEqual(list(output.parent.glob(f".{output.name}.*.tmp")), [])

    def test_skips_file_symlink_that_resolves_outside_campaign(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            external = root / "outside.png"
            external.write_bytes(_png(32, 32))
            link = campaign / "assets" / "tokens" / "outside-token-vtt-v1.png"
            try:
                link.symlink_to(external)
            except OSError as error:
                self.skipTest(f"symlink indisponivel: {error}")

            manifest = build_manifest(campaign)

            asset_paths = {asset["relativePath"] for asset in manifest["assets"]}
            self.assertNotIn("assets/tokens/outside-token-vtt-v1.png", asset_paths)
            self.assertTrue(any(warning["code"] == "link-skipped" for warning in manifest["warnings"]))

    def test_detects_windows_reparse_point_without_python_312_api(self) -> None:
        path = mock.Mock()
        path.is_symlink.return_value = False
        path.lstat.return_value = mock.Mock(st_file_attributes=0x0400)

        self.assertTrue(generate._is_link_or_junction(path))

    def test_detects_asset_changed_during_read(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self._campaign(Path(temporary)).resolve()
            target = campaign / "assets" / "tokens" / "eco-indexador-token-vtt-v1.png"
            original_sha256 = generate._sha256

            def hash_then_change(path: Path) -> str:
                digest = original_sha256(path)
                path.write_bytes(path.read_bytes() + b"changed")
                return digest

            with mock.patch.object(generate, "_sha256", side_effect=hash_then_change):
                with self.assertRaisesRegex(ManifestError, "alterado durante a leitura"):
                    generate._asset_metadata(target, campaign)


if __name__ == "__main__":
    unittest.main()
