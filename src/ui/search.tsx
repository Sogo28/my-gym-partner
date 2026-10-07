import { Ionicons } from '@expo/vector-icons';
import { Pressable, TextInput, View } from 'react-native';
import { usePalette } from './palette';

/** Le champ de recherche, partout pareil. */
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { muted } = usePalette();

  return (
    <View className="h-12 flex-row items-center gap-2 rounded-lg border border-border bg-surface pl-3.5 dark:border-border-dark dark:bg-surface-dark">
      {/* La loupe dit ce que fait le champ avant qu'on y ait rien tapé. */}
      <Ionicons name="search" size={18} color={muted} />
      <TextInput
        className="flex-1 text-strong text-ink dark:text-ink-dark"
        placeholder={placeholder}
        placeholderTextColor="#A8AD9E"
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
      />

      {/* Effacer d'un geste : vider une recherche caractère par caractère est
          la façon la plus sûre de renoncer à en lancer une autre. */}
      {value.length > 0 && (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={8}
          className="h-12 w-12 items-center justify-center"
        >
          <Ionicons name="close-circle" size={18} color={muted} />
        </Pressable>
      )}
    </View>
  );
}
