import GetExerciseCard from "@/components/exercise/GetExerciseCard";
import { Colors } from "@/constants/Colors";
import { ExerciseLogWithIdSchema } from "@/types/types";
import React, { useRef, useState } from "react";
import { Modal, ScrollView, Share, Text, View, useColorScheme } from "react-native";
import { captureRef } from "react-native-view-shot";
import { z } from "zod";
import { Button } from "../Button";
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

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      setIsSharing(true);
      const uri = await captureRef(cardRef, { format: "png", quality: 0.95 });
      await Share.share({ url: uri });
    } catch {
      // share cancelled or failed — still close
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
        style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      >
        <View
          className="rounded-t-3xl p-6 max-h-[90%]"
          style={{ backgroundColor: palette.background }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* This view is captured as the shared image */}
            <View
              ref={cardRef}
              collapsable={false}
              className="mb-4 py-2"
              style={{ backgroundColor: palette.background }}
            >
              <View className="flex-row items-center mb-1">
                <LogoIcon size={26} color={palette.highlight} />
                <Text
                  className="text-xl font-bold ml-1.5"
                  style={{ color: palette.highlight }}
                >
                  ercule
                </Text>
              </View>

              <Text className="text-sm mb-4" style={{ color: palette.mutedText }}>
                {date}
              </Text>

              {logs.map((log, index) => (
                <GetExerciseCard key={log.id} exercise={log} index={index} />
              ))}

              <Text
                className="text-xs text-center tracking-widest mt-2"
                style={{ color: palette.mutedText }}
              >
                Logged with Hercule
              </Text>
            </View>
          </ScrollView>

          <View className="flex-row gap-3 pt-1">
            <View className="flex-1">
              <Button type="primary" onPress={handleShare} disabled={isSharing}>
                {isSharing ? "Sharing..." : "Share"}
              </Button>
            </View>
            <View className="flex-1">
              <Button type="default" onPress={onClose}>
                Cancel
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
