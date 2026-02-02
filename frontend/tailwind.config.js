/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7952B3',  // 어두운 보라색 테마
          light: '#9B7ACC',
          mid: '#8A66BF',
          dark: '#5E3D8F',
        },
        sidebar: {
          bg: '#1b1b1b',
          hover: '#2d2d2d',
          active: '#7952B3',  // 사이드바 활성 색상도 보라색으로 통일
        },
        danger: '#cc333e',
        success: '#25a35a',
      },
    },
  },
  plugins: [],
}
