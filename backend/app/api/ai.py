from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import httpx
import logging
from app.database import get_db
from app.config import settings
from app.models.ticket import FaultIncident

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI"])

class SummaryRequest(BaseModel):
    ticket_id: int

@router.post("/summarize-ticket")
async def summarize_ticket(
    req: SummaryRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate concise operator brief using Groq API (minimal tokens). Caches result in DB."""
    result = await db.execute(
        select(FaultIncident).where(FaultIncident.id == req.ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # 1. Zero-Token Cache: return existing summary if already generated
    if ticket.ai_summary:
        return {
            "ticket_id": ticket.id,
            "ai_summary": ticket.ai_summary,
            "source": "cache"
        }

    ai_summary = None
    source = "template_engine"

    # Ultra-concise prompt (~45 tokens) to minimize Groq token limits
    system_prompt = "You are a power grid control room dispatcher. Give a 1-sentence action brief."
    user_prompt = (
        f"{ticket.fault_type.upper()} fault #{ticket.id} on Feeder {ticket.feeder_id} (DT {ticket.dt_id}). "
        f"{ticket.affected_pole_count} dark poles near PIN {ticket.pincode or '560078'}. "
        f"GPS ({round(ticket.fault_location_lat, 4)}, {round(ticket.fault_location_lon, 4)}). "
        f"Confidence {int(ticket.confidence * 100)}% ({ticket.topology_source})."
    )

    # 2. Call Groq API (High Speed, Free Tier Token-Optimized)
    if settings.GROQ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": settings.GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "max_tokens": 75,
                        "temperature": 0.2,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    ai_summary = data["choices"][0]["message"]["content"].strip()
                    source = "groq"
                else:
                    logger.warning(f"Groq API returned HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Groq API call failed: {e}")

    # 3. Fallback to OpenAI API if Groq fails or unconfigured
    if not ai_summary and settings.OPENAI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "max_tokens": 75,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    ai_summary = data["choices"][0]["message"]["content"].strip()
                    source = "openai"
        except Exception as e:
            logger.warning(f"OpenAI API call failed: {e}")

    # 4. Fallback to Deterministic Template Engine (Zero Cost, Instant)
    if not ai_summary:
        ai_summary = (
            f"⚡ Dispatch crew to ({round(ticket.fault_location_lat, 4)}° N, {round(ticket.fault_location_lon, 4)}° E) "
            f"for {ticket.fault_type.upper()} fault on Feeder {ticket.feeder_id}. "
            f"{ticket.affected_pole_count} poles dark near PIN {ticket.pincode or '560078'} ({int(ticket.confidence * 100)}% confidence)."
        )

    # Save to database to ensure zero repeat token cost
    ticket.ai_summary = ai_summary
    await db.commit()

    return {
        "ticket_id": ticket.id,
        "ai_summary": ai_summary,
        "source": source
    }
