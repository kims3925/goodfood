# CSS 스타일 가이드

## 📁 파일 구조

```
src/styles/
└── globals.css          # 전역 스타일 및 Tailwind 설정
```

## 🎨 디자인 시스템

### 색상 팔레트

#### Primary Colors (파란색)
- `--primary-color`: #2563eb - 주요 액션, 버튼
- `--primary-hover`: #1d4ed8 - 호버 상태
- `--primary-light`: #dbeafe - 배경, 선택된 상태
- `--primary-dark`: #1e40af - 강조

#### Secondary Colors (초록색)
- `--secondary-color`: #10b981 - 보조 액션
- `--secondary-hover`: #059669 - 호버 상태
- `--secondary-light`: #d1fae5 - 배경

#### Neutral Colors
- `--background`: #ffffff - 메인 배경
- `--surface`: #f9fafb - 카드, 패널 배경
- `--border`: #e5e7eb - 테두리
- `--divider`: #f3f4f6- 구분선

#### Text Colors
- `--text-primary`: #111827 - 주요 텍스트
- `--text-secondary`: #6b7280 - 보조 텍스트
- `--text-muted`: #9ca3af - 비활성 텍스트
- `--text-inverse`: #ffffff - 역전된 텍스트 (다크 배경)

#### Status Colors
- `--success`: #10b981 - 성공 메시지
- `--warning`: #f59e0b - 경고 메시지
- `--error`: #ef4444 - 에러 메시지
- `--info`: #3b82f6 - 정보 메시지

### 디자인 토큰

#### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

#### Border Radius
```css
--radius-sm: 0.25rem   (4px)
--radius-md: 0.375rem  (6px)
--radius-lg: 0.5rem    (8px)
--radius-xl: 0.75rem   (12px)
--radius-2xl: 1rem     (16px)
```

#### Spacing
```css
--spacing-xs: 0.5rem   (8px)
--spacing-sm: 1rem     (16px)
--spacing-md: 1.5rem   (24px)
--spacing-lg: 2rem     (32px)
--spacing-xl: 3rem     (48px)
--spacing-2xl: 4rem    (64px)
```

## 🔧 Tailwind 사용법

### 색상 사용
```tsx
// Primary color
<button className="bg-primary-color text-white hover:bg-primary-hover">
  버튼
</button>

// Text color
<p className="text-text-primary">주요 텍스트</p>
<p className="text-text-secondary">보조 텍스트</p>
```

### 컴포넌트 유틸리티 클래스

#### 버튼
```tsx
<button className="btn-primary">Primary Button</button>
<button className="btn-secondary">Secondary Button</button>
<button className="btn-ghost">Ghost Button</button>
```

#### 카드
```tsx
<div className="card">
  <h2>Card Title</h2>
  <p>Card Content</p>
</div>
```

#### 입력 필드
```tsx
<input className="input" placeholder="입력하세요" />
```

### 애니메이션

#### Fade In
```tsx
<div className="fade-in">
  페이드 인 애니메이션
</div>
```

#### Skeleton Loading
```tsx
<div className="skeleton h-20 w-full rounded-lg"></div>
```

## 📝 사용 예시

### 카드 레이아웃
```tsx
<div className="card p-6">
  <h2 className="text-xl font-semibold text-text-primary mb-4">
    제목
  </h2>
  <p className="text-text-secondary">
    내용
  </p>
  <button className="btn-primary mt-4">
    액션
  </button>
</div>
```

### 상태 메시지
```tsx
<div className="p-4 bg-green-50 border border-success rounded-lg">
  <p className="text-success">성공 메시지</p>
</div>

<div className="p-4 bg-red-50 border border-error rounded-lg">
  <p className="text-error">에러 메시지</p>
</div>
```

## 🎯 베스트 프랙티스

1. **CSS 변수 사용**: 직접 색상 값 대신 CSS 변수 사용
   ```tsx
   // ✅ Good
   className="bg-primary-color"

   // ❌ Bad
   className="bg-blue-600"
   ```

2. **컴포넌트 클래스 활용**: 반복되는 스타일은 유틸리티 클래스로
   ```tsx
   // ✅ Good
   className="btn-primary"

   // ❌ Bad
   className="px-4 py-2 bg-primary-color text-white rounded-md..."
   ```

3. **시맨틱 네이밍**: 의미있는 색상 이름 사용
   ```tsx
   // ✅ Good
   className="text-text-secondary"

   // ❌ Bad
   className="text-gray-600"
   ```
