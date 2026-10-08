import { useState } from 'react';
import { View } from 'react-native';
import { LottieView } from './lottie';

const CONFETTI = require('../../assets/lottie/confetti.json');

/**
 * Des confettis sur toute la page, une seule fois, à la fin d'une séance
 * (fournis par Daniel le 2026-10-08).
 *
 * Par-dessus le bilan sans rien en cacher pour de bon : ils ne reçoivent
 * aucun toucher, et disparaissent une fois retombés. Sans lecteur
 * d'animation, il n'y a rien à montrer -- le bilan suffit.
 */
export function Confetti() {
  const [done, setDone] = useState(false);
  if (!LottieView || done) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <LottieView
        source={CONFETTI}
        autoPlay
        loop={false}
        resizeMode="cover"
        style={{ flex: 1 }}
        onAnimationFinish={() => setDone(true)}
      />
    </View>
  );
}
