import { Ionicons } from '@expo/vector-icons';
import { Pressable, TextInput, View } from 'react-native';

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
  return (
    <View className="h-12 flex-row items-center rounded-lg border border-border bg-surface pl-4 dark:border-border-dark dark:bg-surface-dark">
      <TextInput
        className="flex-1 text-[16px] text-ink dark:text-ink-dark"
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
          <Ionicons name="close-circle" size={18} color="#8B9086" />
        </Pressable>
      )}
    </View>
  );
}
