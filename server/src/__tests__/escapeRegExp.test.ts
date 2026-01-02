import { describe, it, expect } from 'vitest';
import { 
  escapeRegExp, 
  createExactMatchRegex, 
  createSearchRegex 
} from '../utils/escapeRegExp.js';

describe('escapeRegExp', () => {
  describe('escapes special regex characters', () => {
    it('should escape dots', () => {
      expect(escapeRegExp('test.value')).toBe('test\\.value');
    });

    it('should escape asterisks', () => {
      expect(escapeRegExp('test*value')).toBe('test\\*value');
    });

    it('should escape plus signs', () => {
      expect(escapeRegExp('test+value')).toBe('test\\+value');
    });

    it('should escape question marks', () => {
      expect(escapeRegExp('test?value')).toBe('test\\?value');
    });

    it('should escape caret', () => {
      expect(escapeRegExp('^start')).toBe('\\^start');
    });

    it('should escape dollar sign', () => {
      expect(escapeRegExp('end$')).toBe('end\\$');
    });

    it('should escape braces', () => {
      expect(escapeRegExp('test{1,2}')).toBe('test\\{1,2\\}');
    });

    it('should escape parentheses', () => {
      expect(escapeRegExp('(group)')).toBe('\\(group\\)');
    });

    it('should escape pipes', () => {
      expect(escapeRegExp('a|b')).toBe('a\\|b');
    });

    it('should escape brackets', () => {
      expect(escapeRegExp('[abc]')).toBe('\\[abc\\]');
    });

    it('should escape backslashes', () => {
      expect(escapeRegExp('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('should escape all special characters together', () => {
      const input = 'hello.*+?^${}()|[]\\world';
      const escaped = escapeRegExp(input);
      expect(escaped).toBe('hello\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\world');
    });
  });

  describe('handles edge cases', () => {
    it('should handle empty strings', () => {
      expect(escapeRegExp('')).toBe('');
    });

    it('should handle strings without special characters', () => {
      expect(escapeRegExp('hello world')).toBe('hello world');
    });

    it('should handle strings with only special characters', () => {
      expect(escapeRegExp('.*+')).toBe('\\.\\*\\+');
    });

    it('should handle unicode characters', () => {
      expect(escapeRegExp('café.test')).toBe('café\\.test');
    });
  });

  describe('prevents ReDoS attacks', () => {
    it('should escape patterns that would cause catastrophic backtracking', () => {
      // These patterns would cause ReDoS if not escaped
      const maliciousPatterns = [
        '(a+)+$',
        '([a-zA-Z]+)*',
        '(a|aa)+',
        '(.*a){20}',
        '^(a+)+$'
      ];

      for (const pattern of maliciousPatterns) {
        const escaped = escapeRegExp(pattern);
        const regex = new RegExp(escaped, 'i');
        
        // Should match the literal pattern, not interpret it as regex
        expect(regex.test(pattern)).toBe(true);
        
        // Should NOT match unrelated strings
        expect(regex.test('aaaaaaaaaaaaaaaaaaaaa')).toBe(false);
      }
    });

    it('should make escaped patterns safe for regex construction', () => {
      const userInput = '(a+)+$'; // ReDoS pattern
      const escaped = escapeRegExp(userInput);
      
      // This should NOT hang or cause CPU issues
      const regex = new RegExp(escaped, 'i');
      const testString = 'a'.repeat(30); // Would cause ReDoS with unescaped pattern
      
      const start = Date.now();
      regex.test(testString);
      const elapsed = Date.now() - start;
      
      // Should complete almost instantly (< 100ms)
      expect(elapsed).toBeLessThan(100);
    });
  });
});

describe('createExactMatchRegex', () => {
  it('should create regex that matches string exactly (case-insensitive)', () => {
    const regex = createExactMatchRegex('MyTag');
    
    expect(regex.test('MyTag')).toBe(true);
    expect(regex.test('mytag')).toBe(true);
    expect(regex.test('MYTAG')).toBe(true);
  });

  it('should NOT match partial strings', () => {
    const regex = createExactMatchRegex('tag');
    
    expect(regex.test('tag')).toBe(true);
    expect(regex.test('tag123')).toBe(false);
    expect(regex.test('mytag')).toBe(false);
    expect(regex.test('tagged')).toBe(false);
  });

  it('should trim whitespace', () => {
    const regex = createExactMatchRegex('  tag  ');
    
    expect(regex.test('tag')).toBe(true);
    expect(regex.test('  tag  ')).toBe(false);
  });

  it('should escape special characters in input', () => {
    const regex = createExactMatchRegex('tag.name');
    
    expect(regex.test('tag.name')).toBe(true);
    expect(regex.test('tagXname')).toBe(false); // dot should be literal, not wildcard
  });
});

describe('createSearchRegex', () => {
  it('should create regex that matches anywhere in string (case-insensitive)', () => {
    const regex = createSearchRegex('test');
    
    expect(regex.test('This is a test')).toBe(true);
    expect(regex.test('testing 123')).toBe(true);
    expect(regex.test('TEST')).toBe(true);
    expect(regex.test('no match')).toBe(false);
  });

  it('should trim whitespace', () => {
    const regex = createSearchRegex('  search  ');
    
    expect(regex.test('searching')).toBe(true);
  });

  it('should escape special characters in search term', () => {
    const regex = createSearchRegex('file.txt');
    
    expect(regex.test('file.txt')).toBe(true);
    expect(regex.test('fileXtxt')).toBe(false); // dot should be literal
  });
});




