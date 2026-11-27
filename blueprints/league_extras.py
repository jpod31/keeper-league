"""2027 additions, registered onto the spa_api blueprint (all under /api):

  player notes      /players/<id>/notes, /players/notes/<id>
  notes panel       /leagues/<id>/notes, /leagues/<id>/notes/general[/<id>]
  player search     /players/search?q=
  honours           /leagues/<id>/honours/board, /leagues/<id>/honours/summary
  record book       /leagues/<id>/record-book
  former players    /leagues/<id>/former-players
  trade block       /leagues/<id>/trade-block[/<entry>]
  past seasons      /leagues/<id>/seasons[/<year>]
"""

import logging
from collections import defaultdict
from datetime import timezone

from flask import jsonify, request
from flask_login import login_required, current_user

import config
from blueprints import check_league_access
from models.database import (
    db, League, FantasyTeam, FantasyRoster, AflPlayer, PlayerStat,
    PlayerNote, GeneralNote, TradeBlockEntry, SeasonStanding, Fixture, Trade, TradeAsset,
    DraftSession, DraftPick, DelistAction, DelistPeriod, User,
)

from models.player_photos import photo_url

logger = logging.getLogger(__name__)

NOTE_MAX = 2000
BLOCK_NOTE_MAX = 240

# What a club wants back for a player on the block. key -> label.
SEEKING = [
    ("any", "Open to offers"),
    ("picks", "Draft picks"),
    ("def", "A defender"),
    ("mid", "A midfielder"),
    ("ruc", "A ruck"),
    ("fwd", "A forward"),
    ("youth", "Youth"),
    ("now", "Ready-made scorer"),
]
_SEEKING_KEYS = {k for k, _ in SEEKING}


