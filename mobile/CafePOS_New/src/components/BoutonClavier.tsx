import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface BoutonClavierProps {
  texte: string | number;
  auClic: () => void;
  styleSpecial?: StyleProp<ViewStyle>;
}

export default function BoutonClavier({ texte, auClic, styleSpecial }: BoutonClavierProps) {
  return (
    <TouchableOpacity style={[styles.btn, styleSpecial]} onPress={auClic} activeOpacity={0.7}>
      <Text style={styles.btnText}>{texte}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '28%',
    aspectRatio: 1,
    backgroundColor: '#2C2C2E',
    margin: 8,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  btnText: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
});
