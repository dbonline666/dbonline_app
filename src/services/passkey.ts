import {NativeModules} from 'react-native';
import type {JsonRecord} from '../types';

type PasskeyBridge = {
  authenticate?: (options: JsonRecord) => Promise<JsonRecord>;
  register?: (options: JsonRecord) => Promise<JsonRecord>;
};

const nativePasskey = NativeModules.DBOnlinePasskey as PasskeyBridge | undefined;

export const authenticatePasskey = async (options: JsonRecord) => {
  if (!nativePasskey?.authenticate) {
    throw new Error('当前 iOS 构建未启用 Passkey 原生桥，请使用密码或 TOTP 登录。');
  }
  return nativePasskey.authenticate(options);
};

export const registerPasskey = async (options: JsonRecord) => {
  if (!nativePasskey?.register) {
    throw new Error('当前 iOS 构建未启用 Passkey 原生桥。');
  }
  return nativePasskey.register(options);
};
