"""Cadastra as criaturas balanceadas da Mnemosyne somente na mesa informada."""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import subprocess
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud import firestore as google_firestore
from google.oauth2.credentials import Credentials as OAuthCredentials
from PIL import Image


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG = SCRIPT_DIR / "config" / "mnemosyne.creatures.json"
DEFAULT_CAMPAIGN_ROOT = Path(r"F:\RPG\mnemosyne\projeto-mnemosyne-rpg")
MAX_IMAGE_DATA_URL = 350_000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mesa-id", required=True, help="ID exato da mesa no Firestore.")
    parser.add_argument("--service-account", help="JSON privado da conta de serviço. Também aceita GOOGLE_APPLICATION_CREDENTIALS.")
    parser.add_argument(
        "--firebase-cli",
        action="store_true",
        help="Usa em memória a sessão ativa do Firebase CLI, sem imprimir ou persistir o token.",
    )
    parser.add_argument("--project", default="sistemarpg-14d7d", help="Projeto Firebase de destino.")
    parser.add_argument("--campaign-root", type=Path, default=DEFAULT_CAMPAIGN_ROOT)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--dry-run", action="store_true", help="Valida e mostra o plano sem escrever no Firestore.")
    parser.add_argument("--force", action="store_true", help="Permite cadastrar mesmo se campaignId não for mnemosyne.")
    return parser.parse_args()


def encode_token(path: Path) -> str:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        for quality in (82, 72, 62, 52):
            output = io.BytesIO()
            image.save(output, format="WEBP", quality=quality, method=6)
            encoded = base64.b64encode(output.getvalue()).decode("ascii")
            data_url = f"data:image/webp;base64,{encoded}"
            if len(data_url) <= MAX_IMAGE_DATA_URL:
                return data_url
    raise ValueError(f"A imagem {path} não pôde ser reduzida para o limite do Firestore.")


def load_creatures(config_path: Path, campaign_root: Path) -> list[dict]:
    raw = json.loads(config_path.read_text(encoding="utf-8"))
    creatures: list[dict] = []
    for item in raw:
        creature = dict(item)
        token_path = campaign_root / creature.pop("tokenPath")
        if not token_path.is_file():
            raise FileNotFoundError(f"Token não encontrado: {token_path}")
        creature["foto"] = encode_token(token_path)
        creature["pv_atual"] = int(creature["pv_max"])
        creature["personalizada"] = True
        creatures.append(creature)
    return creatures


def firebase_cli_credentials() -> OAuthCredentials:
    command = ["firebase.cmd" if os.name == "nt" else "firebase", "login:list", "--json"]
    result = subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8")
    payload = json.loads(result.stdout)
    accounts = payload.get("result") or []
    if not accounts:
        raise RuntimeError("Nenhuma sessão ativa foi encontrada no Firebase CLI.")
    token = ((accounts[0].get("tokens") or {}).get("access_token") or "").strip()
    if not token:
        raise RuntimeError("A sessão do Firebase CLI não forneceu uma credencial temporária.")
    return OAuthCredentials(token=token)


def initialize_firebase(
    service_account: str | None,
    use_firebase_cli: bool,
    project: str,
) -> google_firestore.Client:
    if use_firebase_cli:
        return google_firestore.Client(project=project, credentials=firebase_cli_credentials())
    if firebase_admin._apps:
        return firestore.client()
    account_path = service_account or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if account_path:
        firebase_admin.initialize_app(credentials.Certificate(account_path))
    else:
        firebase_admin.initialize_app()
    return firestore.client()


def main() -> None:
    args = parse_args()
    creatures = load_creatures(args.config.resolve(), args.campaign_root.resolve())
    print(f"Plano: {len(creatures)} criaturas para a mesa {args.mesa_id}.")
    for creature in creatures:
        print(f"- {creature['nome']} (VD {creature['vd']}, imagem {len(creature['foto'])} caracteres)")
    if args.dry_run:
        return

    database = initialize_firebase(args.service_account, args.firebase_cli, args.project)
    mesa_ref = database.collection("mesas").document(args.mesa_id)
    mesa = mesa_ref.get()
    if not mesa.exists:
        raise RuntimeError(f"A mesa {args.mesa_id} não existe.")
    campaign_id = str((mesa.to_dict().get("vtt") or {}).get("campaignId") or "")
    if campaign_id != "mnemosyne" and not args.force:
        raise RuntimeError(
            f"A mesa usa campaignId={campaign_id!r}, não 'mnemosyne'. Use --force somente após conferir o alvo."
        )

    batch = database.batch()
    for creature in creatures:
        target = mesa_ref.collection("criaturas").document(creature["id"])
        batch.set(target, {**creature, "atualizadaEm": firestore.SERVER_TIMESTAMP})
    batch.commit()

    for creature in creatures:
        saved = mesa_ref.collection("criaturas").document(creature["id"]).get()
        if not saved.exists:
            raise RuntimeError(f"A criatura {creature['nome']} não foi encontrada após a gravação.")
        saved_data = saved.to_dict() or {}
        if saved_data.get("nome") != creature["nome"] or saved_data.get("vd") != creature["vd"]:
            raise RuntimeError(f"A criatura {creature['nome']} divergiu após a gravação.")
    print("Criaturas cadastradas e verificadas com sucesso.")


if __name__ == "__main__":
    main()
