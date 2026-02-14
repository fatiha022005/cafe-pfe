import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type CafeLogoProps = {
  size?: number;
  style?: ViewStyle;
};

export default function CafeLogo({ size = 30, style }: CafeLogoProps) {
  return (
    <View style={[styles.shadowWrap, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="logoGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#f0b37e" />
            <Stop offset="60%" stopColor="#c85c2a" />
            <Stop offset="100%" stopColor="#8b3a1a" />
          </LinearGradient>
          <LinearGradient id="logoHighlight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.7} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="4" y="4" width="40" height="40" rx="12" fill="url(#logoGradient)" />
        <Path d="M16 18h16v9a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-9z" fill="#fff3e7" />
        <Path d="M32 20h3a3 3 0 0 1 0 6h-3" fill="none" stroke="#fff3e7" strokeWidth="2" strokeLinecap="round" />
        <Path d="M18 13c0 2 2 2 2 4" fill="none" stroke="#fff3e7" strokeWidth="2" strokeLinecap="round" />
        <Path d="M24 13c0 2 2 2 2 4" fill="none" stroke="#fff3e7" strokeWidth="2" strokeLinecap="round" />
        <Path d="M30 13c0 2 2 2 2 4" fill="none" stroke="#fff3e7" strokeWidth="2" strokeLinecap="round" />
        <Rect x="6" y="6" width="36" height="36" rx="10" fill="url(#logoHighlight)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: '#c85c2a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
});
