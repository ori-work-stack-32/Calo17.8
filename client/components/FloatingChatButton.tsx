import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Vibration,
  PanResponder,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageCircle, Minus, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AIChatScreen from "../app/(tabs)/ai-chat";

// Clean constants
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const BUTTON_SIZE = 60;
const EDGE_MARGIN = 20;

// Smooth animations
const ANIMATIONS = {
  spring: {
    tension: 300,
    friction: 20,
    useNativeDriver: true,
  },
  timing: {
    duration: 150,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  },
} as const;

// Updated colors with emerald
const COLORS = {
  glass: "rgba(16, 185, 129, 0.3)", // emerald with transparency
  glassStroke: "rgba(255, 255, 255, 0.3)",
  backdrop: "rgba(6, 78, 59, 0.1)", // dark emerald
  emerald: "#10b981", // emerald-500
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray600: "#4b5563",
  gray900: "#111827",
} as const;

export default function FloatingChatButton() {
  const insets = useSafeAreaInsets();

  // State
  const [showChat, setShowChat] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [snapSide, setSnapSide] = useState<"left" | "right">("right");

  // Animation refs
  const pan = useRef(new Animated.ValueXY()).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Calculate initial position
  const initialPosition = useMemo(() => {
    const safeBottom = insets.bottom + 100;
    const safeTop = insets.top + 80;
    const centerY = (screenHeight - safeBottom - safeTop) / 2;

    return {
      x: screenWidth - EDGE_MARGIN - BUTTON_SIZE,
      y: centerY,
    };
  }, [insets]);

  // Set initial position
  useEffect(() => {
    pan.setOffset(initialPosition);
  }, [initialPosition]);

  // Pan responder
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },

      onPanResponderGrant: () => {
        setIsDragging(true);

        if (Platform.OS === "ios") {
          Vibration.vibrate([10]);
        }

        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1.05,
            ...ANIMATIONS.spring,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.9,
            ...ANIMATIONS.timing,
          }),
        ]).start();
      },

      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),

      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);

        const currentX = pan.x._offset + gestureState.dx;
        const currentY = pan.y._offset + gestureState.dy;

        const snapToLeft = currentX < screenWidth / 2;
        const newSnapSide = snapToLeft ? "left" : "right";
        setSnapSide(newSnapSide);

        const snapX = snapToLeft
          ? EDGE_MARGIN
          : screenWidth - EDGE_MARGIN - BUTTON_SIZE;

        const minY = insets.top + 60;
        const maxY = screenHeight - insets.bottom - BUTTON_SIZE - 60;
        const snapY = Math.max(minY, Math.min(maxY, currentY));

        pan.setOffset({ x: currentX, y: currentY });
        pan.setValue({ x: 0, y: 0 });

        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: snapX - currentX, y: snapY - currentY },
            ...ANIMATIONS.spring,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            ...ANIMATIONS.spring,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            ...ANIMATIONS.timing,
          }),
        ]).start(() => {
          pan.setOffset({ x: snapX, y: snapY });
          pan.setValue({ x: 0, y: 0 });
        });
      },
    });
  }, [pan, scaleAnim, opacityAnim, insets]);

  // Press handler
  const handlePress = useCallback(() => {
    if (isDragging) return;

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...ANIMATIONS.spring,
      }),
    ]).start();

    if (Platform.OS === "ios") {
      Vibration.vibrate([30]);
    }

    setShowChat(true);
  }, [isDragging, scaleAnim]);

  const handleClose = useCallback(() => {
    setShowChat(false);
  }, []);

  const handleMinimize = useCallback(() => {
    setShowChat(false);
  }, []);

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scaleAnim },
            ],
            opacity: opacityAnim,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.button}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View style={styles.glassEffect} />
          <MessageCircle size={26} color={COLORS.white} strokeWidth={2} />
        </TouchableOpacity>
      </Animated.View>

      {showChat && (
        <Modal
          visible={showChat}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handleClose}
          statusBarTranslucent={true}
        >
          <SafeAreaView style={styles.modalContainer}>
            <AIChatScreen onClose={handleClose} onMinimize={handleMinimize} />
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  glassEffect: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassStroke,
    shadowColor: COLORS.backdrop,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
});
