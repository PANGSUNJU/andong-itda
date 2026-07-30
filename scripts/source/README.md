# 원본 시간표 엑셀

안동시 시내버스 운행시간표 원본을 이 폴더에 넣는다.

## 출처

공공데이터포털 — 경상북도 안동시_시내버스 운행시간표
https://www.data.go.kr/data/3068539/fileData.do

## 필요한 파일

운수업체별로 파일이 나뉘어 있다. 4개 모두 필요하다.

| 담당 | 노선 |
|---|---|
| 안동버스 | 급행1·2, 212, 순환2/2-1/3/3-1, 112, 풍산, 풍천, 서후, 일직, 남후, 남선 |
| 경안여객 | 급행3, 110, 113, 114, 도산, 녹전, 북후, 예안, 와룡 |
| 동춘여객 | 111, 순환1/1-1, 길안, 임하, 임동 |

⚠️ 동춘여객 파일은 한시 시간표다. 기간이 지나면 최신 버전으로 교체해야 한다.

⚠️ 파일명은 개편 회차마다 바뀐다. 스크립트는 이 폴더의 모든 `.xlsx`를 읽으므로
   파일명을 맞출 필요는 없다.

## 실행

```bash
pip install openpyxl
python scripts/parse_timetable.py          # → scripts/output/timetable-raw.json
python scripts/build_spot_timetable.py     # → server/data/timetable-spots.json
```

## 파싱 방식

시트마다 컬럼 구조가 전혀 다르므로 완전 파싱은 시도하지 않는다.
**정류장 컬럼별 첫차·막차·운행횟수만** 수확한다. → docs/decisions.md ADR-016
