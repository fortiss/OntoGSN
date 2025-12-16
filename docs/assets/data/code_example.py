import sqlite3
from typing import Any

ALLOWED_CHARS = set("abcdefghijklmnopqrstuvwxyz"
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                    "0123456789_@.- ")

def sanitize_input(value: str) -> str:
    return "".join(ch for ch in value if ch in ALLOWED_CHARS)


def insert_user(conn: sqlite3.Connection, username: str, email: str) -> None:
    safe_username = sanitize_input(username)
    safe_email = sanitize_input(email)

    with conn:
        conn.execute(
            "INSERT INTO users (username, email) VALUES (?, ?)",
            (safe_username, safe_email),
        )
