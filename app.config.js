export default {
  expo: {
    name: process.env.APP_ENV === 'production' ? 'Hercule' : 'Hercule (DEV)',
    slug: "fitnessChronicle",
    version: "1.1.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "fitnesschronicle",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.APP_ENV === 'production' ? "com.siar.konyar.fitnessChronicle" : "com.siar.konyar.fitnessChronicle-dev",
      usesAppleSignIn: true,
      appleTeamId: "TAMQ259Y2Y",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // Analytics starts OFF and is switched on by useAnalyticsConsent only
        // after the user's stored choice has been read. Without this, Firebase
        // collects from launch and an opted-out user is sampled every cold
        // start before anyone has checked whether they agreed.
        //
        // These live here rather than in firebase.json because the react-native
        // block in firebase.json is only wired up on Android (see
        // node_modules/@react-native-firebase/analytics/android/build.gradle:84,101).
        // Nothing on the iOS side reads it, so the same two settings have to be
        // written twice, once per platform.
        //
        // ..._ENABLED, never ..._DEACTIVATED: deactivated is permanent for the
        // build and cannot be turned back on at runtime, which would make the
        // consent toggle do nothing.
        FIREBASE_ANALYTICS_COLLECTION_ENABLED: false,
        // Firebase's own screen tracking reports the native view controller —
        // one container hosting every route in a React Native app. Left on, it
        // would both double-count and file most traffic under a single
        // meaningless name. useScreenTracking sends the real route instead.
        FirebaseAutomaticScreenReportingEnabled: false
      },
      entitlements: {
        "com.apple.developer.applesignin": ["Default"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      package: process.env.APP_ENV === 'production' ? "com.siar.konyar.fitnessChronicle" : "com.siar.konyar.fitnessChronicle_dev",
      googleServicesFile: "./google-services.json"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-firebase/app-check",
      "@react-native-firebase/crashlytics",
      "@react-native-google-signin/google-signin",
      "./plugins/ios/withFmtFix",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#FFFFFF"
        }
      ],
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
            buildReactNativeFromSource: true
          }
        }
      ],
      "expo-web-browser"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "19563d98-f43e-43ca-b916-7575e85af71a"
      }
    }
  }
};