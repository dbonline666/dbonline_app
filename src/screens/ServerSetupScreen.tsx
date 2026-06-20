import React, {useState} from 'react';
import {Alert, Text} from 'react-native';
import axios from 'axios';
import {Card, Field, PrimaryButton, Screen, useAppColors} from '../components/ui';
import {useAppState} from '../state/AppState';
import {normalizeServerConfig} from '../utils/url';

export function ServerSetupScreen() {
  const {setServerUrl, t} = useAppState();
  const colors = useAppColors();
  const [serverUrl, setServerUrlInput] = useState('');
  const [checking, setChecking] = useState(false);

  const connect = async () => {
    setChecking(true);
    try {
      const config = normalizeServerConfig(serverUrl);
      await axios.get(`${config.apiBaseUrl}/health`, {timeout: 8000});
      await setServerUrl(serverUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务器连接失败';
      Alert.alert('连接失败', message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen>
      <Card title={t('serverTitle')}>
        <Text style={{color: colors.mutedText, lineHeight: 22}}>{t('serverSubtitle')}</Text>
        <Field
          label={t('serverUrl')}
          value={serverUrl}
          onChangeText={setServerUrlInput}
          placeholder="http://192.168.1.10:9090"
          keyboardType="url"
        />
        <PrimaryButton label={checking ? '连接中' : t('connect')} onPress={connect} disabled={checking} />
      </Card>
    </Screen>
  );
}

