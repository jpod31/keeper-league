"""The notes panel on My Team: general notes per league, player notes grouped
into your squad and everyone else, and a search across every player."""

from flask import g

from models.database import PlayerNote, AflPlayer


def _client(app, user):
    from blueprints.spa_api import spa_api
    if "spa_api" not in app.blueprints:
        app.register_blueprint(spa_api)
    c = app.test_client()
    with c.session_transaction() as s:
        s["_user_id"] = str(user.id)
        s["_fresh"] = True
    g.pop("_login_user", None)
    return c


def test_general_notes_are_yours_and_per_league(app, db, seed_data):
    lg = seed_data["league"].id
    c = _client(app, seed_data["commissioner"])
    r = c.post(f"/api/leagues/{lg}/notes/general", json={"body": "Chase a ruck at the deadline"})
    assert r.status_code == 201
    nid = r.get_json()["note"]["id"]
    assert c.post(f"/api/leagues/{lg}/notes/general", json={"body": "  "}).status_code == 400
    d = c.get(f"/api/leagues/{lg}/notes").get_json()
    assert [x["body"] for x in d["general"]] == ["Chase a ruck at the deadline"]
    # another manager sees none of it and cannot delete it
    other = _client(app, seed_data["manager"])
    assert other.get(f"/api/leagues/{lg}/notes").get_json()["general"] == []
    assert other.delete(f"/api/leagues/{lg}/notes/general/{nid}").status_code == 404
    c = _client(app, seed_data["commissioner"])
    assert c.delete(f"/api/leagues/{lg}/notes/general/{nid}").status_code == 200
    assert c.get(f"/api/leagues/{lg}/notes").get_json()["general"] == []


def test_player_notes_split_into_your_squad_and_others(app, db, seed_data):
    lg = seed_data["league"].id
    me = seed_data["commissioner"]
    team_a = seed_data["team_a"]
    from models.database import FantasyRoster
    mine_ids = {fr.player_id for fr in FantasyRoster.query.filter_by(team_id=team_a.id, is_active=True).all()}
    ps = list(seed_data["players"].values())
    on_my_list = next(p for p in ps if p.id in mine_ids)
    elsewhere = next(p for p in ps if p.id not in mine_ids)
    # a note written on the player card is the same note the panel shows
    db.session.add(PlayerNote(user_id=me.id, player_id=on_my_list.id, body="Ready to break out"))
    db.session.add(PlayerNote(user_id=me.id, player_id=elsewhere.id, body="Trade target"))
    db.session.commit()
    d = _client(app, me).get(f"/api/leagues/{lg}/notes").get_json()
    assert [(x["player"]["id"], x["mine"]) for x in d["players"]] == [(on_my_list.id, True), (elsewhere.id, False)]
    assert {p["id"] for p in d["squad"]} == mine_ids


def test_player_search_finds_anyone(app, db, seed_data):
    p = list(seed_data["players"].values())[0]
    surname = p.name.split(" ")[-1]
    d = _client(app, seed_data["manager"]).get(f"/api/players/search?q={surname[:4]}").get_json()
    assert p.id in [x["id"] for x in d["players"]]
    assert _client(app, seed_data["manager"]).get("/api/players/search?q=a").get_json()["players"] == []
