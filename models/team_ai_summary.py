"""AI-powered team analysis summaries using GPT.

Generates natural language team reports from deep analytics data.
Results are cached in the database to avoid repeated API calls.
"""

import os
import json
import logging
import hashlib
from datetime import datetime, timezone

import requests

from models.database import db, FantasyTeam

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════════════════════════
# GENERIC ANALYTICS CACHE — stores any computed analytics as JSON
# ════════════════════════════════════════════════════════════════════

# In-memory cache: {(team_id, year, cache_type): {"data": ..., "ts": float}}
_mem_cache = {}
_CACHE_TTL = 7 * 24 * 3600  # 1 week


def get_cached_analytics(team_id, year, cache_type):
    """Retrieve cached analytics. Checks memory first, then DB."""
    import time
    key = (team_id, year, cache_type)
    # Memory cache (fast path)
    entry = _mem_cache.get(key)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    # DB cache (survives restarts).
    # SQLite + SQLAlchemy DateTime (no timezone=True) returns naive
    # datetimes on read. The previous version compared an aware
    # datetime.now(timezone.utc) against this naive value, raising
    # TypeError which the bare except swallowed — leaving the cache
    # permanently broken. Coerce naive → aware before subtracting.
    try:
        row = AnalyticsJsonCache.query.filter_by(
            team_id=team_id, year=year, cache_type=cache_type
        ).first()
        if row and row.data and row.generated_at:
            ga = row.generated_at
            if ga.tzinfo is None:
                ga = ga.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - ga).total_seconds()
            if age < _CACHE_TTL:
                data = json.loads(row.data)
                _mem_cache[key] = {"data": data, "ts": time.time()}
                return data
    except Exception:
        logger.warning("Analytics cache read failed (team=%s year=%s type=%s)",
                       team_id, year, cache_type, exc_info=True)
    return None


def cache_analytics(team_id, year, cache_type, data):
    """Store analytics in memory + DB cache."""
    import time
    _mem_cache[(team_id, year, cache_type)] = {"data": data, "ts": time.time()}
    # Persist to DB so it survives restarts
    try:
        row = AnalyticsJsonCache.query.filter_by(
            team_id=team_id, year=year, cache_type=cache_type
        ).first()
        serialized = json.dumps(data, default=str)
        if row:
            row.data = serialized
            row.generated_at = datetime.now(timezone.utc)
        else:
            row = AnalyticsJsonCache(
                team_id=team_id, year=year, cache_type=cache_type,
                data=serialized
            )
            db.session.add(row)
        db.session.commit()
    except Exception:
        db.session.rollback()


def invalidate_analytics_cache(team_id=None, year=None):
    """Clear analytics cache (memory + DB). If team_id given, clear just that team."""
    if team_id is not None and year:
        # Clear all cache types for this team
        keys_to_pop = [k for k in _mem_cache if k[0] == team_id and k[1] == year]
        for k in keys_to_pop:
            _mem_cache.pop(k, None)
        try:
            AnalyticsJsonCache.query.filter_by(team_id=team_id, year=year).delete()
            db.session.commit()
        except Exception:
            db.session.rollback()
    else:
        _mem_cache.clear()
        try:
            AnalyticsJsonCache.query.delete()
            db.session.commit()
        except Exception:
            db.session.rollback()


# Generic JSON analytics cache (persistent across restarts)
class AnalyticsJsonCache(db.Model):
    __tablename__ = "analytics_json_cache"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    cache_type = db.Column(db.String(40), nullable=False)
    data = db.Column(db.Text)
    generated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("team_id", "year", "cache_type", name="uq_ajc_team_year_type"),
    )


# Cache table — stores generated AI summaries (persistent across restarts)
class TeamAnalysisCache(db.Model):
    __tablename__ = "team_analysis_cache"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    data_hash = db.Column(db.String(32), nullable=False)
    summary = db.Column(db.Text)
    generated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("team_id", "year", name="uq_ta_cache_team_year"),
    )


