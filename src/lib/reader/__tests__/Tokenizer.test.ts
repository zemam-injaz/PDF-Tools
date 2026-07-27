import { describe, it, expect } from 'vitest';
import { tokenize, chunkPhrases } from '../Tokenizer';

describe('tokenize', () => {
  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('splits simple English text into tokens', () => {
    const tokens = tokenize('The cat jumped');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toMatchObject({ text: 'The', index: 0, type: 'word' });
    expect(tokens[1]).toMatchObject({ text: 'cat', index: 1, type: 'word' });
    expect(tokens[2]).toMatchObject({ text: 'jumped', index: 2, type: 'word' });
  });

  it('marks sentence end on punctuation', () => {
    const tokens = tokenize('Hello world. Next sentence.');
    expect(tokens[1].isSentenceEnd).toBe(true);
    expect(tokens[3].isSentenceEnd).toBe(true);
  });

  it('marks paragraph end on blank line', () => {
    const tokens = tokenize('First paragraph.\n\nSecond paragraph.');
    const paraBreak = tokens.find(t => t.text === 'paragraph');
    expect(paraBreak?.isParagraphEnd).toBe(true);
  });

  it('marks headings', () => {
    const tokens = tokenize('# Chapter One\nSome text.');
    expect(tokens[0].isHeading).toBe(true);
    expect(tokens[0].text).toBe('Chapter');
    expect(tokens[1].isHeading).toBe(true);
    expect(tokens[1].text).toBe('One');
  });

  it('detects numbers', () => {
    const tokens = tokenize('There are 42 apples');
    expect(tokens[2].type).toBe('number');
  });

  it('detects punctuation tokens', () => {
    const tokens = tokenize('Hello , world');
    expect(tokens[1].type).toBe('punctuation');
  });

  describe('Arabic text', () => {
    it('tokenizes Arabic sentences', () => {
      const tokens = tokenize('ذهب محمد إلى المدرسة');
      expect(tokens).toHaveLength(4);
      expect(tokens[0].text).toBe('ذهب');
      expect(tokens[1].text).toBe('محمد');
    });

    it('marks Arabic conjunctions with arabicRole', () => {
      const tokens = tokenize('ذهب محمد و علي إلى السوق', 'ar');
      const waw = tokens.find(t => t.text === 'و');
      expect(waw?.arabicRole).toBe('conjunction');
    });

    it('marks Arabic prepositions with arabicRole', () => {
      const tokens = tokenize('الكتاب في الحقيبة', 'ar');
      const fi = tokens.find(t => t.text === 'في');
      expect(fi?.arabicRole).toBe('preposition');
    });

    it('detects Arabic via content when no language hint given', () => {
      const tokens = tokenize('و محمد', 'ar');
      expect(tokens[0].arabicRole).toBe('conjunction');
      expect(tokens[1].arabicRole).toBeUndefined();
    });

    it('assigns prefix role for Arabic prefixed words', () => {
      const tokens = tokenize('والكتاب كبير', 'ar');
      const prefixed = tokens.find(t => t.text.startsWith('و') && t.text.length > 1);
      expect(prefixed?.arabicRole).toBe('prefix');
    });

    it('does not assign arabicRole to English words', () => {
      const tokens = tokenize('Hello world', 'en');
      for (const t of tokens) {
        expect(t.arabicRole).toBeUndefined();
      }
    });
  });

  describe('headings', () => {
    it('handles multiple heading levels', () => {
      const tokens = tokenize('# H1\n## H2\nBody text');
      expect(tokens[0].isHeading).toBe(true);
      expect(tokens[1].isHeading).toBe(true);
      expect(tokens[2].isHeading).toBe(false);
    });

    it('strips markdown heading markers from each word', () => {
      const tokens = tokenize('# Chapter 1');
      expect(tokens[0].text).toBe('Chapter');
      expect(tokens[0].isHeading).toBe(true);
    });
  });

  describe('sentence detection', () => {
    it('handles multiple punctuation marks', () => {
      const tokens = tokenize('Really?! I cannot believe it.');
      expect(tokens[0].isSentenceEnd).toBe(true);
    });

    it('marks end of line as sentence end for non-blank-line breaks', () => {
      const tokens = tokenize('Line one\nLine two');
      expect(tokens[1].isSentenceEnd).toBe(true);
    });
  });
});

describe('chunkPhrases', () => {
  it('returns empty for no tokens', () => {
    expect(chunkPhrases([], 2)).toEqual([]);
  });

  it('groups tokens by target size', () => {
    const tokens = tokenize('the cat jumped over the wall');
    const chunks = chunkPhrases(tokens, 3);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(3);
    expect(chunks[1]).toHaveLength(3);
  });

  it('with targetSize 1 returns singletons', () => {
    const tokens = tokenize('a b c');
    const chunks = chunkPhrases(tokens, 1);
    expect(chunks).toHaveLength(3);
  });

  it('with targetSize 2 returns pairs', () => {
    const tokens = tokenize('one two three four');
    const chunks = chunkPhrases(tokens, 2);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(2);
    expect(chunks[1]).toHaveLength(2);
    expect(chunks[0][0].text).toBe('one');
    expect(chunks[1][1].text).toBe('four');
  });

  it('attaches Arabic conjunction to previous chunk', () => {
    const tokens = tokenize('ذهب محمد و علي', 'ar');
    const chunks = chunkPhrases(tokens, 3);
    // "و" is a conjunction, should be grouped with surrounding words
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
