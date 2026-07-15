import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYLIST_URL, parseM3U } from '../src/playlist';

const samplePlaylist = `#EXTM3U
#EXTINF:0,VTV1 (HD 8Mbps)
#EXTVLCOPT:network-caching=1000
http://192.168.1.7:1234/udp/225.1.2.249:30120
#EXTINF:-1,KIX HD
http://192.168.1.7:1234/udp/225.1.2.144:30120
`;

describe('IPTV playlist parser', () => {
  it('uses the thichcode playlist as the default source', () => {
    expect(DEFAULT_PLAYLIST_URL).toBe(
      'https://raw.githubusercontent.com/thichcode/thichcode/refs/heads/main/filtered_playlist.m3u',
    );
  });

  it('keeps all entries, including channels with option lines before the URL', () => {
    const channels = parseM3U(samplePlaylist);

    expect(channels.map((channel) => channel.name)).toEqual(['VTV1 (HD 8Mbps)', 'KIX HD']);
  });
});