def _hash_analytics(analytics):
    """Create a short hash of the analytics dict to detect when data has changed."""
    # Use key metrics that change each round
    key_data = json.dumps({
        "total_sc": analytics.get("total_sc"),
        "form_avg": analytics.get("form_avg"),
        "mc_p50": analytics.get("mc_p50"),
        "total_vorp": analytics.get("total_vorp"),
        "quality_pct": analytics.get("quality_pct"),
        "round_count": len(analytics.get("round_data", [])),
    }, sort_keys=True)
    return hashlib.md5(key_data.encode()).hexdigest()[:16]


def _build_prompt(team_name, analytics, league_comparison, narrative=None,
                  comparative_insights=None):
    """Build insight-driven GPT prompt.

    Instead of dumping raw stats, we feed pre-computed comparative insights
    that are mathematically proven. GPT's job is to articulate them well,
    not to derive analysis from numbers.
    """
    a = analytics
    n = narrative or {}
    ci = comparative_insights or {}

    prompt = f"""You are an elite fantasy AFL keeper league analyst writing a deep-dive report for "{team_name}".

TEAM TRAJECTORY: {n.get('trajectory', 'unknown')}. {n.get('verdict', '')}
WINDOW: {a.get('window', 'Unknown')} — {a.get('window_detail', '')}

## MATHEMATICALLY COMPUTED INSIGHTS
The following facts have been computed from league-wide data analysis. Use them as the backbone of your report — cite specific players, positions, and numbers. Do NOT just list them back — weave them into analytical narrative.

"""
    for category, label in [
        ("positional_dominance", "POSITIONAL DOMINANCE"),
        ("scoring_comparison", "SCORING POWER"),
        ("win_window", "CHAMPIONSHIP WINDOW"),
        ("depth_longevity", "DEPTH & LONGEVITY"),
        ("vulnerabilities", "RISKS & VULNERABILITIES"),
        ("actionable", "ACTIONABLE MOVES"),
    ]:
        items = ci.get(category, [])
        if items:
            prompt += f"**{label}:**\n"
            for item in items:
                prompt += f"- {item}\n"
            prompt += "\n"

    # Add key players for reference
    prompt += "**KEY PLAYERS (top 5 by value above replacement):**\n"
    for p in (a.get('player_vorp', []) or [])[:5]:
        prompt += f"- {p['name']} ({p['position']}): SC {p['sc']:.0f}, VORP +{p['vorp']:.0f}\n"

    if a.get('aging_out'):
        prompt += "\n**DECLINING ASSETS (next year):**\n"
        for p in a['aging_out'][:3]:
            prompt += f"- {p['name']}: {p['current_sc']:.0f} → {p['projected_sc']:.0f} ({p['change']:+.0f})\n"

    if a.get('aging_in'):
        prompt += "\n**RISING ASSETS (next year):**\n"
        for p in a['aging_in'][:3]:
            prompt += f"- {p['name']}: {p['current_sc']:.0f} → {p['projected_sc']:.0f} ({p['change']:+.0f})\n"

    prompt += """
## INSTRUCTIONS

Write a 400-500 word analytical report. This is NOT a stat summary — it's a strategic assessment. Think like a GM evaluating a franchise, not a journalist recapping a game.

For each section, LEAD with the comparative insight (e.g. "You own 4 of the top 5 defenders"), THEN explain what that means strategically. Connect insights to each other — e.g. if positional dominance + age cliff exist at the same position, that's the story.

REQUIRED SECTIONS (separated by "---" on its own line):

THE VERDICT: 2-3 sentences. Are they a dynasty, contender, pretender, or rebuilding? How do they compare to the field RIGHT NOW and going forward? Be direct and opinionated.
---
THE EDGE: What gives this team its competitive advantage? Which positions dominate? How sustainable is it? Name the players that make the difference and WHY they matter to the structure.
---
THE CRACKS: What breaks first? Age cliffs, single-player dependency, positional weakness — identify the structural risk, not just "Player X is old". Explain what happens when the risk materialises (e.g. "losing X drops you from 1st to 4th").
---
THE TRAJECTORY: Where is this team in 2 years? 4 years? Use the dynasty projections and crossover data. Be specific about WHEN windows open and close. Name the teams that will overtake or be overtaken.
---
THE PLAYBOOK: 3 specific, high-impact moves. Not generic advice — use the computed trade targets, free agents, and gap analysis. Each recommendation should reference the insight that justifies it.

TONE: Confident, analytical, direct. Like a front-office memo, not a blog post. Use player names throughout. No bullet points — flowing paragraphs. Each section 3-5 sentences."""

    return prompt


