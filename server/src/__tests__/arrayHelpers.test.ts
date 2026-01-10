import { describe, it, expect } from 'vitest';
import { asArray, arrayLength, hasArrayItems } from '../utils/arrayHelpers.js';

describe('asArray', () => {
  it('should return array when given an array', () => {
    expect(asArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(asArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(asArray([])).toEqual([]);
  });

  it('should return empty array when given null', () => {
    expect(asArray(null)).toEqual([]);
  });

  it('should return empty array when given undefined', () => {
    expect(asArray(undefined)).toEqual([]);
  });

  it('should return empty array when given non-array value', () => {
    expect(asArray('string' as any)).toEqual([]);
    expect(asArray(123 as any)).toEqual([]);
    expect(asArray({} as any)).toEqual([]);
    expect(asArray(true as any)).toEqual([]);
  });
});

describe('arrayLength', () => {
  it('should return length when given an array', () => {
    expect(arrayLength([1, 2, 3])).toBe(3);
    expect(arrayLength(['a'])).toBe(1);
    expect(arrayLength([])).toBe(0);
  });

  it('should return 0 when given null', () => {
    expect(arrayLength(null)).toBe(0);
  });

  it('should return 0 when given undefined', () => {
    expect(arrayLength(undefined)).toBe(0);
  });

  it('should return 0 when given non-array value', () => {
    expect(arrayLength('string' as any)).toBe(0);
    expect(arrayLength(123 as any)).toBe(0);
  });
});

describe('hasArrayItems', () => {
  it('should return true when array has items', () => {
    expect(hasArrayItems([1, 2, 3])).toBe(true);
    expect(hasArrayItems(['a'])).toBe(true);
  });

  it('should return false when array is empty', () => {
    expect(hasArrayItems([])).toBe(false);
  });

  it('should return false when given null', () => {
    expect(hasArrayItems(null)).toBe(false);
  });

  it('should return false when given undefined', () => {
    expect(hasArrayItems(undefined)).toBe(false);
  });

  it('should return false when given non-array value', () => {
    expect(hasArrayItems('string' as any)).toBe(false);
    expect(hasArrayItems(123 as any)).toBe(false);
  });
});


