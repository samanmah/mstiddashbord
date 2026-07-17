import {
  computeOutlineLevels,
  countLeadingSpaces,
  detectAndScalePercents,
  isStrongTotalsLabel,
  isTotalsLabel,
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

  describe('isTotalsLabel (anchored)', () => {
    it('عنوان عادی شامل «روز» Totals نیست', () => {
      expect(isTotalsLabel('فعالیت روز اول')).toBe(false);
      expect(isTotalsLabel('شکست برنامه‌ریزی روزانه')).toBe(false);
    });
    it('عنوان عادی شامل «ماه» Totals نیست', () => {
      expect(isTotalsLabel('شکست ماهانه 1-2')).toBe(false);
      expect(isTotalsLabel('بررسی گزارش ماه جاری')).toBe(false);
    });
    it('«جمع کل» Totals است', () => {
      expect(isTotalsLabel('جمع کل')).toBe(true);
      expect(isStrongTotalsLabel('جمع کل')).toBe(true);
    });
    it('«مجموع دوره» Totals است', () => {
      expect(isTotalsLabel('مجموع دوره')).toBe(true);
    });
    it('exact روز/ماه Totals هستند', () => {
      expect(isTotalsLabel('روز')).toBe(true);
      expect(isTotalsLabel('ماه')).toBe(true);
    });
    it('total / grand total', () => {
      expect(isTotalsLabel('total')).toBe(true);
      expect(isTotalsLabel('Grand Total')).toBe(true);
    });
  });

  describe('detectAndScalePercents', () => {
    it('0 → 0', () => {
      expect(detectAndScalePercents([0]).values).toEqual([0]);
    });
    it('0.25 → 25 و 1 → 100', () => {
      const r = detectAndScalePercents([0.25, 1, null]);
      expect(r.scale).toBe('fraction');
      expect(r.values).toEqual([25, 100, null]);
    });
    it('0..100 بدون تغییر', () => {
      const r = detectAndScalePercents([0, 25, 100]);
      expect(r.scale).toBe('percent');
      expect(r.values).toEqual([0, 25, 100]);
    });
    it('مقیاس مخلوط تشخیص داده می‌شود', () => {
      const r = detectAndScalePercents([0.5, 75]);
      expect(r.scale).toBe('mixed');
      expect(r.values).toEqual([0.5, 75]);
    });
    it('null جدا می‌ماند', () => {
      expect(detectAndScalePercents([null, null]).scale).toBe('empty');
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
    it('صفر بودجه حفظ می‌شود', () => {
      expect(parseBudgetToman(0)).toBe(0);
      expect(parseBudgetToman('0')).toBe(0);
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
