import { TextInput } from 'react-native';

/**
 * La recherche, partout pareille : un champ, et une comparaison qui ignore
 * casse et accents -- « ischio » doit trouver « Ischio-jambiers », sans quoi
 * il faut connaître l'orthographe exacte de ce qu'on cherche.
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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
