"""Autenticação e autorização do runtime.

- Tokens de portador (``Authorization: Bearer …``). O servidor guarda só o SHA-256 de cada token, em
  ``BEZALEL_RUNTIME_TOKENS`` (``nome:papel:sha256,nome:papel:sha256``); gere com
  ``python -m app.runtime.cli token <nome> <papel>``.
- Papéis por ação: ``reader`` (consultar) < ``operator`` (criar e cancelar tarefas) < ``approver``
  (decidir aprovações) < ``admin``. Nenhum agente tem papel: agente não aprova, não cria token, não muda
  o próprio nível nem o próprio orçamento.
- Sem tokens configurados, o runtime fica fechado (503): nunca aberto por padrão.
- Escritas só da própria máquina (127.0.0.1/::1), a menos que ``BEZALEL_RUNTIME_ALLOW_REMOTE_WRITES=1``
  esteja definido conscientemente (atrás de TLS e do proxy, ver docs/AGENT-OPERATIONS.md).
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import HTTPException, Request

ROLES = ["reader", "operator", "approver", "admin"]
LOCAL_HOSTS = {"127.0.0.1", "::1", "localhost"}


@dataclass(frozen=True)
class Principal:
    name: str
    role: str

    def can(self, needed: str) -> bool:
        return ROLES.index(self.role) >= ROLES.index(needed)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_token() -> str:
    return "bzr_" + secrets.token_urlsafe(32)


def _configured() -> list[tuple[str, str, str]]:
    out = []
    for item in os.environ.get("BEZALEL_RUNTIME_TOKENS", "").split(","):
        parts = item.strip().split(":")
        if len(parts) == 3 and parts[1] in ROLES and len(parts[2]) == 64:
            out.append((parts[0], parts[1], parts[2].lower()))
    return out


def authenticate(request: Request) -> Principal:
    tokens = _configured()
    if not tokens:
        raise HTTPException(status_code=503, detail="Runtime sem autenticação configurada (BEZALEL_RUNTIME_TOKENS): fechado por padrão.")
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token ausente", headers={"WWW-Authenticate": "Bearer"})
    got = hash_token(header[7:].strip())
    for name, role, h in tokens:
        if hmac.compare_digest(got, h):
            return Principal(name, role)
    raise HTTPException(status_code=401, detail="Token inválido", headers={"WWW-Authenticate": "Bearer"})


_writes: dict[str, deque[float]] = defaultdict(deque)
WRITE_LIMIT = 30  # escritas…
WRITE_WINDOW = 60  # …por minuto, por token (estado em memória: um processo de API)


def require(needed: str, write: bool = False):
    def dep(request: Request) -> Principal:
        p = authenticate(request)
        if not p.can(needed):
            raise HTTPException(status_code=403, detail=f"Papel '{p.role}' não autoriza esta ação (exige '{needed}')")
        if write:
            host = request.client.host if request.client else ""
            if host not in LOCAL_HOSTS and os.environ.get("BEZALEL_RUNTIME_ALLOW_REMOTE_WRITES") != "1":
                raise HTTPException(status_code=403, detail="Escrita no runtime só da própria máquina nesta etapa")
            now = time.monotonic()
            log = _writes[p.name]
            while log and now - log[0] > WRITE_WINDOW:
                log.popleft()
            if len(log) >= WRITE_LIMIT:
                raise HTTPException(status_code=429, detail="Limite de escritas atingido")
            log.append(now)
        return p

    return dep
