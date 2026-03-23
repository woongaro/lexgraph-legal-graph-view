/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", ".dark"],
  theme: {
    extend: {
      colors: {
        // 법률 특화 색상 팔레트
        legal: {
          primary: "#1e3a5f",   // 네이비 (법원 느낌)
          accent: "#c9a227",    // 골드 (저울 느낌)
          danger: "#b91c1c",    // 위험 조항
          safe: "#15803d",      // 안전 조항
          gap: "#d97706",       // 논리 공백
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/container-queries"),
  ],
  // Obsidian Shadow DOM 내부에서도 적용되도록
  important: false,
};
