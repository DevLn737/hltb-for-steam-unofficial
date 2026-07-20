import { describe, expect, it } from 'vitest';
import { extractSteamGamePage, findWidgetPlacement } from '../src/steam/page';

describe('Steam page detection', () => {
  it('prefers the visible Steam title over URL slug and metadata', () => {
    document.head.innerHTML = '<meta property="og:title" content="Metadata title on Steam"><meta property="og:image" content="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3375780/header.jpg">';
    document.body.innerHTML = '<div class="apphub_AppName">Trails in the Sky 1st Chapter</div><main><div class="game_area_purchase"></div></main><aside class="rightcol"></aside>';
    expect(extractSteamGamePage(document, 'https://store.steampowered.com/app/3375780/Wrong_Slug/')).toEqual({
      appId: '3375780', title: 'Trails in the Sky 1st Chapter',
      artworkUrl: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3375780/header.jpg',
    });
    expect(findWidgetPlacement(document)).toEqual({ anchor: document.querySelector('.game_area_purchase'), position: 'before' });
  });

  it('uses the legacy community placement after the app header', () => {
    document.body.innerHTML = '<header><div class="apphub_AppName">Game</div><div class="next"></div></header>';
    expect(findWidgetPlacement(document)).toEqual({ anchor: document.querySelector('.apphub_AppName'), position: 'after' });
  });

  it('falls back to the decoded URL slug', () => {
    expect(extractSteamGamePage(document, 'https://store.steampowered.com/app/10/HalfLife/')).toEqual({ appId: '10', title: 'HalfLife', artworkUrl: null });
  });

  it('ignores non-game pages', () => {
    expect(extractSteamGamePage(document, 'https://store.steampowered.com/search/')).toBeNull();
  });
});
