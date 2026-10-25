import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import AppSplashScreen from './src/components/native/AppSplashScreen';
import NativeUserApp from './src/components/native/NativeUserApp';

/**
 * MobileRootEntryPoint
 * 100% Pure React Native Application Entry Point
 * Redirects the app's startup to load the new React Native Splash Screen component directly.
 */
function MobileRootEntryPoint() {
  const [splashFinished, setSplashFinished] = useState(false);

  return (
    <>
      <NativeUserApp />
      {!splashFinished && (
        <AppSplashScreen
          onAnimationEnd={() => setSplashFinished(true)}
        />
      )}
    </>
  );
}

registerRootComponent(MobileRootEntryPoint);

export default MobileRootEntryPoint;
