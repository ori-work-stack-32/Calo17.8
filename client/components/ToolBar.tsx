import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Settings,
  Globe,
  Sun,
  Moon,
  CircleHelp as HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react-native";
import { useLanguage } from "../src/i18n/context/LanguageContext";
import { useTheme } from "../src/context/ThemeContext";
import { Colors, EmeraldSpectrum } from "@/constants/Colors";

interface HelpContent {
  title: string;
  description: string;
}

interface ToolBarProps {
  helpContent?: HelpContent;
}

const { width: screenWidth } = Dimensions.get("window");
const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const ToolBar: React.FC<ToolBarProps> = ({ helpContent }) => {
  const { language, changeLanguage, isRTL } = useLanguage();
  const { isDark, toggleTheme, colors } = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  // Animation values
  const fabScale = useSharedValue(1);
  const fabRotation = useSharedValue(0);
  const menuOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0);

  // Button positions for radial menu
  const button1Position = useSharedValue({ x: 0, y: 0 });
  const button2Position = useSharedValue({ x: 0, y: 0 });
  const button3Position = useSharedValue({ x: 0, y: 0 });

  const handleToggleMenu = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    // FIXED: Invert the expansion direction logic
    // When toolbar is on the right, expand to the left (negative direction)
    // When toolbar is on the left, expand to the right (positive direction)
    const expandDirection = isRTL ? 1 : -1; // Inverted logic

    if (newExpanded) {
      // Expand animation
      fabRotation.value = withSpring(45, { damping: 15, stiffness: 200 });
      menuOpacity.value = withTiming(1, { duration: 300 });
      backdropOpacity.value = withTiming(0.3, { duration: 300 });

      // Radial positions - properly adjusted for RTL
      button1Position.value = withSpring(
        { x: 80 * expandDirection, y: -10 },
        { damping: 12, stiffness: 180 }
      );
      button2Position.value = withSpring(
        { x: 65 * expandDirection, y: -55 },
        { damping: 12, stiffness: 180 }
      );
      button3Position.value = withSpring(
        { x: 35 * expandDirection, y: -85 },
        { damping: 12, stiffness: 180 }
      );
    } else {
      // Collapse animation
      fabRotation.value = withSpring(0, { damping: 15, stiffness: 200 });
      menuOpacity.value = withTiming(0, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 200 });

      // Reset positions
      button1Position.value = withSpring(
        { x: 0, y: 0 },
        { damping: 15, stiffness: 150 }
      );
      button2Position.value = withSpring(
        { x: 0, y: 0 },
        { damping: 15, stiffness: 150 }
      );
      button3Position.value = withSpring(
        { x: 0, y: 0 },
        { damping: 15, stiffness: 150 }
      );
    }
  }, [
    isExpanded,
    isRTL,
    fabRotation,
    menuOpacity,
    backdropOpacity,
    button1Position,
    button2Position,
    button3Position,
  ]);

  const handleLanguageToggle = useCallback(async () => {
    const newLanguage = language === "he" ? "en" : "he";
    try {
      await changeLanguage(newLanguage);
      handleToggleMenu();
    } catch (error) {
      console.error("Error changing language:", error);
    }
  }, [language, changeLanguage, handleToggleMenu]);

  const handleThemeToggle = useCallback(() => {
    try {
      toggleTheme();
      handleToggleMenu();
    } catch (error) {
      console.error("Error toggling theme:", error);
    }
  }, [toggleTheme, handleToggleMenu]);

  const handleHelpPress = useCallback(() => {
    setShowHelp(true);
    modalScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    handleToggleMenu();
  }, [modalScale, handleToggleMenu]);

  const handleCloseHelp = useCallback(() => {
    modalScale.value = withTiming(0, { duration: 200 });
    setTimeout(() => setShowHelp(false), 200);
  }, [modalScale]);

  // Memoized animated styles
  const fabStyle = useAnimatedStyle(
    () => ({
      transform: [
        { scale: fabScale.value },
        { rotate: `${fabRotation.value}deg` },
      ],
    }),
    []
  );

  const backdropStyle = useAnimatedStyle(
    () => ({
      opacity: backdropOpacity.value,
    }),
    []
  );

  const menuContainerStyle = useAnimatedStyle(
    () => ({
      opacity: menuOpacity.value,
    }),
    []
  );

  const button1Style = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: button1Position.value.x },
        { translateY: button1Position.value.y },
        { scale: interpolate(menuOpacity.value, [0, 1], [0.3, 1]) },
      ],
    }),
    []
  );

  const button2Style = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: button2Position.value.x },
        { translateY: button2Position.value.y },
        { scale: interpolate(menuOpacity.value, [0, 1], [0.3, 1]) },
      ],
    }),
    []
  );

  const button3Style = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: button3Position.value.x },
        { translateY: button3Position.value.y },
        { scale: interpolate(menuOpacity.value, [0, 1], [0.3, 1]) },
      ],
    }),
    []
  );

  const modalStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: modalScale.value }],
      opacity: modalScale.value,
    }),
    []
  );

  // Dynamic positioning based on language
  const toolbarPosition = useMemo(
    () => ({
      bottom: insets.bottom + 100, // Position above tab bar
      [isRTL ? "left" : "right"]: 24,
    }),
    [insets.bottom, isRTL]
  );

  // Panel positioning
  const panelPosition = useMemo(
    () => ({
      top: 50,
      [isRTL ? "left" : "right"]: 20,
      width: Math.min(320, screenWidth - 40),
    }),
    [isRTL]
  );

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
          pointerEvents="auto"
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={handleToggleMenu}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* Main Container */}
      <View style={[styles.container, toolbarPosition]}>
        {/* Menu Items */}
        <Animated.View style={[styles.menuContainer, menuContainerStyle]}>
          {/* Language Button */}
          <AnimatedTouchableOpacity
            style={[styles.menuButton, button1Style]}
            onPress={handleLanguageToggle}
            activeOpacity={0.8}
          >
            <BlurView intensity={80} style={styles.blurButton}>
              <LinearGradient
                colors={[`${colors.primary}20`, `${colors.primary}15`]}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.iconContainer}>
                  <Globe size={18} color={Colors.dark.text} strokeWidth={2.5} />
                </View>
                <Text
                  style={[
                    styles.buttonLabel,
                    {
                      color: colors.primary,
                    },
                  ]}
                >
                  {language === "he" ? "EN" : "עב"}
                </Text>
              </LinearGradient>
            </BlurView>
          </AnimatedTouchableOpacity>

          {/* Theme Button */}
          <AnimatedTouchableOpacity
            style={[styles.menuButton, button2Style]}
            onPress={handleThemeToggle}
            activeOpacity={0.8}
          >
            <BlurView intensity={80} style={styles.blurButton}>
              <LinearGradient
                colors={[`${colors.primary}20`, `${colors.primary}15`]}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.iconContainer}>
                  {isDark ? (
                    <Sun size={18} color={Colors.dark.text} strokeWidth={2.5} />
                  ) : (
                    <Moon
                      size={18}
                      color={Colors.dark.text}
                      strokeWidth={2.5}
                    />
                  )}
                </View>
              </LinearGradient>
            </BlurView>
          </AnimatedTouchableOpacity>

          {/* Help Button */}
          {helpContent && (
            <AnimatedTouchableOpacity
              style={[styles.menuButton, button3Style]}
              onPress={handleHelpPress}
              activeOpacity={0.8}
            >
              <BlurView intensity={80} style={styles.blurButton}>
                <LinearGradient
                  colors={[`${colors.primary}20`, `${colors.primary}15`]}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.iconContainer}>
                    <HelpCircle
                      size={18}
                      color={Colors.dark.text}
                      strokeWidth={2.5}
                    />
                  </View>
                </LinearGradient>
              </BlurView>
            </AnimatedTouchableOpacity>
          )}
        </Animated.View>

        {/* Main FAB */}
        <AnimatedTouchableOpacity
          style={[styles.fab, fabStyle]}
          onPress={handleToggleMenu}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primary, `${colors.primary}E6`]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <BlurView intensity={25} style={styles.fabBlur}>
              {isExpanded ? (
                <X size={24} color="#FFFFFF" strokeWidth={3} />
              ) : (
                <Settings size={24} color="#FFFFFF" strokeWidth={3} />
              )}
            </BlurView>
          </LinearGradient>
        </AnimatedTouchableOpacity>
      </View>

      {/* Help Modal */}
      <Modal
        visible={showHelp}
        transparent
        animationType="none"
        onRequestClose={handleCloseHelp}
        statusBarTranslucent={false}
      >
        <BlurView intensity={100} style={styles.modalContainer}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={handleCloseHelp}
            activeOpacity={1}
          />

          <Animated.View
            style={[
              styles.modalContent,
              modalStyle,
              {
                position: 'absolute',
                top: 50,
                [isRTL ? 'left' : 'right']: 20,
                width: Math.min(320, screenWidth - 40),
                maxHeight: '70%',
              }
            ]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(30,30,30,0.95)", "rgba(20,20,20,0.98)"]
                  : ["rgba(255,255,255,0.95)", "rgba(250,250,250,0.98)"]
              }
              style={styles.modalGradient}
            >
              {/* Modal Header */}
              <View
                style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}
              >
                <View
                  style={[
                    styles.modalTitleContainer,
                    isRTL && styles.modalTitleContainerRTL,
                  ]}
                >
                  <HelpCircle size={24} color={colors.primary} />
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: colors.text },
                      isRTL && styles.rtlText,
                    ]}
                  >
                    {helpContent?.title || "Help"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCloseHelp}
                  style={[
                    styles.closeButton,
                    { backgroundColor: `${colors.primary}15` },
                  ]}
                  activeOpacity={0.7}
                >
                  <X size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Modal Body */}
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalBodyContent}
              >
                {helpContent ? (
                  <View>
                    <Text
                      style={[
                        styles.modalText,
                        { color: colors.text },
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {helpContent.description}
                    </Text>
                    
                    {/* Additional help sections */}
                    <View style={styles.helpSection}>
                      <Text style={[styles.helpSectionTitle, { color: colors.text }]}>
                        Quick Tips:
                      </Text>
                      <Text style={[styles.helpSectionText, { color: colors.text }]}>
                        • Use the camera to scan meals for nutrition analysis
                        • Track your water intake daily for better health
                        • Complete your questionnaire for personalized recommendations
                        • Check your statistics to monitor progress
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noHelpContent}>
                    <Text style={[styles.modalText, { color: colors.text }]}>
                      Help content is loading...
                    </Text>
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </Animated.View>
        </BlurView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    zIndex: 998,
  },
  container: {
    position: "absolute",
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: {
    backgroundColor: `${EmeraldSpectrum.emerald500}`,
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  blurButton: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
  },
  gradientButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 8,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  buttonLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  fabGradient: {
    flex: 1,
    borderRadius: 32,
  },
  fabBlur: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    maxWidth: 420,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 30,
  },
  modalGradient: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeaderRTL: {
    flexDirection: "row-reverse",
  },
  modalTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalTitleContainerRTL: {
    flexDirection: "row-reverse",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 24,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  helpSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  helpSectionText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  noHelpContent: {
    padding: 20,
    alignItems: "center",
  },
});

export default ToolBar;
