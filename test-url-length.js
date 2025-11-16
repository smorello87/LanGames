#!/usr/bin/env node

const fs = require('fs');

// LZW Compression
function lzwCompress(str) {
  const dict = {};
  const data = (str + '').split('');
  const out = [];
  let currChar;
  let phrase = data[0];
  let code = 256;

  for (let i = 1; i < data.length; i++) {
    currChar = data[i];
    if (dict[phrase + currChar] != null) {
      phrase += currChar;
    } else {
      out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
      dict[phrase + currChar] = code;
      code++;
      phrase = currChar;
    }
  }
  out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));

  return out.map(n => String.fromCharCode(n)).join('');
}

// Current implementation (with potential double-encoding issue)
function encodeContentCurrent(content) {
  const jsonStr = JSON.stringify(content);
  const compressed = lzwCompress(jsonStr);

  // This does: encodeURIComponent THEN base64 - potentially wasteful
  const base64 = Buffer.from(encodeURIComponent(compressed), 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return { jsonStr, compressed, base64 };
}

// Improved implementation (just LZW + base64)
function encodeContentImproved(content) {
  const jsonStr = JSON.stringify(content);
  const compressed = lzwCompress(jsonStr);

  // Direct base64 encoding without encodeURIComponent
  const base64 = Buffer.from(compressed, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return { jsonStr, compressed, base64 };
}

// Test with real content
const filename = 'language-games-German-beginner-1760581400142.json';
console.log(`Testing with: ${filename}\n`);

const content = JSON.parse(fs.readFileSync(filename, 'utf8'));

console.log('=== CURRENT IMPLEMENTATION ===');
const current = encodeContentCurrent(content);
const currentURL = `http://localhost/index.html?content=${current.base64}`;
console.log(`Original JSON: ${current.jsonStr.length} chars`);
console.log(`After LZW: ${current.compressed.length} chars`);
console.log(`After base64: ${current.base64.length} chars`);
console.log(`Full URL: ${currentURL.length} chars`);
console.log(`Status: ${currentURL.length > 2000 ? '❌ TOO LONG' : currentURL.length > 1800 ? '⚠️  GETTING LONG' : '✅ OK'}\n`);

console.log('=== IMPROVED IMPLEMENTATION ===');
const improved = encodeContentImproved(content);
const improvedURL = `http://localhost/index.html?content=${improved.base64}`;
console.log(`Original JSON: ${improved.jsonStr.length} chars`);
console.log(`After LZW: ${improved.compressed.length} chars`);
console.log(`After base64: ${improved.base64.length} chars`);
console.log(`Full URL: ${improvedURL.length} chars`);
console.log(`Status: ${improvedURL.length > 2000 ? '❌ TOO LONG' : improvedURL.length > 1800 ? '⚠️  GETTING LONG' : '✅ OK'}\n`);

console.log('=== COMPARISON ===');
const savings = current.base64.length - improved.base64.length;
const savingsPercent = ((savings / current.base64.length) * 100).toFixed(1);
console.log(`Bytes saved: ${savings} (${savingsPercent}%)`);
console.log(`URL length reduction: ${currentURL.length - improvedURL.length} chars`);
