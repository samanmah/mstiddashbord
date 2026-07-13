import {
  DecisionStatus,
  Probability,
  RiskLevel,
} from '@ppm/contracts';
import {
  mapDecisionStatus,
  mapProbability,
  mapRiskLevel,
} from './excel-parser.service';

describe('Excel Persian enum mapping', () => {
  it('maps Persian probability labels', () => {
    expect(mapProbability('پایین')).toBe(Probability.LOW);
    expect(mapProbability('کم')).toBe(Probability.LOW);
    expect(mapProbability('متوسط')).toBe(Probability.MEDIUM);
    expect(mapProbability('بالا')).toBe(Probability.HIGH);
    expect(mapProbability('زیاد')).toBe(Probability.HIGH);
  });

  it('maps Persian risk-level labels', () => {
    expect(mapRiskLevel('پایین')).toBe(RiskLevel.LOW);
    expect(mapRiskLevel('متوسط')).toBe(RiskLevel.MEDIUM);
    expect(mapRiskLevel('بالا')).toBe(RiskLevel.HIGH);
  });

  it('maps Persian decision-status labels', () => {
    expect(mapDecisionStatus('جدید')).toBe(DecisionStatus.NEW);
    expect(mapDecisionStatus('در حال اجرا')).toBe(DecisionStatus.IN_PROGRESS);
    expect(mapDecisionStatus('در انتظار گزارش')).toBe(
      DecisionStatus.WAITING_FOR_REPORT,
    );
    expect(mapDecisionStatus('انجام شد')).toBe(DecisionStatus.DONE);
    expect(mapDecisionStatus('سایر')).toBe(DecisionStatus.OTHER);
  });

  it('falls back to safe defaults for unknown or empty values', () => {
    expect(mapProbability(null)).toBe(Probability.MEDIUM);
    expect(mapProbability('نامشخص')).toBe(Probability.MEDIUM);
    expect(mapRiskLevel(null)).toBe(RiskLevel.MEDIUM);
    expect(mapDecisionStatus(null)).toBe(DecisionStatus.NEW);
  });
});
