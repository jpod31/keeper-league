"""The full player page, player headshots, and the pool's detailed stats.

  GET /api/leagues/<id>/players/<pid>/dossier   everything for the player page
  GET /api/player-photo/<slug>.webp             a headshot, signed-in only
  GET /api/leagues/<id>/player-pool/detail      season averages of every stat,
                                                for the pool's detailed columns
"""

from flask import abort, jsonify, send_from_directory
from flask_login import login_required
from sqlalchemy import func

from models.database import db, League, AflPlayer, PlayerStat


def register_player_dossier_endpoints(bp):

    @bp.route("/leagues/<int:league_id>/players/<int:player_id>/dossier")
    @login_required
    def player_dossier(league_id, player_id):
        if not db.session.get(League, league_id):
            return jsonify({"error": "Not found"}), 404
        from models.player_dossier import build
        data = build(league_id, player_id)
        if data is None:
            return jsonify({"error": "Player not found"}), 404
        return jsonify(data)

    @bp.route("/player-photo/<slug>.webp")
    @login_required
    def player_photo(slug):
        from models.player_photos import PHOTO_DIR, photo_slug
        if photo_slug(slug) != slug:
            abort(404)
        resp = send_from_directory(PHOTO_DIR, f"{slug}.webp", mimetype="image/webp", max_age=86400)
        resp.headers["Cache-Control"] = "private, max-age=86400"
        return resp

    @bp.route("/leagues/<int:league_id>/player-pool/detail")
    @login_required
    def player_pool_detail(league_id):
        if not db.session.get(League, league_id):
            return jsonify({"error": "Not found"}), 404
        from models.player_dossier import STATS, STAT_KEYS
        from models.years import stats_year
        year = stats_year()
        # Average and how many games carry it: a stat held for under half his
        # games (live feeds only carry the basics) is left blank.
        cols = []
        for k in STAT_KEYS:
            cols += [func.avg(getattr(PlayerStat, k)), func.count(getattr(PlayerStat, k))]
        q = (db.session.query(PlayerStat.player_id, func.count(PlayerStat.id), *cols)
             .filter(PlayerStat.year == year, db.or_(PlayerStat.is_live == False,  # noqa: E712
                                                      PlayerStat.is_live.is_(None)))
             .group_by(PlayerStat.player_id))
        rows = {}
        for r in q.all():
            pid, games, vals = r[0], r[1], r[2:]
            d = {"games": games}
            for i, k in enumerate(STAT_KEYS):
                v, n = vals[2 * i], vals[2 * i + 1]
                d[k] = round(v, 1) if v is not None and n * 2 >= games else None
            rows[pid] = d
        extra = {}
        for p in AflPlayer.query.all():
            extra[p.id] = {
                "height_cm": p.height_cm, "career_games": p.career_games,
                "cba_pct": p.cba_pct, "kick_in_pct": p.kick_in_pct,
                "kick_in_playon_pct": p.kick_in_playon_pct,
                "draft_pick": p.draft_pick, "draft_year": p.draft_year,
                "grade": p.grade,
            }
        out = {}
        for pid, e in extra.items():
            out[str(pid)] = {**e, **rows.get(pid, {"games": 0})}
        return jsonify({
            "stats_year": year,
            "stats": [{"key": k, "label": lab} for k, lab in STATS],
            "players": out,
        })