def _utc_iso(dt):
    """Stored UTC, read back naive: say so, or the browser shows it in the
    wrong zone."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _note_json(n):
    return {"id": n.id, "player_id": n.player_id, "body": n.body, "created_at": _utc_iso(n.created_at)}


def _player_card(p, extra=None):
    out = {
        "id": p.id, "name": p.name, "position": p.position or "",
        "position_expected": bool(p.position_expected),
        "afl_team": p.afl_team or "", "age": p.age,
        "rating": p.rating, "potential": p.potential,
        "sc_avg": p.sc_avg, "games_played": p.games_played or 0,
        "is_former": p.is_former,
    }
    if extra:
        out.update(extra)
    return out


def register_league_extras(spa_api):

    # ── Player notes ─────────────────────────────────────────────────
    # Private to the manager who wrote them, and about the player rather
    # than a league, so they follow you into every league you are in.

    @spa_api.route("/players/<int:player_id>/notes", methods=["GET", "POST"])
    @login_required
    def player_notes(player_id):
        player = db.session.get(AflPlayer, player_id)
        if not player:
            return jsonify({"error": "Player not found"}), 404

        if request.method == "POST":
            body = ((request.get_json(silent=True) or {}).get("body") or "").strip()
            if not body:
                return jsonify({"error": "A note needs some text."}), 400
            if len(body) > NOTE_MAX:
                return jsonify({"error": f"Keep a note under {NOTE_MAX} characters."}), 400
            note = PlayerNote(user_id=current_user.id, player_id=player_id, body=body)
            db.session.add(note)
            db.session.commit()
            return jsonify({"note": _note_json(note)}), 201

        notes = (PlayerNote.query.filter_by(user_id=current_user.id, player_id=player_id)
                 .order_by(PlayerNote.created_at.desc(), PlayerNote.id.desc()).all())
        return jsonify({
            "player": {"id": player.id, "name": player.name},
            "notes": [_note_json(n) for n in notes],
        })

    @spa_api.route("/players/notes/<int:note_id>", methods=["DELETE"])
    @login_required
    def player_note_delete(note_id):
        note = db.session.get(PlayerNote, note_id)
        if not note or note.user_id != current_user.id:
            return jsonify({"error": "Note not found"}), 404
        db.session.delete(note)
        db.session.commit()
        return jsonify({"ok": True})

    @spa_api.route("/players/notes")
    @login_required
    def player_notes_all():
        """Every note this manager has written, newest first, with the player."""
        notes = (PlayerNote.query.filter_by(user_id=current_user.id)
                 .order_by(PlayerNote.created_at.desc(), PlayerNote.id.desc()).all())
        return jsonify({"notes": [{
            **_note_json(n),
            "player_name": n.player.name if n.player else "?",
            "afl_team": n.player.afl_team if n.player else "",
            "position": n.player.position if n.player else "",
        } for n in notes]})

    # ── Notes panel on My Team (2026-11-27) ──────────────────────────
    # General notes are per league; player notes are the same notes the
    # player card writes, grouped into your squad and everyone else.

    @spa_api.route("/leagues/<int:league_id>/notes", methods=["GET"])
    @login_required
    def league_notes(league_id):
        league, user_team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Not a league member"}), 403
        general = (GeneralNote.query.filter_by(user_id=current_user.id, league_id=league_id)
                   .order_by(GeneralNote.created_at.desc(), GeneralNote.id.desc()).all())
        squad = []
        mine = set()
        if user_team:
            rows = (FantasyRoster.query.filter_by(team_id=user_team.id, is_active=True).all())
            for fr in rows:
                if fr.player and fr.player_id not in mine:
                    mine.add(fr.player_id)
                    squad.append(_player_card(fr.player, {"photo_url": photo_url(fr.player.name)}))
            squad.sort(key=lambda x: x["name"].split(" ")[-1])
        by_player = defaultdict(list)
        for n in (PlayerNote.query.filter_by(user_id=current_user.id)
                  .order_by(PlayerNote.created_at.desc(), PlayerNote.id.desc()).all()):
            by_player[n.player_id].append(n)
        players = []
        for pid, notes in by_player.items():
            p = notes[0].player
            if not p:
                continue
            players.append({"player": _player_card(p, {"photo_url": photo_url(p.name)}), "mine": pid in mine,
                            "latest": _utc_iso(notes[0].created_at),
                            "notes": [_note_json(n) for n in notes]})
        # newest first, your own squad ahead of everyone else
        players.sort(key=lambda x: x["latest"] or "", reverse=True)
        players.sort(key=lambda x: not x["mine"])
        return jsonify({
            "general": [{"id": g.id, "body": g.body, "created_at": _utc_iso(g.created_at)} for g in general],
            "players": players,
            "squad": squad,
        })

    @spa_api.route("/leagues/<int:league_id>/notes/general", methods=["POST"])
    @login_required
    def league_note_add(league_id):
        league, _team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Not a league member"}), 403
        body = ((request.get_json(silent=True) or {}).get("body") or "").strip()
        if not body:
            return jsonify({"error": "A note needs some text."}), 400
        if len(body) > NOTE_MAX:
            return jsonify({"error": f"Keep a note under {NOTE_MAX} characters."}), 400
        g = GeneralNote(user_id=current_user.id, league_id=league_id, body=body)
        db.session.add(g)
        db.session.commit()
        return jsonify({"note": {"id": g.id, "body": g.body, "created_at": _utc_iso(g.created_at)}}), 201

    @spa_api.route("/leagues/<int:league_id>/notes/general/<int:note_id>", methods=["DELETE"])
    @login_required
    def league_note_delete(league_id, note_id):
        g = db.session.get(GeneralNote, note_id)
        if not g or g.user_id != current_user.id or g.league_id != league_id:
            return jsonify({"error": "Note not found"}), 404
        db.session.delete(g)
        db.session.commit()
        return jsonify({"ok": True})

    @spa_api.route("/players/search")
    @login_required
    def player_search():
        """Any player by name, listed ones first: for a note on someone not on
        your list."""
        q = (request.args.get("q") or "").strip()
        if len(q) < 2:
            return jsonify({"players": []})
        like = f"%{q}%"
        rows = (AflPlayer.query.filter(AflPlayer.name.ilike(like))
                .order_by(AflPlayer.list_status.desc(), AflPlayer.name).limit(40).all())
        ql = q.lower()
        rows.sort(key=lambda p: (p.is_former, not p.name.lower().startswith(ql)
                                 and not p.name.lower().split(" ")[-1].startswith(ql), p.name))
        return jsonify({"players": [_player_card(p, {"photo_url": photo_url(p.name)}) for p in rows[:15]]})

    # ── Honours v3 (models/player_honours.py) ────────────────────────

    @spa_api.route("/leagues/<int:league_id>/honours/board")
    @login_required
    def honours_board(league_id):
        league, _team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Not a league member"}), 403
        from models.player_honours import board, honour_boards, cabinets
        return jsonify({**board(league_id), "boards": honour_boards(league_id), "players": cabinets(league_id)})

    @spa_api.route("/leagues/<int:league_id>/honours/summary")
    @login_required
    def honours_summary(league_id):
        """Every honoured player's points, counts and icons, for the pool."""
        league, _team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Not a league member"}), 403
        from models.player_honours import summary
        return jsonify({"players": {str(k): v for k, v in summary(league_id).items()}})

    @spa_api.route("/leagues/<int:league_id>/record-book")
    @login_required
    def record_book(league_id):
        """The Record Book: club, player and match records, rivalries, the
        all-time ladder (models/record_book.py)."""
        league, _team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Not a league member"}), 403
        from models.record_book import build
        return jsonify(build(league_id))

    # ── Former players ───────────────────────────────────────────────

    @spa_api.route("/leagues/<int:league_id>/former-players")
    @login_required
    def former_players(league_id):
        league, _team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Access denied"}), 403

        players = (AflPlayer.query.filter(AflPlayer.list_status == "former")
                   .order_by(AflPlayer.left_afl_year.desc(), AflPlayer.name).all())
        ids = [p.id for p in players]

        # Season by season, from the match stats: the averages on afl_player
        # only ever describe the latest season and are wiped for anyone who
        # is not playing in it.
        seasons = defaultdict(list)
        if ids:
            for pid, year, avg, games in (
                    db.session.query(PlayerStat.player_id, PlayerStat.year,
                                     db.func.avg(PlayerStat.supercoach_score),
                                     db.func.count(PlayerStat.id))
                    .filter(PlayerStat.player_id.in_(ids),
                            PlayerStat.supercoach_score.isnot(None))
                    .group_by(PlayerStat.player_id, PlayerStat.year).all()):
                seasons[pid].append((year, round(float(avg), 1), int(games)))

        from models.player_history import league_stints, serialise_stint
        stints = league_stints(league_id, ids)

        out = []
        for p in players:
            yrs = sorted(seasons.get(p.id, []))
            total_games = sum(g for _y, _a, g in yrs)
            career_avg = (round(sum(a * g for _y, a, g in yrs) / total_games, 1)
                          if total_games else None)
            best = max(yrs, key=lambda s: s[1]) if yrs else None
            last = yrs[-1] if yrs else None
            hist = stints.get(p.id, [])
            drafted = [s for s in hist if s["pick_number"] is not None]
            out.append({
                "id": p.id, "name": p.name, "position": p.position or "",
                "afl_team": p.afl_team or "", "age": p.age,
                "left_year": p.left_afl_year,
                "rating": p.rating, "potential": p.potential,
                "games": total_games,
                "career_avg": career_avg,
                "last_avg": last[1] if last else None,
                "last_games": last[2] if last else 0,
                "last_year": last[0] if last else None,
                "best_avg": best[1] if best else None,
                "best_year": best[0] if best else None,
                "first_year": yrs[0][0] if yrs else None,
                # In this league: every stint, and the headline pick.
                "history": [serialise_stint(s) for s in hist],
                "times_listed": len(hist),
                "first_pick": drafted[0]["pick_number"] if drafted else None,
                "drafted_by": drafted[0]["team"] if drafted else None,
                "still_listed_by": next((s["team"] for s in hist if s["is_active"]), None),
            })

        return jsonify({
            "league": {"id": league.id, "name": league.name},
            "players": out,
            "years": sorted({p["left_year"] for p in out if p["left_year"]}, reverse=True),
            "teams": [t.name for t in FantasyTeam.query.filter_by(league_id=league_id)
                      .order_by(FantasyTeam.name).all()],
            "team_logos": config.TEAM_LOGOS,
        })

    # ── Trade block ──────────────────────────────────────────────────

    def _block_payload(league, user_team):
        # A player who has left the list he was shopped from is off the block.
        active = {
            (fr.team_id, fr.player_id): fr
            for fr, _t in (db.session.query(FantasyRoster, FantasyTeam)
                           .join(FantasyTeam, FantasyRoster.team_id == FantasyTeam.id)
                           .filter(FantasyTeam.league_id == league.id,
                                   FantasyRoster.is_active == True).all())
        }
        entries = TradeBlockEntry.query.filter_by(league_id=league.id).all()
        stale = [e for e in entries if (e.team_id, e.player_id) not in active]
        if stale:
            for e in stale:
                db.session.delete(e)
            db.session.commit()
            entries = [e for e in entries if e not in stale]

        teams = {t.id: t for t in FantasyTeam.query.filter_by(league_id=league.id).all()}
        owners = {u.id: (u.display_name or u.username)
                  for u in User.query.filter(User.id.in_({t.owner_id for t in teams.values()})).all()}

        from models.team_ai_summary import get_cached_analytics
        from models.team_identity import team_card
        rolling = get_cached_analytics(0, league.season_year, "rolling_avgs") or {}

        def entry_json(e):
            t = teams.get(e.team_id)
            p = e.player
            form = rolling.get(p.name, {}) if isinstance(rolling, dict) else {}
            return {
                "id": e.id,
                "team": {**team_card(t), "coach": owners.get(t.owner_id, "")} if t else None,
                "player": _player_card(p, {"l5": form.get("l5")}),
                "seeking": [k for k in (e.seeking or "").split(",") if k in _SEEKING_KEYS],
                "note": e.note or "",
                "created_at": _utc_iso(e.created_at),
                "is_mine": bool(user_team and e.team_id == user_team.id),
            }

        entries.sort(key=lambda e: (e.created_at is None, e.created_at), reverse=True)
        on_block = {e.player_id for e in entries if user_team and e.team_id == user_team.id}
        my_roster = []
        if user_team:
            for (tid, _pid), fr in active.items():
                if tid != user_team.id or not fr.player:
                    continue
                my_roster.append(_player_card(fr.player, {"on_block": fr.player_id in on_block}))
            my_roster.sort(key=lambda x: -(x["sc_avg"] or 0))

        from models.window_state import is_trade_window_open
        from models.years import year_context
        return {
            "league": {"id": league.id, "name": league.name},
            "entries": [entry_json(e) for e in entries],
            "my_team": {"id": user_team.id, "name": user_team.name} if user_team else None,
            "my_roster": my_roster,
            "seeking_options": [{"key": k, "label": lbl} for k, lbl in SEEKING],
            "team_logos": config.TEAM_LOGOS,
            "trade_window_open": is_trade_window_open(league.id, league.season_year),
            "teams": [{"id": t.id, "name": t.name} for t in sorted(teams.values(), key=lambda t: t.name)],
            **year_context(),
        }

    @spa_api.route("/leagues/<int:league_id>/trade-block", methods=["GET", "POST"])
    @login_required
    def trade_block(league_id):
        league, user_team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Access denied"}), 403

        if request.method == "GET":
            return jsonify(_block_payload(league, user_team))

        if not user_team:
            return jsonify({"error": "You need a team to put a player up for trade."}), 403
        data = request.get_json(silent=True) or {}
        try:
            player_id = int(data.get("player_id"))
        except (TypeError, ValueError):
            return jsonify({"error": "Pick a player."}), 400
        roster = FantasyRoster.query.filter_by(
            team_id=user_team.id, player_id=player_id, is_active=True).first()
        if not roster:
            return jsonify({"error": "That player is not on your list."}), 400

        seeking = [k for k in (data.get("seeking") or []) if k in _SEEKING_KEYS]
        note = (data.get("note") or "").strip()
        if len(note) > BLOCK_NOTE_MAX:
            return jsonify({"error": f"Keep the note under {BLOCK_NOTE_MAX} characters."}), 400

        entry = TradeBlockEntry.query.filter_by(
            team_id=user_team.id, player_id=player_id).first()
        is_new = entry is None
        if is_new:
            entry = TradeBlockEntry(league_id=league_id, team_id=user_team.id, player_id=player_id)
            db.session.add(entry)
        entry.seeking = ",".join(seeking) or "any"
        entry.note = note or None
        db.session.commit()

        if is_new:
            player = roster.player
            title = f"{user_team.name} put {player.name} up for trade"
            link = f"/leagues/{league_id}/trade-block"
            try:
                from models.activity_feed import log_activity
                log_activity(league_id, "trade_block", title, body=note or None,
                             link=link, actor_user_id=current_user.id)
            except Exception:
                logger.exception("trade block activity failed")
            try:
                from models.notification_manager import create_notification
                for t in FantasyTeam.query.filter(
                        FantasyTeam.league_id == league_id,
                        FantasyTeam.id != user_team.id).all():
                    if t.owner_id:
                        create_notification(
                            user_id=t.owner_id, league_id=league_id,
                            notif_type="trade_block", title=title,
                            body=note or None, link=link)
            except Exception:
                logger.exception("trade block notifications failed")
        return jsonify(_block_payload(league, user_team)), (201 if is_new else 200)

    @spa_api.route("/leagues/<int:league_id>/trade-block/<int:entry_id>", methods=["DELETE"])
    @login_required
    def trade_block_remove(league_id, entry_id):
        league, user_team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Access denied"}), 403
        entry = db.session.get(TradeBlockEntry, entry_id)
        if not entry or entry.league_id != league_id:
            return jsonify({"error": "Not found"}), 404
        mine = user_team and entry.team_id == user_team.id
        if not mine and league.commissioner_id != current_user.id:
            return jsonify({"error": "Only the club that listed him can take him down."}), 403
        db.session.delete(entry)
        db.session.commit()
        return jsonify(_block_payload(league, user_team))

    # ── Past seasons ─────────────────────────────────────────────────

    def _season_years(league):
        """Every year this league has something to show for, newest first."""
        years = set()
        years.update(y for (y,) in db.session.query(SeasonStanding.year)
                     .filter_by(league_id=league.id).distinct().all())
        years.update(y for (y,) in db.session.query(Fixture.year)
                     .filter_by(league_id=league.id).distinct().all())
        from models.season_squads import snapshot_years
        years.update(snapshot_years(league.id))
        years.add(league.season_year)
        return sorted(years, reverse=True)

    @spa_api.route("/leagues/<int:league_id>/seasons")
    @spa_api.route("/leagues/<int:league_id>/seasons/<int:year>")
    @login_required
    def season_view(league_id, year=None):
        """One season of a league: ladder, results, opening squads, drafts,
        trades and list changes. The place every "previous year" link lands."""
        league, user_team = check_league_access(league_id)
        if not league:
            return jsonify({"error": "Access denied"}), 403

        years = _season_years(league)
        if year is None:
            year = league.season_year
        if year not in years:
            return jsonify({"error": f"No {year} season on record.", "years": years}), 404

        from models.draft_picks import team_cards
        from models.player_history import draft_label
        cards = team_cards(league_id)

        # Ladder
        ladder = []
        rows = (SeasonStanding.query.filter_by(league_id=league_id, year=year)
                .order_by(SeasonStanding.ladder_points.desc(),
                          SeasonStanding.percentage.desc()).all())
        for pos, s in enumerate(rows, 1):
            ladder.append({
                **cards.get(s.team_id, {"id": s.team_id, "name": "?", "logo": None, "accent": "#f5b940"}),
                "pos": pos, "wins": s.wins or 0, "losses": s.losses or 0, "draws": s.draws or 0,
                "points_for": round(s.points_for or 0), "points_against": round(s.points_against or 0),
                "pct": round(s.percentage or 0, 1), "points": s.ladder_points or 0,
            })

        # Results, round by round
        rounds = defaultdict(list)
        fixtures = (Fixture.query.filter_by(league_id=league_id, year=year)
                    .order_by(Fixture.afl_round, Fixture.id).all())
        for f in fixtures:
            rounds[f.afl_round].append({
                "id": f.id, "status": f.status, "is_final": bool(f.is_final),
                "home_id": f.home_team_id, "away_id": f.away_team_id,
                "home": cards.get(f.home_team_id, {}).get("name", "TBC"),
                "away": cards.get(f.away_team_id, {}).get("name", "TBC"),
                "home_score": round(f.home_score) if f.home_score is not None else None,
                "away_score": round(f.away_score) if f.away_score is not None else None,
            })
        played = sum(1 for f in fixtures if f.status == "completed")

        # Opening squads
        from models.season_squads import season_squads
        squads = season_squads(league_id, year)

        # Drafts held that year
        drafts = []
        for sess in (DraftSession.query.filter_by(league_id=league_id, is_mock=False, status="completed")
                     .order_by(DraftSession.id).all()):
            when = sess.completed_at or sess.started_at
            if not when or when.year != year:
                continue
            picks = (DraftPick.query.filter_by(draft_session_id=sess.id)
                     .filter(DraftPick.player_id.isnot(None))
                     .order_by(DraftPick.pick_number).all())
            drafts.append({
                "id": sess.id, "label": draft_label(sess), "type": sess.draft_round_type,
                "date": _utc_iso(when), "rounds": sess.total_rounds,
                "picks": [{
                    "pick": p.pick_number, "round": p.draft_round, "team_id": p.team_id,
                    "team": cards.get(p.team_id, {}).get("name", "?"),
                    "player_id": p.player_id,
                    "player": p.player.name if p.player else "?",
                    "position": p.player.position if p.player else "",
                    "afl_team": p.player.afl_team if p.player else "",
                } for p in picks],
            })

        # Trades completed that year
        trades = []
        for t in (Trade.query.filter_by(league_id=league_id, status="accepted")
                  .order_by(Trade.responded_at.desc()).all()):
            when = t.responded_at or t.proposed_at
            if not when or when.year != year:
                continue
            sides = defaultdict(list)
            for a in t.assets:
                if a.player_id and a.player:
                    sides[a.to_team_id].append(a.player.name)
                elif a.future_pick_id and a.future_pick:
                    fp = a.future_pick
                    sides[a.to_team_id].append(f"{fp.year} R{fp.round_number} pick")
            trades.append({
                "id": t.id, "date": _utc_iso(when),
                "a_id": t.proposer_team_id, "b_id": t.recipient_team_id,
                "a": cards.get(t.proposer_team_id, {}).get("name", "?"),
                "b": cards.get(t.recipient_team_id, {}).get("name", "?"),
                "a_gets": sides.get(t.proposer_team_id, []),
                "b_gets": sides.get(t.recipient_team_id, []),
            })

        # Delistings that year
        delists = []
        periods = {p.id: p for p in DelistPeriod.query.filter_by(league_id=league_id, year=year).all()}
        if periods:
            for a in (DelistAction.query.filter(DelistAction.delist_period_id.in_(list(periods)))
                      .order_by(DelistAction.delisted_at.desc()).all()):
                delists.append({
                    "team_id": a.team_id, "team": cards.get(a.team_id, {}).get("name", "?"),
                    "player_id": a.player_id, "player": a.player.name if a.player else "?",
                    "position": a.player.position if a.player else "",
                    "period": periods[a.delist_period_id].period_type,
                    "date": _utc_iso(a.delisted_at),
                })

        return jsonify({
            "league": {"id": league.id, "name": league.name, "season_year": league.season_year},
            "year": year, "years": years,
            "is_current": year == league.season_year,
            "my_team_id": user_team.id if user_team else None,
            "teams": list(cards.values()),
            "ladder": ladder,
            "premier": ladder[0] if ladder and played and not any(
                f.status != "completed" for f in fixtures) else None,
            "rounds": [{"round": r, "matches": m} for r, m in sorted(rounds.items())],
            "squads": squads,
            "has_squads": bool(squads),
            "drafts": drafts,
            "trades": trades,
            "delists": delists,
            "team_logos": config.TEAM_LOGOS,
        })
