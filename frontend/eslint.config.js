import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// 추가 설정에 필요한 플러그인 Import
import react from 'eslint-plugin-react'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintPluginPrettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      // JSX 구문 분석을 위한 설정 추가
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    // React 버전을 자동 감지하기 위한 세팅
    settings: {
      react: {
        version: 'detect',
      },
    },
    // 플러그인 등록
    plugins: {
      react,
      'simple-import-sort': simpleImportSort,
      prettier: eslintPluginPrettier,
    },
    // 세부 규칙 적용
    rules: {
      // Prettier 포맷팅 오류를 ESLint 에러로 표시
      'prettier/prettier': 'error',

      // React 17+ JSX 변환 방식 지원 (React import 생략)
      'react/react-in-jsx-scope': 'off',

      // Import 자동 정렬 규칙
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // 1. react 및 서드파티 라이브러리
            ['^react', '^@?\\w'],
            // 2. 내부 프로젝트 절대 경로 및 상대 경로
            ['^(@|components|utils|hooks|pages)(/.*|$)'],
            ['^\\.'],
            // 3. 스타일 파일
            ['^.+\\.?(css|scss|sass|less)$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      // TypeScript 규칙
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Prettier와 충돌하는 기본 ESLint 규칙들을 비활성화 
  // (반드시 배열의 맨 마지막에 위치해야 합니다)
  eslintConfigPrettier,
])