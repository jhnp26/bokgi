"""문제 은행 전체 점검. 형식이 깨졌거나 중복된 문제를 찾는다.

python tools/check_bank.py          → 문제 목록 출력 (문제가 있으면 종료 코드 1)
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def norm(s):
    return re.sub(r"[\s·,.\-()]+", "", (s or "").lower())


def check(problems):
    issues = []
    seen_q = {}
    for p in problems:
        pid = p.get("id", "?")
        ch = p.get("choices") or []
        if not re.match(r"^[A-Z]{2}-\d{2,4}$", pid):
            issues.append((pid, "문제 번호 형식이 이상함"))
        if len(ch) != 4:
            issues.append((pid, "보기가 4개가 아님"))
        if len({re.sub(r"\s+", "", str(c)) for c in ch}) != len(ch):
            issues.append((pid, "보기가 겹침: %s" % ch))
        if any(not str(c).strip() for c in ch):
            issues.append((pid, "빈 보기"))
        if not isinstance(p.get("answer"), int) or not 0 <= p["answer"] < len(ch):
            issues.append((pid, "정답 번호가 이상함"))
        text = " ".join([p.get("q", ""), p.get("explain", "")] + [str(c) for c in ch])
        if re.search(r"\$|\\frac|\\sqrt|\\text|\\times", text):
            issues.append((pid, "LaTeX가 남아 있음"))
        if re.search(r"그림과 같|아래 그림|다음 그림|표와 같", p.get("q", "")):
            issues.append((pid, "없는 그림을 참조함"))
        if len(p.get("q", "")) < 6 or len(p.get("explain", "")) < 10:
            issues.append((pid, "문제나 해설이 너무 짧음"))
        key = norm(p.get("q"))
        if key in seen_q:
            issues.append((pid, "%s 와 문제가 똑같음" % seen_q[key]))
        seen_q.setdefault(key, pid)
    ids = [p.get("id") for p in problems]
    for i in {x for x in ids if ids.count(x) > 1}:
        issues.append((i, "문제 번호 중복"))
    return issues


if __name__ == "__main__":
    bank = json.load(open(os.path.join(ROOT, "data", "problems.json"), encoding="utf-8"))["problems"]
    found = check(bank)
    for pid, why in found:
        print(pid, why)
    print("점검 %d문제, 문제 %d건" % (len(bank), len(found)))
    sys.exit(1 if found else 0)
