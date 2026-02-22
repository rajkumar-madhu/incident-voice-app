"""Test script for Santhira voice agent (OpenAI-only mode)."""

import asyncio
import os

from dotenv import load_dotenv

load_dotenv(override=True)


async def test():
    print("=== Santhira Voice Agent Test ===\n")

    api_key = os.environ.get("OPENAI_API_KEY", "")
    print(f"OPENAI_API_KEY: {'set (' + api_key[:10] + '...)' if api_key else 'MISSING'}")
    print()

    print("Testing OpenAI API...")
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        response = await client.chat.completions.create(
            model=os.environ.get("OPENAI_CHAT_MODEL", "gpt-4.1"),
            messages=[
                {"role": "system", "content": "You are Santhira, an IT support voice agent. Reply in one sentence."},
                {"role": "user", "content": "Hello, what can you help me with?"},
            ],
            max_tokens=100,
        )
        print(f"Model: {response.model}")
        print(f"Response: {response.choices[0].message.content}")
        print("\nTest PASSED!")

    except Exception as e:
        print(f"\nTest FAILED: {type(e).__name__}: {e}")


if __name__ == "__main__":
    asyncio.run(test())
