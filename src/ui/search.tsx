import { TextInput } from 'react-native';

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
    <TextInput
      className="h-12 rounded-lg border border-border bg-surface px-4 text-[16px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
      placeholder={placeholder}
      placeholderTextColor="#A8AD9E"
      value={value}
      onChangeText={onChange}
      autoCorrect={false}
    />
  );
}
