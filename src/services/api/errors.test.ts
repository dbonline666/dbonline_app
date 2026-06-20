import {AxiosError, AxiosHeaders} from 'axios';
import {isLocalOnlyAccessError, normalizeApiError} from './errors';

describe('isLocalOnlyAccessError', () => {
  test('detects local-only response header', () => {
    expect(
      isLocalOnlyAccessError(
        403,
        {'x-access-restriction': 'local-only'},
        {error: 'forbidden'},
      ),
    ).toBe(true);
  });

  test('detects local-only response body', () => {
    expect(isLocalOnlyAccessError(403, {}, {error: '仅允许内网访问'})).toBe(true);
  });

  test('ignores non-403 responses', () => {
    expect(isLocalOnlyAccessError(401, {'x-access-restriction': 'local-only'}, {})).toBe(false);
  });
});

describe('normalizeApiError', () => {
  test('normalizes axios response error', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      {
        data: {error: '未授权访问，请先登录'},
        status: 401,
        statusText: 'Unauthorized',
        headers: new AxiosHeaders(),
        config: {headers: new AxiosHeaders()},
      },
    );

    expect(normalizeApiError(error)).toEqual({
      status: 401,
      message: '未授权访问，请先登录',
      accessRestriction: null,
      retryable: false,
    });
  });

  test('marks network failures retryable', () => {
    const result = normalizeApiError(new Error('Network Error'));

    expect(result.status).toBeNull();
    expect(result.retryable).toBe(true);
  });
});

