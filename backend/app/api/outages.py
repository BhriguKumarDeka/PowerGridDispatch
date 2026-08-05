from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db

router = APIRouter(prefix="/outages", tags=["Outages"])

class ScheduledOutageCreate(BaseModel):
    title: str
    target_id: str
    target_type: str # 'feeder' or 'dt'
    start_time: str
    end_time: str

@router.get("/scheduled")
async def list_scheduled_outages(
    from_time: Optional[str] = None,
    to_time: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Mock the department's scheduled outage feed."""
    from app.models.outage import ScheduledOutage
    
    query = select(ScheduledOutage)
    res = await db.execute(query)
    outages = res.scalars().all()
    
    return [{
        'id': o.id,
        'title': o.title,
        'target_id': o.target_id,
        'target_type': o.target_type,
        'start_time': o.start_time.isoformat() if o.start_time else None,
        'end_time': o.end_time.isoformat() if o.end_time else None,
        'status': o.status,
    } for o in outages]

@router.post("/scheduled")
async def create_scheduled_outage(
    outage: ScheduledOutageCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a scheduled outage entry."""
    from app.models.outage import ScheduledOutage
    from dateutil.parser import isoparse
    
    try:
        start_t = isoparse(outage.start_time)
        end_t = isoparse(outage.end_time)
    except:
        start_t = datetime.now()
        end_t = datetime.now()
        
    new_outage = ScheduledOutage(
        title=outage.title,
        target_id=outage.target_id,
        target_type=outage.target_type,
        start_time=start_t,
        end_time=end_t,
        status='scheduled'
    )
    
    db.add(new_outage)
    await db.commit()
    
    return {"status": "created", "id": new_outage.id}
