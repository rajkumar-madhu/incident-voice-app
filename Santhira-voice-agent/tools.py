"""Incident management tools for Santhira voice agent.

Defines tool functions and their OpenAI function-calling schemas
for Argus ITSM integration and knowledge base search.
"""

import json
import time
from typing import Any

import httpx
import structlog

from config import settings

logger = structlog.get_logger()

# JWT token — auto-refreshed every 10 minutes
_auth_token: str = ""
_token_time: float = 0.0
_TOKEN_TTL = 600  # Refresh every 10 minutes (JWT expires at 15m)


def set_auth_token(token: str) -> None:
    """Set the JWT token for ITSM API calls."""
    global _auth_token, _token_time
    _auth_token = token
    _token_time = time.monotonic()


async def _refresh_token() -> None:
    """Re-authenticate with Argus ITSM backend to get a fresh JWT."""
    global _auth_token, _token_time
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.itsm_api_url}/api/v1/auth/login",
                json={"email": "superadmin@linkedeye.local", "password": "LinkedEye@2026"},
            )
            resp.raise_for_status()
            data = resp.json()
            token = data.get("data", {}).get("accessToken", "")
            if token:
                _auth_token = token
                _token_time = time.monotonic()
                logger.info("itsm_token_refreshed")
    except Exception as e:
        logger.error("itsm_token_refresh_failed", error=str(e))


async def _ensure_token() -> None:
    """Refresh the JWT if it's older than _TOKEN_TTL seconds."""
    if not _auth_token or (time.monotonic() - _token_time) > _TOKEN_TTL:
        await _refresh_token()


def _headers() -> dict[str, str]:
    """Build auth headers for Argus API."""
    h: dict[str, str] = {"Content-Type": "application/json"}
    if _auth_token:
        h["Authorization"] = f"Bearer {_auth_token}"
    if settings.itsm_api_key:
        h["X-API-Key"] = settings.itsm_api_key
    return h


