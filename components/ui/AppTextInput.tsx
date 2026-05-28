import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { forwardRef, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";

type AppTextInputProps = TextInputProps;

const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
  function AppTextInput(
    { style, className, onFocus, onBlur, ...props },
    ref,
  ) {
    const theme = useColorScheme() ?? "light";
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus: TextInputProps["onFocus"] = (e) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur: TextInputProps["onBlur"] = (e) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <TextInput
        ref={ref}
        className={`p-3 rounded-xl ${className ?? ""}`}
        style={[
          {
            backgroundColor: Colors[theme].inputBackground,
            borderWidth: 2,
            borderColor: isFocused ? Colors[theme].highlight : "transparent",
            color: Colors[theme].text,
          },
          style,
        ]}
        placeholderTextColor={Colors[theme].mutedText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);

export default AppTextInput;
