import { useWindowDimensions } from 'react-native';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const useScale = () => {
  const { width, height } = useWindowDimensions();
  const scale = clamp(width / 375, 0.9, 1.2);
  const verticalScale = clamp(height / 812, 0.9, 1.2);
  const s = (value: number) => Math.round(value * scale);
  const vs = (value: number) => Math.round(value * verticalScale);

  return { width, height, scale, verticalScale, s, vs, isSmall: width < 360 };
};
