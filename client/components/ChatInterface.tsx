import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  MessageCircle,
  Send,
  X,
  ChefHat,
  Sparkles,
  Clock,
  Utensils,
  Heart,
  Zap,
  Apple,
  Coffee,
} from "lucide-react-native";
import { useTheme } from "@/src/context/ThemeContext";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { useTranslation } from "react-i18next";
import { chatAPI } from "@/src/services/api";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  suggestions?: string[];
}

interface ChatInterfaceProps {
  children: React.ReactNode;
}

export default function ChatInterface({ children }: ChatInterfaceProps) {
  const { colors, isDark } = useTheme();
  const { isRTL } = useLanguage();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text:
        t("ai_chat.welcome_message") ||
        "שלום! אני כאן לעזור לך לבחור מה לאכול. ספר לי על ההעדפות שלך, הדיאטה שלך, או פשוט שאל אותי מה מומלץ לאכול עכשיו! 🍽️",
      isUser: false,
      timestamp: new Date(),
      suggestions: [
        t("ai_chat.suggestion_breakfast") || "מה מומלץ לארוחת בוקר?",
        t("ai_chat.suggestion_healthy") || "אני רוצה משהו בריא",
        t("ai_chat.suggestion_quick") || "יש לי 30 דקות לבישול",
        t("ai_chat.suggestion_vegetarian") || "אני צמחוני",
      ],
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const translateX = useRef(new Animated.Value(screenWidth)).current;
  const swipeProgress = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const chatIconScale = useRef(new Animated.Value(1)).current;

  // Enhanced pulse animation
  useEffect(() => {
    const pulseAnimation = () => {
      Animated.sequence([
        Animated.timing(chatIconScale, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(chatIconScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(pulseAnimation, 4000);
      });
    };

    const timer = setTimeout(pulseAnimation, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Enhanced pan responder with RTL support
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const edgeThreshold = 60;
        const startX = isRTL ? screenWidth - edgeThreshold : 0;
        const endX = isRTL ? screenWidth : edgeThreshold;

        return (
          evt.nativeEvent.pageX >= startX &&
          evt.nativeEvent.pageX <= endX &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          (isRTL ? gestureState.dx < -10 : gestureState.dx > 10)
        );
      },
      onPanResponderGrant: () => {
        // Start tracking the swipe
      },
      onPanResponderMove: (evt, gestureState) => {
        const dx = isRTL ? -gestureState.dx : gestureState.dx;
        if (dx > 0) {
          const progress = Math.min(dx / (screenWidth * 0.3), 1);
          swipeProgress.setValue(progress);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const dx = isRTL ? -gestureState.dx : gestureState.dx;
        const shouldOpen = dx > screenWidth * 0.15 && dx > 0;

        if (shouldOpen) {
          openChat();
        } else {
          Animated.spring(swipeProgress, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const openChat = () => {
    setIsOpen(true);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(swipeProgress, {
        toValue: 0,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const closeChat = () => {
    Animated.spring(translateX, {
      toValue: isRTL ? -screenWidth : screenWidth,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setIsOpen(false);
    });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Send message to AI chat API
    try {
      const response = await chatAPI.sendMessage(
        text.trim(),
        isRTL ? "hebrew" : "english"
      );

      if (response.success && response.response) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response.response.response || response.response,
          isUser: false,
          timestamp: new Date(),
          suggestions: isRTL
            ? ["איך מכינים קינואה?", "אפשרויות חלבון", "עוד רעיונות לסלטים"]
            : ["How to prepare quinoa?", "Protein options", "More salad ideas"],
        };

        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (error) {
      console.error("💥 Chat API error:", error);
      
      // Fallback response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: isRTL
          ? "מצטער, אירעה שגיאה. אנא נסה שוב."
          : "Sorry, there was an error. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const dynamicStyles = createChatStyles(colors, isDark, isRTL);

  return (
    <View style={dynamicStyles.container}>
      {/* Main content with enhanced pan responder */}
      <View style={dynamicStyles.mainContent} {...panResponder.panHandlers}>
        {children}
      </View>

      {/* Enhanced floating chat icon */}
      <Animated.View
        style={[
          dynamicStyles.floatingChatIcon,
          {
            transform: [{ scale: chatIconScale }],
            [isRTL ? "left" : "right"]: 20,
          },
        ]}
      >
        <TouchableOpacity
          style={dynamicStyles.chatIconButton}
          onPress={openChat}
          activeOpacity={0.8}
          accessibilityLabel={t("tabs.ai_chat")}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[colors.emerald500, colors.emerald600]}
            style={dynamicStyles.chatIconGradient}
          >
            <MessageCircle size={32} color="#FFFFFF" strokeWidth={2.5} />
            <View style={dynamicStyles.chatIconBadge}>
              <ChefHat size={14} color={colors.emerald600} strokeWidth={2} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Enhanced swipe indicator with RTL support */}
      <Animated.View
        style={[
          dynamicStyles.swipeIndicator,
          {
            opacity: swipeProgress,
            transform: [
              {
                scale: swipeProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.2],
                }),
              },
              {
                translateX: swipeProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isRTL ? 50 : -50, 0],
                }),
              },
            ],
            [isRTL ? "right" : "left"]: 20,
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[colors.emerald500, colors.emerald600]}
          style={dynamicStyles.swipeIndicatorGradient}
        >
          <MessageCircle size={28} color="#FFFFFF" strokeWidth={2} />
          <Text
            style={[
              dynamicStyles.swipeIndicatorText,
              isRTL && dynamicStyles.rtlText,
            ]}
          >
            {isRTL ? "החלק שמאלה לצ'אט" : "Swipe right to chat"}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* Enhanced Chat Interface */}
      {isOpen && (
        <Animated.View
          style={[
            dynamicStyles.chatContainer,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.background, colors.surface]}
            style={dynamicStyles.chatGradient}
          >
            <SafeAreaView style={dynamicStyles.chatSafeArea}>
              {/* Enhanced Chat Header */}
              <View style={dynamicStyles.chatHeader}>
                <LinearGradient
                  colors={[
                    colors.background,
                    isDark
                      ? "rgba(30, 41, 59, 0.95)"
                      : "rgba(255, 255, 255, 0.95)",
                  ]}
                  style={dynamicStyles.chatHeaderGradient}
                >
                  <View
                    style={[
                      dynamicStyles.chatHeaderLeft,
                      isRTL && dynamicStyles.rtlRow,
                    ]}
                  >
                    <View style={dynamicStyles.chatIconContainer}>
                      <LinearGradient
                        colors={[colors.emerald500, colors.emerald600]}
                        style={dynamicStyles.chatHeaderIconGradient}
                      >
                        <ChefHat size={24} color="#FFFFFF" strokeWidth={2} />
                      </LinearGradient>
                    </View>
                    <View
                      style={[
                        dynamicStyles.chatHeaderTextContainer,
                        isRTL && dynamicStyles.rtlAlign,
                      ]}
                    >
                      <Text
                        style={[
                          dynamicStyles.chatTitle,
                          { color: colors.text },
                          isRTL && dynamicStyles.rtlText,
                        ]}
                      >
                        {t("ai_chat.title")}
                      </Text>
                      <Text
                        style={[
                          dynamicStyles.chatSubtitle,
                          { color: colors.textSecondary },
                          isRTL && dynamicStyles.rtlText,
                        ]}
                      >
                        {t("ai_chat.subtitle") || "מה נאכל היום?"}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={dynamicStyles.closeButton}
                    onPress={closeChat}
                    accessibilityLabel={t("common.close")}
                    accessibilityRole="button"
                  >
                    <X size={24} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                </LinearGradient>
              </View>

              {/* Enhanced Messages */}
              <ScrollView
                ref={scrollViewRef}
                style={dynamicStyles.messagesContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={dynamicStyles.messagesContent}
              >
                {messages.map((message) => (
                  <View key={message.id} style={dynamicStyles.messageWrapper}>
                    <View
                      style={[
                        dynamicStyles.messageBubble,
                        message.isUser
                          ? dynamicStyles.userMessage
                          : dynamicStyles.botMessage,
                        isRTL &&
                          (message.isUser
                            ? dynamicStyles.userMessageRTL
                            : dynamicStyles.botMessageRTL),
                      ]}
                    >
                      {!message.isUser && (
                        <View style={dynamicStyles.botIconContainer}>
                          <Sparkles
                            size={16}
                            color={colors.emerald600}
                            strokeWidth={2}
                          />
                        </View>
                      )}
                      <Text
                        style={[
                          dynamicStyles.messageText,
                          message.isUser
                            ? dynamicStyles.userMessageText
                            : dynamicStyles.botMessageText,
                          { color: message.isUser ? "#FFFFFF" : colors.text },
                          isRTL && dynamicStyles.rtlText,
                        ]}
                      >
                        {message.text}
                      </Text>
                      <Text
                        style={[
                          dynamicStyles.messageTime,
                          message.isUser
                            ? dynamicStyles.userMessageTime
                            : dynamicStyles.botMessageTime,
                          isRTL && dynamicStyles.rtlText,
                        ]}
                      >
                        {message.timestamp.toLocaleTimeString(
                          isRTL ? "he-IL" : "en-US",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </Text>
                    </View>

                    {/* Enhanced Suggestions */}
                    {message.suggestions && (
                      <View
                        style={[
                          dynamicStyles.suggestionsContainer,
                          isRTL && dynamicStyles.suggestionsContainerRTL,
                        ]}
                      >
                        {message.suggestions.map((suggestion, index) => (
                          <TouchableOpacity
                            key={index}
                            style={dynamicStyles.suggestionButton}
                            onPress={() => handleSuggestionPress(suggestion)}
                            activeOpacity={0.8}
                          >
                            <LinearGradient
                              colors={[colors.emerald50, colors.emerald500]}
                              style={dynamicStyles.suggestionGradient}
                            >
                              <Text
                                style={[
                                  dynamicStyles.suggestionText,
                                  { color: colors.emerald700 },
                                  isRTL && dynamicStyles.rtlText,
                                ]}
                              >
                                {suggestion}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))}

                {/* Enhanced typing indicator */}
                {isTyping && (
                  <View
                    style={[
                      dynamicStyles.typingContainer,
                      isRTL && dynamicStyles.typingContainerRTL,
                    ]}
                  >
                    <View style={dynamicStyles.typingBubble}>
                      <View style={dynamicStyles.typingDots}>
                        <Animated.View
                          style={[
                            dynamicStyles.typingDot,
                            { backgroundColor: colors.emerald500 },
                          ]}
                        />
                        <Animated.View
                          style={[
                            dynamicStyles.typingDot,
                            { backgroundColor: colors.emerald500 },
                          ]}
                        />
                        <Animated.View
                          style={[
                            dynamicStyles.typingDot,
                            { backgroundColor: colors.emerald500 },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Enhanced Input Area */}
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={dynamicStyles.inputContainer}
              >
                <LinearGradient
                  colors={[colors.background, colors.surface]}
                  style={dynamicStyles.inputGradient}
                >
                  <View
                    style={[
                      dynamicStyles.inputWrapper,
                      isRTL && dynamicStyles.inputWrapperRTL,
                    ]}
                  >
                    <TextInput
                      style={[
                        dynamicStyles.textInput,
                        {
                          color: colors.text,
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                        isRTL && dynamicStyles.rtlTextInput,
                      ]}
                      value={inputText}
                      onChangeText={setInputText}
                      placeholder={
                        t("ai_chat.type_message") || "שאל אותי מה לאכול..."
                      }
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      maxLength={500}
                      textAlign={isRTL ? "right" : "left"}
                      onSubmitEditing={() => sendMessage(inputText)}
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity
                      style={[
                        dynamicStyles.sendButton,
                        (!inputText.trim() || isTyping) &&
                          dynamicStyles.sendButtonDisabled,
                      ]}
                      onPress={() => sendMessage(inputText)}
                      disabled={!inputText.trim() || isTyping}
                      accessibilityLabel={t("common.send")}
                    >
                      <LinearGradient
                        colors={
                          inputText.trim() && !isTyping
                            ? [colors.emerald500, colors.emerald600]
                            : [colors.textSecondary, colors.textSecondary]
                        }
                        style={dynamicStyles.sendButtonGradient}
                      >
                        <Send size={20} color="#FFFFFF" strokeWidth={2} />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {/* Enhanced quick actions with RTL support */}
                  <View
                    style={[
                      dynamicStyles.quickActions,
                      isRTL && dynamicStyles.quickActionsRTL,
                    ]}
                  >
                    <TouchableOpacity
                      style={dynamicStyles.quickAction}
                      onPress={() =>
                        sendMessage(
                          t("ai_chat.suggestion_breakfast") ||
                            "מה מומלץ לארוחת בוקר?"
                        )
                      }
                    >
                      <Coffee
                        size={16}
                        color={colors.emerald600}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          dynamicStyles.quickActionText,
                          { color: colors.emerald600 },
                          isRTL && dynamicStyles.rtlText,
                        ]}
                      >
                        {t("ai_chat.breakfast") || "ארוחת בוקר"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={dynamicStyles.quickAction}
                      onPress={() =>
                        sendMessage(
                          t("ai_chat.suggestion_quick") || "משהו מהיר להכנה"
                        )
                      }
                    >
                      <Clock
                        size={16}
                        color={colors.emerald600}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          dynamicStyles.quickActionText,
                          { color: colors.emerald600 },
                          isRTL && dynamicStyles.rtlText,
                        ]}
                      >
                        {t("ai_chat.quick") || "מהיר"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={dynamicStyles.quickAction}
                      onPress={() =>
                        sendMessage(
                          t("ai_chat.suggestion_healthy") || "משהו בריא ומזין"
                        )
                      }
                    >
                      <Heart
                        size={16}
                        color={colors.emerald600}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          dynamicStyles.quickActionText,
                          { color: colors.emerald600 },
                          isRTL && dynamicStyles.rtlText,
                        ]}
                      >
                        {t("ai_chat.healthy") || "בריא"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={dynamicStyles.quickAction}
                      onPress={() =>
                        sendMessage(
                          t("ai_chat.suggestion_snacks") || "רעיונות לחטיפים"
                        )
                      }
                    >
                      <Apple
                        size={16}
                        color={colors.emerald600}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          dynamicStyles.quickActionText,
                          { color: colors.emerald600 },
                          isRTL && dynamicStyles.rtlText,
                        ]}
                      >
                        {t("ai_chat.snacks") || "חטיפים"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

const createChatStyles = (colors: any, isDark: boolean, isRTL: boolean) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    mainContent: {
      flex: 1,
    },
    floatingChatIcon: {
      position: "absolute",
      bottom: 120,
      zIndex: 999,
    },
    chatIconButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      overflow: "hidden",
      elevation: 16,
      shadowColor: colors.emerald600,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
    },
    chatIconGradient: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      borderWidth: 4,
      borderColor: colors.background,
    },
    chatIconBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    swipeIndicator: {
      position: "absolute",
      top: "50%",
      marginTop: -50,
      borderRadius: 25,
      overflow: "hidden",
      elevation: 12,
      shadowColor: colors.emerald600,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
    },
    swipeIndicatorGradient: {
      paddingHorizontal: 24,
      paddingVertical: 20,
      alignItems: "center",
      gap: 12,
      borderWidth: 2,
      borderColor: "rgba(255, 255, 255, 0.2)",
    },
    swipeIndicatorText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#FFFFFF",
      textAlign: "center",
      letterSpacing: 0.3,
    },
    chatContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    },
    chatGradient: {
      flex: 1,
    },
    chatSafeArea: {
      flex: 1,
    },
    chatHeader: {
      borderBottomWidth: 1,
      borderBottomColor: isDark
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.05)",
    },
    chatHeaderGradient: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 20,
      backdropFilter: "blur(20px)",
    },
    chatHeaderLeft: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      flex: 1,
      gap: 16,
    },
    rtlRow: {
      flexDirection: "row-reverse",
    },
    rtlAlign: {
      alignItems: isRTL ? "flex-end" : "flex-start",
    },
    rtlText: {
      textAlign: isRTL ? "right" : "left",
      writingDirection: isRTL ? "rtl" : "ltr",
    },
    chatIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 26,
      overflow: "hidden",
      shadowColor: colors.emerald600,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    chatHeaderIconGradient: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    chatHeaderTextContainer: {
      flex: 1,
    },
    chatTitle: {
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
    },
    chatSubtitle: {
      fontSize: 14,
      fontWeight: "500",
      marginTop: 2,
      opacity: 0.8,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.05)",
      justifyContent: "center",
      alignItems: "center",
    },
    messagesContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    messagesContent: {
      padding: 20,
      paddingBottom: 40,
    },
    messageWrapper: {
      marginBottom: 20,
    },
    messageBubble: {
      maxWidth: "85%",
      borderRadius: 24,
      padding: 16,
      position: "relative",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    userMessage: {
      backgroundColor: colors.emerald600,
      alignSelf: "flex-end",
      borderBottomRightRadius: 8,
    },
    userMessageRTL: {
      alignSelf: "flex-start",
      borderBottomRightRadius: 24,
      borderBottomLeftRadius: 8,
    },
    botMessage: {
      backgroundColor: colors.card,
      alignSelf: "flex-start",
      borderBottomLeftRadius: 8,
      paddingTop: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    botMessageRTL: {
      alignSelf: "flex-end",
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 8,
    },
    botIconContainer: {
      position: "absolute",
      top: -8,
      left: isRTL ? undefined : 16,
      right: isRTL ? 16 : undefined,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.emerald100,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    messageText: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "400",
    },
    userMessageText: {
      color: "#FFFFFF",
    },
    botMessageText: {
      color: colors.text,
    },
    messageTime: {
      fontSize: 12,
      marginTop: 8,
      opacity: 0.7,
    },
    userMessageTime: {
      color: "rgba(255,255,255,0.8)",
      textAlign: isRTL ? "left" : "right",
    },
    botMessageTime: {
      color: colors.textSecondary,
      textAlign: isRTL ? "right" : "left",
    },
    suggestionsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 16,
      alignSelf: "flex-start",
    },
    suggestionsContainerRTL: {
      alignSelf: "flex-end",
    },
    suggestionButton: {
      borderRadius: 20,
      overflow: "hidden",
      shadowColor: colors.emerald600,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    suggestionGradient: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.emerald200,
    },
    suggestionText: {
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    typingContainer: {
      alignSelf: "flex-start",
      marginBottom: 20,
    },
    typingContainerRTL: {
      alignSelf: "flex-end",
    },
    typingBubble: {
      backgroundColor: colors.card,
      borderRadius: 24,
      borderBottomLeftRadius: isRTL ? 24 : 8,
      borderBottomRightRadius: isRTL ? 8 : 24,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    typingDots: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
    },
    typingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    inputContainer: {
      borderTopWidth: 1,
      borderTopColor: isDark
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.05)",
    },
    inputGradient: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 24,
      backdropFilter: "blur(20px)",
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 12,
      marginBottom: 16,
    },
    inputWrapperRTL: {
      flexDirection: "row-reverse",
    },
    textInput: {
      flex: 1,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 16,
      fontSize: 16,
      maxHeight: 120,
      borderWidth: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    rtlTextInput: {
      textAlign: "right",
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: "hidden",
      shadowColor: colors.emerald600,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    sendButtonDisabled: {
      opacity: 0.5,
      shadowOpacity: 0.1,
    },
    sendButtonGradient: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    quickActions: {
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    quickActionsRTL: {
      flexDirection: "row-reverse",
    },
    quickAction: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.emerald50,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.emerald200,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    quickActionText: {
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
  });
};
