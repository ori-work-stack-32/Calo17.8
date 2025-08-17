import { SplashScreen, Stack } from "expo-router";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/src/store";
import { StatusBar } from "expo-status-bar";
import {
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/src/context/ThemeContext";
import { useRouter, useSegments } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { queryClient } from "@/src/providers/QueryProvider";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "@/src/i18n"; // Initialize i18n
import { LanguageProvider } from "@/src/i18n/context/LanguageContext";
import { useFonts } from "expo-font";
import "react-native-reanimated";
import { I18nextProvider } from "react-i18next";
import i18n from "@/src/i18n";
import LanguageToolbar from "@/components/ToolBar";
import { NotificationService } from "@/src/services/notifications";
import React from "react";
import FloatingChatButton from "@/components/FloatingChatButton";
import { I18nManager } from "react-native";
import { useOptimizedAuthSelector } from "@/hooks/useOptimizedSelector";
import { ErrorHandler } from "@/src/utils/errorHandler";
import { useTranslation } from "react-i18next";

// Enable RTL support globally
if (Platform.OS !== "web") {
  I18nManager.allowRTL(true);
}

SplashScreen.preventAutoHideAsync();

// Update the navigation state logic with proper memoization
function useNavigationState(
  user: any,
  isAuthenticated: boolean,
  segments: string[]
) {
  return useMemo(() => {
    const currentPath = segments?.[0] || "";
    const inAuthGroup = currentPath === "(auth)";
    const inTabsGroup = currentPath === "(tabs)";
    const onPaymentPlan = currentPath === "payment-plan";
    const onPayment = currentPath === "payment";
    const onQuestionnaire = inTabsGroup && segments?.[1] === "questionnaire";
    const onEmailVerification =
      inAuthGroup && segments?.[1] === "email-verification";

    const currentRoute = "/" + segments.join("/");

    let targetRoute: string | null = null;

    if (!isAuthenticated || !user) {
      if (!inAuthGroup) {
        targetRoute = "/(auth)/signin";
      }
    } else if (user && !user.email_verified && !onEmailVerification) {
      targetRoute = "/(auth)/email-verification";
    } else if (
      user?.subscription_type === "FREE" &&
      !onPaymentPlan &&
      !onPayment
    ) {
      targetRoute = "/payment-plan";
    } else if (!user?.is_questionnaire_completed && !onQuestionnaire) {
      targetRoute = "/(tabs)/questionnaire";
    } else if (
      !inTabsGroup &&
      isAuthenticated &&
      user?.email_verified &&
      user?.subscription_type &&
      !onPayment &&
      !onPaymentPlan &&
      !onQuestionnaire
    ) {
      targetRoute = "/(tabs)";
    }

    return {
      targetRoute,
      currentRoute,
      shouldNavigate: targetRoute !== null && targetRoute !== currentRoute,
    };
  }, [
    user?.email_verified,
    user?.subscription_type,
    user?.is_questionnaire_completed,
    user?.email,
    isAuthenticated,
    segments?.join("/") || "",
  ]);
}

function useNavigationManager(
  targetRoute: string | null,
  currentRoute: string,
  shouldNavigate: boolean,
  loaded: boolean
) {
  const router = useRouter();
  const lastNavigationRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);
  const segments = useSegments();

  useEffect(() => {
    if (!loaded || !shouldNavigate || !targetRoute || isNavigatingRef.current) {
      return;
    }

    const currentPath = segments?.[0] || "";
    const currentFullPath = "/" + segments.join("/");

    if (
      currentPath === "payment" ||
      currentPath === "payment-plan" ||
      currentPath === "questionnaire" ||
      currentFullPath.includes("questionnaire") ||
      currentPath === "menu"
    ) {
      return;
    }

    if (lastNavigationRef.current === targetRoute) {
      return;
    }

    isNavigatingRef.current = true;
    lastNavigationRef.current = targetRoute;

    router.replace(targetRoute as any);

    const resetTimeout = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 100);

    return () => {
      clearTimeout(resetTimeout);
    };
  }, [loaded, shouldNavigate, targetRoute, router, segments]);
}

const LoadingScreen = React.memo(() => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#10b981" />
    <Text style={styles.loadingText}>Loading...</Text>
  </View>
));

const StackScreens = React.memo(() => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(auth)" />
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="payment-plan" />
    <Stack.Screen name="payment" />
    <Stack.Screen name="questionnaire" />
    <Stack.Screen name="privacy-policy" />
    <Stack.Screen name="menu/[id]" />
    <Stack.Screen name="+not-found" />
  </Stack>
));

