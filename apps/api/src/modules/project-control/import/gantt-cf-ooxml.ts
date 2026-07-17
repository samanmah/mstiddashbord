/**
 * خواندن فقط‌خواندنی قواعد Conditional Formatting از OOXML داخل xlsx.
 * بدون وابستگی خارجی و بدون اجرای فرمول.
 */
import { inflateRawSync } from 'node:zlib';
import {
  isKnownCfFormula,
  semanticForFormula,
  type DiscoveredCfRule,
} from './gantt-cf-evaluator';

function readZipEntry(buffer: Buffer, entryName: string): string | null {
  // Local file header signature 0x04034b50
  let offset = 0;
  while (offset + 30 < buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      // skip to next possible header (central directory etc.)
      const next = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset + 1);
      if (next < 0) break;
      offset = next;
      continue;
    }
    const compression = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (name === entryName) {
      const payload = buffer.subarray(dataStart, dataEnd);
      if (compression === 0) return payload.toString('utf8');
      if (compression === 8) return inflateRawSync(payload).toString('utf8');
      return null;
    }
    offset = dataEnd;
  }
  return null;
}

function parseCfFromSheetXml(xml: string): DiscoveredCfRule[] {
  const rules: DiscoveredCfRule[] = [];
  const cfRe =
    /<conditionalFormatting[^>]*sqref="([^"]+)"[^>]*>([\s\S]*?)<\/conditionalFormatting>/g;
  let m: RegExpExecArray | null;
  while ((m = cfRe.exec(xml)) !== null) {
    const range = m[1]!;
    const body = m[2]!;
    const ruleRe = /<cfRule\b([^>]*)(?:\/>|>([\s\S]*?)<\/cfRule>)/g;
    let rm: RegExpExecArray | null;
    while ((rm = ruleRe.exec(body)) !== null) {
      const attrs = rm[1] ?? '';
      const inner = rm[2] ?? '';
      const type = /type="([^"]+)"/.exec(attrs)?.[1] ?? 'expression';
      const priority = Number(/priority="([^"]+)"/.exec(attrs)?.[1] ?? NaN);
      const stopIfTrue = /stopIfTrue="1"/.test(attrs);
      const dxfId = Number(/dxfId="([^"]+)"/.exec(attrs)?.[1] ?? NaN);
      const formula = /<formula>([^<]*)<\/formula>/.exec(inner)?.[1] ?? null;
      const known =
        type === 'dataBar' || (formula !== null && isKnownCfFormula(formula));
      rules.push({
        type,
        priority: Number.isFinite(priority) ? priority : null,
        stopIfTrue,
        range,
        formula: type === 'dataBar' ? null : formula,
        dxfId: Number.isFinite(dxfId) ? dxfId : null,
        semanticMeaning:
          type === 'dataBar' ? 'PROGRESS' : semanticForFormula(formula),
        known,
      });
    }
  }
  return rules;
}

/**
 * استخراج CF rules از buffer فایل xlsx (sheet1 = گانت در قالب شناخته‌شده).
 */
export async function readGanttConditionalFormattingRules(
  buffer: Buffer,
): Promise<DiscoveredCfRule[]> {
  const xml =
    readZipEntry(buffer, 'xl/worksheets/sheet1.xml') ??
    readZipEntry(buffer, 'xl/worksheets/sheet2.xml');
  if (!xml) return [];
  return parseCfFromSheetXml(xml);
}
