# 캐릭터 에셋 16종

생성 모드: 내장 image_gen. 생성일: 2026-10-12. 가상의 메이커 캐릭터이며 실제 참가자 사진이 아니다.

## 저장 위치

- Firebase Storage: gs://smoke-529c6.firebasestorage.app/vibecoding2/characters/2026-10-12-v1/
- 원본 PNG: 위 경로의 originals/
- 웹 이미지와 썸네일: 위 경로의 maker-*.webp / maker-*-thumb.webp
- 로컬 작업 사본: work/character-assets/ (Git 및 Vercel 배포 제외)
- 앱에는 이미지 바이너리를 포함하지 않는다. src/lib/character-assets.json의 Firebase 다운로드 URL로 직접 표시한다.
- 각 캐릭터의 선택 ID는 Firestore의 본인 members/profiles 문서 avatar 필드에 함께 저장된다.
- 같은 캐릭터를 여러 참가자가 선택할 수 있으며 언제든 변경 가능하다.
- 기존 Storage 보안 규칙/버킷 공개 정책은 변경하지 않았다. 생성된 공용 일러스트의 웹 이미지/썸네일만 다운로드 토큰 URL을 발급했다.
- 웹 변환은 Sharp 리사이즈와 WebP 인코딩만 수행하며 알파를 보존한다.

## 생성 프롬프트

### 바이올렛 (maker-violet)

Generate a premium 3D character portrait asset for a Korean maker community dashboard inspired by dramatic NBA athlete profile cards. Fictional adult Korean creative technologist, stylish high-end game cinematic character render, realistic proportions with subtly stylized beautiful materials, strong confident personality, waist-up including full head and shoulders, centered with breathing space around silhouette, looking at camera, editorial sports campaign lighting, strong violet rim light and warm coral key light. Isolated clean transparent background, NO text, NO logo, NO watermark, NO props obscuring face. Fine detailed clothing. Portrait composition. Woman with short black bob haircut, confident half smile, oversized iridescent purple and lavender technical bomber jacket over black tee, arms folded loosely. Cool creative director energy.

### 코랄 (maker-coral)

Generate a premium 3D character portrait asset for a Korean maker community dashboard inspired by dramatic NBA athlete profile cards. Fictional adult Korean creative technologist, stylish high-end game cinematic character render, realistic proportions with subtly stylized beautiful materials, strong confident personality, waist-up including full head and shoulders, centered with breathing space around silhouette, looking at camera, editorial sports campaign lighting, strong violet rim light and warm coral key light. Isolated clean transparent background, NO text, NO logo, NO watermark, NO props obscuring face. Fine detailed clothing. Portrait composition. Man with textured short black hair, confident friendly expression, vibrant vermilion orange technical jacket, black shirt, hands relaxed below crop. Strong esports captain energy.

### 민트 (maker-mint)

Generate a premium 3D character portrait asset for a Korean maker community dashboard inspired by dramatic NBA athlete profile cards. Fictional adult Korean creative technologist, stylish high-end game cinematic character render, realistic proportions with subtly stylized beautiful materials, strong confident personality, waist-up including full head and shoulders, centered with breathing space around silhouette, looking at camera, editorial sports campaign lighting, strong violet rim light and warm coral key light. Isolated clean transparent background, NO text, NO logo, NO watermark, NO props obscuring face. Fine detailed clothing. Portrait composition. Woman with dark tied-back hair and wispy bangs, round clear glasses, silver mint-green technical windbreaker, thoughtful warm expression, one hand on hip. Inventor energy.

### 블루 (maker-blue)

Generate a premium 3D character portrait asset for a Korean maker community dashboard inspired by dramatic NBA athlete profile cards. Fictional adult Korean creative technologist, stylish high-end game cinematic character render, realistic proportions with subtly stylized beautiful materials, strong confident personality, waist-up including full head and shoulders, centered with breathing space around silhouette, looking at camera, editorial sports campaign lighting, strong violet rim light and warm coral key light. Isolated clean transparent background, NO text, NO logo, NO watermark, NO props obscuring face. Fine detailed clothing. Portrait composition. Man with wavy dark hair, navy blue headphones around neck, cobalt blue technical hoodie, optimistic confident expression. Designer and builder energy.

### 앰버 (maker-amber)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Woman around 35, shoulder-length wavy dark-brown hair, warm confident smile, ochre amber technical bomber jacket over charcoal shirt, relaxed arms crossed.

### 로즈 (maker-rose)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Man around 30, cropped black hair, subtle round glasses, dusty rose pink utility jacket with clean seams, calm thoughtful smile.

### 시안 (maker-cyan)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Woman around 28, long dark hair in high ponytail, bright cyan and black technical windbreaker, confident sporty stance, cheerful half smile.

### 라임 (maker-lime)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Man around 25, tousled medium brown hair, vivid acid lime zip-up windbreaker over black tee, playful energetic smile, arms folded.

### 펄 (maker-pearl)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Woman around 45, elegant chin-length black hair with a silver streak, pearl white architectural jacket with silver details over black shirt, composed confident expression.

### 틸 (maker-teal)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Man around 45, short swept-back dark hair with gray at temples, neat short beard, rich teal utility bomber, broad kind smile.

### 루비 (maker-ruby)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Woman around 30, short asymmetrical black pixie haircut, burgundy ruby red structured leather jacket, determined confident expression, hands on hips below crop.

### 인디고 (maker-indigo)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Man around 35, shoulder-length swept-back dark hair, thin black glasses, deep indigo layered technical jacket with violet accents, reflective calm smile.

### 피치 (maker-peach)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Woman around 25, softly curled dark bob hair with blunt bangs, warm peach-orange soft technical hoodie, friendly joyful smile, relaxed shoulders.

### 에메랄드 (maker-emerald)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Man around 32, closely cropped dark hair, emerald green tactical-style civilian designer jacket with black shoulder panels, strong friendly expression, arms crossed.

### 골드 (maker-gold)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Woman around 50, cropped softly wavy salt-and-pepper hair, brushed metallic gold bomber jacket, mature face with natural smile lines, open confident smile.

### 그라파이트 (maker-graphite)

Create ONE premium cinematic 3D character portrait asset for a Korean creative coding community's selectable game-character roster. Fictional adult Korean creative technologist, stylish editorial athlete-profile lighting, subtly stylized high-end game render with believable proportions and rich detailed clothing, confident approachable personality, waist-up including entire head with space above hair and shoulders, centered and facing camera, strong violet rim light with a warm complementary key light. Consistent portrait series, 2:3 vertical framing, character occupies 85 percent width. CRITICAL: genuine transparent alpha background, no solid studio background or scenery, no smoke behind subject. No lettering, logo, watermark, text or UI. Hands anatomically correct or outside frame. Man around 50, wavy silver-gray hair, charcoal graphite technical jacket with thin luminous violet piping over a black tee, clean shaven, thoughtful experienced mentor energy.
