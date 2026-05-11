import ShareExerciseCard from "@/components/exercise/ShareExerciseCard";
import { Colors } from "@/constants/Colors";
import { ExerciseLogWithIdSchema } from "@/types/types";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { z } from "zod";
import LogoIcon from "../LogoIcon";

type ExerciseLog = z.infer<typeof ExerciseLogWithIdSchema>;

type ShareDayModalProps = {
  visible: boolean;
  onClose: () => void;
  logs: ExerciseLog[];
  date: string;
};

export default function ShareDayModal({
  visible,
  onClose,
  logs,
  date,
}: ShareDayModalProps) {
  const theme = useColorScheme() ?? "light";
  const palette = Colors[theme];
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const totalSets = logs.reduce(
    (acc, log) => acc + log.sets.filter((s) => s.setType === "normal").length,
    0,
  );

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      setIsSharing(true);
      const uri = await captureRef(cardRef, { format: "png", quality: 0.95 });
      await Share.share({ url: uri });
    } catch {
      // cancelled or failed — still close
    } finally {
      setIsSharing(false);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      >
        <View
          className="rounded-t-3xl pt-3 pb-8 px-5 max-h-[92%]"
          style={{ backgroundColor: palette.background }}
        >
          {/* Drag handle */}
          <View className="items-center mb-5">
            <View
              className="w-10 h-1 rounded-full"
              style={{ backgroundColor: palette.separator }}
            />
          </View>

          {/* Modal header */}
          <View className="flex-row items-center justify-between mb-5">
            <View>
              <Text className="text-xl font-bold" style={{ color: palette.text }}>
                Share your day
              </Text>
              <Text className="text-sm" style={{ color: palette.mutedText }}>
                {date}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: palette.inputBackground }}
            >
              <Feather name="x" size={16} color={palette.mutedText} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Captured share card */}
            <View
              ref={cardRef}
              collapsable={false}
              className="rounded-3xl overflow-hidden"
              style={{ backgroundColor: palette.elevation }}
            >
              {/* Hero header */}
              <View
                className="px-5 pt-5 pb-6 overflow-hidden"
                style={{ backgroundColor: palette.highlight }}
              >
                <View
                  pointerEvents="none"
                  className="absolute -right-8 -top-8 w-36 h-36 rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                />
                <View
                  pointerEvents="none"
                  className="absolute -right-2 top-10 w-16 h-16 rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
                />

                <View className="flex-row items-center gap-1 mb-5">
                  <LogoIcon size={28} color="rgba(255,255,255,0.9)" />
                  <Text className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                    ercule
                  </Text>
                </View>

                <View className="flex-row gap-6">
                  <View>
                    <Text className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
                      {logs.length}
                    </Text>
                    <Text
                      className="text-xs font-semibold tracking-widest uppercase mt-0.5"
                      style={{ color: "rgba(255,255,255,0.65)" }}
                    >
                      {logs.length === 1 ? "exercise" : "exercises"}
                    </Text>
                  </View>
                  <View
                    className="w-px self-stretch"
                    style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                  />
                  <View>
                    <Text className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
                      {totalSets}
                    </Text>
                    <Text
                      className="text-xs font-semibold tracking-widest uppercase mt-0.5"
                      style={{ color: "rgba(255,255,255,0.65)" }}
                    >
                      {totalSets === 1 ? "set" : "sets"}
                    </Text>
                  </View>
                </View>

                <Text className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {date}
                </Text>
              </View>

              {/* Exercise list */}
              <View className="px-5 pt-4 pb-2">
                {logs.map((log) => (
                  <ShareExerciseCard key={log.id} exercise={log} />
                ))}
              </View>

              {/* Footer */}
              <View
                className="flex-row items-center justify-center gap-1.5 py-3"
                style={{ borderTopWidth: 1, borderTopColor: palette.cardBorderColor }}
              >
                <LogoIcon size={13} color={palette.mutedText} />
                <Text className="text-xs tracking-widest" style={{ color: palette.mutedText }}>
                  Logged with Hercule
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Share action */}
          <TouchableOpacity
            onPress={handleShare}
            disabled={isSharing}
            className="flex-row items-center justify-center gap-2 rounded-2xl py-4 mb-3 mt-2"
            style={{
              backgroundColor: palette.highlight,
              opacity: isSharing ? 0.6 : 1,
            }}
          >
            <Feather name="upload" size={18} color="#FFFFFF" />
            <Text className="text-base font-semibold" style={{ color: "#FFFFFF" }}>
              {isSharing ? "Sharing..." : "Share"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} className="items-center py-2">
            <Text className="text-base" style={{ color: palette.mutedText }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
