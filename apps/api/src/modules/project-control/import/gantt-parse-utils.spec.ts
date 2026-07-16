import {
  computeOutlineLevels,
  countLeadingSpaces,
  parseBudgetToman,
  splitOwners,
  tryParseJalali,
} from './gantt-parse-utils';

describe('gantt-parse-utils', () => {
  describe('countLeadingSpaces', () => {
    it('فاصله‌های ابتدایی را می‌شمارد', () => {
      expect(countLeadingSpaces('فعالیت')).toBe(0);
      expect(countLeadingSpaces('   فعالیت')).toBe(3);
      expect(countLeadingSpaces('      x')).toBe(6);
    });
    it('Tab و NBSP را معادل یک فاصله می‌شمارد', () => {
      expect(countLeadingSpaces('\tx')).toBe(1);
      expect(countLeadingSpaces('\u00a0\u00a0x')).toBe(2);
    });
  });

  describe('computeOutlineLevels', () => {
    it('سطح Outline را از تورفتگی با Stack محاسبه می‌کند', () => {
      expect(computeOutlineLevels([0, 0, 3, 6, 0])).toEqual([0, 0, 1, 2, 0]);
    });
    it('تورفتگی مطلق مهم نیست، فقط ترتیب نسبی', () => {
      expect(computeOutlineLevels([0, 1, 3, 3, 0])).toEqual([0, 1, 2, 2, 0]);
    });
    it('گروه خالی', () => {
      expect(computeOutlineLevels([])).toEqual([]);
    });
  });

  describe('parseBudgetToman', () => {
    it('مبلغ فارسی با پسوند تومان', () => {
      expect(parseBudgetToman('۸۷۵٬۰۰۰٬۰۰۰ تومان')).toBe(875_000_000);
    });
    it('مبلغ لاتین با جداکنندهٔ کاما', () => {
      expect(parseBudgetToman('464,000,000,000 تومان')).toBe(464_000_000_000);
    });
    it('عدد مستقیم', () => {
      expect(parseBudgetToman(15_000_000_000)).toBe(15_000_000_000);
    });
    it('مقادیر خالی/نامعتبر → null', () => {
      expect(parseBudgetToman(null)).toBeNull();
      expect(parseBudgetToman('-')).toBeNull();
      expect(parseBudgetToman('تومان')).toBeNull();
    });
  });

  describe('tryParseJalali', () => {
    it('تاریخ معتبر فارسی', () => {
      const r = tryParseJalali('۱۴۰۴/۰۹/۰۱');
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe('1404/09/01');
    });
    it('تاریخ نامعتبر متنی', () => {
      expect(tryParseJalali('نامشخص').valid).toBe(false);
      expect(tryParseJalali('1404/13/01').valid).toBe(false);
      expect(tryParseJalali(null).valid).toBe(false);
    });
    it('کلید مرتب‌سازی صعودی است', () => {
      const a = tryParseJalali('1404/09/01').sortKey!;
      const b = tryParseJalali('1406/12/10').sortKey!;
      expect(b).toBeGreaterThan(a);
    });
  });

  describe('splitOwners', () => {
    it('چند مسئول را جدا می‌کند', () => {
      expect(splitOwners('علی، رضا, حسن')).toEqual(['علی', 'رضا', 'حسن']);
    });
    it('خالی → آرایهٔ خالی', () => {
      expect(splitOwners(null)).toEqual([]);
    });
  });
});
