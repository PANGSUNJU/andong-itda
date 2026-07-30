"""
정규화된 노선 시간표 → 관광지 중심 뷰

안동잇다가 화면에서 답해야 하는 질문은 하나다.
  "여기서 시내로 돌아가는 마지막 버스는 몇 시인가"

노선 단위 데이터를 관광지 단위로 뒤집어서 그 질문에 답할 수 있게 만든다.
시간표가 없는 관광지는 억지로 채우지 않고 비워 둔다.
부정확한 교통 정보는 여행자를 정류장에 세워두기 때문이다.
"""
import json

import os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'output', 'timetable-raw.json')
OUT = os.path.join(HERE, '..', 'server', 'data', 'timetable-spots.json')

# 관광지 ← 노선/컬럼 매핑
# outboundStop : 시내에서 관광지로 갈 때 타는 곳
# inboundStop  : 관광지에서 시내로 나올 때의 시각이 적힌 컬럼
SPOT_MAP = [
    {
        'spot': '안동하회마을',
        'routes': [
            {'code': '210', 'sheet': '210번(하회)',
             'outbound': ('교보건너', '하회마을'),
             'inbound': None,
             'note': '하회 출발 시각은 시간표에 표기되어 있지 않습니다.'},
            {'code': '급행2', 'sheet': '급행2(하회봉정사)',
             'outbound': None,
             'inbound': '출발',
             'note': '매년 8월 토·일·공휴일과 탈춤축제기간(9/26~10/5)에만 운행합니다.'},
        ],
    },
    {
        'spot': '병산서원',
        'routes': [
            {'code': '210', 'sheet': '210번(하회)',
             'outbound': ('교보건너', '병산서원'),
             'inbound': None,
             'note': '하회마을을 경유해 하루 3회만 들어갑니다.'},
        ],
    },
    {
        'spot': '봉정사',
        'routes': [
            {'code': '310', 'sheet': '310번(봉정사)',
             'outbound': (None, '봉정사'),
             'inbound': None,
             'note': None},
            {'code': '급행2', 'sheet': '급행2(하회봉정사)',
             'outbound': None,
             'inbound': '봉정사발',
             'note': '매년 8월 토·일·공휴일과 탈춤축제기간에만 운행합니다.'},
        ],
    },
    {
        'spot': '도산서원',
        'routes': [
            {'code': '급행3', 'sheet': '급행 3 ',
             'outbound': (None, '급행3(도산서원)'),
             'inbound': None,
             'note': None},
        ],
    },
    {
        'spot': '안동댐·월영교',
        'routes': [
            {'code': '112', 'sheet': '112번(댐)',
             'outbound': (None, '112번(구3번,관광단지)'),
             'inbound': None,
             'note': '관광단지 방면 노선입니다.'},
        ],
    },
]


def load():
    data = json.load(open(RAW, encoding='utf-8'))
    idx = {}
    for r in data:
        idx.setdefault(r['sheet'], []).append(r)
    return idx


def pick(rows, label):
    """시트 목록에서 특정 컬럼 라벨을 찾아 반환."""
    for r in rows:
        for s in r['stops']:
            if s['stop'] == label:
                return r, s
    return None, None


def build():
    idx = load()
    out = []

    for entry in SPOT_MAP:
        spot = {'spot': entry['spot'], 'routes': []}

        for rt in entry['routes']:
            rows = idx.get(rt['sheet'], [])
            if not rows:
                continue

            item = {
                'routeCode': rt['code'],
                'effectiveFrom': rows[0].get('effectiveFrom'),
                'note': rt['note'],
                'outbound': None,
                'inbound': None,
            }

            if rt['outbound']:
                from_label, to_label = rt['outbound']
                _, arr = pick(rows, to_label)
                if arr:
                    item['outbound'] = {
                        'arrivesAt': to_label,
                        'first': arr['first'], 'last': arr['last'],
                        'runs': arr['runs'], 'times': arr['times'],
                    }
                if from_label:
                    _, dep = pick(rows, from_label)
                    if dep:
                        item['outbound'] = item['outbound'] or {}
                        item['outbound']['departsFrom'] = from_label
                        item['outbound']['departFirst'] = dep['first']
                        item['outbound']['departLast'] = dep['last']

            if rt['inbound']:
                _, ret = pick(rows, rt['inbound'])
                if ret:
                    item['inbound'] = {
                        'departsFrom': rt['inbound'],
                        'first': ret['first'], 'last': ret['last'],
                        'runs': ret['runs'], 'times': ret['times'],
                    }

            spot['routes'].append(item)

        # 화면에 쓸 요약값
        ib = [r['inbound'] for r in spot['routes'] if r['inbound']]
        ob = [r['outbound'] for r in spot['routes'] if r['outbound']]
        spot['summary'] = {
            'lastInbound': max((r['last'] for r in ib), default=None),
            'lastOutboundArrival': max((r['last'] for r in ob if 'last' in r), default=None),
            'hasReturnTimetable': bool(ib),
        }
        out.append(spot)

    return out


if __name__ == '__main__':
    data = build()
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    print('관광지별 버스 시간 요약\n' + '─' * 62)
    for s in data:
        print(f"\n▸ {s['spot']}")
        for r in s['routes']:
            eff = f"({r['effectiveFrom']} 시행)" if r['effectiveFrom'] else ''
            print(f"   [{r['routeCode']}] {eff}")
            if r['outbound']:
                o = r['outbound']
                if 'departsFrom' in o:
                    print(f"      가는 편  {o['departsFrom']} {o['departFirst']}~{o['departLast']}"
                          f" → {o['arrivesAt']} 도착 {o['first']}~{o['last']} ({o['runs']}회)")
                else:
                    print(f"      가는 편  {o['arrivesAt']} {o['first']}~{o['last']} ({o['runs']}회)")
            if r['inbound']:
                i = r['inbound']
                print(f"      오는 편  {i['departsFrom']} 출발 {i['first']}~{i['last']} ({i['runs']}회)")
                print(f"               {', '.join(i['times'])}")
            if r['note']:
                print(f"      ⚠ {r['note']}")
        sm = s['summary']
        if sm['hasReturnTimetable']:
            print(f"   ▷ 돌아오는 막차 {sm['lastInbound']}")
        else:
            print(f"   ▷ 돌아오는 시간표 없음 · 도착 편 막차 {sm['lastOutboundArrival']}")
