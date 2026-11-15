import * as dgram from 'dgram';
import * as os from 'os';
import { getLocalNetworkIps, testServerConnection } from './network-utils';

export const LAN_DISCOVERY_PORT = 41234;

export interface DiscoveredServer {
  name: string;
  url: string;
  ip: string;
  port: number;
  latencyMs: number;
}

interface DiscoveryProbePayload {
  type: 'EDUCENTER_DISCOVER';
  version: 1;
}

interface DiscoveryReplyPayload {
  type: 'EDUCENTER_SERVER_HERE';
  hostname: string;
  port: number;
  ips: string[];
}

export function isDiscoveryProbePacket(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Partial<DiscoveryProbePayload>;
    return parsed?.type === 'EDUCENTER_DISCOVER';
  } catch {
    return false;
  }
}

export function parseDiscoveryReplyPacket(raw: string): DiscoveryReplyPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DiscoveryReplyPayload>;
    if (
      parsed?.type === 'EDUCENTER_SERVER_HERE' &&
      typeof parsed.hostname === 'string' &&
      typeof parsed.port === 'number' &&
      Array.isArray(parsed.ips)
    ) {
      return {
        type: 'EDUCENTER_SERVER_HERE',
        hostname: parsed.hostname,
        port: parsed.port,
        ips: parsed.ips.filter((ip): ip is string => typeof ip === 'string' && ip.length > 0),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Starts a lightweight UDP responder on LAN port 41234 when running as the center's
 * main Server PC so Client PCs discover it automatically without typing IPs.
 */
export class LanDiscoveryResponder {
  private socket: dgram.Socket | null = null;
  private readonly serverPort: number;

  constructor(serverPort = 4000) {
    this.serverPort = serverPort;
  }

  public start(): void {
    if (this.socket) return;

    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket = sock;

    sock.on('error', (err) => {
      console.warn('[LAN-Discovery] Responder error:', err.message);
      this.stop();
    });

    sock.on('message', (msg, rinfo) => {
      if (!isDiscoveryProbePacket(msg.toString('utf8'))) return;

      const reply: DiscoveryReplyPayload = {
        type: 'EDUCENTER_SERVER_HERE',
        hostname: os.hostname(),
        port: this.serverPort,
        ips: getLocalNetworkIps(),
      };
      const payload = Buffer.from(JSON.stringify(reply), 'utf8');
      sock.send(payload, rinfo.port, rinfo.address, () => undefined);
    });

    try {
      sock.bind(LAN_DISCOVERY_PORT, '0.0.0.0', () => {
        try {
          sock.setBroadcast(true);
        } catch {
          // Ignore if broadcast flag unsupported on adapter
        }
      });
    } catch {
      this.stop();
    }
  }

  public stop(): void {
    if (!this.socket) return;
    try {
      this.socket.close();
    } catch {
      // Ignore already-closed socket
    } finally {
      this.socket = null;
    }
  }
}

function getBroadcastTargets(): string[] {
  const targets = new Set<string>(['255.255.255.255']);
  for (const ip of getLocalNetworkIps()) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      targets.add(`${parts[0]}.${parts[1]}.${parts[2]}.255`);
    }
  }
  return Array.from(targets);
}

/**
 * Broadcasts a UDP discovery probe across the local network, collects any responding
 * EduCenter Server PCs, and verifies live HTTP `/api/health` connectivity before returning.
 */
export async function discoverLanServers(
  timeoutMs = 1800,
  verifyFn = testServerConnection,
): Promise<DiscoveredServer[]> {
  const startTime = Date.now();
  const candidates = new Map<string, { name: string; ip: string; port: number; rtt: number }>();

  await new Promise<void>((resolve) => {
    const sock = dgram.createSocket('udp4');
    let settled = false;

    const done = () => {
      if (settled) return;
      settled = true;
      try {
        sock.close();
      } catch {
        // Ignore close errors
      }
      resolve();
    };

    const timer = setTimeout(done, timeoutMs);

    sock.on('error', () => {
      clearTimeout(timer);
      done();
    });

    sock.on('message', (msg, rinfo) => {
      const reply = parseDiscoveryReplyPacket(msg.toString('utf8'));
      if (!reply) return;

      const rtt = Math.max(1, Date.now() - startTime);
      const candidateIps = reply.ips.length > 0 ? reply.ips : [rinfo.address];
      for (const ip of candidateIps) {
        if (ip === '127.0.0.1') continue;
        const url = `http://${ip}:${reply.port}`;
        if (!candidates.has(url)) {
          candidates.set(url, {
            name: reply.hostname,
            ip,
            port: reply.port,
            rtt,
          });
        }
      }
    });

    sock.bind(0, () => {
      try {
        sock.setBroadcast(true);
        const probe = Buffer.from(
          JSON.stringify({ type: 'EDUCENTER_DISCOVER', version: 1 }),
          'utf8',
        );
        for (const target of getBroadcastTargets()) {
          sock.send(probe, LAN_DISCOVERY_PORT, target, () => undefined);
        }
      } catch {
        clearTimeout(timer);
        done();
      }
    });
  });

  const verified: DiscoveredServer[] = [];
  await Promise.all(
    Array.from(candidates.entries()).map(async ([url, meta]) => {
      const check = await verifyFn(url, 1500);
      if (check.ok) {
        verified.push({
          name: meta.name,
          url,
          ip: meta.ip,
          port: meta.port,
          latencyMs: meta.rtt,
        });
      }
    }),
  );

  return verified.sort((a, b) => a.latencyMs - b.latencyMs);
}
