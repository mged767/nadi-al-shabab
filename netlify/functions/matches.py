"""
مكانه بالضبط: netlify/functions/matches.py
=================================================
هذه دالة Netlify (Serverless Function) — نسخة من نفس منطق app.py
لكن بصيغة تفهمها Netlify (تشتغل عند الطلب فقط، مو سيرفر دائم).

بعد الرفع على Netlify، الرابط يصير تلقائيًا:
https://اسم-موقعك.netlify.app/.netlify/functions/matches

المفتاح السري (API_FOOTBALL_KEY) لا يوضع هنا في الكود أبدًا،
بل في: Netlify Dashboard > Site configuration > Environment variables
"""

import os
import json
import requests

API_KEY = os.environ.get("API_FOOTBALL_KEY", "")
BASE_URL = "https://v3.football.api-sports.io"
HEADERS = {"x-apisports-key": API_KEY}

TEAM_NAME = "Al-Shabab"
SEASON = 2026

_cache = {"team_id": None, "league_id": None}


def api_get(endpoint, params=None):
    resp = requests.get(f"{BASE_URL}/{endpoint}", headers=HEADERS, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("errors"):
        raise RuntimeError(str(data["errors"]))
    return data.get("response", [])


def resolve_team_id():
    if _cache["team_id"]:
        return _cache["team_id"]
    results = api_get("teams", {"search": TEAM_NAME})
    for r in results:
        team = r["team"]
        if team["country"] == "Saudi-Arabia" and "Shabab" in team["name"]:
            _cache["team_id"] = team["id"]
            return team["id"]
    if results:
        _cache["team_id"] = results[0]["team"]["id"]
        return _cache["team_id"]
    raise RuntimeError("Al-Shabab team not found")


def resolve_league_id():
    if _cache["league_id"]:
        return _cache["league_id"]
    results = api_get("leagues", {"country": "Saudi-Arabia", "search": "Saudi Pro League"})
    for r in results:
        if r["league"]["type"] == "League":
            _cache["league_id"] = r["league"]["id"]
            return r["league"]["id"]
    raise RuntimeError("Saudi Pro League not found")


def fmt_date(iso_str):
    return iso_str[:10]


def fmt_time(iso_str):
    return iso_str[11:16]


def get_standings(league_id):
    raw = api_get("standings", {"league": league_id, "season": SEASON})
    table = []
    if raw:
        for row in raw[0]["league"]["standings"][0]:
            table.append({
                "pos": row["rank"],
                "team": row["team"]["name"],
                "played": row["all"]["played"],
                "win": row["all"]["win"],
                "draw": row["all"]["draw"],
                "loss": row["all"]["lose"],
                "pts": row["points"],
            })
    return table


def build_payload():
    team_id = resolve_team_id()
    league_id = resolve_league_id()
    fixtures_raw = api_get("fixtures", {"team": team_id, "season": SEASON})

    results, fixtures = [], []
    for f in fixtures_raw:
        status = f["fixture"]["status"]["short"]
        home = f["teams"]["home"]
        away = f["teams"]["away"]
        is_home = home["id"] == team_id
        opponent = away["name"] if is_home else home["name"]
        venue = (f["fixture"]["venue"] or {}).get("name") or "غير محدد"
        competition = f["league"]["name"] + (f" · الجولة {f['league']['round']}" if f["league"].get("round") else "")

        if status in ("FT", "AET", "PEN"):
            gh, ga = f["goals"]["home"], f["goals"]["away"]
            team_goals = gh if is_home else ga
            opp_goals = ga if is_home else gh
            result = "win" if team_goals > opp_goals else ("loss" if team_goals < opp_goals else "draw")
            results.append({
                "opponent": opponent,
                "score": f"{team_goals} - {opp_goals}",
                "result": result,
                "date": fmt_date(f["fixture"]["date"]),
                "competition": competition,
                "home": is_home,
                "venue": venue,
            })
        elif status in ("NS", "TBD"):
            fixtures.append({
                "opponent": opponent,
                "date": fmt_date(f["fixture"]["date"]),
                "time": fmt_time(f["fixture"]["date"]),
                "competition": competition,
                "home": is_home,
                "venue": venue,
            })

    results.sort(key=lambda m: m["date"], reverse=True)
    fixtures.sort(key=lambda m: m["date"])

    return {
        "standings": get_standings(league_id),
        "results": results[:10],
        "fixtures": fixtures[:10],
    }


def handler(event, context):
    """نقطة الدخول التي يستدعيها Netlify تلقائيًا لكل طلب."""
    try:
        if not API_KEY:
            raise RuntimeError("لم يتم ضبط API_FOOTBALL_KEY في Environment Variables على Netlify")
        payload = build_payload()
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(payload, ensure_ascii=False),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": str(e)}, ensure_ascii=False),
        }
