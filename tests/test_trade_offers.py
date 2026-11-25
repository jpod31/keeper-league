"""Several open trade offers at once, and what happens when one is accepted."""

from models.database import FantasyTeam, FantasyRoster, AflPlayer, Trade, User
from models.trade_manager import propose_trade, respond_to_trade
from werkzeug.security import generate_password_hash


def _third_team(db, seed):
    u = User(username="third", email="t@test.com", password_hash=generate_password_hash("pass"), display_name="Third")
    db.session.add(u)
    db.session.flush()
    t = FantasyTeam(league_id=seed["league"].id, owner_id=u.id, name="Team Gamma", draft_order=3)
    db.session.add(t)
    db.session.flush()
    p = AflPlayer(name="Gamma Player", afl_team="Sydney", position="MID", sc_avg=90.0, age=24)
    db.session.add(p)
    db.session.flush()
    db.session.add(FantasyRoster(team_id=t.id, player_id=p.id, position_code="MID"))
    db.session.commit()
    return t, p


def _ids(seed):
    a, b, pl = seed["team_a"], seed["team_b"], seed["players"]
    # team_a holds the even-indexed players, team_b the odd
    return a, b, pl["Jordan Dawson"], pl["Ben Keays"], pl["Rory Laird"], pl["Patrick Cripps"]


def test_two_different_offers_to_the_same_club(db, seed_data):
    a, b, dawson, keays, laird, cripps = _ids(seed_data)
    lg = seed_data["league"].id
    t1, e1 = propose_trade(lg, a.id, b.id, [dawson.id], [laird.id])
    t2, e2 = propose_trade(lg, a.id, b.id, [dawson.id, keays.id], [laird.id])
    assert e1 is None and e2 is None
    assert Trade.query.filter_by(status="pending").count() == 2


def test_the_same_offer_twice_is_refused(db, seed_data):
    a, b, dawson, keays, laird, cripps = _ids(seed_data)
    lg = seed_data["league"].id
    propose_trade(lg, a.id, b.id, [dawson.id], [laird.id])
    t, err = propose_trade(lg, a.id, b.id, [dawson.id], [laird.id])
    assert t is None and "exact offer" in err


def test_accepting_one_offer_withdraws_the_ones_that_clash(db, seed_data):
    a, b, dawson, keays, laird, cripps = _ids(seed_data)
    c, gamma = _third_team(db, seed_data)
    lg = seed_data["league"].id
    to_b, _ = propose_trade(lg, a.id, b.id, [dawson.id], [laird.id])
    to_c, _ = propose_trade(lg, a.id, c.id, [dawson.id], [gamma.id])
    other, _ = propose_trade(lg, a.id, c.id, [keays.id], [gamma.id])
    _, err = respond_to_trade(to_b.id, accept=True)
    assert err is None
    assert db.session.get(Trade, to_b.id).status == "accepted"
    assert db.session.get(Trade, to_c.id).status == "withdrawn"      # Dawson has gone
    assert db.session.get(Trade, other.id).status == "pending"       # no clash


def test_an_agreed_deal_holds_its_players(db, seed_data):
    a, b, dawson, keays, laird, cripps = _ids(seed_data)
    c, gamma = _third_team(db, seed_data)
    league = seed_data["league"]
    league.trade_window_open = False
    db.session.commit()
    t, _ = propose_trade(league.id, a.id, b.id, [dawson.id], [laird.id])
    respond_to_trade(t.id, accept=True)
    assert db.session.get(Trade, t.id).status == "agreed"
    t2, err = propose_trade(league.id, a.id, c.id, [dawson.id], [gamma.id])
    assert t2 is None and "agreed deal" in err


def test_only_the_club_it_was_sent_to_can_accept(app, db, seed_data):
    # The test holds one app context for every request, so Flask-Login's
    # cached user (g._login_user) has to be dropped between users.
    from flask import g
    a, b, dawson, keays, laird, cripps = _ids(seed_data)
    lg = seed_data["league"].id
    t, _ = propose_trade(lg, a.id, b.id, [dawson.id], [laird.id])
    client = app.test_client()
    with client.session_transaction() as s:                     # the proposer (commish) tries to accept
        s["_user_id"] = str(seed_data["commissioner"].id)
        s["_fresh"] = True
    g.pop("_login_user", None)
    r = client.post(f"/leagues/{lg}/trades/{t.id}/respond", data={"action": "accept", "format": "json"})
    assert r.get_json()["ok"] is False
    assert db.session.get(Trade, t.id).status == "pending"
    client = app.test_client()                                  # the recipient can
    with client.session_transaction() as s:
        s["_user_id"] = str(seed_data["manager"].id)
        s["_fresh"] = True
    g.pop("_login_user", None)
    r = client.post(f"/leagues/{lg}/trades/{t.id}/respond", data={"action": "accept", "format": "json"})
    assert r.get_json()["ok"] is True, r.get_json()
    assert db.session.get(Trade, t.id).status == "accepted"


def test_a_refused_offer_says_why_and_a_sent_one_says_so(app, db, seed_data):
    from flask import g
    a, b, dawson, keays, laird, cripps = _ids(seed_data)
    lg = seed_data["league"].id
    client = app.test_client()
    with client.session_transaction() as s:
        s["_user_id"] = str(seed_data["commissioner"].id)
        s["_fresh"] = True
    form = {"recipient_team_id": b.id, "give_player_ids": [dawson.id], "receive_player_ids": [laird.id], "format": "json"}
    g.pop("_login_user", None)
    r1 = client.post(f"/leagues/{lg}/trades/propose", data=form)
    assert r1.status_code == 200 and r1.get_json()["ok"] is True
    g.pop("_login_user", None)
    r2 = client.post(f"/leagues/{lg}/trades/propose", data=form)
    assert r2.status_code == 400 and "exact offer" in r2.get_json()["error"]
    g.pop("_login_user", None)
    form["give_player_ids"] = [dawson.id, keays.id]
    r3 = client.post(f"/leagues/{lg}/trades/propose", data=form)
    assert r3.get_json()["ok"] is True
    assert Trade.query.filter_by(status="pending").count() == 2
