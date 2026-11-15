import { describe, expect, it } from 'vitest';
import { isDiscoveryProbePacket, parseDiscoveryReplyPacket } from './lan-discovery';

describe('lan-discovery protocol helpers', () => {
  it('validates discovery probe packets cleanly', () => {
    expect(isDiscoveryProbePacket(JSON.stringify({ type: 'EDUCENTER_DISCOVER', version: 1 }))).toBe(
      true,
    );
    expect(isDiscoveryProbePacket('invalid-json')).toBe(false);
    expect(isDiscoveryProbePacket(JSON.stringify({ type: 'OTHER' }))).toBe(false);
  });

  it('parses server announcement packets cleanly', () => {
    const parsed = parseDiscoveryReplyPacket(
      JSON.stringify({
        type: 'EDUCENTER_SERVER_HERE',
        hostname: 'CENTER-MAIN-PC',
        port: 4000,
        ips: ['192.168.1.50'],
      }),
    );

    expect(parsed).toEqual({
      type: 'EDUCENTER_SERVER_HERE',
      hostname: 'CENTER-MAIN-PC',
      port: 4000,
      ips: ['192.168.1.50'],
    });
    expect(parseDiscoveryReplyPacket('bad')).toBeNull();
  });
});
