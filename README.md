# hablemos

한국어 화자를 위한 스페인(카스티야) 스페인어 입문 학습 웹앱(PWA). 개인용이며 서버 없이 브라우저에서 동작한다.

- 바로 쓰기: https://1ayer.github.io/hablemos/ (main에 push하면 GitHub Actions가 다시 배포합니다)
- 계획·명세: [docs/specs/2026-11-22-hablemos-mvp.md](docs/specs/2026-11-22-hablemos-mvp.md)
- 상태: MVP(M1~M6) 구현 완료. 12개 유닛, 36개 레슨, 360문항
- PWA: 한 번 온라인으로 열면 이후에는 인터넷 없이도 레슨과 복습을 할 수 있습니다(AI 기능과 말하기 제외). 폰에서는 브라우저 메뉴의 '홈 화면에 추가'로 설치합니다.
- API 키 주의: 이 사이트는 같은 계정의 다른 GitHub Pages 사이트와 주소(`1ayer.github.io`)를 함께 씁니다. 그 페이지들의 스크립트도 이 브라우저에 저장된 키를 읽을 수 있으니, 이 앱 전용 키를 쓰고 AI Studio에서 사용 한도를 걸어 두세요.
- 진도는 브라우저에만 저장됩니다. 설정 > 학습 기록에서 파일로 내보내고 가져올 수 있습니다.
- AI 기능은 설정에서 Gemini API 키(Google AI Studio 무료 키)를 넣으면 켜집니다. 키 없이도 레슨·복습·듣기·말하기는 모두 쓸 수 있습니다. 무료 키로 보낸 내용은 Google 제품 개선에 쓰일 수 있습니다.
- 듣기 문제는 기기에 스페인어 음성이 있어야 나옵니다. Windows는 설정 > 시간 및 언어 > 음성에서 스페인어(스페인) 음성을 추가할 수 있습니다.
- 말하기 문제는 브라우저 음성 인식(Chrome·Edge, 온라인)과 마이크 권한이 필요합니다.

## 실행

```
npm install
npm run dev    # http://localhost:5173
npm test
npm run build && npm run preview   # 오프라인·설치 동작은 빌드 결과로만 확인됩니다 (http://localhost:4173)
```

## 콘텐츠 한계

학습 문장은 원어민 검수를 거치지 않았습니다.
