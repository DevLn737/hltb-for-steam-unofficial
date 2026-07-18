import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  condition: { requestMethods?: string[]; urlFilter?: string };
  action: { requestHeaders?: Array<{ header: string; value?: string }> };
}

describe('HLTB request header rules', () => {
  const rules = JSON.parse(readFileSync('public/rules/hltb-headers.json', 'utf8')) as HeaderRule[];

  it('does not synthesize an Origin header for the initialization GET', () => {
    const init = rules.find((rule) => rule.condition.requestMethods?.includes('get'));
    expect(init?.condition.urlFilter).toContain('/api/bleed/init');
    expect(init?.action.requestHeaders?.map((header) => header.header)).toEqual(['Referer']);
  });

  it('uses same-site Origin and Referer only for the search POST', () => {
    const search = rules.find((rule) => rule.condition.requestMethods?.includes('post'));
    expect(search?.condition.urlFilter).toContain('/api/bleed');
    expect(search?.action.requestHeaders).toEqual(expect.arrayContaining([
      { header: 'Origin', operation: 'set', value: 'https://howlongtobeat.com' },
      { header: 'Referer', operation: 'set', value: 'https://howlongtobeat.com/' },
    ]));
  });
});
