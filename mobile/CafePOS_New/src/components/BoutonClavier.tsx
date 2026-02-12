import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface BoutonClavierProps {
  texte: string | number;
  auClic: () => void;
  styleSpecial?: StyleProp<ViewStyle>;
}

export default function BoutonClavier({ texte, auClic, styleSpecial }: BoutonClavierProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <TouchableOpacity style={[styles.btn, styleSpecial]} onPress={auClic} activeOpacity={0.7}>
      <Text style={styles.btnText}>{texte}</Text>
    </TouchableOpacity>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    btn: {
      width: '28%',
      aspectRatio: 1,
      backgroundColor: theme.bgSurface2,
      margin: 8,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    btnText: { color: theme.textMain, fontSize: 28, fontWeight: 'bold' },
  });
