import React, {useState} from 'react';
import {Alert, Text, View} from 'react-native';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Card, Field, PrimaryButton, Screen, TextButton, VideoThumb, useAppColors} from '../components/ui';
import {useAppState} from '../state/AppState';
import {authenticatePasskey} from '../services/passkey';
import type {JsonRecord} from '../types';
import {extractList} from '../services/api/endpoints';
import {absoluteUrl, asRecord, pickString, summarizeRecord} from '../utils/data';

export function LoginScreen() {
  const {api, serverConfig, setSessionToken, t} = useAppState();
  const queryClient = useQueryClient();
  const colors = useAppColors();
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passkeySubmitting, setPasskeySubmitting] = useState(false);
  const covers = useQuery({queryKey: ['login-covers'], queryFn: () => api.getLoginCovers(12)});
  const coverItems = extractList(covers.data).slice(0, 4);

  const login = async () => {
    setSubmitting(true);
    try {
      const result = await api.authLogin({
        password,
        ...(totp.trim() ? {totp_code: totp.trim()} : {}),
      });
      if (!result.token) {
        throw new Error('登录响应缺少 token');
      }
      await setSessionToken(result.token);
      await queryClient.invalidateQueries();
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败';
      Alert.alert('登录失败', message);
    } finally {
      setSubmitting(false);
    }
  };

  const passkeyLogin = async () => {
    setPasskeySubmitting(true);
    try {
      const begin = await api.authWebAuthnLoginBegin();
      const beginRecord = asRecord(begin);
      const beginData = asRecord(beginRecord.data);
      const sessionId =
        pickString(beginRecord, ['session_id', 'sessionId']) ||
        pickString(beginData, ['session_id', 'sessionId']);
      const publicKeyFromRoot = asRecord(beginRecord.publicKey);
      const publicKeyFromData = asRecord(beginData.publicKey);
      const optionsFromRoot = asRecord(beginRecord.options);
      const optionsFromData = asRecord(beginData.options);
      const publicKey = publicKeyFromRoot.challenge
        ? publicKeyFromRoot
        : publicKeyFromData.challenge
          ? publicKeyFromData
          : Object.keys(optionsFromRoot).length
            ? optionsFromRoot
            : optionsFromData;

      if (!sessionId || !Object.keys(publicKey).length) {
        Alert.alert('Passkey 不可用', `后端未返回可用的 Passkey 登录参数。\n${summarizeRecord(begin)}`);
        return;
      }

      const credential = await authenticatePasskey(publicKey as JsonRecord);
      const finished = await api.authWebAuthnLoginFinish(sessionId, credential);
      const finishedRecord = asRecord(finished);
      const token =
        pickString(finishedRecord, ['token']) ||
        pickString(asRecord(finishedRecord.data), ['token']);
      if (!token) {
        throw new Error('Passkey 登录响应缺少 token');
      }
      await setSessionToken(token);
      await queryClient.invalidateQueries();
    } catch (error) {
      Alert.alert('Passkey 不可用', error instanceof Error ? error.message : t('passkeyUnavailable'));
    } finally {
      setPasskeySubmitting(false);
    }
  };

  return (
    <Screen>
      {coverItems.length ? (
        <Card title="登录封面">
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
            {coverItems.map((item, index) => {
              const record = asRecord(item);
              const uri = absoluteUrl(serverConfig, pickString(record, ['cover', 'cover_url', 'image', 'url']));
              return <VideoThumb key={String(record.id || record.code || index)} uri={uri} />;
            })}
          </View>
        </Card>
      ) : null}
      <Card title={t('login')}>
        <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry />
        <Field label={t('totp')} value={totp} onChangeText={setTotp} keyboardType="number-pad" />
        <PrimaryButton
          label={submitting ? '登录中' : t('loginWithPassword')}
          onPress={login}
          disabled={submitting || !password.trim()}
        />
        <View style={{alignItems: 'center'}}>
          <TextButton label={passkeySubmitting ? 'Passkey 检查中' : '使用 Passkey'} onPress={passkeyLogin} />
        </View>
        <Text style={{color: colors.mutedText, lineHeight: 20}}>
          Passkey 桥接保留为原生扩展点；当前不会阻塞密码和 TOTP 登录。
        </Text>
      </Card>
    </Screen>
  );
}
