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

from models.database import db

logger = logging.getLogger(__name__)

# Cache table — stores generated summaries
class TeamAnalysisCache(db.Model):
    __tablename__ = "team_analysis_cache"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    data_hash = db.Column(db.String(32), nullable=False)  # hash of input data to detect staleness
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


def _build_prompt(team_name, analytics, league_comparison):
    """Build the GPT prompt with structured team data."""

    a = analytics
    lc = league_comparison

    prompt = f"""You are an expert fantasy AFL analyst writing a team report for "{team_name}" in a SuperCoach keeper league.

## Team Data

**Scoring:**
- Projected weekly score: {a.get('mc_p50', 0):.0f} (range {a.get('mc_p10', 0):.0f}–{a.get('mc_p90', 0):.0f})
- Season average: {a.get('season_avg', 0):.0f} per round
- Last 3 rounds form: {a.get('form_avg', 0):.0f} ({'+' if a.get('form_vs_season', 0) > 0 else ''}{a.get('form_vs_season', 0):.0f} vs season avg)
- League rank by avg SC/player: {lc.get('sc_rank', '?')}/{lc.get('total_teams', '?')}

**Roster Quality:**
- Quality score: {a.get('quality_pct', 0)}% (league rank: {lc.get('quality_rank', '?')}/{lc.get('total_teams', '?')})
- Total Value Above Average: {a.get('total_vorp', 0):.0f} (league rank: {lc.get('vorp_rank', '?')}/{lc.get('total_teams', '?')})
- Top 5 player dependency: {a.get('top5_pct', 0)}% of total scoring
- Scoring depth (std dev): {a.get('sc_std', 0)} — {'deep roster' if a.get('sc_std', 30) < 25 else 'top-heavy' if a.get('sc_std', 30) > 35 else 'moderate depth'}

**Competitive Window:**
- Current window: {a.get('window', 'Unknown')} — {a.get('window_detail', '')}
- Average age: {a.get('avg_age', 0)} (league avg: {a.get('league_avg_age', 0)})
- Projected total next year: {a.get('projected_next_year', 0):.0f} ({'+' if a.get('projected_change_pct', 0) > 0 else ''}{a.get('projected_change_pct', 0):.1f}% change)

**Positional Strength:**
"""
    for pos in ['DEF', 'MID', 'RUC', 'FWD']:
        pd = a.get('pos_breakdown', {}).get(pos, {})
        lg_avg = lc.get('pos_league_avg', {}).get(pos, 0)
        prompt += f"- {pos}: {pd.get('count', 0)} players, avg {pd.get('avg_sc', 0)} (league avg: {lg_avg:.0f})\n"

    prompt += f"""
**Reliability:**
- Consistency: {a.get('avg_consistency', 0)*100:.0f}%
- Durability: {a.get('avg_durability', 0):.0f} games/season avg
- Injury risks: {len(a.get('injury_risk', []))} flagged players

**Key Players (top 5 by value above average):**
"""
    for p in (a.get('player_vorp', []) or [])[:5]:
        prompt += f"- {p['name']} ({p['position']}): SC {p['sc']:.0f}, value +{p['vorp']:.0f} above replacement\n"

    if a.get('aging_out'):
        prompt += "\n**Biggest Projected Declines (next year):**\n"
        for p in a['aging_out'][:3]:
            prompt += f"- {p['name']}: {p['current_sc']:.0f} → {p['projected_sc']:.0f} ({p['change']:+.0f})\n"

    if a.get('aging_in'):
        prompt += "\n**Biggest Projected Gains (next year):**\n"
        for p in a['aging_in'][:3]:
            prompt += f"- {p['name']}: {p['current_sc']:.0f} → {p['projected_sc']:.0f} ({p['change']:+.0f})\n"

    if lc.get('other_teams'):
        prompt += "\n**League Context:**\n"
        for t in lc['other_teams']:
            prompt += f"- {t['name']}: avg SC {t['avg_sc']:.0f}, quality {t['quality_pct']}%, window: {t['window']}\n"

    prompt += """
## Instructions

Write a concise but insightful team analysis report (250-350 words). Structure it as:

1. **Overall Assessment** (2-3 sentences) — Where does this team sit right now? Are they contenders or pretenders?

2. **Strengths** — What's working? Which positions are strong? Any standout performers?

3. **Concerns** — What's the biggest risk? Aging players? Positional weakness? Over-reliance on a few players?

4. **Outlook** — Based on the age curves and projections, is this team getting better or worse? What's the 1-2 year trajectory?

5. **Recommendations** — 2-3 specific, actionable things the coach should do (draft targets, trade candidates, positional upgrades).

Write in a confident, analytical tone — like a sports journalist, not a robot. Use the actual player names and numbers. Don't repeat the raw data — interpret it. Be direct and opinionated.

Do NOT use markdown headers or bullet points. Write in flowing paragraphs. Keep it punchy."""

    return prompt


def generate_team_summary(team_id, team_name, year, analytics, league_comparison):
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

    prompt = _build_prompt(team_name, analytics, league_comparison)

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a fantasy AFL analyst writing team reports for a keeper league platform."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 600,
                "temperature": 0.7,
            },
            timeout=30,
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
