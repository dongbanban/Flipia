# 16: 抽取历史 — 展示抽取人

**Status:** done
**Type:** implementation
**Blocked by:** 11

## What

在历史记录页面和首页摘要中，每条抽取记录展示"谁抽的"。按天分组时，同一天多条记录各自标注抽取人。

## Why

多人群组中，不同成员可能在不同时间各自抽取。标注抽取人帮助区分"今天某人吃了什么"。

## Acceptance

- [x] 历史记录列表每条展示抽取人昵称（如"张三的午餐"），群组成员数 > 1 时显示
- [x] 首页摘要（今日已确认 X 条）中，如有多次抽取且抽取人不同，显示为"张三、李四 今天抽了 3 次"
- [x] 群组成员数 = 1 时，不展示抽取人标签
- [x] 抽取人使用微信昵称

## Comments

460f11a feat: show drawer nickname on history records and homepage summary
