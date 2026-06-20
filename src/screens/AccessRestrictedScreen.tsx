import React from 'react';
import {Text} from 'react-native';
import {Card, PrimaryButton, Screen, useAppColors} from '../components/ui';
import {useAppState} from '../state/AppState';

export function AccessRestrictedScreen() {
  const {clearServer} = useAppState();
  const colors = useAppColors();

  return (
    <Screen>
      <Card title="访问受限">
        <Text style={{color: colors.text, lineHeight: 22}}>
          当前服务处于未启用鉴权或未配置密码的本地访问保护状态，iOS 设备不在允许访问范围内。
        </Text>
        <Text style={{color: colors.mutedText, lineHeight: 22}}>
          请在后端配置鉴权密码，或确保设备处于服务允许的内网环境后重试。
        </Text>
        <PrimaryButton label="重置服务器地址" onPress={clearServer} tone="neutral" />
      </Card>
    </Screen>
  );
}

