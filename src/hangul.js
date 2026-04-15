// Extracted from es-hangul (MIT License). https://github.com/toss/es-hangul
// Only `disassemble` and `getChoseong` are exposed as globals;
// internal helpers are file-scoped inside the IIFE.
(function (global) {
  'use strict';

  // ---- Constants (from es-hangul _internal/constants.ts) ----

  const _JASO_HANGUL_NFD = [...'각힣'.normalize('NFD')].map(c => c.charCodeAt(0));

  const COMPLETE_HANGUL_START_CHARCODE = '가'.charCodeAt(0);
  const COMPLETE_HANGUL_END_CHARCODE = '힣'.charCodeAt(0);

  const NUMBER_OF_JONGSEONG = 28;
  const NUMBER_OF_JUNGSEONG = 21;

  const DISASSEMBLED_CONSONANTS_BY_CONSONANT = {
    '':   '',
    'ㄱ': 'ㄱ', 'ㄲ': 'ㄲ', 'ㄳ': 'ㄱㅅ',
    'ㄴ': 'ㄴ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ',
    'ㄷ': 'ㄷ', 'ㄸ': 'ㄸ',
    'ㄹ': 'ㄹ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ',
    'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ',
    'ㅁ': 'ㅁ', 'ㅂ': 'ㅂ', 'ㅃ': 'ㅃ', 'ㅄ': 'ㅂㅅ',
    'ㅅ': 'ㅅ', 'ㅆ': 'ㅆ',
    'ㅇ': 'ㅇ', 'ㅈ': 'ㅈ', 'ㅉ': 'ㅉ',
    'ㅊ': 'ㅊ', 'ㅋ': 'ㅋ', 'ㅌ': 'ㅌ', 'ㅍ': 'ㅍ', 'ㅎ': 'ㅎ',
  };

  const DISASSEMBLED_VOWELS_BY_VOWEL = {
    'ㅏ': 'ㅏ', 'ㅐ': 'ㅐ', 'ㅑ': 'ㅑ', 'ㅒ': 'ㅒ',
    'ㅓ': 'ㅓ', 'ㅔ': 'ㅔ', 'ㅕ': 'ㅕ', 'ㅖ': 'ㅖ',
    'ㅗ': 'ㅗ', 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅛ': 'ㅛ',
    'ㅜ': 'ㅜ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅠ': 'ㅠ',
    'ㅡ': 'ㅡ', 'ㅢ': 'ㅡㅣ', 'ㅣ': 'ㅣ',
  };

  const CHOSEONGS = [
    'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
    'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
  ];

  const JUNGSEONGS = Object.values(DISASSEMBLED_VOWELS_BY_VOWEL);

  const JONGSEONGS = [
    '', 'ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ',
    'ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ',
    'ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ',
    'ㅋ','ㅌ','ㅍ','ㅎ',
  ].map(c => DISASSEMBLED_CONSONANTS_BY_CONSONANT[c]);

  const JASO_HANGUL_NFD = {
    START_CHOSEONG: _JASO_HANGUL_NFD[0],
    END_CHOSEONG:   _JASO_HANGUL_NFD[3],
  };

  // ---- Helpers (file-scoped) ----

  function hasProperty(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function disassembleCompleteCharacter(letter) {
    const charCode = letter.charCodeAt(0);
    if (charCode < COMPLETE_HANGUL_START_CHARCODE || charCode > COMPLETE_HANGUL_END_CHARCODE) {
      return undefined;
    }
    const hangulCode = charCode - COMPLETE_HANGUL_START_CHARCODE;
    const jongseongIndex = hangulCode % NUMBER_OF_JONGSEONG;
    const jungseongIndex = ((hangulCode - jongseongIndex) / NUMBER_OF_JONGSEONG) % NUMBER_OF_JUNGSEONG;
    const choseongIndex  = Math.floor((hangulCode - jongseongIndex) / NUMBER_OF_JONGSEONG / NUMBER_OF_JUNGSEONG);
    return {
      choseong:  CHOSEONGS[choseongIndex],
      jungseong: JUNGSEONGS[jungseongIndex],
      jongseong: JONGSEONGS[jongseongIndex],
    };
  }

  function disassembleToGroups(str) {
    const result = [];
    for (const letter of str) {
      const dc = disassembleCompleteCharacter(letter);
      if (dc != null) {
        result.push([...dc.choseong, ...dc.jungseong, ...dc.jongseong]);
        continue;
      }
      if (hasProperty(DISASSEMBLED_CONSONANTS_BY_CONSONANT, letter)) {
        result.push([...DISASSEMBLED_CONSONANTS_BY_CONSONANT[letter]]);
        continue;
      }
      if (hasProperty(DISASSEMBLED_VOWELS_BY_VOWEL, letter)) {
        result.push([...DISASSEMBLED_VOWELS_BY_VOWEL[letter]]);
        continue;
      }
      result.push([letter]);
    }
    return result;
  }

  // ---- Public: disassemble ----

  function disassemble(str) {
    return disassembleToGroups(str).reduce(
      (acc, group) => acc + group.join(''),
      ''
    );
  }

  // ---- Public: getChoseong ----

  const EXTRACT_CHOSEONG_REGEX = new RegExp(
    '[^\\u' + JASO_HANGUL_NFD.START_CHOSEONG.toString(16) +
    '-\\u' + JASO_HANGUL_NFD.END_CHOSEONG.toString(16) +
    'ㄱ-ㅎ\\s]+',
    'ug'
  );
  const CHOOSE_NFD_CHOSEONG_REGEX = new RegExp(
    '[\\u' + JASO_HANGUL_NFD.START_CHOSEONG.toString(16) +
    '-\\u' + JASO_HANGUL_NFD.END_CHOSEONG.toString(16) + ']',
    'g'
  );

  function getChoseong(word) {
    return word
      .normalize('NFD')
      .replace(EXTRACT_CHOSEONG_REGEX, '')
      .replace(CHOOSE_NFD_CHOSEONG_REGEX, $0 => CHOSEONGS[$0.charCodeAt(0) - 0x1100]);
  }

  // ---- Export ----
  global.disassemble = disassemble;
  global.getChoseong = getChoseong;
})(typeof window !== 'undefined' ? window : globalThis);
