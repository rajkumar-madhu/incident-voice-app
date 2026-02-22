"""Santhira Voice Agent - Incident management customer support agent.

OpenAI-powered voice agent using GPT with function calling for
incident management, runbook search, and general conversation.
"""

import asyncio
import json
import sys
import time

import structlog
from dotenv import load_dotenv
from openai import AsyncOpenAI

from config import settings
from tools import TOOL_DEFINITIONS, TOOL_HANDLERS

load_dotenv(override=True)

logger = structlog.get_logger()

SYSTEM_PROMPT = """\
You are Santhira, an AI voice agent for LinkedEye's incident management platform.
You help IT support teams manage incidents through voice interactions.

Your capabilities:
- Look up existing incidents by ID or keyword search
- Create new incident tickets with proper categorization and priority
- Escalate incidents to higher priority levels
- Search runbooks and SOPs for troubleshooting steps
- Retrieve incident history and activity timelines
- Handle general conversation and IT support questions

Conversation guidelines:
- Be concise and clear — responses will be converted to speech via TTS.
- Keep responses under 3 sentences when possible.
- Always confirm critical actions (creating/escalating incidents) before executing.
- When searching runbooks, summarize the key steps rather than reading verbatim.
- Use incident IDs (e.g., INC-1234) when referencing specific incidents.
- If the caller describes a new issue, gather: affected service, impact, and urgency
  before creating a ticket.
- For P1/P2 incidents, proactively suggest escalation if not already escalated.
- For general questions, respond conversationally and helpfully.

Priority definitions:
- P1: Critical — service down, widespread impact
- P2: High — major feature impaired, workaround difficult
- P3: Medium — feature impaired, workaround available
- P4: Low — minor issue, no impact on service
"""

MAX_TOOL_ROUNDS = 5


async def run_agent_loop(
    client: AsyncOpenAI,
    messages: list[dict],
) -> str:
    """Run the GPT agent loop with function calling until a final response."""
    for _ in range(MAX_TOOL_ROUNDS):
        start = time.monotonic()

        response = await client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            max_tokens=500,
            temperature=0.7,
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        choice = response.choices[0]
        message = choice.message

        logger.info(
            "llm_response",
            model=settings.openai_chat_model,
            finish_reason=choice.finish_reason,
            latency_ms=latency_ms,
        )

        # If no tool calls, return the text response
        if not message.tool_calls:
            return message.content or ""

        # Append assistant message with tool calls
        messages.append(message.model_dump())

        # Execute each tool call
        for tool_call in message.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            logger.info("tool_invoked", tool=fn_name, input=fn_args)

            handler = TOOL_HANDLERS.get(fn_name)
            if handler:
                result = await handler(fn_args)
            else:
                result = f"Unknown tool: {fn_name}"

            # Append tool result
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

    return "I've reached the maximum number of steps. Please try again with a simpler request."


async def run_single_query(client: AsyncOpenAI, prompt: str) -> None:
    """Run a single query."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    response = await run_agent_loop(client, messages)
    print(response)


async def run_interactive(client: AsyncOpenAI) -> None:
    """Run an interactive conversation session."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    print("Santhira Voice Agent ready. Type 'exit' to quit.\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "bye"):
            print("Santhira: Goodbye!")
            break

        messages.append({"role": "user", "content": user_input})

        response = await run_agent_loop(client, messages)
        messages.append({"role": "assistant", "content": response})

        print(f"Santhira: {response}")


async def main() -> None:
    """Entry point."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
        await run_single_query(client, prompt)
    else:
        await run_interactive(client)


if __name__ == "__main__":
    asyncio.run(main())
