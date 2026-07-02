"""OpenAI-compatible LLM client for CharacterOS v0.01.

If no API key is configured, the client prints the generated prompt so the
entire memory-to-prompt chain can still be inspected locally.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path


def generate_response(prompt: str) -> str:
    """Call an OpenAI-compatible chat completions API or return setup help."""

    load_dotenv()
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    api_key = os.getenv("LLM_API_KEY")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    timeout = int(os.getenv("LLM_TIMEOUT", "120"))

    if not api_key:
        return (
            "未检测到 LLM_API_KEY，已跳过大模型调用。\n\n"
            "下面是本次生成的 prompt，你可以先检查记忆检索与人物心理模拟指令是否正确：\n\n"
            f"{prompt}\n\n"
            "如需调用 OpenAI-compatible API，请配置环境变量：\n"
            "LLM_BASE_URL, LLM_API_KEY, LLM_MODEL"
        )

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "你是 CharacterOS，只模拟人物心理与抉择，不写小说剧情。",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
    }

    request = urllib.request.Request(
        url=f"{base_url}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        return f"LLM 请求失败：HTTP {error.code}\n{error_body}"
    except urllib.error.URLError as error:
        return f"LLM 请求失败：{error.reason}"
    except TimeoutError:
        return "LLM 请求超时。"

    return response_data["choices"][0]["message"]["content"]


def load_dotenv() -> None:
    """Load simple KEY=VALUE pairs from a local .env file if present."""

    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    with env_path.open("r", encoding="utf-8") as file:
        for line in file:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
