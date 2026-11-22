# hablemos

한국어 화자를 위한 스페인(카스티야) 스페인어 입문 학습 웹앱(PWA). 개인용이며 서버 없이 브라우저에서 동작한다.

- 계획·명세: [docs/specs/2026-11-22-hablemos-mvp.md](docs/specs/2026-11-22-hablemos-mvp.md)
- 상태: M5(설정 화면, Gemini AI 연습·대화 연습)까지 구현. 유닛 3~4, PWA, 진도 내보내기는 M6에서 추가
- AI 기능은 설정에서 Gemini API 키(Google AI Studio 무료 키)를 넣으면 켜집니다. 키 없이도 레슨·복습·듣기·말하기는 모두 쓸 수 있습니다. 무료 키로 보낸 내용은 Google 제품 개선에 쓰일 수 있습니다.
- 듣기 문제는 기기에 스페인어 음성이 있어야 나옵니다. Windows는 설정 > 시간 및 언어 > 음성에서 스페인어(스페인) 음성을 추가할 수 있습니다.
- 말하기 문제는 브라우저 음성 인식(Chrome·Edge, 온라인)과 마이크 권한이 필요합니다.

## 실행

```
npm install
npm run dev    # http://localhost:5173
npm test
```

## 콘텐츠 한계

학습 문장은 원어민 검수를 거치지 않았습니다.
