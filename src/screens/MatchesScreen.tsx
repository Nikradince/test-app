import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FavoriteButton } from '../components/FavoriteButton';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { MATCHES_URL } from '../config';
import { useFavorites } from '../hooks/useFavorites';
import { filterMatches, formatStart, Match, MatchFilter, MatchesResponse, parseMatches, statusLabel } from '../matches';

const filters: { value: MatchFilter; label: string }[] = [
  { value: 'all', label: 'Все' }, { value: 'upcoming', label: 'Предстоящие' },
  { value: 'finished', label: 'Завершённые' },
];

export function MatchesScreen() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<MatchFilter>('all');
  const request = useRef<AbortController | null>(null);
  const { favorites, isFavorite, toggle } = useFavorites();

  async function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(MATCHES_URL, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Сервер вернул HTTP ${response.status}`);
      const result = parseMatches(await response.json());
      if (request.current !== controller) return;
      setData(result);
      setUpdatedAt(new Date());
    } catch (cause) {
      if (request.current !== controller) return;
      setError(controller.signal.aborted
        ? 'Сервер не ответил за 15 секунд.'
        : cause instanceof Error ? cause.message : 'Не удалось загрузить матчи.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();
    return () => {
      const active = request.current;
      request.current = null;
      active?.abort();
    };
  }, []);

  function renderMatch({ item }: { item: Match }) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.status, item.status === 'live' && styles.live]}>{statusLabel(item)}</Text>
          <FavoriteButton active={isFavorite(item.id)} onPress={() => toggle(item.id)} />
        </View>
        <View style={styles.row}>
          <View style={styles.teams}>
            <Text style={styles.team}>{item.home.name}</Text>
            <Text style={styles.team}>{item.away.name}</Text>
          </View>
          <Text style={styles.score}>{item.score != null ? `${item.score.home} : ${item.score.away}` : '—'}</Text>
        </View>
        <Text style={styles.date}>{formatStart(item.startsAt)}</Text>
      </View>
    );
  }

  const visible = filterMatches(data?.matches ?? [], filter);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Матчи тура{data ? ` · ${data.round}` : ''}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading }} disabled={loading} onPress={() => void load()} style={[styles.button, loading && styles.disabled]}>
          <Text style={styles.buttonText}>{loading ? 'Загрузка…' : 'Обновить'}</Text>
        </Pressable>
      </View>
      {updatedAt && <UpdatedAgo since={updatedAt} />}
      <Text style={styles.hint}>Время начала — в часовом поясе устройства</Text>
      <View style={styles.filters}>
        {filters.map(({ value, label }) => (
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.selected]}>
            <Text style={[styles.filterText, filter === value && styles.selectedText]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {error && <View accessibilityRole="alert" style={styles.error}>
        <Text>{data ? 'Не удалось обновить. Показаны последние загруженные данные.' : 'Не удалось загрузить матчи.'}</Text>
        <Text style={styles.date}>{error}</Text>
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={styles.button}>
          <Text style={styles.buttonText}>Повторить</Text>
        </Pressable>
      </View>}
      {loading && <ActivityIndicator accessibilityLabel="Загрузка матчей" style={styles.spinner} color="#2457d6" />}
      {data && <FlatList data={visible} extraData={favorites} keyExtractor={(item) => item.id} renderItem={renderMatch}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{data.matches.length === 0 ? 'Матчей пока нет.' : 'В этой категории матчей нет.'}</Text>} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: '700', color: '#182337' },
  button: { backgroundColor: '#2457d6', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.6 },
  hint: { color: '#687386', fontSize: 12, marginTop: 6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 18 },
  filter: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, backgroundColor: '#edf1f7' },
  selected: { backgroundColor: '#182337' },
  filterText: { color: '#344054' },
  selectedText: { color: '#fff' },
  list: { paddingBottom: 24, gap: 12 },
  card: { borderWidth: 1, borderColor: '#e1e7ef', borderRadius: 12, padding: 16, gap: 12, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  teams: { flex: 1, gap: 8 },
  team: { fontSize: 17, fontWeight: '600', color: '#182337' },
  score: { fontSize: 23, fontWeight: '700', color: '#182337' },
  status: { fontSize: 13, color: '#687386', flexShrink: 1 },
  live: { color: '#c62828' },
  date: { fontSize: 13, color: '#687386' },
  error: { backgroundColor: '#fff0ed', borderRadius: 10, padding: 14, gap: 10, marginBottom: 12 },
  spinner: { marginVertical: 16 },
  empty: { paddingVertical: 36, textAlign: 'center', color: '#687386' },
});
