import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Video from 'react-native-video';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Card, Screen, useAppColors} from '../components/ui';
import type {RootStackParamList} from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

export function PlayerScreen({route}: Props) {
  const colors = useAppColors();
  const {streamUrl, title, code} = route.params;

  return (
    <Screen>
      <Card title={title || code}>
        {streamUrl ? (
          <View style={styles.playerFrame}>
            <Video
              source={{uri: streamUrl}}
              style={styles.video}
              controls
              resizeMode="contain"
              paused={false}
            />
          </View>
        ) : (
          <Text style={{color: colors.mutedText}}>没有可播放地址</Text>
        )}
      </Card>
      <Card title="地址">
        <Text style={{color: colors.mutedText}}>{streamUrl}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  playerFrame: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: {
    height: '100%',
    width: '100%',
  },
});

