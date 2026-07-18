from __future__ import annotations

import json
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


def _webp(*chunks: tuple[bytes, bytes]) -> bytes:
    body = bytearray(b"WEBP")
    for chunk_type, payload in chunks:
        body.extend(chunk_type)
        body.extend(struct.pack("<I", len(payload)))
        body.extend(payload)
        if len(payload) & 1:
            body.append(0)
    return b"RIFF" + struct.pack("<I", len(body)) + bytes(body)


class CampaignManifestTests(unittest.TestCase):
    def _classification_config(
        self, root: Path, *, scene_layers: list[dict[str, object]] | None = None
    ) -> Path:
        path = root / "fixture.asset-overrides.json"
        path.write_text(
            json.dumps(
                {
                    "schemaVersion": 2,
                    "campaignId": "mnemosyne",
                    "assetOverrides": {},
                    "assetFamilyOverrides": {
                        "assets/tokens/corpo-conectado-token-vtt": {
                            "extensions": ["png", "webp"],
                            "kind": "prop",
                            "audience": "players",
                            "controlledBy": "gm",
                        },
                        "assets/tokens/helena-vasconcelos-cadeira-neural-token-vtt": {
                            "extensions": ["png", "webp"],
                            "kind": "prop",
                            "audience": "players",
                            "controlledBy": "gm",
                        },
                    },
                    "sceneLayers": scene_layers or [],
                },
                ensure_ascii=False,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        return path

    def _build(self, campaign: Path) -> dict[str, object]:
        return build_manifest(
            campaign,
            self._classification_config(campaign.parent),
        )

    def _campaign(self, root: Path) -> Path:
        campaign = root / "Projeto Memoria"
        (campaign / "assets" / "mapas" / "helix-9" / "vtt-limpo").mkdir(parents=True)
        (campaign / "assets" / "mapas" / "helix-9" / "overlays").mkdir(parents=True)
        (campaign / "assets" / "tokens").mkdir(parents=True)
        (campaign / "assets" / "handouts" / "one-shot-01").mkdir(parents=True)
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
        (campaign / "assets" / "tokens" / "corpo-conectado-token-vtt-v1.png").write_bytes(
            _png(64, 64)
        )
        (campaign / "assets" / "tokens" / "helena-vasconcelos-cadeira-neural-token-vtt-v1.png").write_bytes(
            _png(64, 64)
        )
        (campaign / "assets" / "handouts" / "one-shot-01" / "relatorio-handout-v1.png").write_bytes(
            _png(96, 128)
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
            manifest = self._build(campaign)

            self.assertEqual(manifest["summary"]["assetCount"], 10)
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
            assets = {item["relativePath"]: item for item in manifest["assets"]}
            self.assertEqual(
                assets["assets/tokens/corpo-conectado-token-vtt-v1.png"]["kind"],
                "prop",
            )
            self.assertEqual(
                assets[
                    "assets/tokens/helena-vasconcelos-cadeira-neural-token-vtt-v1.png"
                ]["kind"],
                "prop",
            )
            handout = assets["assets/handouts/one-shot-01/relatorio-handout-v1.png"]
            self.assertEqual((handout["kind"], handout["audience"]), ("handout", "gm"))
            assets_by_id = {asset["id"]: asset for asset in manifest["assets"]}
            token_paths = {
                assets_by_id[asset_id]["relativePath"]
                for asset_id in manifest["collections"]["tokenAssetIds"]
            }
            self.assertEqual(token_paths, {"assets/tokens/eco-indexador-token-vtt-v1.png"})
            self.assertIn(
                handout["id"], manifest["collections"]["handoutAssetIds"]
            )
            self.assertIn(
                assets["assets/tokens/corpo-conectado-token-vtt-v1.png"]["id"],
                manifest["collections"]["propAssetIds"],
            )
            self.assertRegex(
                manifest["classification"]["fingerprint"], r"^sha256:[0-9a-f]{64}$"
            )
            self.assertNotIn("sourceRoot", manifest["campaign"])
            self.assertNotIn("\\", manifest["assets"][0]["relativePath"])

    def test_scene_layers_consume_props_overlays_and_complete_state_groups(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            # Mantem uma unica revisao por estado para que o grupo inteiro seja
            # assumido pela layer, sem deixar uma variante historica solta.
            (
                campaign
                / "assets"
                / "objetos"
                / "ancoras"
                / "malha-mnemonica-ativa-objeto-vtt-v2.png"
            ).unlink()
            placement = {"x": 0.5, "y": 0.5, "width": 0.2, "height": 0.2, "rotation": 0}
            config = self._classification_config(
                root,
                scene_layers=[
                    {
                        "key": "corpos-conectados",
                        "sceneKey": "helix-9-nivel-0",
                        "label": "Corpos conectados",
                        "defaultState": None,
                        "states": {
                            "conectados": {
                                "label": "Conectados",
                                "assetPath": "assets/tokens/corpo-conectado-token-vtt-v1.png",
                                "placements": [placement, {**placement, "rotation": 90}],
                            }
                        },
                    },
                    {
                        "key": "malha-mnemonica",
                        "sceneKey": "helix-9-nivel-0",
                        "label": "Malha mnemônica",
                        "defaultState": None,
                        "states": {
                            "ativo": {
                                "label": "Ativa",
                                "assetPath": "assets/objetos/ancoras/malha-mnemonica-ativa-objeto-vtt-v1.png",
                                "placements": [placement],
                            },
                            "desativado": {
                                "label": "Desativada",
                                "assetPath": "assets/objetos/ancoras/malha-mnemonica-desativada-objeto-vtt-v1.png",
                                "placements": [placement],
                            },
                        },
                    },
                    {
                        "key": "inundacao-controlada",
                        "sceneKey": "helix-9-nivel-0",
                        "label": "Inundação",
                        "defaultState": None,
                        "states": {
                            "inundado": {
                                "label": "Inundado",
                                "assetPath": "assets/mapas/helix-9/overlays/helix-9-nivel-0-inundacao-overlay-vtt-v1.png",
                                "placements": [{**placement, "width": 1, "height": 1}],
                            }
                        },
                    },
                ],
            )

            manifest = build_manifest(campaign, config)
            scene = manifest["collections"]["scenes"][0]

            self.assertEqual(
                [layer["key"] for layer in scene["layers"]],
                ["corpos-conectados", "inundacao-controlada", "malha-mnemonica"],
            )
            self.assertEqual(scene["overlays"], [])
            self.assertEqual(manifest["collections"]["stateGroups"], [])
            prop_paths = {
                next(asset for asset in manifest["assets"] if asset["id"] == asset_id)[
                    "relativePath"
                ]
                for asset_id in manifest["collections"]["propAssetIds"]
            }
            self.assertEqual(
                prop_paths,
                {"assets/tokens/helena-vasconcelos-cadeira-neural-token-vtt-v1.png"},
            )
            self.assertEqual(manifest["summary"]["sceneLayerCount"], 3)

    def test_scene_layer_rejects_partial_consumption_of_state_group(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            config = self._classification_config(
                root,
                scene_layers=[
                    {
                        "key": "malha-mnemonica",
                        "sceneKey": "helix-9-nivel-0",
                        "label": "Malha mnemônica",
                        "defaultState": None,
                        "states": {
                            "ativo": {
                                "label": "Ativa",
                                "assetPath": "assets/objetos/ancoras/malha-mnemonica-ativa-objeto-vtt-v2.png",
                                "placements": [
                                    {"x": 0.5, "y": 0.5, "width": 0.2, "height": 0.2, "rotation": 0}
                                ],
                            }
                        },
                    }
                ],
            )

            with self.assertRaisesRegex(ManifestError, "apenas parte"):
                build_manifest(campaign, config)

    def test_invalid_scene_layer_geometry_is_ignored_with_config_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            config = self._classification_config(
                root,
                scene_layers=[
                    {
                        "key": "corpos-conectados",
                        "sceneKey": "helix-9-nivel-0",
                        "label": "Corpos conectados",
                        "defaultState": None,
                        "states": {
                            "conectados": {
                                "label": "Conectados",
                                "assetPath": "assets/tokens/corpo-conectado-token-vtt-v1.png",
                                "placements": [
                                    {"x": 0.5, "y": 0.5, "width": 0, "height": 0.2, "rotation": 0}
                                ],
                            }
                        },
                    }
                ],
            )

            manifest = build_manifest(campaign, config)

            self.assertEqual(manifest["summary"]["sceneLayerCount"], 0)
            self.assertTrue(
                any(
                    warning["code"] == "classification-config-invalid"
                    and "sceneLayers" in warning["message"]
                    for warning in manifest["warnings"]
                )
            )

    def test_render_is_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first_campaign = self._campaign(root / "first")
            second_campaign = self._campaign(root / "second")
            first = render_manifest(self._build(first_campaign))
            second = render_manifest(self._build(second_campaign))
            self.assertEqual(first, second)
            self.assertNotIn(str(first_campaign.resolve()), first)

    def test_missing_classification_config_warns_but_folder_rules_still_apply(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            missing_config = root / "missing-overrides.json"

            manifest = build_manifest(campaign, missing_config)

            self.assertIsNone(manifest["classification"]["fingerprint"])
            self.assertTrue(
                any(
                    warning["code"] == "classification-config-missing"
                    for warning in manifest["warnings"]
                )
            )
            handout = next(
                asset for asset in manifest["assets"] if asset["kind"] == "handout"
            )
            self.assertEqual(handout["audience"], "gm")

    def test_invalid_and_absent_exact_overrides_emit_deterministic_warnings(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            config = {
                "schemaVersion": 2,
                "campaignId": "mnemosyne",
                "assetOverrides": {
                    "assets/tokens/nao-existe-token-vtt-v1.png": {"kind": "prop"},
                    "../fora.png": {"kind": "token"},
                    "assets/tokens/eco-indexador-token-vtt-v1.png": {"kind": "invalido"},
                },
                "assetFamilyOverrides": {},
            }
            first_config = root / "first.json"
            second_config = root / "second.json"
            rendered_config = json.dumps(config, ensure_ascii=False, sort_keys=True)
            first_config.write_text(rendered_config, encoding="utf-8")
            second_config.write_text(rendered_config, encoding="utf-8")

            first = build_manifest(campaign, first_config)
            second = build_manifest(campaign, second_config)
            warning_codes = {warning["code"] for warning in first["warnings"]}

            self.assertIn("classification-override-invalid", warning_codes)
            self.assertIn("classification-override-missing", warning_codes)
            self.assertEqual(
                first["classification"]["fingerprint"],
                second["classification"]["fingerprint"],
            )

    def test_versioned_prop_families_apply_to_v2_plus_without_prefix_false_positives(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self._campaign(Path(temporary))
            tokens = campaign / "assets" / "tokens"
            family_members = (
                "corpo-conectado-token-vtt-v2.png",
                "helena-vasconcelos-cadeira-neural-token-vtt-v42.png",
            )
            lookalikes = (
                "corpo-conectado-token-vtt-v02.png",
                "corpo-conectado-token-vtt-v2-backup.png",
                "helena-vasconcelos-cadeira-neural-token-vtt-v0.png",
            )
            for name in (*family_members, *lookalikes):
                (tokens / name).write_bytes(_png(64, 64))

            manifest = self._build(campaign)
            assets = {asset["relativePath"]: asset for asset in manifest["assets"]}

            for name in family_members:
                asset = assets[f"assets/tokens/{name}"]
                self.assertEqual(asset["kind"], "prop")
                self.assertIn(asset["id"], manifest["collections"]["propAssetIds"])
                self.assertNotIn(asset["id"], manifest["collections"]["tokenAssetIds"])
            for name in lookalikes:
                asset = assets[f"assets/tokens/{name}"]
                self.assertEqual(asset["kind"], "token")
                self.assertIn(asset["id"], manifest["collections"]["tokenAssetIds"])

    def test_shared_controller_is_rejected_and_never_reaches_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            config_path = root / "shared-controller.json"
            config_path.write_text(
                json.dumps(
                    {
                        "schemaVersion": 2,
                        "campaignId": "mnemosyne",
                        "assetOverrides": {
                            "assets/tokens/eco-indexador-token-vtt-v1.png": {
                                "controlledBy": "shared"
                            }
                        },
                        "assetFamilyOverrides": {},
                    }
                ),
                encoding="utf-8",
            )

            manifest = build_manifest(campaign, config_path)

            self.assertTrue(
                any(
                    warning["code"] == "classification-override-invalid"
                    for warning in manifest["warnings"]
                )
            )
            self.assertEqual(
                {asset["controlledBy"] for asset in manifest["assets"]},
                {"gm"},
            )

    def test_large_tokens_and_props_do_not_request_runtime_derivatives(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self._campaign(Path(temporary))
            (campaign / "assets" / "tokens" / "criatura-grande-token-vtt-v1.png").write_bytes(
                _png(2048, 2048)
            )
            (campaign / "assets" / "objetos" / "objeto-grande-v1.png").write_bytes(
                _png(2048, 2048)
            )

            manifest = self._build(campaign)

            self.assertFalse(
                any(
                    warning["code"] == "runtime-derivative-recommended"
                    for warning in manifest["warnings"]
                )
            )

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

            manifest = self._build(campaign)
            scene = manifest["collections"]["scenes"][0]

            self.assertIsNone(scene["activePlayerMap"])
            self.assertTrue(
                any(
                    warning["code"] == "scene-player-map-ambiguous"
                    for warning in manifest["warnings"]
                )
            )

    def test_selects_only_highest_overlay_version_and_warns_only_on_active_tie(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self._campaign(Path(temporary))
            overlays = campaign / "assets" / "mapas" / "helix-9" / "overlays"
            version_two = overlays / "helix-9-nivel-0-inundacao-overlay-vtt-v2.png"
            version_two.write_bytes(_png(128, 128))

            manifest = self._build(campaign)
            scene = manifest["collections"]["scenes"][0]

            self.assertEqual(len(scene["overlays"]), 1)
            self.assertEqual(scene["overlays"][0]["version"], 2)
            self.assertTrue(
                any(
                    asset["relativePath"].endswith("inundacao-overlay-vtt-v1.png")
                    for asset in manifest["assets"]
                )
            )
            self.assertFalse(
                any(
                    warning["code"] == "scene-overlay-ambiguous"
                    for warning in manifest["warnings"]
                )
            )

            (overlays / "helix-9-nivel-0-inundacao-overlay-vtt-v2.svg").write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"/>',
                encoding="utf-8",
            )
            ambiguous = self._build(campaign)
            ambiguous_scene = ambiguous["collections"]["scenes"][0]
            overlay_warnings = [
                warning
                for warning in ambiguous["warnings"]
                if warning["code"] == "scene-overlay-ambiguous"
            ]

            self.assertEqual(ambiguous_scene["overlays"], [])
            self.assertEqual(len(overlay_warnings), 1)
            self.assertEqual(overlay_warnings[0]["path"], "helix-9-nivel-0/inundacao")

    def test_reads_vp8x_vp8_and_vp8l_webp_metadata_safely(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            width, height = 2048, 1536
            vp8x_payload = (
                bytes([0x10, 0, 0, 0])
                + (width - 1).to_bytes(3, "little")
                + (height - 1).to_bytes(3, "little")
            )
            vp8_payload = (
                b"\x00\x00\x00\x9d\x01\x2a"
                + width.to_bytes(2, "little")
                + height.to_bytes(2, "little")
            )
            packed_vp8l = (width - 1) | ((height - 1) << 14) | (1 << 28)
            vp8l_payload = b"\x2f" + packed_vp8l.to_bytes(4, "little")
            cases = {
                "extended.webp": (_webp((b"VP8X", vp8x_payload)), "VP8X", True),
                "lossy.webp": (_webp((b"VP8 ", vp8_payload)), "VP8", False),
                "lossless.webp": (_webp((b"VP8L", vp8l_payload)), "VP8L", True),
            }

            for name, (content, variant, has_alpha) in cases.items():
                with self.subTest(variant=variant):
                    path = root / name
                    path.write_bytes(content)
                    metadata = generate._image_metadata(path)
                    self.assertEqual(metadata["format"], "webp")
                    self.assertEqual((metadata["width"], metadata["height"]), (width, height))
                    self.assertEqual(metadata["hasAlpha"], has_alpha)
                    self.assertEqual(metadata["webpVariant"], variant)

    def test_rejects_webp_chunk_outside_declared_riff(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "truncated.webp"
            body = b"WEBP" + b"VP8X" + struct.pack("<I", 100) + b"\x00" * 10
            path.write_bytes(b"RIFF" + struct.pack("<I", len(body)) + body)

            with self.assertRaisesRegex(ManifestError, "excede os limites"):
                generate._image_metadata(path)

    def test_refuses_output_inside_source_campaign(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            campaign = self._campaign(Path(temporary))
            manifest = self._build(campaign)
            with self.assertRaises(ManifestError):
                write_manifest(manifest, campaign / "manifest.json", campaign)

    def test_writes_utf8_without_copying_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            campaign = self._campaign(root)
            output = root / "generated" / "manifest.json"
            source_files_before = sorted(path.relative_to(campaign) for path in campaign.rglob("*") if path.is_file())

            write_manifest(self._build(campaign), output, campaign)

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

            write_manifest(self._build(campaign), output, campaign)

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

            manifest = self._build(campaign)

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
