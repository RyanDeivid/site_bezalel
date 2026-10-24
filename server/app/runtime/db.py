"""Armazenamento do runtime: SQLite (biblioteca padrão), com esquema versionado.

Por que SQLite: uma instância, um processo de API e um worker (o mesmo padrão de implantação do backend,
ver server/deploy). Com WAL, leitores não bloqueiam o escritor; com ``busy_timeout``, dois processos
esperam um ao outro em vez de falhar. Para vários workers em máquinas diferentes, o caminho é PostgreSQL
(docs/AGENT-RUNTIME.md › Evolução). O banco fica fora do frontend e dos dados de demonstração.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "var" / "runtime.db"

# Cada migração roda uma vez, em ordem, numa transação. Nunca edite uma migração já aplicada: crie outra.
MIGRATIONS: list[str] = [
    # 1 — esquema inicial
    """
    CREATE TABLE agent_definitions (
        id TEXT NOT NULL,
        version INTEGER NOT NULL,
        definition TEXT NOT NULL,          -- JSON da definição (identidade, ferramentas, limites, critérios)
        registered_at TEXT NOT NULL,
        PRIMARY KEY (id, version)
    );
    CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_version INTEGER NOT NULL,
        objective TEXT NOT NULL,
        input TEXT NOT NULL,               -- JSON validado pelo esquema de entrada do agente
        state TEXT NOT NULL CHECK (state IN ('queued','running','waiting_approval','succeeded','failed','cancelled')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL,
        not_before TEXT,                   -- próxima tentativa (backoff)
        deadline TEXT,
        correlation_id TEXT NOT NULL,
        dedupe_key TEXT,                   -- tarefas idênticas em andamento não se duplicam
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        lease_owner TEXT,                  -- worker que a executa agora
        lease_until TEXT,                  -- se expirar sem renovação, a execução foi interrompida
        cancel_requested INTEGER NOT NULL DEFAULT 0,
        result TEXT,                       -- JSON do resultado estruturado
        error TEXT,
        cost_usd REAL NOT NULL DEFAULT 0,
        schedule_id TEXT,
        environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live','test'))
    );
    CREATE INDEX tasks_state ON tasks(state, not_before);
    CREATE UNIQUE INDEX tasks_dedupe_active ON tasks(dedupe_key) WHERE dedupe_key IS NOT NULL AND state IN ('queued','running','waiting_approval');
    CREATE TABLE executions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        attempt INTEGER NOT NULL,
        worker TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('running','succeeded','failed','timed_out','cancelled','interrupted')),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        steps INTEGER NOT NULL DEFAULT 0,
        model_calls INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        error TEXT,
        UNIQUE (task_id, attempt)
    );
    CREATE TABLE events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,  -- ordem total e cursor de paginação
        id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        at TEXT NOT NULL,
        actor TEXT NOT NULL,               -- 'agent:<id>', 'worker:<id>', 'user:<nome>', 'system'
        task_id TEXT,
        execution_id TEXT,
        correlation_id TEXT,
        result TEXT NOT NULL CHECK (result IN ('success','failure','warning','info')),
        summary TEXT NOT NULL,
        data TEXT,                         -- JSON
        environment TEXT NOT NULL          -- 'live' (runtime real) ou 'test', nunca 'demo' aqui
    );
    CREATE INDEX events_task ON events(task_id, seq);
    CREATE TABLE approvals (
        id TEXT PRIMARY KEY,
        task_id TEXT REFERENCES tasks(id),
        agent_id TEXT NOT NULL,
        action TEXT NOT NULL,
        params TEXT NOT NULL,              -- JSON exato do que será feito
        destination TEXT NOT NULL,
        risks TEXT NOT NULL,
        expected_effects TEXT NOT NULL,
        action_hash TEXT NOT NULL,         -- sha256 de ação + parâmetros + destino (não serve para outra ação)
        state TEXT NOT NULL CHECK (state IN ('pending','approved','rejected','revoked','expired','consumed')),
        requested_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        decided_by TEXT,
        decided_at TEXT,
        decision_note TEXT,
        executed_at TEXT,
        execution_result TEXT
    );
    CREATE TABLE evaluations (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        agent_id TEXT NOT NULL,
        agent_version INTEGER NOT NULL,
        evaluator TEXT NOT NULL,           -- quem avaliou (nunca o próprio agente)
        at TEXT NOT NULL,
        scores TEXT NOT NULL,              -- JSON: critério -> valor medido
        notes TEXT
    );
    CREATE TABLE schedules (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        objective TEXT NOT NULL,
        input TEXT NOT NULL,
        interval_seconds INTEGER NOT NULL CHECK (interval_seconds >= 3600),
        enabled INTEGER NOT NULL DEFAULT 1,
        next_run_at TEXT NOT NULL,
        last_task_id TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE usage_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        day TEXT NOT NULL,
        task_id TEXT,
        execution_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost_usd REAL NOT NULL
    );
    CREATE INDEX usage_day ON usage_ledger(day);
    """,
]

_local = threading.local()


def db_path() -> Path:
    return Path(os.environ.get("BEZALEL_RUNTIME_DB", DEFAULT_PATH))


def connect(path: Path | str | None = None) -> sqlite3.Connection:
    """Uma conexão por thread (sqlite3 não deve ser compartilhado entre threads sem cuidado)."""
    p = Path(path) if path else db_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(p, timeout=10, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


@contextmanager
def transaction(conn: sqlite3.Connection, immediate: bool = True) -> Iterator[sqlite3.Connection]:
    """Transação explícita. ``BEGIN IMMEDIATE`` pega a trava de escrita na hora: duas threads ou processos
    nunca leem o mesmo estado e escrevem por cima um do outro."""
    conn.execute("BEGIN IMMEDIATE" if immediate else "BEGIN")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")


def _statements(sql: str) -> list[str]:
    """Divide o script em comandos completos (um ';' dentro de comentário ou texto não corta o comando)."""
    out, buf = [], ""
    for line in sql.splitlines(keepends=True):
        buf += line
        if sqlite3.complete_statement(buf):
            if buf.strip():
                out.append(buf.strip())
            buf = ""
    if buf.strip():
        raise ValueError("migração termina com um comando incompleto")
    return out


def migrate(conn: sqlite3.Connection) -> int:
    """Aplica as migrações pendentes; devolve a versão do esquema."""
    conn.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)")
    row = conn.execute("SELECT version FROM schema_version").fetchone()
    current = row["version"] if row else 0
    for i, sql in enumerate(MIGRATIONS[current:], start=current + 1):
        with transaction(conn):
            # (statement a statement: o executescript faria COMMIT implícito no meio da transação)
            for statement in _statements(sql):
                conn.execute(statement)
            if row is None and i == 1:
                conn.execute("INSERT INTO schema_version (version) VALUES (?)", (i,))
            else:
                conn.execute("UPDATE schema_version SET version = ?", (i,))
            row = {"version": i}
    return len(MIGRATIONS)
