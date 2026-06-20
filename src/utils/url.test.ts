import {buildSchedulerWsUrl, joinApiPath, normalizeServerConfig} from './url';

describe('normalizeServerConfig', () => {
  test('adds http protocol when the user enters host only', () => {
    const config = normalizeServerConfig('192.168.1.10:9090', '2026-06-19T00:00:00.000Z');

    expect(config).toEqual({
      rawUrl: '192.168.1.10:9090',
      origin: 'http://192.168.1.10:9090',
      apiBaseUrl: 'http://192.168.1.10:9090/api',
      wsBaseUrl: 'ws://192.168.1.10:9090/ws',
      lastVerifiedAt: '2026-06-19T00:00:00.000Z',
    });
  });

  test('uses wss for https servers', () => {
    const config = normalizeServerConfig('https://db.example.test/');

    expect(config.apiBaseUrl).toBe('https://db.example.test/api');
    expect(config.wsBaseUrl).toBe('wss://db.example.test/ws');
  });

  test('rejects unsupported protocols', () => {
    expect(() => normalizeServerConfig('ftp://example.test')).toThrow('仅支持 HTTP 或 HTTPS 地址');
  });
});

describe('URL helpers', () => {
  test('joins api paths with one slash', () => {
    expect(joinApiPath('https://db.example.test/api/', '/health')).toBe(
      'https://db.example.test/api/health',
    );
  });

  test('builds scheduler websocket endpoint', () => {
    expect(buildSchedulerWsUrl('wss://db.example.test/ws/')).toBe(
      'wss://db.example.test/ws/scheduler/status',
    );
  });
});

