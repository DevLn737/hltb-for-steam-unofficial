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
    expect(init?.action.requestHeaders?.map((header) => header.header)).toEqual(['Referer', 'User-Agent']);
  });

  it('uses same-site Origin and Referer only for the search POST', () => {
    const search = rules.find((rule) => rule.condition.requestMethods?.includes('post'));
    expect(search?.condition.urlFilter).toContain('/api/bleed');
    expect(search?.action.requestHeaders).toEqual(expect.arrayContaining([
      { header: 'Origin', operation: 'set', value: 'https://howlongtobeat.com' },
      { header: 'Referer', operation: 'set', value: 'https://howlongtobeat.com/' },
    ]));
  });

  it('replaces embedded-client user agents consistently for both HLTB API calls', () => {
    const userAgents = rules.map((rule) => rule.action.requestHeaders
      ?.find((header) => header.header.toLowerCase() === 'user-agent')?.value);

    expect(userAgents[0]).toBe(userAgents[1]);
    expect(userAgents[0]).toMatch(/Chrome\/\d+/);
    expect(userAgents[0]).not.toMatch(/Steam|Headless/i);
  });
});