function useHelpContent(): { title: string; description: string } | undefined {
  const segments = useSegments();
  const { t } = useTranslation();

  return useMemo(() => {
    const route = "/" + segments.join("/");
    
    // Ensure we have valid translations
    const safeT = (key: string, fallback: string = key) => {
      try {
        const translation = t(key);
        return translation && translation !== key ? translation : fallback;
      } catch {
        return fallback;
      }
    };

    const helpContentMap: Record<
      string,
      { title: string; description: string }
    > = {
      "/questionnaire": {
        title: safeT("questionnaire.title", "Health Questionnaire"),
        description: safeT("tabs.questionnaire_description", "Complete your health profile to receive personalized nutrition recommendations. This questionnaire helps us understand your goals, lifestyle, and dietary needs."),
      },
      "/(tabs)": {
        title: safeT("tabs.home", "Home"),
        description: safeT("tabs.home_description", "Welcome to your nutrition dashboard! Here you can view your daily progress, recent meals, and quick access to all features."),
      },
      "/(tabs)/index": {
        title: safeT("tabs.home", "Home"),
        description: safeT("tabs.home_description", "Welcome to your nutrition dashboard! Here you can view your daily progress, recent meals, and quick access to all features."),
      },
      "/(tabs)/calendar": {
        title: safeT("tabs.calendar", "Calendar"),
        description: safeT("tabs.calendar_description", "Plan your meals for the week ahead. View scheduled meals, track your nutrition goals, and see your eating patterns over time."),
      },
      "/(tabs)/statistics": {
        title: safeT("tabs.statistics", "Statistics"),
        description: safeT("tabs.statistics_description", "Track your nutritional progress with detailed charts and metrics. Monitor your intake and view trends."),
      },
      "/(tabs)/camera": {
        title: safeT("tabs.camera", "Camera"),
        description: safeT("tabs.camera_description", "Take photos of your meals to automatically log nutrition information. The AI will analyze your food and provide detailed nutritional breakdown."),
      },
      "/(tabs)/food-scanner": {
        title: safeT("tabs.food_scanner", "Food Scanner"),
        description: safeT("tabs.food_scanner_description", "Scan barcodes or upload food images to get instant nutrition information. Perfect for packaged foods and restaurant meals."),
      },
      "/(tabs)/ai-chat": {
        title: safeT("tabs.ai_chat", "AI Chat"),
        description: safeT("tabs.ai_chat_description", "Chat with your personal AI nutrition assistant. Ask questions about food, get meal recommendations, and receive personalized advice."),
      },
      "/(tabs)/recommended-menus": {
        title: safeT("tabs.recommended_menus", "Recommended Menus"),
        description: safeT("tabs.recommended_menus_description", "Discover personalized meal plans created just for you. Based on your dietary preferences, goals, and restrictions."),
      },
      "/(tabs)/history": {
        title: safeT("tabs.history", "History"),
        description: safeT("tabs.history_description", "Review your past meals and track your eating patterns. Rate your meals, add notes, and learn from your nutrition journey."),
      },
      "/(tabs)/profile": {
        title: safeT("tabs.profile", "Profile"),
        description: safeT("tabs.profile_description", "Manage your personal information, dietary preferences, and app settings. Update your goals and notification preferences."),
      },
      "/(tabs)/devices": {
        title: safeT("tabs.devices", "Devices"),
        description: safeT("tabs.devices_description", "Connect your fitness trackers and health apps to get a complete picture of your wellness. Sync data from various devices."),
      },
      "/(tabs)/questionnaire": {
        title: safeT("questionnaire.title", "Health Questionnaire"),
        description: safeT("tabs.questionnaire_description", "Complete your health profile to receive personalized nutrition recommendations."),
      },
    };

    return (
      helpContentMap[route] || {
        title: safeT("common.help", "Help"),
        description: safeT("tabs.home_description", "Welcome to your nutrition tracking app! Use the features to monitor your health and nutrition goals."),
      }
    );
  }, [segments, t]);
}

const AppContent = React.memo(() => {
  const authState = useOptimizedAuthSelector();
  const { isAuthenticated = false, user = null } = authState || {};

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const segments = useSegments() as string[];
  const navigationState = useNavigationState(user, isAuthenticated, segments);

  useNavigationManager(
    navigationState.targetRoute,
    navigationState.currentRoute,
    navigationState.shouldNavigate,
    loaded
  );

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      NotificationService.requestPermissions().catch((error) => {
        console.warn("Failed to request notification permissions:", error);
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <StackScreens />;
});

const MainApp = React.memo(() => {
  const helpContent = useHelpContent();
  const authState = useOptimizedAuthSelector();
  const { isAuthenticated = false } = authState || {};

  return (
    <View style={styles.container}>
      <LanguageToolbar helpContent={helpContent} />
      <AppContent />
      {isAuthenticated && <FloatingChatButton />}
    </View>
  );
});

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <Provider store={store}>
            <QueryClientProvider client={queryClient}>
              <PersistGate loading={<LoadingScreen />} persistor={persistor}>
                <ThemeProvider>
                  <LanguageProvider>
                    <MainApp />
                    <StatusBar style="auto" />
                  </LanguageProvider>
                </ThemeProvider>
              </PersistGate>
            </QueryClientProvider>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
});
