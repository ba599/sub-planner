// src/index.html의 <script src="..."> 태그를 전부 인라인으로 치환해
// 프로젝트 루트에 index.html(단일 파일)을 생성한다.
// GitHub Pages는 루트의 index.html을 바로 서빙한다.
//
// 사용법: node build.js

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'src');
const SRC = path.join(SRC_DIR, 'index.html');
const OUT = path.join(ROOT, 'index.html');

const html = fs.readFileSync(SRC, 'utf8');

const SCRIPT_SRC_RE = /<script\s+src="([^"]+)"\s*><\/script>/g;

const inlined = html.replace(SCRIPT_SRC_RE, (match, src) => {
  const abs = path.join(SRC_DIR, src);
  if (!fs.existsSync(abs)) {
    console.warn('missing source, leaving tag intact:', src);
    return match;
  }
  const code = fs.readFileSync(abs, 'utf8').replace(/<\/script>/gi, '<\\/script>');
  return '<script>\n' + code + '\n</script>';
});

fs.writeFileSync(OUT, inlined, 'utf8');

const kb = (Buffer.byteLength(inlined, 'utf8') / 1024).toFixed(1);
console.log(`wrote ${OUT} (${kb} KB)`);
