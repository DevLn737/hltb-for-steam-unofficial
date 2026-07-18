import { describe, expect, it } from 'vitest';
import { extractSteamGamePage, findWidgetAnchor } from '../src/steam/page';

describe('Steam page detection', () => {
  it('prefers the visible Steam title over URL slug and metadata', () => {
    document.head.innerHTML = '<meta property="og:title" content="Metadata title on Steam">';
    document.body.innerHTML = '<div class="apphub_AppName">Trails in the Sky 1st Chapter</div><aside class="rightcol"></aside>';
    expect(extractSteamGamePage(document, 'https://store.steampowered.com/app/3375780/Wrong_Slug/')).toEqual({
      appId: '3375780', title: 'Trails in the Sky 1st Chapter',
    });
    expect(findWidgetAnchor(document)).toBe(document.querySelector('.rightcol'));
  });

  it('falls back to the decoded URL slug', () => {
    expect(extractSteamGamePage(document, 'https://store.steampowered.com/app/10/HalfLife/')).toEqual({ appId: '10', title: 'HalfLife' });
  });

  it('ignores non-game pages', () => {
    expect(extractSteamGamePage(document, 'https://store.steampowered.com/search/')).toBeNull();
  });
});