def generate_team_summary(team_id, team_name, year, analytics, league_comparison,
                          narrative=None, comparative_insights=None):
    """Generate or retrieve cached AI summary for a team.

    Returns: str (the summary text) or None on failure.
    """
    # Ensure table exists
    try:
        db.create_all()
    except Exception:
        pass

    data_hash = _hash_analytics(analytics)

    # Check cache
    cached = TeamAnalysisCache.query.filter_by(team_id=team_id, year=year).first()
    if cached and cached.data_hash == data_hash:
        return cached.summary

    # Generate new summary
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — cannot generate team summary")
        return None

    prompt = _build_prompt(team_name, analytics, league_comparison, narrative,
                           comparative_insights)

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": "You are an elite fantasy AFL keeper league analyst. You write like a front-office executive — direct, analytical, opinionated. You never summarise raw stats; you interpret what they mean strategically."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 1200,
                "temperature": 0.7,
            },
            timeout=45,
        )
        resp.raise_for_status()
        data = resp.json()
        summary = data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.exception("GPT summary generation failed for team %d", team_id)
        return None

    # Cache result
    if cached:
        cached.summary = summary
        cached.data_hash = data_hash
        cached.generated_at = datetime.now(timezone.utc)
    else:
        cached = TeamAnalysisCache(
            team_id=team_id, year=year,
            data_hash=data_hash, summary=summary,
        )
        db.session.add(cached)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

    return summary


def compute_league_comparison(league_id, year, all_team_analytics):
    """Compute league-wide rankings for comparison context.

    Args:
        all_team_analytics: dict of {team_id: analytics_dict}

    Returns: dict with ranks and comparison data per team
    """
    teams = []
    for tid, a in all_team_analytics.items():
        t = db.session.get(FantasyTeam, tid)
        if not t or not a:
            continue
        teams.append({
            "team_id": tid,
            "name": t.name,
            "avg_sc": a.get("avg_sc", 0),
            "quality_pct": a.get("quality_pct", 0),
            "total_vorp": a.get("total_vorp", 0),
            "window": a.get("window", "Unknown"),
            "avg_age": a.get("avg_age", 0),
            "mc_p50": a.get("mc_p50", 0),
            "form_avg": a.get("form_avg", 0),
            "pos_breakdown": a.get("pos_breakdown", {}),
        })

    n = len(teams)
    if n == 0:
        return {}

    # Rank by various metrics
    by_sc = sorted(teams, key=lambda t: t["avg_sc"], reverse=True)
    by_quality = sorted(teams, key=lambda t: t["quality_pct"], reverse=True)
    by_vorp = sorted(teams, key=lambda t: t["total_vorp"], reverse=True)
    by_form = sorted(teams, key=lambda t: t["form_avg"], reverse=True)

    # Positional league averages
    pos_league_avg = {}
    for pos in ["DEF", "MID", "RUC", "FWD"]:
        avgs = [t["pos_breakdown"].get(pos, {}).get("avg_sc", 0) for t in teams]
        pos_league_avg[pos] = round(sum(avgs) / max(len(avgs), 1), 1)

    comparisons = {}
    for t in teams:
        tid = t["team_id"]
        comparisons[tid] = {
            "total_teams": n,
            "sc_rank": next(i+1 for i, x in enumerate(by_sc) if x["team_id"] == tid),
            "quality_rank": next(i+1 for i, x in enumerate(by_quality) if x["team_id"] == tid),
            "vorp_rank": next(i+1 for i, x in enumerate(by_vorp) if x["team_id"] == tid),
            "form_rank": next(i+1 for i, x in enumerate(by_form) if x["team_id"] == tid),
            "pos_league_avg": pos_league_avg,
            "other_teams": [x for x in teams if x["team_id"] != tid],
        }

    return comparisons
