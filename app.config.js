export default {
  expo: {
    name: process.env.APP_ENV === 'production' ? 'Hercule' : 'Hercule (DEV)',
    slug: "fitnessChronicle",
    version: "1.0.0",
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
        ITSAppUsesNonExemptEncryption: false
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