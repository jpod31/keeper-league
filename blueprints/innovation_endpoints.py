"""
Round recap + Win probability endpoints — registered into spa_api blueprint.
Kept out of spa_api.py to avoid bash heredoc issues during development.
"""
from flask import jsonify, request
from flask_login import login_required

from models.database import (
    db, League, FantasyTeam, FantasyRoster, Fixture, LineupSlot,
    PlayerStat, ScScore, AflPlayer,
)


def register_innovation_endpoints(spa_api):
    @spa_api.route("/leagues/<int:league_id>/team/<int:team_id>/round-recap")
    @login_required
    def round_recap(league_id, team_id):
        """End-of-round recap for a specific team + league-wide notables."""
        from models.scoring_engine import get_current_afl_round

        league = db.session.get(League, league_id)
        team = db.session.get(FantasyTeam, team_id)
        if not league or not team or team.league_id != league_id:
            return jsonify({"error": "Not found"}), 404

        year = league.season_year
        current_round = get_current_afl_round(year)
        recap_round = current_round - 1 if current_round > 1 else 1

        fx = Fixture.query.filter_by(league_id=league_id, year=year, afl_round=recap_round).all()
        status_all_done = all((f.status == "completed") for f in fx) if fx else False
        if not status_all_done and recap_round > 1:
            for r in range(recap_round, 0, -1):
                rx = Fixture.query.filter_by(league_id=league_id, year=year, afl_round=r).all()
                if rx and all(f.status == "completed" for f in rx):
                    recap_round = r
                    fx = rx
                    break

        if not fx:
            return jsonify({"recap_round": 0, "has_recap": False})

        team_fixture = None
        for f in fx:
            if f.home_team_id == team_id or f.away_team_id == team_id:
                team_fixture = f
                break

        result = None
        if team_fixture:
            is_home = team_fixture.home_team_id == team_id
            my_score = team_fixture.home_score or 0 if is_home else team_fixture.away_score or 0
            opp_score = team_fixture.away_score or 0 if is_home else team_fixture.home_score or 0
            opp_id = team_fixture.away_team_id if is_home else team_fixture.home_team_id
            opp = db.session.get(FantasyTeam, opp_id)
            outcome = "win" if my_score > opp_score else "loss" if my_score < opp_score else "draw"
            result = {
                "outcome": outcome,
                "my_score": my_score, "opp_score": opp_score,
                "opp_name": opp.name if opp else "?",
                "margin": abs(my_score - opp_score),
            }

        # Per-player scores this round
        slot_rows = LineupSlot.query.filter_by(team_id=team_id, afl_round=recap_round, year=year).all()
        mvp, bust = None, None
        if slot_rows:
            pids = [s.player_id for s in slot_rows if s.player_id]
            sc_rows = ScScore.query.filter(
                ScScore.player_id.in_(pids), ScScore.year == year, ScScore.round == recap_round
            ).all() if pids else []
            sc_map = {s.player_id: s.score for s in sc_rows}
            scored = []
            for s in slot_rows:
                if s.position_code == "BENCH":
                    continue
                base = sc_map.get(s.player_id, 0) or 0
                score = base * 2 if s.is_captain else base
                ap = db.session.get(AflPlayer, s.player_id)
                scored.append({
                    "player_id": s.player_id,
                    "name": ap.name if ap else "?",
                    "afl_team": ap.afl_team if ap else "",
                    "score": round(score, 1),
                    "is_captain": s.is_captain,
                })
            scored.sort(key=lambda x: x["score"], reverse=True)
            if scored:
                mvp = scored[0]
                bust = scored[-1] if scored[-1]["score"] < (mvp["score"] - 20) else None

        # League-wide notable: best team score + biggest margin
        best_team = None
        biggest_margin_fx = None
        max_score = 0
        for f in fx:
            hs = f.home_score or 0
            aws = f.away_score or 0
            if hs > max_score:
                max_score = hs
                best_team = {"team_id": f.home_team_id, "name": f.home_team.name if f.home_team else "?", "score": hs}
            if aws > max_score:
                max_score = aws
                best_team = {"team_id": f.away_team_id, "name": f.away_team.name if f.away_team else "?", "score": aws}
        margins = sorted(fx, key=lambda f: abs((f.home_score or 0) - (f.away_score or 0)), reverse=True)
        if margins:
            m = margins[0]
            biggest_margin_fx = {
                "home": m.home_team.name if m.home_team else "?",
                "away": m.away_team.name if m.away_team else "?",
                "home_score": m.home_score or 0,
                "away_score": m.away_score or 0,
                "margin": abs((m.home_score or 0) - (m.away_score or 0)),
            }

        return jsonify({
            "recap_round": recap_round,
            "has_recap": True,
            "team_name": team.name,
            "result": result,
            "mvp": mvp,
            "bust": bust,
            "best_team": best_team,
            "biggest_margin": biggest_margin_fx,
        })

    @spa_api.route("/leagues/<int:league_id>/matchup/<int:fixture_id>/win-probability")
    @login_required
    def win_probability(league_id, fixture_id):
        """Monte Carlo win probability based on remaining player variance."""
        import random, statistics

        fx = db.session.get(Fixture, fixture_id)
        if not fx or fx.league_id != league_id:
            return jsonify({"error": "Not found"}), 404

        league = db.session.get(League, league_id)
        year = league.season_year
        rnd = fx.afl_round

        def team_projection(team_id):
            slots = LineupSlot.query.filter_by(team_id=team_id, afl_round=rnd, year=year).all()
            if not slots:
                slots = []
                for rr in FantasyRoster.query.filter_by(team_id=team_id, is_active=True).all():
                    dummy = type("S", (), {
                        "player_id": rr.player_id, "is_captain": False,
                        "is_vice_captain": False, "position_code": "MID",
                    })()
                    slots.append(dummy)
            pids = [s.player_id for s in slots if s.player_id]
            sc_rows = ScScore.query.filter(
                ScScore.year == year, ScScore.round == rnd, ScScore.player_id.in_(pids),
            ).all() if pids else []
            sc_done = {r.player_id: r.score for r in sc_rows}
            scored_so_far = 0.0
            remaining_means = []
            remaining_sds = []
            for s in slots:
                if not s.player_id or s.position_code == "BENCH":
                    continue
                mult = 2 if s.is_captain else 1
                if s.player_id in sc_done:
                    scored_so_far += (sc_done[s.player_id] or 0) * mult
                else:
                    hist = [ps.score for ps in PlayerStat.query.filter_by(player_id=s.player_id, year=year).all()
                            if ps.score is not None]
                    ap = db.session.get(AflPlayer, s.player_id)
                    if hist:
                        mean = statistics.mean(hist)
                        sd = statistics.pstdev(hist) if len(hist) > 1 else 15.0
                    else:
                        mean = (ap.sc_avg if ap else 0) or 60
                        sd = 18.0
                    remaining_means.append(mean * mult)
                    remaining_sds.append(sd * mult)
            return scored_so_far, remaining_means, remaining_sds

        home_done, home_m, home_s = team_projection(fx.home_team_id)
        away_done, away_m, away_s = team_projection(fx.away_team_id)

        N = 3000
        home_wins = away_wins = ties = 0
        home_totals = []
        away_totals = []
        for _ in range(N):
            ht = home_done + sum(max(0, random.gauss(m, s)) for m, s in zip(home_m, home_s))
            at = away_done + sum(max(0, random.gauss(m, s)) for m, s in zip(away_m, away_s))
            home_totals.append(ht)
            away_totals.append(at)
            if ht > at:
                home_wins += 1
            elif at > ht:
                away_wins += 1
            else:
                ties += 1
        home_totals.sort()
        away_totals.sort()

        def pct(arr, p):
            return arr[min(len(arr) - 1, int(len(arr) * p / 100))]

        return jsonify({
            "fixture_id": fx.id,
            "afl_round": rnd,
            "home_team": {
                "id": fx.home_team_id,
                "name": fx.home_team.name if fx.home_team else "?",
                "current_score": round(home_done, 1),
                "projected_mean": round(sum(home_m) + home_done, 1),
                "remaining_players": len(home_m),
                "p10": round(pct(home_totals, 10), 1),
                "p50": round(pct(home_totals, 50), 1),
                "p90": round(pct(home_totals, 90), 1),
            },
            "away_team": {
                "id": fx.away_team_id,
                "name": fx.away_team.name if fx.away_team else "?",
                "current_score": round(away_done, 1),
                "projected_mean": round(sum(away_m) + away_done, 1),
                "remaining_players": len(away_m),
                "p10": round(pct(away_totals, 10), 1),
                "p50": round(pct(away_totals, 50), 1),
                "p90": round(pct(away_totals, 90), 1),
            },
            "home_win_pct": round(home_wins / N * 100, 1),
            "away_win_pct": round(away_wins / N * 100, 1),
            "tie_pct": round(ties / N * 100, 1),
            "simulations": N,
        })
