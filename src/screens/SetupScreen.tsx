import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {useQuery} from '@tanstack/react-query';
import {
  Badge,
  Card,
  ErrorState,
  Field,
  KeyValueRow,
  LoadingState,
  PrimaryButton,
  Screen,
  SegmentedControl,
  TextButton,
  useAppColors,
} from '../components/ui';
import {useAppState} from '../state/AppState';
import {radius, spacing} from '../theme';
import type {JsonRecord} from '../types';
import {asRecord, pickString, summarizeRecord} from '../utils/data';

type SetupStep = 'connection' | 'database' | 'finish';
type SslMode = 'disable' | 'allow' | 'prefer' | 'require';

const databaseList = (payload: unknown) => {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const list = record.databases || data.databases || record.items || data.items;
  return Array.isArray(list) ? list.map(item => asRecord(item)) : [];
};

const statusCurrent = (payload: unknown) => {
  const record = asRecord(payload);
  return asRecord(record.current || asRecord(record.data).current);
};

const statusBool = (payload: unknown, key: string) => {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  return record[key] === true || data[key] === true;
};

export function SetupScreen() {
  const {api} = useAppState();
  const colors = useAppColors();
  const [step, setStep] = useState<SetupStep>('connection');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [sslmode, setSslmode] = useState<SslMode>('disable');
  const [testPassed, setTestPassed] = useState(false);
  const [databases, setDatabases] = useState<Record<string, unknown>[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [newDatabaseName, setNewDatabaseName] = useState('');
  const [busy, setBusy] = useState('');
  const [initResult, setInitResult] = useState<Record<string, unknown> | null>(null);

  const statusQuery = useQuery({queryKey: ['setup-status'], queryFn: api.setupStatus});
  const current = useMemo(() => statusCurrent(statusQuery.data), [statusQuery.data]);
  const assistantAvailable = statusBool(statusQuery.data, 'available');
  const canRestart = statusBool(statusQuery.data, 'can_restart') || initResult?.can_restart === true;

  useEffect(() => {
    if (!Object.keys(current).length) {
      return;
    }
    setHost(previous => pickString(current, ['host']) || previous);
    setPort(previous => String(current.port || previous));
    setUser(previous => pickString(current, ['user']) || previous);
    setSslmode(previous => (pickString(current, ['sslmode']) as SslMode) || previous);
    setSelectedDatabase(pickString(current, ['dbname']));
  }, [current]);

  const payload = (): JsonRecord => ({
    host: host.trim(),
    port: Number(port) || 0,
    user: user.trim(),
    password,
    sslmode,
  });

  const testConnection = async () => {
    setBusy('test');
    setTestPassed(false);
    try {
      const result = await api.setupTestConnection(payload());
      setTestPassed(true);
      Alert.alert('连接成功', summarizeRecord(result));
    } catch (error) {
      Alert.alert('连接失败', error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy('');
    }
  };

  const loadDatabases = async () => {
    setBusy('databases');
    try {
      const result = await api.setupListDatabases(payload());
      const nextDatabases = databaseList(result);
      setDatabases(nextDatabases);
      setStep('database');
    } catch (error) {
      setDatabases([]);
      Alert.alert('获取数据库失败', error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy('');
    }
  };

  const createDatabase = async () => {
    const name = newDatabaseName.trim();
    if (!name) {
      Alert.alert('创建数据库', '请输入数据库名');
      return;
    }
    setBusy('create');
    try {
      await api.setupCreateDatabase({...payload(), name});
      setSelectedDatabase(name);
      setNewDatabaseName('');
      await loadDatabases();
      Alert.alert('创建成功', `已创建数据库 ${name}`);
    } catch (error) {
      Alert.alert('创建失败', error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy('');
    }
  };

  const initialize = async () => {
    if (!selectedDatabase) {
      Alert.alert('初始化', '请选择数据库');
      return;
    }
    setBusy('initialize');
    try {
      const result = await api.setupInitialize({...payload(), dbname: selectedDatabase});
      setInitResult(asRecord(result));
      setStep('finish');
      await statusQuery.refetch();
    } catch (error) {
      Alert.alert('初始化失败', error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy('');
    }
  };

  const restart = async () => {
    setBusy('restart');
    try {
      await api.setupRestart();
      Alert.alert('重启请求已提交', '请稍后重新连接后端服务');
    } catch (error) {
      Alert.alert('请求重启失败', error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy('');
    }
  };

  if (statusQuery.isLoading) {
    return <LoadingState />;
  }

  if (statusQuery.error) {
    return <ErrorState message={(statusQuery.error as Error).message} onRetry={() => statusQuery.refetch()} />;
  }

  return (
    <Screen>
      <Card title="数据库初始化助手">
        <Text style={{color: colors.mutedText, lineHeight: 22}}>
          当后端无法连接数据库时，可在 iOS App 中填写连接信息、创建数据库并执行初始化。
        </Text>
        <View style={styles.stepRow}>
          <Badge label="1 连接信息" tone={step === 'connection' ? 'success' : 'neutral'} />
          <Badge label="2 选择数据库" tone={step === 'database' ? 'success' : 'neutral'} />
          <Badge label="3 初始化" tone={step === 'finish' ? 'success' : 'neutral'} />
        </View>
        <KeyValueRow label="助手状态" value={assistantAvailable ? '可用' : '数据库已连接或助手未开放'} />
        {pickString(current, ['dbname']) ? <KeyValueRow label="当前数据库" value={pickString(current, ['dbname'])} /> : null}
      </Card>

      {step === 'connection' ? (
        <Card title="连接信息">
          <Field label="主机地址" value={host} onChangeText={setHost} placeholder="127.0.0.1 或 postgres" />
          <Field label="端口" value={port} onChangeText={setPort} keyboardType="number-pad" />
          <Field label="用户名" value={user} onChangeText={setUser} placeholder="postgres" />
          <Field label="密码" value={password} onChangeText={setPassword} secureTextEntry />
          <SegmentedControl<SslMode>
            value={sslmode}
            onChange={setSslmode}
            options={[
              {label: 'disable', value: 'disable'},
              {label: 'allow', value: 'allow'},
              {label: 'prefer', value: 'prefer'},
              {label: 'require', value: 'require'},
            ]}
          />
          <PrimaryButton
            label={busy === 'test' ? '测试中' : '测试连接'}
            onPress={testConnection}
            disabled={busy === 'test' || !host.trim() || !user.trim()}
            tone="neutral"
          />
          <PrimaryButton
            label={busy === 'databases' ? '加载数据库' : '下一步：选择数据库'}
            onPress={loadDatabases}
            disabled={busy === 'databases' || !testPassed}
          />
        </Card>
      ) : null}

      {step === 'database' ? (
        <>
          <Card title="选择数据库" action={<TextButton label="刷新" onPress={loadDatabases} />}>
            {!databases.length ? (
              <Text style={{color: colors.mutedText}}>未发现可用数据库，可在下方创建新数据库。</Text>
            ) : null}
            {databases.map(database => {
              const name = pickString(database, ['name']);
              const disabled = database.allow_access === false || database.is_template === true;
              const selected = selectedDatabase === name;
              return (
                <Pressable
                  key={name}
                  disabled={disabled}
                  onPress={() => setSelectedDatabase(name)}
                  style={[
                    styles.databaseRow,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.elevated : colors.surface,
                      opacity: disabled ? 0.45 : 1,
                    },
                  ]}>
                  <Text style={{color: colors.text, fontWeight: '800'}}>{name}</Text>
                  <Text style={{color: colors.mutedText, lineHeight: 20}}>
                    {[
                      database.owner ? `Owner: ${database.owner}` : '',
                      database.encoding ? `编码: ${database.encoding}` : '',
                      database.has_schema ? '已部署 schema' : '',
                      disabled ? '不可选' : '',
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              );
            })}
          </Card>

          <Card title="创建数据库">
            <Field label="数据库名" value={newDatabaseName} onChangeText={setNewDatabaseName} placeholder="db_online" />
            <PrimaryButton
              label={busy === 'create' ? '创建中' : '创建数据库'}
              onPress={createDatabase}
              disabled={busy === 'create'}
              tone="neutral"
            />
          </Card>

          <View style={styles.actionRow}>
            <PrimaryButton label="上一步" onPress={() => setStep('connection')} tone="neutral" />
            <PrimaryButton
              label={busy === 'initialize' ? '初始化中' : '初始化所选数据库'}
              onPress={initialize}
              disabled={busy === 'initialize' || !selectedDatabase}
            />
          </View>
        </>
      ) : null}

      {step === 'finish' ? (
        <Card title="初始化完成">
          <Text style={{color: colors.text, lineHeight: 22}}>{summarizeRecord(initResult)}</Text>
          <PrimaryButton
            label={busy === 'restart' ? '请求重启中' : '立即重启程序'}
            onPress={restart}
            disabled={busy === 'restart' || !canRestart}
          />
          {!canRestart ? (
            <Text style={{color: colors.warning, lineHeight: 22}}>
              当前部署未提供重启回调，请通过容器管理器或手动重启进程。
            </Text>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  databaseRow: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    padding: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
