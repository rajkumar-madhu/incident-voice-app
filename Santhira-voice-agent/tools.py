"""Incident management tools for Santhira voice agent.

Defines tool functions and their OpenAI function-calling schemas
for ITSM integration and RAG-based runbook search.
"""

import json
from typing import Any

import httpx
import structlog

from config import settings

logger = structlog.get_logger()

# OpenAI function-calling tool definitions
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "lookup_incident",
            "description": "Look up an incident by ID or search by keywords. Returns incident details including status, priority, assignee, and timeline.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Incident ID (e.g. INC-1234) or search keywords"},
                    "search_type": {"type": "string", "enum": ["id", "keyword"], "default": "keyword"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_incident",
            "description": "Create a new incident ticket in the ITSM system.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short incident title"},
                    "description": {"type": "string", "description": "Detailed description of the issue"},
                    "priority": {"type": "string", "enum": ["P1", "P2", "P3", "P4"], "default": "P3"},
                    "category": {"type": "string", "description": "Incident category (e.g. network, database, application)"},
                },
                "required": ["title", "description"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_incident",
            "description": "Escalate an existing incident to a higher priority or different team.",
            "parameters": {
                "type": "object",
                "properties": {
                    "incident_id": {"type": "string", "description": "The incident ID to escalate"},
                    "new_priority": {"type": "string", "enum": ["P1", "P2", "P3", "P4"]},
                    "reason": {"type": "string", "description": "Reason for escalation"},
                },
                "required": ["incident_id", "new_priority", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_runbooks",
            "description": "Search runbooks and SOPs via RAG for troubleshooting steps related to an incident.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query describing the issue"},
                    "top_k": {"type": "integer", "default": 5, "description": "Number of results to return"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_incident_history",
            "description": "Get the timeline and activity history for a specific incident.",
            "parameters": {
                "type": "object",
                "properties": {
                    "incident_id": {"type": "string", "description": "The incident ID"},
                },
                "required": ["incident_id"],
            },
        },
    },
]


async def lookup_incident(args: dict[str, Any]) -> str:
    """Search ITSM for incidents by ID or keyword."""
    query = args["query"]
    search_type = args.get("search_type", "keyword")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if search_type == "id":
                resp = await client.get(
                    f"{settings.itsm_api_url}/api/incidents/{query}",
                    headers={
                        "X-API-Key": settings.itsm_api_key,
                        "X-Tenant-ID": settings.default_tenant_id,
                    },
                )
            else:
                resp = await client.get(
                    f"{settings.itsm_api_url}/api/incidents",
                    params={"q": query, "limit": 5},
                    headers={
                        "X-API-Key": settings.itsm_api_key,
                        "X-Tenant-ID": settings.default_tenant_id,
                    },
                )
            resp.raise_for_status()
            return json.dumps(resp.json(), indent=2)
    except httpx.HTTPStatusError as e:
        logger.error("itsm_lookup_failed", status=e.response.status_code, query=query)
        return f"Failed to look up incident: HTTP {e.response.status_code}"
    except httpx.ConnectError:
        logger.error("itsm_unreachable", url=settings.itsm_api_url)
        return "ITSM service is currently unreachable."


async def create_incident(args: dict[str, Any]) -> str:
    """Create a new incident in the ITSM system."""
    payload = {
        "title": args["title"],
        "description": args["description"],
        "priority": args.get("priority", "P3"),
        "category": args.get("category", "general"),
        "source": "voice-agent",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.itsm_api_url}/api/incidents",
                json=payload,
                headers={
                    "X-API-Key": settings.itsm_api_key,
                    "X-Tenant-ID": settings.default_tenant_id,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return f"Incident {data.get('id', 'unknown')} created successfully.\n{json.dumps(data, indent=2)}"
    except httpx.HTTPError as e:
        logger.error("incident_creation_failed", error=str(e))
        return f"Failed to create incident: {e}"


async def escalate_incident(args: dict[str, Any]) -> str:
    """Escalate an incident's priority."""
    payload = {
        "priority": args["new_priority"],
        "escalation_reason": args["reason"],
        "escalated_by": "voice-agent",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                f"{settings.itsm_api_url}/api/incidents/{args['incident_id']}/escalate",
                json=payload,
                headers={
                    "X-API-Key": settings.itsm_api_key,
                    "X-Tenant-ID": settings.default_tenant_id,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return f"Incident {args['incident_id']} escalated to {args['new_priority']}.\n{json.dumps(data, indent=2)}"
    except httpx.HTTPError as e:
        logger.error("escalation_failed", incident_id=args["incident_id"], error=str(e))
        return f"Failed to escalate incident: {e}"


async def search_runbooks(args: dict[str, Any]) -> str:
    """Query the RAG service for relevant runbooks and SOPs."""
    query = args["query"]
    top_k = args.get("top_k", 5)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.rag_service_url}/api/v1/search",
                json={"query": query, "top_k": top_k, "min_similarity": 0.75},
                headers={"X-Tenant-ID": settings.default_tenant_id},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        logger.error("rag_search_failed", error=str(e))
        return f"Failed to search runbooks: {e}"

    results = data.get("results", [])
    if not results:
        return "No relevant runbooks found for this query."

    formatted = []
    for r in results:
        source = r.get("source", "Unknown")
        score = r.get("similarity", 0)
        text = r.get("text", "")
        formatted.append(f"[{source}] (score: {score:.2f})\n{text}")

    return "\n\n---\n\n".join(formatted)


async def get_incident_history(args: dict[str, Any]) -> str:
    """Retrieve the activity timeline for an incident."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.itsm_api_url}/api/incidents/{args['incident_id']}/history",
                headers={
                    "X-API-Key": settings.itsm_api_key,
                    "X-Tenant-ID": settings.default_tenant_id,
                },
            )
            resp.raise_for_status()
            return json.dumps(resp.json(), indent=2)
    except httpx.HTTPError as e:
        logger.error("history_fetch_failed", incident_id=args["incident_id"], error=str(e))
        return f"Failed to fetch history: {e}"


# Map function names to handlers
TOOL_HANDLERS: dict[str, Any] = {
    "lookup_incident": lookup_incident,
    "create_incident": create_incident,
    "escalate_incident": escalate_incident,
    "search_runbooks": search_runbooks,
    "get_incident_history": get_incident_history,
}