# OpenAI function-calling tool definitions
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "lookup_incident",
            "description": "Look up an incident by number (e.g. INC0004521) or search by keywords. Returns incident details including status, priority, assignee, and description.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Incident number (e.g. INC0004521) or search keywords"},
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
            "description": "Create a new incident ticket in the Argus ITSM system.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short incident description"},
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
            "description": "Escalate an existing incident to a higher priority.",
            "parameters": {
                "type": "object",
                "properties": {
                    "incident_id": {"type": "string", "description": "The incident UUID or number to escalate"},
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
            "name": "list_recent_incidents",
            "description": "List the most recent incidents, optionally filtered by state or priority.",
            "parameters": {
                "type": "object",
                "properties": {
                    "state": {"type": "string", "enum": ["NEW", "IN_PROGRESS", "ON_HOLD", "ESCALATED", "RESOLVED", "CLOSED"], "description": "Filter by incident state"},
                    "priority": {"type": "string", "enum": ["P1", "P2", "P3", "P4"], "description": "Filter by priority"},
                    "limit": {"type": "integer", "default": 5, "description": "Number of results"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_stats",
            "description": "Get overall ITSM dashboard statistics — open incidents, MTTR, SLA compliance, etc.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_alerts",
            "description": "Search active alerts from Prometheus/Grafana monitoring.",
            "parameters": {
                "type": "object",
                "properties": {
                    "severity": {"type": "string", "enum": ["CRITICAL", "WARNING", "INFO"], "description": "Filter by severity"},
                    "limit": {"type": "integer", "default": 10},
                },
                "required": [],
            },
        },
    },
]


async def lookup_incident(args: dict[str, Any]) -> str:
    """Search Argus ITSM for incidents by number or keyword."""
    await _ensure_token()
    query = args["query"]
    search_type = args.get("search_type", "keyword")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if search_type == "id":
                resp = await client.get(
                    f"{settings.itsm_api_url}/api/v1/incidents",
                    params={"search": query, "limit": 1},
                    headers=_headers(),
                )
            else:
                resp = await client.get(
                    f"{settings.itsm_api_url}/api/v1/incidents",
                    params={"search": query, "limit": 5},
                    headers=_headers(),
                )
            # Retry once on 401 (token expired)
            if resp.status_code == 401:
                await _refresh_token()
                params = {"search": query, "limit": 1 if search_type == "id" else 5}
                resp = await client.get(
                    f"{settings.itsm_api_url}/api/v1/incidents",
                    params=params, headers=_headers(),
                )
            resp.raise_for_status()
            data = resp.json()
            incidents = data.get("data", [])
            if not incidents:
                return f"No incidents found matching '{query}'."
            # Format concisely for voice
            results = []
            for inc in incidents[:5]:
                results.append(
                    f"{inc.get('number', 'N/A')} | {inc.get('priority', '?')} | "
                    f"{inc.get('state', '?')} | {inc.get('shortDescription', 'No description')}"
                )
            return "\n".join(results)
    except httpx.HTTPStatusError as e:
        logger.error("itsm_lookup_failed", status=e.response.status_code, query=query)
        return f"Failed to look up incident: HTTP {e.response.status_code}"
    except httpx.ConnectError:
        logger.error("itsm_unreachable", url=settings.itsm_api_url)
        return "ITSM service is currently unreachable."


async def create_incident(args: dict[str, Any]) -> str:
    """Create a new incident in Argus ITSM."""
    await _ensure_token()
    # Map priority string to impact/urgency for Argus
    priority_map = {
        "P1": {"impact": "HIGH", "urgency": "CRITICAL"},
        "P2": {"impact": "HIGH", "urgency": "HIGH"},
        "P3": {"impact": "MEDIUM", "urgency": "MEDIUM"},
        "P4": {"impact": "LOW", "urgency": "LOW"},
    }
    prio = args.get("priority", "P3")
    iu = priority_map.get(prio, priority_map["P3"])

    payload = {
        "shortDescription": args["title"],
        "description": args["description"],
        "impact": iu["impact"],
        "urgency": iu["urgency"],
        "category": args.get("category", "general"),
        "source": "VOICE",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.itsm_api_url}/api/v1/incidents",
                json=payload,
                headers=_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            inc = data.get("data", data)
            return f"Incident {inc.get('number', 'created')} created successfully with priority {prio}."
    except httpx.HTTPError as e:
        logger.error("incident_creation_failed", error=str(e))
        return f"Failed to create incident: {e}"


async def escalate_incident(args: dict[str, Any]) -> str:
    """Escalate an incident's priority in Argus."""
    await _ensure_token()
    inc_id = args["incident_id"]
    new_prio = args["new_priority"]
    reason = args["reason"]

    priority_map = {
        "P1": {"impact": "HIGH", "urgency": "CRITICAL"},
        "P2": {"impact": "HIGH", "urgency": "HIGH"},
        "P3": {"impact": "MEDIUM", "urgency": "MEDIUM"},
        "P4": {"impact": "LOW", "urgency": "LOW"},
    }
    iu = priority_map.get(new_prio, priority_map["P2"])

    payload = {
        "impact": iu["impact"],
        "urgency": iu["urgency"],
        "state": "IN_PROGRESS",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.put(
                f"{settings.itsm_api_url}/api/v1/incidents/{inc_id}",
                json=payload,
                headers=_headers(),
            )
            resp.raise_for_status()
            return f"Incident {inc_id} escalated to {new_prio}. Reason: {reason}"
    except httpx.HTTPError as e:
        logger.error("escalation_failed", incident_id=inc_id, error=str(e))
        return f"Failed to escalate incident: {e}"


async def list_recent_incidents(args: dict[str, Any]) -> str:
    """List recent incidents from Argus."""
    await _ensure_token()
    params: dict[str, Any] = {"limit": args.get("limit", 5)}
    if args.get("state"):
        params["state"] = args["state"]
    if args.get("priority"):
        params["priority"] = args["priority"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.itsm_api_url}/api/v1/incidents",
                params=params,
                headers=_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            incidents = data.get("data", [])
            if not incidents:
                return "No incidents found matching your criteria."
            results = []
            for inc in incidents:
                results.append(
                    f"{inc.get('number')} | {inc.get('priority')} | "
                    f"{inc.get('state')} | {inc.get('shortDescription', 'No description')}"
                )
            return "\n".join(results)
    except httpx.HTTPError as e:
        return f"Failed to list incidents: {e}"


async def get_dashboard_stats(args: dict[str, Any]) -> str:
    """Get Argus dashboard stats."""
    await _ensure_token()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.itsm_api_url}/api/v1/dashboard/stats",
                headers=_headers(),
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})
            return json.dumps(data, indent=2)
    except httpx.HTTPError as e:
        return f"Failed to get dashboard stats: {e}"


async def search_alerts(args: dict[str, Any]) -> str:
    """Search active alerts in Argus."""
    await _ensure_token()
    params: dict[str, Any] = {"limit": args.get("limit", 10)}
    if args.get("severity"):
        params["severity"] = args["severity"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.itsm_api_url}/api/v1/alerts",
                params=params,
                headers=_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            alerts = data.get("data", [])
            if not alerts:
                return "No active alerts found."
            results = []
            for a in alerts[:10]:
                results.append(
                    f"{a.get('severity', '?')} | {a.get('alertName', 'Unknown')} | "
                    f"{a.get('state', '?')} | {a.get('description', '')[:80]}"
                )
            return "\n".join(results)
    except httpx.HTTPError as e:
        return f"Failed to search alerts: {e}"


# Map function names to handlers
TOOL_HANDLERS: dict[str, Any] = {
    "lookup_incident": lookup_incident,
    "create_incident": create_incident,
    "escalate_incident": escalate_incident,
    "list_recent_incidents": list_recent_incidents,
    "get_dashboard_stats": get_dashboard_stats,
    "search_alerts": search_alerts,
}
